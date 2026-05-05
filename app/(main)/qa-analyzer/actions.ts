'use server'

import { createClient } from '@/app/lib/supabase/server';
import { getCurrentUserContext, hasRole, normalizeRole } from '@/app/lib/authz';
import { getAllowedParticipantIdsForLeader } from '@/app/lib/access-control/leaderAccess.server';
import {
  ServiceType, Category, ScoringMode, ServiceWeight, DEFAULT_SERVICE_WEIGHTS,
  TopAgentData, ExportData, AgentDirectoryEntry
} from './lib/qa-types';
import { revalidatePath, revalidateTag } from 'next/cache';
import {
  QA_AGENT_DETAIL_TAG,
  QA_AGENT_DIRECTORY_TAG,
  QA_DASHBOARD_RANGE_TAG,
} from './services/qaService.server';
import {
  filterAgentDirectoryByParticipantIds,
  filterRankingByParticipantIds,
} from './lib/leaderScopeFilters';

function revalidateQaPerformanceCaches(agentId?: string) {
  revalidatePath('/qa-analyzer/dashboard');
  revalidatePath('/qa-analyzer/agents');
  revalidateTag(QA_DASHBOARD_RANGE_TAG);
  revalidateTag(QA_AGENT_DIRECTORY_TAG);
  revalidateTag(QA_AGENT_DETAIL_TAG);

  if (agentId) {
    revalidatePath(`/qa-analyzer/agents/${agentId}`);
  }
}

function revalidateQaTemuanCaches(agentId?: string) {
  revalidatePath('/qa-analyzer/input');
  revalidateTag(QA_AGENT_DETAIL_TAG);
  revalidateTag(QA_DASHBOARD_RANGE_TAG);

  if (agentId) {
    revalidatePath(`/qa-analyzer/agents/${agentId}`);
  }
}

async function refreshQaDashboardSummary(supabase: Awaited<ReturnType<typeof createClient>>, periodId?: string) {
  if (!periodId) return;
  const { error } = await supabase.rpc('refresh_qa_dashboard_summary_for_period', {
    p_period_id: periodId,
    p_folder_key: '__ALL__',
  });
  if (error) {
    console.warn('[Summary] Rebuild failed for period', periodId, error.message);
  }
}

async function invalidateQaDashboardSummaryForService(supabase: Awaited<ReturnType<typeof createClient>>, serviceType?: string) {
  if (!serviceType) return;

  const { error: err1 } = await supabase
    .from('qa_dashboard_period_summary')
    .delete()
    .eq('service_type', serviceType)
    .eq('folder_key', '__ALL__');
  if (err1) {
    console.warn('[Summary] Invalidation failed for service', serviceType, err1.message);
    return;
  }

  const { error: err2 } = await supabase
    .from('qa_dashboard_indicator_period_summary')
    .delete()
    .eq('service_type', serviceType)
    .eq('folder_key', '__ALL__');
  if (err2) {
    console.warn('[Summary] Invalidation failed for service', serviceType, err2.message);
    return;
  }

  const { error: err3 } = await supabase
    .from('qa_dashboard_agent_period_summary')
    .delete()
    .eq('service_type', serviceType)
    .eq('folder_key', '__ALL__');
  if (err3) {
    console.warn('[Summary] Invalidation failed for service', serviceType, err3.message);
  }
}

