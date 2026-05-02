import 'server-only';
import { createClient } from '@/app/lib/supabase/server';
import { getCurrentUserContext, normalizeRole } from '@/app/lib/authz';
import {
  resolveLeaderScope,
  isPrivilegedRole,
} from './leaderScope';
import type {
  AccessGroupItem,
  LeaderAccessInfo,
  LeaderAccessStatus,
  LeaderAccessModule,
} from './leaderScope';

// Re-export shared types and functions for convenience
export type { AccessGroupItem, LeaderScopeFilter, LeaderAccessStatus, LeaderAccessInfo, LeaderAccessModule } from './leaderScope';
export { resolveLeaderScope, isPrivilegedRole } from './leaderScope';

// --- Access status queries ---

/**
 * Get the leader's current access status for a module.
 * Returns the full access info: hasAccess, status, group names, and resolved scope filter.
 */
export async function getLeaderAccessStatus(
  userId: string,
  module: LeaderAccessModule,
): Promise<LeaderAccessInfo> {
  const supabase = await createClient();

  // Prioritize approved: check for any approved request (module-specific or 'all') first
  const { data: approvedReq, error: approvedError } = await supabase
    .from('leader_access_requests')
    .select('id, status')
    .eq('leader_user_id', userId)
    .in('module', [module, 'all'])
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (approvedError) {
    console.error('[leaderAccess] Error fetching approved status:', approvedError.message);
    return { hasAccess: false, status: 'none', accessGroups: [], scopeFilter: {} };
  }

  if (approvedReq) {
    // Approved: resolve scope
    const scopeItems = await getLeaderApprovedScopeItems(userId, module);
    const scopeFilter = resolveLeaderScope(module, scopeItems);

    const { data: groupRows } = await supabase
      .from('leader_access_request_groups')
      .select('access_group_id')
      .eq('request_id', approvedReq.id);

    const groupIds = (groupRows || []).map((r) => r.access_group_id);
    let groupNames: string[] = [];
    if (groupIds.length > 0) {
      const { data: groups } = await supabase
        .from('access_groups')
        .select('name')
        .in('id', groupIds)
        .eq('is_active', true);
      groupNames = (groups || []).map((g) => g.name);
    }

    return {
      hasAccess: Object.keys(scopeFilter).length > 0,
      status: 'approved',
      accessGroups: groupNames,
      scopeFilter,
    };
  }

  // No approved request: check for other statuses
  const { data: otherReq, error: otherError } = await supabase
    .from('leader_access_requests')
    .select('id, status')
    .eq('leader_user_id', userId)
    .in('module', [module, 'all'])
    .in('status', ['pending', 'rejected', 'revoked'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (otherError) {
    console.error('[leaderAccess] Error fetching other status:', otherError.message);
    return { hasAccess: false, status: 'none', accessGroups: [], scopeFilter: {} };
  }

  if (!otherReq) {
    return { hasAccess: false, status: 'none', accessGroups: [], scopeFilter: {} };
  }

  const status = otherReq.status as LeaderAccessStatus;

  return { hasAccess: false, status, accessGroups: [], scopeFilter: {} };
}

/**
 * Get approved scope items for a leader + module using the security definer RPC.
 */
async function getLeaderApprovedScopeItems(
  userId: string,
  module: string,
): Promise<AccessGroupItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('get_leader_approved_scope_items', {
    p_leader_user_id: userId,
    p_module: module,
  });

  if (error) {
    console.error('[leaderAccess] Error fetching scope items via RPC:', error.message);
    return [];
  }

  if (!data) return [];

  return (data as Array<{ field_name: string; field_value: string }>).map((row) => ({
    id: '',
    access_group_id: '',
    field_name: row.field_name as AccessGroupItem['field_name'],
    field_value: row.field_value,
    is_active: true,
  }));
}

/**
 * Request module access for the current leader user.
 * Only creates a new request if no active (pending/approved) request exists.
 */
export async function requestLeaderModuleAccess(module: LeaderAccessModule): Promise<{
  success: boolean;
  message: string;
}> {
  const { user, profile, role } = await getCurrentUserContext();

  if (!user || !profile) {
    return { success: false, message: 'Anda harus login terlebih dahulu' };
  }

  const nRole = normalizeRole(role);
  if (nRole !== 'leader') {
    return { success: false, message: 'Hanya leader yang dapat mengajukan akses' };
  }

  const supabase = await createClient();

  // Check ALL existing active requests (use array, not maybeSingle)
  const { data: existingRows, error: checkError } = await supabase
    .from('leader_access_requests')
    .select('id, status, module')
    .eq('leader_user_id', user.id)
    .in('module', [module, 'all'])
    .in('status', ['pending', 'approved']);

  if (checkError) {
    console.error('[leaderAccess] Error checking existing request:', checkError.message);
    return { success: false, message: 'Gagal memeriksa status akses' };
  }

  const hasApproved = (existingRows || []).some((r) => r.status === 'approved');
  const hasPending = (existingRows || []).some((r) => r.status === 'pending');

  if (hasApproved) {
    return { success: false, message: 'Anda sudah memiliki akses yang disetujui untuk modul ini' };
  }
  if (hasPending) {
    return { success: false, message: 'Anda sudah memiliki permintaan akses yang sedang menunggu approval' };
  }

  // Create new request
  const { error: insertError } = await supabase
    .from('leader_access_requests')
    .insert({
      leader_user_id: user.id,
      module,
      status: 'pending',
    });

  if (insertError) {
    console.error('[leaderAccess] Error creating access request:', insertError.message);
    return { success: false, message: 'Gagal mengajukan permintaan akses' };
  }

  return { success: true, message: 'Permintaan akses berhasil diajukan' };
}

// --- Admin/Trainer helper: assert privileged access ---

/**
 * Assert the caller is admin or trainer. Throws on unauthorized access.
 */
export async function assertPrivilegedAccess(): Promise<{ userId: string }> {
  const { user, profile, role } = await getCurrentUserContext();

  if (!user || !profile) {
    throw new Error('Unauthenticated');
  }

  if (!isPrivilegedRole(role)) {
    throw new Error('Akses ditolak: Hanya admin dan trainer yang dapat mengelola akses');
  }

  return { userId: user.id };
}
