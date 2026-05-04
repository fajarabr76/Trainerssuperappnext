'use server';

import { createClient } from '@/app/lib/supabase/server';
import { assertPrivilegedAccess, requestLeaderModuleAccess } from '@/app/lib/access-control/leaderAccess.server';
import { SERVICE_LABELS, VALID_SERVICE_TYPES } from '@/app/(main)/qa-analyzer/lib/qa-types';

export { requestLeaderModuleAccess };

// --- Types for UI ---

export interface PendingLeaderRequest {
  id: string;
  leader_name: string;
  leader_email: string;
  module: string;
  created_at: string;
  status: string;
}

export interface ApprovedLeaderAccess {
  id: string;
  leader_name: string;
  leader_email: string;
  module: string;
  access_group_ids: string[];
  access_group_names: string[];
  approved_at: string;
}

export interface AccessGroupRow {
  id: string;
  name: string;
  description: string | null;
  scope_type: string;
  is_active: boolean;
  created_at: string;
  item_count: number;
}

export interface AccessGroupItemRow {
  id: string;
  access_group_id: string;
  field_name: string;
  field_value: string;
  is_active: boolean;
}

export interface AccessScopeAgentOption {
  id: string;
  name: string;
  team: string;
  batch_name: string | null;
}

export interface AccessScopeOptions {
  teams: string[];
  services: { value: string; label: string }[];
  agentsByTeam: Record<string, AccessScopeAgentOption[]>;
}

// --- Admin/Trainer: Get pending requests ---