async function hasPhantomPaddingSupport(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<boolean> {
  const { error } = await supabase
    .from('qa_temuan')
    .select('id, is_phantom_padding')
    .limit(1);
  if (!error) return true;

  const message = (error.message || '').toLowerCase();
  const missingColumn = error.code === '42703'
    || error.code === 'PGRST204'
    || message.includes('is_phantom_padding')
    || message.includes('schema cache');

  if (missingColumn) return false;

  // Default to true when probe fails for non-schema reasons (e.g. permission/intermittent).
  return true;
}

function isMissingVersionedRuleColumnError(
  error: { code?: string; message?: string } | null | undefined
): boolean {
  if (!error) return false;
  const message = (error.message || '').toLowerCase();
  return error.code === '42703'
    || error.code === 'PGRST204'
    || message.includes('rule_version_id')
    || message.includes('rule_indicator_id')
    || message.includes('schema cache');
}

async function assertQaActionAccess(allowedRoles: string[]) {
  const { user, profile, role } = await getCurrentUserContext();
  if (!user || !profile) {
    throw new Error('Tidak terautentikasi');
  }
  if (!hasRole(role, allowedRoles)) {
    throw new Error('Akses ditolak: Role tidak memiliki izin untuk aksi ini');
  }
  return { user, profile, role };
}

async function assertCanAccessAgentDetail(agentId: string) {
  const { user, profile, role } = await getCurrentUserContext();
  if (!user || !profile) {
    throw new Error('Tidak terautentikasi');
  }

  if (!hasRole(role, ['agent', 'leader', 'trainer', 'admin'])) {
    throw new Error('Akses ditolak');
  }

  // Agent: only own data
  if (role === 'agent') {
    const supabase = await createClient();
    const { data: ownPeserta, error } = await supabase
      .from('profiler_peserta')
      .select('id')
      .eq('email_ojk', user.email)
      .single();
    if (error || !ownPeserta || ownPeserta.id !== agentId) {
      throw new Error('Akses ditolak');
    }
    return;
  }

  // Leader: must be within approved scope
  if (normalizeRole(role) === 'leader') {
    const participantAccess = await getAllowedParticipantIdsForLeader(user.id, 'sidak', role);
    if (!participantAccess.hasAccess) {
      throw new Error('Akses ditolak: Anda tidak memiliki akses ke modul ini');
    }
    const ids = participantAccess.participantIds;
    if (ids && ids.length > 0 && !ids.includes(agentId)) {
      throw new Error('Akses ditolak: peserta di luar scope akses Anda');
    }
    if (ids && ids.length === 0) {
      throw new Error('Akses ditolak: tidak ada peserta dalam scope akses Anda');
    }
    return;
  }

  // Admin/trainer: full access
}


function normalizeQaActionError(error: any, fallbackMessage: string): Error {
  console.error('[SIDAK][action] error:', error);
  
  // If it's already a clean string or we have a known safe message
  if (typeof error === 'string') return new Error(error);

  const rawMessage = error?.message || '';
  const errorCode = error?.code || '';

  // Detect sensitive database/infrastructure errors
  const isInternal = 
    errorCode.startsWith('PGRST') || 
    /supabase|postgrest|postgres|database|schema|connection|timeout|fetch/i.test(rawMessage) ||
    errorCode === '42703' || // missing column
    errorCode === '23505';   // unique constraint (usually handled specifically, but fallback here)

  if (isInternal) {
    return new Error(fallbackMessage);
  }

  if (error instanceof Error) return error;
  if (rawMessage) return new Error(rawMessage);
  
  return new Error(fallbackMessage);
}

export async function getAgentExportDataAction(agentId: string): Promise<{ data: ExportData | null; error?: string }> {
  try {
    await assertCanAccessAgentDetail(agentId);
    const { qaServiceServer } = await import('./services/qaService.server');
    const data = await qaServiceServer.getAgentExportData(agentId);
    return { data };
  } catch (err) {
    const norm = normalizeQaActionError(err, 'Gagal menyiapkan data export.');
    return { data: null, error: norm.message };
  }
}

export async function getPersonalTrendAction(agentId: string, year: number, startMonth: number, endMonth: number, serviceType?: string): Promise<{ data: any | null; error?: string }> {
  try {
    await assertCanAccessAgentDetail(agentId);
    const { qaServiceServer } = await import('./services/qaService.server');
    const data = await qaServiceServer.getPersonalTrendWithParameters(agentId, year, startMonth, endMonth, serviceType);
    return { data };
  } catch (err) {
    const norm = normalizeQaActionError(err, 'Gagal memproses data tren agent.');
    return { data: null, error: norm.message };
  }
}

export async function getLastAuditedMonthAction(agentId: string, year: number, serviceType?: string) {
  await assertCanAccessAgentDetail(agentId);
  const { createClient } = await import('@/app/lib/supabase/server');
  const supabase = await createClient();
  const { data: periods } = await supabase
    .from('qa_periods')
    .select('id, month')
    .eq('year', year)
    .order('month', { ascending: false });

  if (!periods || periods.length === 0) return null;

  const pIds = periods.map((period: { id: string }) => period.id);
  
  let query = supabase
    .from('qa_temuan')
    .select('period_id')
    .eq('peserta_id', agentId)
    .in('period_id', pIds);

  if (serviceType) query = query.eq('service_type', serviceType);
  
  const { data: temuan } = await query;
  
  if (!temuan || temuan.length === 0) return null;

  const activePeriodIds = new Set(temuan.map((item: { period_id: string }) => item.period_id));
  const latestPeriod = periods.find((period: { id: string; month: number }) => activePeriodIds.has(period.id));
  
  return latestPeriod ? latestPeriod.month : null;
}

export async function createPeriodAction(month: number, year: number): Promise<{ data: any | null; error?: string }> {
  try {
    const { createClient } = await import('@/app/lib/supabase/server');
    const supabase = await createClient();

    // Authentication Check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: 'Tidak terautentikasi' };

    // RBAC Check for mutation
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const allowedMutationRoles = ['trainer', 'trainers', 'admin'];
    if (!profile || !allowedMutationRoles.includes(profile.role?.toLowerCase() ?? '')) {
      return { data: null, error: 'Akses ditolak: Role tidak memiliki izin untuk aksi ini' };
    }

    const { data, error } = await supabase.from('qa_periods').insert({ month, year }).select().single();
    if (error) {
      if (error.code === '23505') return { data: null, error: 'Periode ini sudah ada.' };
      const norm = normalizeQaActionError(error, 'Gagal membuat periode.');
      return { data: null, error: norm.message };
    }
    revalidatePath('/qa-analyzer/periods');
    revalidateQaPerformanceCaches();
    revalidateTag('periods');
    return { data };
  } catch (err) {
    const norm = normalizeQaActionError(err, 'Gagal membuat periode.');
    return { data: null, error: norm.message };
  }
}

export async function deletePeriodAction(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { createClient } = await import('@/app/lib/supabase/server');
    const supabase = await createClient();
    
    // Authentication Check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Tidak terautentikasi' };

    // RBAC Check for mutation
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const allowedMutationRoles = ['trainer', 'trainers', 'admin'];
    if (!profile || !allowedMutationRoles.includes(profile.role?.toLowerCase() ?? '')) {
      return { success: false, error: 'Akses ditolak: Role tidak memiliki izin untuk aksi ini' };
    }

    const { count, error: checkError } = await supabase
      .from('qa_temuan').select('*', { count: 'exact', head: true }).eq('period_id', id);
    if (checkError) {
      const norm = normalizeQaActionError(checkError, 'Gagal memverifikasi status periode.');
      return { success: false, error: norm.message };
    }
    if ((count ?? 0) > 0) return { success: false, error: 'Periode ini sudah memiliki data temuan dan tidak bisa dihapus.' };
    
    const { error } = await supabase.from('qa_periods').delete().eq('id', id);
    if (error) {
      const norm = normalizeQaActionError(error, 'Gagal menghapus periode.');
      return { success: false, error: norm.message };
    }
    
    revalidatePath('/qa-analyzer/periods');
    revalidateQaPerformanceCaches();
    revalidateTag('periods');
    return { success: true };
  } catch (err) {
    const norm = normalizeQaActionError(err, 'Gagal menghapus periode.');
    return { success: false, error: norm.message };
  }
}

export async function createIndicatorAction(
  service_type: ServiceType, name: string, category: Category, bobot: number, has_na: boolean
) {
  const { createClient } = await import('@/app/lib/supabase/server');
  const supabase = await createClient();

  // Authentication Check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Tidak terautentikasi');

  // RBAC Check for mutation
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const allowedMutationRoles = ['trainer', 'trainers', 'admin'];
  if (!profile || !allowedMutationRoles.includes(profile.role?.toLowerCase() ?? '')) {
    throw new Error('Akses ditolak: Role tidak memiliki izin untuk aksi ini');
  }

  const { data, error } = await supabase.from('qa_indicators').insert({ service_type, name, category, bobot, has_na }).select().single();
  if (error) throw error;
  revalidatePath('/qa-analyzer/settings');
  revalidateQaPerformanceCaches();
  revalidateTag('indicators');
  return data;
}

export async function updateIndicatorAction(
  id: string, patch: { name?: string; category?: Category; bobot?: number; has_na?: boolean }
) {
  const { createClient } = await import('@/app/lib/supabase/server');
  const supabase = await createClient();

  // Authentication Check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Tidak terautentikasi');

  // RBAC Check for mutation
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const allowedMutationRoles = ['trainer', 'trainers', 'admin'];
  if (!profile || !allowedMutationRoles.includes(profile.role?.toLowerCase() ?? '')) {
    throw new Error('Akses ditolak: Role tidak memiliki izin untuk aksi ini');
  }

  const { data, error } = await supabase.from('qa_indicators').update(patch).eq('id', id).select().single();
  if (error) throw error;
  revalidatePath('/qa-analyzer/settings');
  revalidateQaPerformanceCaches();
  revalidateTag('indicators');
  return data;
}

export async function deleteIndicatorAction(id: string) {
  const { createClient } = await import('@/app/lib/supabase/server');
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Tidak terautentikasi');

  // RBAC Check for mutation
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const allowedMutationRoles = ['trainer', 'trainers', 'admin'];
  if (!profile || !allowedMutationRoles.includes(profile.role?.toLowerCase() ?? '')) {
    throw new Error('Akses ditolak: Role tidak memiliki izin untuk aksi ini');
  }

  const { count, error: checkError } = await supabase
    .from('qa_temuan').select('*', { count: 'exact', head: true }).eq('indicator_id', id);
  if (checkError) throw checkError;
  if ((count ?? 0) > 0) throw new Error('Indikator ini sudah memiliki data temuan dan tidak bisa dihapus.');
  
  // Get indicator name for log
  const { data: indicator } = await supabase.from('qa_indicators').select('name').eq('id', id).single();

  const { error } = await supabase.from('qa_indicators').delete().eq('id', id);
  if (error) throw error;

  // Log Activity
  await supabase.from('activity_logs').insert({
    user_id: user.id,
    user_name: user.email,
    action: `Menghapus Indikator: ${indicator?.name || id}`,
    module: 'SIDAK',
    type: 'delete'
  });

  revalidatePath('/qa-analyzer/settings');
  revalidateQaPerformanceCaches();
  revalidateTag('indicators');
}