export async function getPendingLeaderAccessRequests(): Promise<PendingLeaderRequest[]> {
  await assertPrivilegedAccess();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('leader_access_requests')
    .select(`
      id,
      module,
      status,
      created_at,
      profiles:leader_user_id (full_name, email)
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[leader-access] Error fetching pending requests:', error.message);
    return [];
  }

  return (data || []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    leader_name: (row.profiles as Record<string, string> | null)?.full_name ?? 'Unknown',
    leader_email: (row.profiles as Record<string, string> | null)?.email ?? '',
    module: row.module as string,
    created_at: row.created_at as string,
    status: row.status as string,
  }));
}

// --- Admin/Trainer: Get approved access list ---

export async function getApprovedLeaderAccessList(): Promise<ApprovedLeaderAccess[]> {
  await assertPrivilegedAccess();
  const supabase = await createClient();

  const { data: requests, error } = await supabase
    .from('leader_access_requests')
    .select(`
      id,
      module,
      status,
      updated_at,
      profiles:leader_user_id (full_name, email)
    `)
    .eq('status', 'approved')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[leader-access] Error fetching approved list:', error.message);
    return [];
  }

  if (!requests) return [];

  // Fetch group names and ids per request
  const requestIds = (requests as Array<{ id: string }>).map((r) => r.id);
  const { data: joinRows } = await supabase
    .from('leader_access_request_groups')
    .select('request_id, access_group_id')
    .in('request_id', requestIds);

  const { data: allGroups } = await supabase
    .from('access_groups')
    .select('id, name')
    .eq('is_active', true);

  const groupNameMap = new Map<string, string>();
  (allGroups || []).forEach((g: { id: string; name: string }) => groupNameMap.set(g.id, g.name));

  const requestGroupMap = new Map<string, string[]>();
  const requestGroupIdMap = new Map<string, string[]>();
  (joinRows || []).forEach((j: { request_id: string; access_group_id: string }) => {
    const name = groupNameMap.get(j.access_group_id);
    if (name) {
      const existing = requestGroupMap.get(j.request_id) || [];
      existing.push(name);
      requestGroupMap.set(j.request_id, existing);
      const existingIds = requestGroupIdMap.get(j.request_id) || [];
      existingIds.push(j.access_group_id);
      requestGroupIdMap.set(j.request_id, existingIds);
    }
  });

  return (requests as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    leader_name: (row.profiles as Record<string, string> | null)?.full_name ?? 'Unknown',
    leader_email: (row.profiles as Record<string, string> | null)?.email ?? '',
    module: row.module as string,
    access_group_ids: requestGroupIdMap.get(row.id as string) || [],
    access_group_names: requestGroupMap.get(row.id as string) || [],
    approved_at: row.updated_at as string,
  }));
}

// --- Admin/Trainer: Approve ---

export async function approveLeaderAccessRequest(
  requestId: string,
  accessGroupIds: string[],
): Promise<{ success: boolean; message: string }> {
  const { userId } = await assertPrivilegedAccess();
  const supabase = await createClient();
  const uniqueAccessGroupIds = [...new Set((accessGroupIds || []).filter(Boolean))];

  if (uniqueAccessGroupIds.length === 0) {
    return { success: false, message: 'Pilih minimal satu access group' };
  }

  // Verify request exists and is pending
  const { data: request, error: reqError } = await supabase
    .from('leader_access_requests')
    .select('id, status, leader_user_id')
    .eq('id', requestId)
    .eq('status', 'pending')
    .single();

  if (reqError || !request) {
    return { success: false, message: 'Request tidak ditemukan atau sudah diproses' };
  }

  if (request.leader_user_id === userId) {
    return { success: false, message: 'Anda tidak dapat menyetujui request akses milik sendiri' };
  }

  const { data: activeGroups, error: groupError } = await supabase
    .from('access_groups')
    .select('id')
    .in('id', uniqueAccessGroupIds)
    .eq('is_active', true);

  if (groupError) {
    console.error('[leader-access] Error validating active groups:', groupError.message);
    return { success: false, message: 'Gagal memvalidasi access group' };
  }

  if ((activeGroups || []).length !== uniqueAccessGroupIds.length) {
    return { success: false, message: 'Access group tidak valid atau sudah nonaktif' };
  }

  // Start a transaction-like flow
  const { error: updateError } = await supabase
    .from('leader_access_requests')
    .update({ status: 'approved', reviewed_by: userId })
    .eq('id', requestId)
    .eq('status', 'pending');

  if (updateError) {
    console.error('[leader-access] Error approving request:', updateError.message);
    return { success: false, message: 'Gagal menyetujui request' };
  }

  // Insert group links
  const groupRows = uniqueAccessGroupIds.map((groupId) => ({
    request_id: requestId,
    access_group_id: groupId,
  }));

  const { error: linkError } = await supabase
    .from('leader_access_request_groups')
    .insert(groupRows);

  if (linkError) {
    console.error('[leader-access] Error linking groups:', linkError.message);
    // Revert status update to avoid orphaned approved request with no groups
    await supabase
      .from('leader_access_requests')
      .update({ status: 'pending', reviewed_by: null })
      .eq('id', requestId);
    return { success: false, message: 'Gagal menautkan access group. Silakan coba lagi.' };
  }

  return { success: true, message: 'Request berhasil disetujui' };
}

// --- Admin/Trainer: Reject ---

export async function rejectLeaderAccessRequest(
  requestId: string,
  note?: string,
): Promise<{ success: boolean; message: string }> {
  const { userId } = await assertPrivilegedAccess();
  const supabase = await createClient();

  const { error } = await supabase
    .from('leader_access_requests')
    .update({ status: 'rejected', reviewed_by: userId, review_note: note || null })
    .eq('id', requestId)
    .eq('status', 'pending');

  if (error) {
    console.error('[leader-access] Error rejecting request:', error.message);
    return { success: false, message: 'Gagal menolak request' };
  }

  return { success: true, message: 'Request ditolak' };
}

// --- Admin/Trainer: Revoke ---

export async function revokeLeaderAccessRequest(
  requestId: string,
  note?: string,
): Promise<{ success: boolean; message: string }> {
  const { userId } = await assertPrivilegedAccess();
  const supabase = await createClient();

  const { error } = await supabase
    .from('leader_access_requests')
    .update({ status: 'revoked', reviewed_by: userId, review_note: note || null })
    .eq('id', requestId)
    .eq('status', 'approved');

  if (error) {
    console.error('[leader-access] Error revoking access:', error.message);
    return { success: false, message: 'Gagal mencabut akses' };
  }

  return { success: true, message: 'Akses dicabut' };
}

// --- Admin/Trainer: Reassign access groups ---

export async function reassignLeaderAccessGroups(
  requestId: string,
  accessGroupIds: string[],
): Promise<{ success: boolean; message: string }> {
  const { userId } = await assertPrivilegedAccess();
  const supabase = await createClient();
  const uniqueAccessGroupIds = [...new Set((accessGroupIds || []).filter(Boolean))];

  if (uniqueAccessGroupIds.length === 0) {
    return { success: false, message: 'Pilih minimal satu access group' };
  }

  const { data: request, error: reqError } = await supabase
    .from('leader_access_requests')
    .select('id, status, leader_user_id')
    .eq('id', requestId)
    .eq('status', 'approved')
    .single();

  if (reqError || !request) {
    return { success: false, message: 'Akses tidak ditemukan atau tidak aktif' };
  }

  if (request.leader_user_id === userId) {
    return { success: false, message: 'Anda tidak dapat mengubah akses milik sendiri' };
  }

  const { data: activeGroups, error: groupError } = await supabase
    .from('access_groups')
    .select('id')
    .in('id', uniqueAccessGroupIds)
    .eq('is_active', true);

  if (groupError) {
    console.error('[leader-access] Error validating active groups:', groupError.message);
    return { success: false, message: 'Gagal memvalidasi access group' };
  }

  if ((activeGroups || []).length !== uniqueAccessGroupIds.length) {
    return { success: false, message: 'Access group tidak valid atau sudah nonaktif' };
  }

  // Capture existing groups for rollback if insert fails
  const { data: existingGroups, error: fetchExistingError } = await supabase
    .from('leader_access_request_groups')
    .select('access_group_id')
    .eq('request_id', requestId);

  if (fetchExistingError) {
    console.error('[leader-access] Error fetching existing groups:', fetchExistingError.message);
    return { success: false, message: 'Gagal membaca access group saat ini' };
  }

  // Re-verify request is still approved before mutating groups
  const { data: recheckReq, error: recheckError } = await supabase
    .from('leader_access_requests')
    .select('id, status')
    .eq('id', requestId)
    .eq('status', 'approved')
    .single();

  if (recheckError || !recheckReq) {
    return { success: false, message: 'Akses sudah tidak aktif. Permintaan mungkin sudah dicabut.' };
  }

  const { error: deleteError } = await supabase
    .from('leader_access_request_groups')
    .delete()
    .eq('request_id', requestId);

  if (deleteError) {
    console.error('[leader-access] Error clearing access groups:', deleteError.message);
    return { success: false, message: 'Gagal menghapus access group lama' };
  }

  const groupRows = uniqueAccessGroupIds.map((groupId) => ({
    request_id: requestId,
    access_group_id: groupId,
  }));

  const { error: insertError } = await supabase
    .from('leader_access_request_groups')
    .insert(groupRows);

  if (insertError) {
    console.error('[leader-access] Error assigning access groups:', insertError.message);
    // Rollback: restore previous groups
    if (existingGroups && existingGroups.length > 0) {
      const rollbackRows = existingGroups.map((g: { access_group_id: string }) => ({
        request_id: requestId,
        access_group_id: g.access_group_id,
      }));
      const { error: rollbackError } = await supabase
        .from('leader_access_request_groups')
        .insert(rollbackRows);
      if (rollbackError) {
        console.error('[leader-access] CRITICAL: Rollback failed after insert error:', rollbackError.message);
      }
    }
    return { success: false, message: 'Gagal menyimpan access group baru. Perubahan dibatalkan.' };
  }

  const { error: auditError } = await supabase
    .from('leader_access_requests')
    .update({ reviewed_by: userId })
    .eq('id', requestId)
    .eq('status', 'approved');

  if (auditError) {
    console.error('[leader-access] Warning: Failed to update reviewed_by audit field:', auditError.message);
  }

  return { success: true, message: 'Access group berhasil diperbarui' };
}

// --- Admin/Trainer: Access Group CRUD ---

export async function getAccessGroups(): Promise<AccessGroupRow[]> {
  await assertPrivilegedAccess();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('access_groups')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[leader-access] Error fetching access groups:', error.message);
    return [];
  }

  const groupIds = (data || []).map((g: { id: string }) => g.id);
  const { data: counts } = await supabase
    .from('access_group_items')
    .select('access_group_id')
    .in('access_group_id', groupIds);

  const countMap = new Map<string, number>();
  (counts || []).forEach((c: { access_group_id: string }) => {
    countMap.set(c.access_group_id, (countMap.get(c.access_group_id) || 0) + 1);
  });

  return (data || []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    name: row.name as string,
    description: row.description as string | null,
    scope_type: row.scope_type as string,
    is_active: row.is_active as boolean,
    created_at: row.created_at as string,
    item_count: countMap.get(row.id as string) || 0,
  }));
}

export async function createAccessGroup(
  name: string,
  description?: string,
): Promise<{ success: boolean; message: string; id?: string }> {
  await assertPrivilegedAccess();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('access_groups')
    .insert({ name, description: description || null })
    .select('id')
    .single();

  if (error) {
    console.error('[leader-access] Error creating access group:', error.message);
    return { success: false, message: 'Gagal membuat access group' };
  }

  return { success: true, message: 'Access group berhasil dibuat', id: data.id };
}

export async function updateAccessGroup(
  id: string,
  updates: { name?: string; description?: string; is_active?: boolean },
): Promise<{ success: boolean; message: string }> {
  await assertPrivilegedAccess();
  const supabase = await createClient();

  const { error } = await supabase
    .from('access_groups')
    .update(updates)
    .eq('id', id);

  if (error) {
    console.error('[leader-access] Error updating access group:', error.message);
    return { success: false, message: 'Gagal mengupdate access group' };
  }

  return { success: true, message: 'Access group berhasil diupdate' };
}

export async function getAccessGroupItems(groupId: string): Promise<AccessGroupItemRow[]> {
  await assertPrivilegedAccess();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('access_group_items')
    .select('*')
    .eq('access_group_id', groupId)
    .order('field_name')
    .order('field_value');

  if (error) {
    console.error('[leader-access] Error fetching group items:', error.message);
    return [];
  }

  return (data || []) as AccessGroupItemRow[];
}

export async function getAccessScopeOptions(): Promise<AccessScopeOptions> {
  await assertPrivilegedAccess();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('profiler_peserta')
    .select('id, nama, tim, batch_name')
    .order('tim', { ascending: true })
    .order('nama', { ascending: true });

  if (error) {
    console.error('[leader-access] Error fetching scope options:', error.message);
    return {
      teams: [],
      services: VALID_SERVICE_TYPES.map((service) => ({
        value: service,
        label: SERVICE_LABELS[service],
      })),
      agentsByTeam: {},
    };
  }

  const teamSet = new Set<string>();
  const agentsByTeam: Record<string, AccessScopeAgentOption[]> = {};

  (data || []).forEach((row: { id: string; nama: string | null; tim: string | null; batch_name: string | null }) => {
    const team = row.tim?.trim();
    if (!team) return;

    teamSet.add(team);
    if (!agentsByTeam[team]) {
      agentsByTeam[team] = [];
    }
    agentsByTeam[team].push({
      id: row.id,
      name: row.nama || 'Tanpa Nama',
      team,
      batch_name: row.batch_name,
    });
  });

  return {
    teams: [...teamSet].sort((a, b) => a.localeCompare(b)),
    services: VALID_SERVICE_TYPES.map((service) => ({
      value: service,
      label: SERVICE_LABELS[service],
    })),
    agentsByTeam,
  };
}

export async function addAccessGroupItem(
  groupId: string,
  fieldName: string,
  fieldValue: string,
): Promise<{ success: boolean; message: string }> {
  await assertPrivilegedAccess();
  const supabase = await createClient();

  const { error } = await supabase
    .from('access_group_items')
    .insert({
      access_group_id: groupId,
      field_name: fieldName,
      field_value: fieldValue,
    });

  if (error) {
    console.error('[leader-access] Error adding group item:', error.message);
    return { success: false, message: 'Gagal menambah item' };
  }

  return { success: true, message: 'Item berhasil ditambahkan' };
}

export async function removeAccessGroupItem(
  itemId: string,
): Promise<{ success: boolean; message: string }> {
  await assertPrivilegedAccess();
  const supabase = await createClient();

  const { error } = await supabase
    .from('access_group_items')
    .delete()
    .eq('id', itemId);

  if (error) {
    console.error('[leader-access] Error removing group item:', error.message);
    return { success: false, message: 'Gagal menghapus item' };
  }

  return { success: true, message: 'Item berhasil dihapus' };
}