export async function createTemuanBatchAction(
  peserta_id: string,
  period_id: string,
  temuanList: {
    indicator_id: string;
    no_tiket?: string;
    nilai: number;
    ketidaksesuaian?: string;
    sebaiknya?: string;
    service_type: ServiceType;
  }[]
): Promise<{ data: any[]; error?: string }> {
  try {
    const { createClient } = await import('@/app/lib/supabase/server');
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: [], error: 'Tidak terautentikasi' };

    // RBAC Check for mutation
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const allowedMutationRoles = ['trainer', 'trainers', 'admin'];
    if (!profile || !allowedMutationRoles.includes(profile.role?.toLowerCase() ?? '')) {
      return { data: [], error: 'Akses ditolak: Role tidak memiliki izin untuk aksi ini' };
    }

    // 1. Validate period exists (also fetch year for tahun column)
    const { data: period, error: pErr } = await supabase
      .from('qa_periods')
      .select('id, year')
      .eq('id', period_id)
      .single();
    
    if (pErr || !period) {
      return { data: [], error: 'Periode tidak valid atau tidak ditemukan.' };
    }

    const { qaServiceServer } = await import('./services/qaService.server');
    const resolvedRuleByService = new Map<ServiceType, Awaited<ReturnType<typeof qaServiceServer.resolveRuleVersion>>>();

    const insertData = await Promise.all(temuanList.map(async (t) => {
      if (!resolvedRuleByService.has(t.service_type)) {
        const resolved = await qaServiceServer.resolveRuleVersion(period_id, t.service_type);
        resolvedRuleByService.set(t.service_type, resolved);
      }
      const resolved = resolvedRuleByService.get(t.service_type) ?? null;
      const matchedIndicator = resolved?.indicators.find((indicator) =>
        indicator.id === t.indicator_id || indicator.legacy_indicator_id === t.indicator_id
      ) ?? null;

      if (resolved && !matchedIndicator) {
        console.warn('[SIDAK][input] unresolved rule indicator mapping', {
          peserta_id,
          period_id,
          service_type: t.service_type,
          indicator_id: t.indicator_id,
        });
      }

      // Use legacy_indicator_id for indicator_id FK (references qa_indicators),
      // and versioned indicator id for rule_indicator_id (references qa_service_rule_indicators).
      // Without this mapping, indicator_id would contain a qa_service_rule_indicators UUID
      // which violates the FK constraint to qa_indicators(id).
      const effectiveIndicatorId = matchedIndicator
        ? (matchedIndicator.legacy_indicator_id || t.indicator_id)
        : t.indicator_id;

      return {
        peserta_id,
        period_id,
        tahun: period.year,
        indicator_id: effectiveIndicatorId,
        rule_version_id: resolved?.version.id ?? null,
        rule_indicator_id: matchedIndicator?.id ?? null,
        no_tiket: t.no_tiket,
        nilai: t.nilai,
        ketidaksesuaian: t.ketidaksesuaian,
        sebaiknya: t.sebaiknya,
        service_type: t.service_type,
      };
    }));

    // ── Check for duplicates within the submitted batch itself ─────────────
    // After this app-level check, the DB unique index uq_qa_temuan_duplicate_input
    // provides atomic enforcement for concurrent submits (23505 caught below).
    const seenInBatch = new Set<string>();
    for (const d of insertData) {
      const ticket = d.no_tiket?.trim();
      if (!ticket) continue;
      const key = `${ticket.toLowerCase()}::${d.indicator_id}::${d.service_type}`;
      if (seenInBatch.has(key)) {
        return { data: [], error: `Duplicate temuan ditemukan dalam satu batch: No. Tiket ${ticket}. Hapus duplicate dan coba lagi.` };
      }
      seenInBatch.add(key);
    }

    // ── Check for duplicates against existing data BEFORE insert ──────────────
    // Fetch all existing rows scoped to agent+period+service and compare with
    // normalized keys (trim + lowercase, matching DB constraint uq_qa_temuan_duplicate_input).
    // This catches case/whitespace variants that an exact .in('no_tiket', ...) would miss.
    const serviceTypes = [...new Set(insertData.map(d => d.service_type))];

    if (serviceTypes.length > 0) {
      const hasPhantomSupport = await hasPhantomPaddingSupport(supabase);
      let existingRowsQuery = supabase
        .from('qa_temuan')
        .select('id, no_tiket, indicator_id, service_type')
        .eq('peserta_id', peserta_id)
        .eq('period_id', period_id)
        .in('service_type', serviceTypes);
      if (hasPhantomSupport) {
        existingRowsQuery = existingRowsQuery.eq('is_phantom_padding', false);
      }

      const { data: existingRows, error: existingError } = await existingRowsQuery;

      if (existingError) {
        const norm = normalizeQaActionError(existingError, 'Gagal memeriksa data duplicate.');
        return { data: [], error: norm.message };
      }

      if (existingRows && existingRows.length > 0) {
        const existingKeys = new Set(
          existingRows
            .filter(e => e.no_tiket?.trim())
            .map(e => `${e.no_tiket.trim().toLowerCase()}::${e.indicator_id}::${e.service_type}`)
        );

        const duplicateTickets: string[] = [];
        for (const d of insertData) {
          const ticket = d.no_tiket?.trim();
          if (!ticket) continue;
          const key = `${ticket.toLowerCase()}::${d.indicator_id}::${d.service_type}`;
          if (existingKeys.has(key)) {
            duplicateTickets.push(ticket);
          }
        }

        if (duplicateTickets.length > 0) {
          const uniqueDups = [...new Set(duplicateTickets)];
          if (uniqueDups.length === 1) {
            return { data: [], error: `Duplicate temuan ditemukan: No. Tiket ${uniqueDups[0]} dengan parameter yang sama sudah pernah diinput.` };
          } else if (uniqueDups.length <= 3) {
            return { data: [], error: `Duplicate temuan ditemukan: ${uniqueDups.join(', ')} sudah pernah diinput.` };
          } else {
            return { data: [], error: `Duplicate temuan ditemukan: ${uniqueDups.slice(0, 3).join(', ')}, dan ${uniqueDups.length - 3} lainnya sudah pernah diinput.` };
          }
        }
      }
    }

    const { data, error } = await supabase
      .from('qa_temuan')
      .insert(insertData)
      .select('*, qa_indicators:qa_service_rule_indicators(id, name, category, bobot, has_na, service_type), qa_periods(id, month, year)');
    
    if (error) {
      if (error.code === '23505' && error.message.includes('uq_qa_temuan_single_phantom_batch_per_period')) {
        return { data: [], error: 'Sesi tanpa temuan gagal dibuat karena constraint database lama. Jalankan migration fix index terbaru terlebih dahulu.' };
      }
      if (error.code === '23505' && error.message.includes('uq_qa_temuan_duplicate_input')) {
        return { data: [], error: 'Duplicate temuan terdeteksi: nomor tiket dan parameter yang sama sudah ada di database. Hapus duplicate dan coba lagi.' };
      }
      if (isMissingVersionedRuleColumnError(error)) {
        return { data: [], error: 'Skema SIDAK belum mendukung versioned QA rules. Jalankan migration database terbaru (kolom rule_version_id/rule_indicator_id) lalu coba lagi.' };
      }
      const norm = normalizeQaActionError(error, 'Gagal menyimpan temuan batch.');
      return { data: [], error: norm.message };
    }
    
    // Log Activity once for the batch
    await supabase.from('activity_logs').insert({
      user_id: user.id,
      user_name: user.email,
      action: `Input ${temuanList.length} Temuan SIDAK untuk Peserta ID: ${peserta_id}`,
      module: 'SIDAK',
      type: 'add'
    });

    revalidateQaTemuanCaches(peserta_id);
    await refreshQaDashboardSummary(supabase, period_id);
    
    return { data: data ?? [] };
  } catch (err: any) {
    const norm = normalizeQaActionError(err, 'Gagal menyimpan temuan batch.');
    return { data: [], error: norm.message };
  }
}

export async function updateTemuanAction(
  id: string,
  patch: { nilai: number; ketidaksesuaian?: string; sebaiknya?: string }
): Promise<{ data: any | null; error?: string }> {
  try {
    const { createClient } = await import('@/app/lib/supabase/server');
    const supabase = await createClient();

    // Authentication Check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: 'Tidak terautentikasi' };

    // RBAC Check for mutation
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const allowedMutationRoles = ['trainer', 'trainers', 'admin'];
    if (!profile || !allowedMutationRoles.includes(profile.role?.toLowerCase() ?? '')) {
      return { data: null, error: 'Akses ditolak: Role tidak memiliki izin untuk aksi ini' };
    }
    const { data, error } = await supabase
      .from('qa_temuan')
      .update(patch)
      .eq('id', id)
      .select('*, qa_indicators:qa_service_rule_indicators(id, name, category, bobot, has_na, service_type), qa_periods(id, month, year)')
      .single();
    if (error) {
      const norm = normalizeQaActionError(error, 'Gagal memperbarui temuan.');
      return { data: null, error: norm.message };
    }
    
    revalidateQaTemuanCaches(data?.peserta_id);
    if (data?.qa_periods?.id) {
      await refreshQaDashboardSummary(supabase, data.qa_periods.id);
    }
    
    return { data };
  } catch (err: any) {
    const norm = normalizeQaActionError(err, 'Gagal memperbarui temuan.');
    return { data: null, error: norm.message };
  }
}

export async function deleteTemuanAction(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { createClient } = await import('@/app/lib/supabase/server');
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Tidak terautentikasi' };

    // RBAC Check for mutation
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const allowedMutationRoles = ['trainer', 'trainers', 'admin'];
    if (!profile || !allowedMutationRoles.includes(profile.role?.toLowerCase() ?? '')) {
      return { success: false, error: 'Akses ditolak: Role tidak memiliki izin untuk aksi ini' };
    }
    
    const { data: current } = await supabase.from('qa_temuan').select('peserta_id, period_id').eq('id', id).single();
    
    const { error } = await supabase.from('qa_temuan').delete().eq('id', id);
    if (error) {
      const norm = normalizeQaActionError(error, 'Gagal menghapus temuan.');
      return { success: false, error: norm.message };
    }

    // Log Activity
    await supabase.from('activity_logs').insert({
      user_id: user.id,
      user_name: user.email,
      action: `Menghapus Temuan SIDAK ID: ${id}`,
      module: 'SIDAK',
      type: 'delete'
    });
    
    revalidateQaTemuanCaches(current?.peserta_id);
    await refreshQaDashboardSummary(supabase, current?.period_id);
    return { success: true };
  } catch (err: any) {
    const norm = normalizeQaActionError(err, 'Gagal menghapus temuan.');
    return { success: false, error: norm.message };
  }
}

export async function getAgentsByFolderAction(batch: string, includeExcluded?: boolean): Promise<{ data: any[]; error?: string }> {
  try {
    await assertQaActionAccess(['trainer', 'admin']);
    const { qaServiceServer } = await import('./services/qaService.server');
    const data = await qaServiceServer.getAgentsByFolder(batch, includeExcluded);
    return { data };
  } catch (err) {
    const norm = normalizeQaActionError(err, 'Gagal mengambil daftar agent.');
    return { data: [], error: norm.message };
  }
}

export async function getAllAgentDirectoryAction(year?: number): Promise<{ data: AgentDirectoryEntry[]; error?: string }> {
  try {
    const { user, role } = await assertQaActionAccess(['trainer', 'leader', 'admin']);
    const { qaServiceServer } = await import('./services/qaService.server');
    const directoryData = await qaServiceServer.getAgentDirectorySummary(year, true);

    if (normalizeRole(role) === 'leader') {
      const participantAccess = await getAllowedParticipantIdsForLeader(user.id, 'sidak', role);
      if (!participantAccess.hasAccess) {
        return { data: [], error: 'Akses ditolak: approval SIDAK belum aktif.' };
      }
      const ids = participantAccess.participantIds;
      if (!ids) return { data: directoryData };
      if (ids.length === 0) return { data: [] };
      const filteredData = filterAgentDirectoryByParticipantIds(directoryData, ids);
      return { data: filteredData };
    }

    return { data: directoryData };
  } catch (err) {
    const norm = normalizeQaActionError(err, 'Gagal mengambil data directory agent.');
    return { data: [], error: norm.message };
  }
}

export async function getFoldersAction(): Promise<{ data: string[]; error?: string }> {
  try {
    await assertQaActionAccess(['trainer', 'admin']);
    const { qaServiceServer } = await import('./services/qaService.server');
    const data = await qaServiceServer.getFolders();
    return { data };
  } catch (err) {
    const norm = normalizeQaActionError(err, 'Gagal mengambil daftar folder.');
    return { data: [], error: norm.message };
  }
}

export async function createPerfectScoreSessionAction(
  peserta_id: string,
  period_id: string,
  service_type: ServiceType,
  _no_tiket?: string
): Promise<{ data: any[]; error?: string }> {
  try {
    const { createClient } = await import('@/app/lib/supabase/server');
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: [], error: 'Tidak terautentikasi' };

    // RBAC Check for mutation
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const allowedMutationRoles = ['trainer', 'trainers', 'admin'];
    if (!profile || !allowedMutationRoles.includes(profile.role?.toLowerCase() ?? '')) {
      return { data: [], error: 'Akses ditolak: Role tidak memiliki izin untuk aksi ini' };
    }
    // Fetch period year for tahun column
    const { data: periodInfo } = await supabase
      .from('qa_periods')
      .select('year')
      .eq('id', period_id)
      .single();
    const periodYear = periodInfo?.year ?? new Date().getFullYear();

    const supportsPhantom = await hasPhantomPaddingSupport(supabase);
    if (!supportsPhantom) {
      return { data: [], error: 'Fitur sesi tanpa temuan belum aktif. Jalankan migration database terbaru terlebih dahulu.' };
    }

    const { count: existingPhantomCount, error: existingErr } = await supabase
      .from('qa_temuan')
      .select('id', { count: 'exact', head: true })
      .eq('peserta_id', peserta_id)
      .eq('period_id', period_id)
      .eq('service_type', service_type)
      .eq('is_phantom_padding', true);
    if (existingErr) {
      const norm = normalizeQaActionError(existingErr, 'Gagal memeriksa sesi tanpa temuan.');
      return { data: [], error: norm.message };
    }
    if ((existingPhantomCount ?? 0) > 0) {
      return { data: [], error: 'Sesi tanpa temuan untuk periode ini sudah pernah dibuat.' };
    }

    // get indicators from resolved rule if possible, else fallback
    const { qaServiceServer } = await import('./services/qaService.server');
    const resolved = await qaServiceServer.resolveRuleVersion(period_id, service_type);
    
    let indicators;
    let rule_version_id = null;
    
    if (resolved) {
      indicators = resolved.indicators.map(i => ({ id: i.legacy_indicator_id || i.id, rule_indicator_id: i.id }));
      rule_version_id = resolved.version.id;
    } else {
      const { data: inds, error: indsErr } = await supabase
        .from('qa_indicators')
        .select('id')
        .eq('service_type', service_type);
      if (indsErr || !inds) return { data: [], error: 'Gagal mengambil parameter untuk agent ini' };
      indicators = inds.map(i => ({ id: i.id, rule_indicator_id: null }));
    }

    if (indicators.length === 0) return { data: [], error: 'Tidak ada parameter untuk tim agent ini' };

    const phantomBatchId = crypto.randomUUID();
    const PADDING_COUNT = 5;
    const insertData = Array.from({ length: PADDING_COUNT }).flatMap((_, sessionIdx) =>
      indicators.map((ind: { id: string, rule_indicator_id: string | null }) => ({
        peserta_id,
        period_id,
        tahun: periodYear,
        indicator_id: ind.id,
        rule_version_id,
        rule_indicator_id: ind.rule_indicator_id,
        no_tiket: `__PHANTOM__${phantomBatchId}_${sessionIdx + 1}`,
        nilai: 3,
        service_type,
        is_phantom_padding: true,
        phantom_batch_id: phantomBatchId,
      }))
    );

    const { data, error } = await supabase
      .from('qa_temuan')
      .insert(insertData)
      .select('*, qa_indicators:qa_service_rule_indicators(id, name, category, bobot, has_na, service_type), qa_periods(id, month, year)');
    
    if (error) {
      if (error.code === '23505' && error.message.includes('uq_qa_temuan_single_phantom_batch_per_period')) {
        return { data: [], error: 'Sesi tanpa temuan gagal dibuat karena constraint database lama. Jalankan migration fix index terbaru terlebih dahulu.' };
      }
      const norm = normalizeQaActionError(error, 'Gagal membuat sesi tanpa temuan.');
      return { data: [], error: norm.message };
    }

    await supabase.from('activity_logs').insert({
      user_id: user.id,
      user_name: user.email,
      action: `Input Sesi Tanpa Temuan SIDAK (phantom x5) untuk Peserta ID: ${peserta_id}`,
      module: 'SIDAK',
      type: 'add'
    });

    revalidateQaTemuanCaches(peserta_id);
    await refreshQaDashboardSummary(supabase, period_id);
    
    return { data: data ?? [] };
  } catch (err: any) {
    const norm = normalizeQaActionError(err, 'Gagal membuat sesi tanpa temuan.');
    return { data: [], error: norm.message };
  }
}

export async function getAgentPeriodsAction(agentId: string, year: number): Promise<{ periods: any[]; error?: string }> {
  try {
    await assertCanAccessAgentDetail(agentId);
    const { qaServiceServer } = await import('./services/qaService.server');
    const result = await qaServiceServer.getAgentPeriodSummaries(agentId, year);
    return { periods: result.periods };
  } catch (err) {
    const norm = normalizeQaActionError(err, 'Gagal mengambil riwayat periode agent.');
    return { periods: [], error: norm.message };
  }
}

export async function getAgentTemuanRangeAction(agentId: string, year: number, startMonth: number, endMonth: number, serviceType: string): Promise<{ data: any[]; error?: string }> {
  try {
    await assertCanAccessAgentDetail(agentId);
    const { qaServiceServer } = await import('./services/qaService.server');
    const data = await qaServiceServer.getAgentTemuanRange(agentId, year, startMonth, endMonth, serviceType);
    return { data };
  } catch (err) {
    const norm = normalizeQaActionError(err, 'Gagal mengambil data temuan audit.');
    return { data: [], error: norm.message };
  }
}

export async function getAgentTemuanPageAction(
  agentId: string,
  year: number,
  periodId: string,
  serviceType: string,
  page: number
): Promise<{ data: any; error?: string }> {
  try {
    await assertCanAccessAgentDetail(agentId);
    const { qaServiceServer } = await import('./services/qaService.server');
    const data = await qaServiceServer.getAgentTemuanPage(agentId, year, periodId, serviceType, page);
    return { data };
  } catch (err) {
    const norm = normalizeQaActionError(err, 'Gagal mengambil halaman temuan audit.');
    return { data: null, error: norm.message };
  }
}

export async function getRankingAgenAction(
  periodId: string,
  serviceType: string,
  folderIds?: string[],
  year?: number
): Promise<{ data: TopAgentData[]; error?: string }> {
  try {
    const { user, role } = await assertQaActionAccess(['trainer', 'leader', 'admin']);
    const { qaServiceServer } = await import('./services/qaService.server');
    const rankingData = await qaServiceServer.getAllAgentsRanking(
      periodId,
      serviceType,
      folderIds || [],
      undefined,
      year
    );

    if (normalizeRole(role) === 'leader') {
      const participantAccess = await getAllowedParticipantIdsForLeader(user.id, 'sidak', role);
      if (!participantAccess.hasAccess) {
        return { data: [], error: 'Akses ditolak: approval SIDAK belum aktif.' };
      }
      const ids = participantAccess.participantIds;
      if (!ids) return { data: rankingData };
      if (ids.length === 0) return { data: [] };
      const filteredData = filterRankingByParticipantIds(rankingData, ids);
      return { data: filteredData };
    }

    return { data: rankingData };
  } catch (error) {
    console.error('getRankingAgenAction error:', error);
    return { data: [], error: 'Gagal mengambil data ranking agen.' };
  }
}

export async function getAllServiceWeightsAction(): Promise<{ data: Record<ServiceType, ServiceWeight>; error?: string }> {
  try {
    await assertQaActionAccess(['trainer', 'admin']);
    const { createClient } = await import('@/app/lib/supabase/server');
    const supabase = await createClient();
    const { data, error } = await supabase.from('qa_service_weights').select('*');
    if (error) {
      const norm = normalizeQaActionError(error, 'Gagal mengambil konfigurasi bobot.');
      return { data: { ...DEFAULT_SERVICE_WEIGHTS }, error: norm.message };
    }

    const result = { ...DEFAULT_SERVICE_WEIGHTS };
    data?.forEach(row => {
      result[row.service_type as ServiceType] = {
        service_type:        row.service_type,
        critical_weight:     Number(row.critical_weight),
        non_critical_weight: Number(row.non_critical_weight),
        scoring_mode:        row.scoring_mode as ScoringMode,
      };
    });
    return { data: result };
  } catch (err) {
    const norm = normalizeQaActionError(err, 'Gagal mengambil konfigurasi bobot.');
    return { data: { ...DEFAULT_SERVICE_WEIGHTS }, error: norm.message };
  }
}

export async function updateServiceWeightAction(
  serviceType: ServiceType,
  criticalWeight: number,
  nonCriticalWeight: number,
  scoringMode: ScoringMode
): Promise<{ data: ServiceWeight | null; error?: string }> {
  try {
    if (Math.abs(criticalWeight + nonCriticalWeight - 1) > 0.001) {
      return { data: null, error: 'Total bobot critical + non-critical harus 100%.' };
    }

    const { createClient } = await import('@/app/lib/supabase/server');
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: 'Tidak terautentikasi' };

    // RBAC Check for mutation
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const allowedMutationRoles = ['trainer', 'trainers', 'admin'];
    if (!profile || !allowedMutationRoles.includes(profile.role?.toLowerCase() ?? '')) {
      return { data: null, error: 'Akses ditolak: Role tidak memiliki izin untuk aksi ini' };
    }

    const { data, error } = await supabase
      .from('qa_service_weights')
      .upsert({
        service_type:        serviceType,
        critical_weight:     criticalWeight,
        non_critical_weight: nonCriticalWeight,
        scoring_mode:        scoringMode,
        updated_at:          new Date().toISOString(),
        updated_by:          user.id
      }, { onConflict: 'service_type' })
      .select().single();

    if (error) {
      const norm = normalizeQaActionError(error, 'Gagal memperbarui bobot.');
      return { data: null, error: norm.message };
    }

    revalidatePath('/qa-analyzer/settings');
    revalidatePath('/qa-analyzer/input');
    revalidateQaPerformanceCaches();
    revalidateTag('indicators');

    await invalidateQaDashboardSummaryForService(supabase, serviceType);

    return { data };
  } catch (err) {
    const norm = normalizeQaActionError(err, 'Gagal memperbarui bobot.');
    return { data: null, error: norm.message };
  }
}

// ── Rule Versioning Actions ──────────────────────────────────
export async function getRuleVersionsAction(serviceType: ServiceType): Promise<{ data: any[]; error?: string }> {
  try {
    await assertQaActionAccess(['trainer', 'admin']);
    const { qaServiceServer } = await import('./services/qaService.server');
    const data = await qaServiceServer.getRuleVersions(serviceType);
    return { data };
  } catch (err) {
    const norm = normalizeQaActionError(err, 'Gagal mengambil versi parameter.');
    return { data: [], error: norm.message };
  }
}

export async function getIndicatorsByVersionAction(versionId: string): Promise<{ data: any[]; error?: string }> {
  try {
    await assertQaActionAccess(['trainer', 'admin']);
    const { qaServiceServer } = await import('./services/qaService.server');
    const data = await qaServiceServer.getIndicatorsByVersion(versionId);
    return { data };
  } catch (err) {
    const norm = normalizeQaActionError(err, 'Gagal mengambil detail parameter versi ini.');
    return { data: [], error: norm.message };
  }
}

export async function createRuleDraftAction(serviceType: ServiceType, sourceVersionId?: string) {
  const { user } = await assertQaActionAccess(['trainer', 'admin']);

  const { qaServiceServer } = await import('./services/qaService.server');
  const draft = await qaServiceServer.createRuleDraft(serviceType, user.id, sourceVersionId);
  revalidatePath('/qa-analyzer/settings');
  return draft;
}

export async function updateRuleDraftAction(versionId: string, patch: any) {
  await assertQaActionAccess(['trainer', 'admin']);

  const { qaServiceServer } = await import('./services/qaService.server');
  const updated = await qaServiceServer.updateRuleDraft(versionId, patch);
  revalidatePath('/qa-analyzer/settings');
  return updated;
}

export async function deleteRuleDraftAction(versionId: string) {
  await assertQaActionAccess(['trainer', 'admin']);

  const { qaServiceServer } = await import('./services/qaService.server');
  await qaServiceServer.deleteRuleDraft(versionId);
  revalidatePath('/qa-analyzer/settings');
}

export async function publishRuleVersionAction(versionId: string, changeReason?: string) {
  const { user } = await assertQaActionAccess(['trainer', 'admin']);

  const { qaServiceServer } = await import('./services/qaService.server');
  const published = await qaServiceServer.publishRuleVersion(versionId, changeReason);
  
  revalidatePath('/qa-analyzer/settings');
  revalidatePath('/qa-analyzer/input');
  revalidateQaPerformanceCaches();
  revalidateTag('indicators');

  const { createClient } = await import('@/app/lib/supabase/server');
  const supabase = await createClient();
  await refreshQaDashboardSummary(supabase, published.effective_period_id);
  
  return published;
}

export async function addDraftIndicatorAction(versionId: string, indicator: any) {
  await assertQaActionAccess(['trainer', 'admin']);
  const { qaServiceServer } = await import('./services/qaService.server');
  const created = await qaServiceServer.addDraftIndicator(versionId, indicator);
  revalidatePath('/qa-analyzer/settings');
  return created;
}

export async function updateDraftIndicatorAction(id: string, patch: any) {
  await assertQaActionAccess(['trainer', 'admin']);
  const { qaServiceServer } = await import('./services/qaService.server');
  const updated = await qaServiceServer.updateDraftIndicator(id, patch);
  revalidatePath('/qa-analyzer/settings');
  return updated;
}

export async function deleteDraftIndicatorAction(id: string) {
  await assertQaActionAccess(['trainer', 'admin']);
  const { qaServiceServer } = await import('./services/qaService.server');
  await qaServiceServer.deleteDraftIndicator(id);
  revalidatePath('/qa-analyzer/settings');
}

export async function getResolvedIndicatorsAction(serviceType: ServiceType, periodId: string): Promise<{ data: any[]; error?: string }> {
  try {
    await assertQaActionAccess(['trainer', 'admin']);
    const { qaServiceServer } = await import('./services/qaService.server');
    const data = await qaServiceServer.getIndicators(serviceType, periodId);
    return { data: data as any[] };
  } catch (err) {
    const norm = normalizeQaActionError(err, 'Gagal mengambil parameter audit.');
    return { data: [], error: norm.message };
  }
}

export async function getResolvedWeightsAction(serviceType: ServiceType, periodId: string): Promise<{ data: any | null; error?: string }> {
  try {
    await assertQaActionAccess(['trainer', 'admin']);
    const { qaServiceServer } = await import('./services/qaService.server');
    const data = await qaServiceServer.getServiceWeights(serviceType, periodId);
    return { data };
  } catch (err) {
    const norm = normalizeQaActionError(err, 'Gagal mengambil bobot layanan.');
    return { data: null, error: norm.message };
  }
}
