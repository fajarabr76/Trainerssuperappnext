'use server'

import { createClient } from '@/app/lib/supabase/server';
import { getCurrentUserContext, hasRole } from '@/app/lib/authz';
import {
  ServiceType, Category, ScoringMode, ServiceWeight, DEFAULT_SERVICE_WEIGHTS,
  TopAgentData, ExportData
} from './lib/qa-types';
import { revalidatePath, revalidateTag } from 'next/cache';
import {
  QA_AGENT_DETAIL_TAG,
  QA_AGENT_DIRECTORY_TAG,
  QA_DASHBOARD_RANGE_TAG,
} from './services/qaService.server';

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

  if (agentId) {
    revalidatePath(`/qa-analyzer/agents/${agentId}`);
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

  if (role !== 'agent') {
    return;
  }

  const supabase = await createClient();
  const { data: ownPeserta, error } = await supabase
    .from('profiler_peserta')
    .select('id')
    .eq('email_ojk', user.email)
    .single();

  if (error || !ownPeserta || ownPeserta.id !== agentId) {
    throw new Error('Akses ditolak');
  }
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

export async function getAgentExportDataAction(agentId: string): Promise<ExportData> {
  await assertCanAccessAgentDetail(agentId);
  const { qaServiceServer } = await import('./services/qaService.server');
  return await qaServiceServer.getAgentExportData(agentId);
}

export async function getPersonalTrendAction(agentId: string, year: number, startMonth: number, endMonth: number, serviceType?: string) {
  await assertCanAccessAgentDetail(agentId);
  const { qaServiceServer } = await import('./services/qaService.server');
  return await qaServiceServer.getPersonalTrendWithParameters(agentId, year, startMonth, endMonth, serviceType);
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
  const hasPhantomSupport = await hasPhantomPaddingSupport(supabase);
  
  let query = supabase
    .from('qa_temuan')
    .select('period_id')
    .eq('peserta_id', agentId)
    .in('period_id', pIds);

  if (serviceType) query = query.eq('service_type', serviceType);
  if (hasPhantomSupport) query = query.eq('is_phantom_padding', false);
  
  const { data: temuan } = await query;
  
  if (!temuan || temuan.length === 0) return null;

  const activePeriodIds = new Set(temuan.map((item: { period_id: string }) => item.period_id));
  const latestPeriod = periods.find((period: { id: string; month: number }) => activePeriodIds.has(period.id));
  
  return latestPeriod ? latestPeriod.month : null;
}

export async function createPeriodAction(month: number, year: number) {
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

  const { data, error } = await supabase.from('qa_periods').insert({ month, year }).select().single();
  if (error) {
    if (error.code === '23505') throw new Error('Periode ini sudah ada.');
    throw error;
  }
  revalidatePath('/qa-analyzer/periods');
  revalidateQaPerformanceCaches();
  revalidateTag('periods');
  return data;
}

export async function deletePeriodAction(id: string) {
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

  const { count, error: checkError } = await supabase
    .from('qa_temuan').select('*', { count: 'exact', head: true }).eq('period_id', id);
  if (checkError) throw checkError;
  if ((count ?? 0) > 0) throw new Error('Periode ini sudah memiliki data temuan dan tidak bisa dihapus.');
  
  const { error } = await supabase.from('qa_periods').delete().eq('id', id);
  if (error) throw error;
  
  revalidatePath('/qa-analyzer/periods');
  revalidateQaPerformanceCaches();
  revalidateTag('periods');
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

    // 1. Validate period exists
    const { data: period, error: pErr } = await supabase
      .from('qa_periods')
      .select('id')
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

      return {
        peserta_id,
        period_id,
        rule_version_id: resolved?.version.id ?? null,
        rule_indicator_id: matchedIndicator?.id ?? null,
        ...t
      };
    }));

    const { data, error } = await supabase
      .from('qa_temuan')
      .insert(insertData)
      .select('*, qa_indicators:qa_service_rule_indicators(id, name, category, bobot, has_na, service_type), qa_periods(id, month, year)');
    
    if (error) {
      if (error.code === '23505' && error.message.includes('uq_qa_temuan_single_phantom_batch_per_period')) {
        return { data: [], error: 'Sesi tanpa temuan gagal dibuat karena constraint database lama. Jalankan migration fix index terbaru terlebih dahulu.' };
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
    
    const { data: current } = await supabase.from('qa_temuan').select('peserta_id').eq('id', id).single();
    
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
    return { success: true };
  } catch (err: any) {
    const norm = normalizeQaActionError(err, 'Gagal menghapus temuan.');
    return { success: false, error: norm.message };
  }
}

export async function getAgentsByFolderAction(batch: string) {
  await assertQaActionAccess(['trainer', 'admin']);
  const { qaServiceServer } = await import('./services/qaService.server');
  return await qaServiceServer.getAgentsByFolder(batch);
}

export async function getFoldersAction() {
  await assertQaActionAccess(['trainer', 'admin']);
  const { qaServiceServer } = await import('./services/qaService.server');
  return await qaServiceServer.getFolders();
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
    
    return { data: data ?? [] };
  } catch (err: any) {
    const norm = normalizeQaActionError(err, 'Gagal membuat sesi tanpa temuan.');
    return { data: [], error: norm.message };
  }
}

export async function getAgentPeriodsAction(agentId: string, year: number) {
  await assertCanAccessAgentDetail(agentId);
  const { qaServiceServer } = await import('./services/qaService.server');
  return await qaServiceServer.getAgentPeriodSummaries(agentId, year);
}

export async function getAgentTemuanRangeAction(agentId: string, year: number, startMonth: number, endMonth: number, serviceType: string) {
  await assertCanAccessAgentDetail(agentId);
  const { qaServiceServer } = await import('./services/qaService.server');
  return await qaServiceServer.getAgentTemuanRange(agentId, year, startMonth, endMonth, serviceType);
}

export async function getAgentTemuanPageAction(
  agentId: string,
  year: number,
  periodId: string,
  serviceType: string,
  page: number
) {
  await assertCanAccessAgentDetail(agentId);
  const { qaServiceServer } = await import('./services/qaService.server');
  return await qaServiceServer.getAgentTemuanPage(agentId, year, periodId, serviceType, page);
}

export async function getRankingAgenAction(
  periodId: string,
  serviceType: string,
  folderIds?: string[],
  year?: number
): Promise<{ data: TopAgentData[]; error?: string }> {
  await assertQaActionAccess(['trainer', 'leader', 'admin']);
  try {
    const { qaServiceServer } = await import('./services/qaService.server');
    const data = await qaServiceServer.getAllAgentsRanking(
      periodId,
      serviceType,
      folderIds || [],
      undefined,
      year
    );
    return { data };
  } catch (error) {
    console.error('getRankingAgenAction error:', error);
    return { data: [], error: 'Gagal mengambil data ranking agen.' };
  }
}

export async function getAllServiceWeightsAction(): Promise<Record<ServiceType, ServiceWeight>> {
  await assertQaActionAccess(['trainer', 'admin']);
  const { createClient } = await import('@/app/lib/supabase/server');
  const supabase = await createClient();
  const { data, error } = await supabase.from('qa_service_weights').select('*');
  if (error) throw new Error(error.message);

  const result = { ...DEFAULT_SERVICE_WEIGHTS };
  data?.forEach(row => {
    result[row.service_type as ServiceType] = {
      service_type:        row.service_type,
      critical_weight:     Number(row.critical_weight),
      non_critical_weight: Number(row.non_critical_weight),
      scoring_mode:        row.scoring_mode as ScoringMode,
    };
  });
  return result;
}

export async function updateServiceWeightAction(
  serviceType: ServiceType,
  criticalWeight: number,
  nonCriticalWeight: number,
  scoringMode: ScoringMode
): Promise<ServiceWeight> {
  if (Math.abs(criticalWeight + nonCriticalWeight - 1) > 0.001)
    throw new Error('Total bobot critical + non-critical harus 100%.');

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

  if (error) throw new Error(error.message);

  revalidatePath('/qa-analyzer/settings');
  revalidatePath('/qa-analyzer/input');
  revalidateQaPerformanceCaches();
  revalidateTag('indicators');

  return data;
}

// ── Rule Versioning Actions ──────────────────────────────────
export async function getRuleVersionsAction(serviceType: ServiceType) {
  await assertQaActionAccess(['trainer', 'admin']);
  const { qaServiceServer } = await import('./services/qaService.server');
  return await qaServiceServer.getRuleVersions(serviceType);
}

export async function getIndicatorsByVersionAction(versionId: string) {
  await assertQaActionAccess(['trainer', 'admin']);
  const { qaServiceServer } = await import('./services/qaService.server');
  return await qaServiceServer.getIndicatorsByVersion(versionId);
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

export async function publishRuleVersionAction(versionId: string, effectivePeriodId: string) {
  const { user } = await assertQaActionAccess(['trainer', 'admin']);

  const { qaServiceServer } = await import('./services/qaService.server');
  const published = await qaServiceServer.publishRuleVersion(versionId, user.id, effectivePeriodId);
  
  revalidatePath('/qa-analyzer/settings');
  revalidatePath('/qa-analyzer/input');
  revalidateQaPerformanceCaches();
  revalidateTag('indicators');
  
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

export async function getResolvedIndicatorsAction(serviceType: ServiceType, periodId: string) {
  await assertQaActionAccess(['trainer', 'admin']);
  const { qaServiceServer } = await import('./services/qaService.server');
  return await qaServiceServer.getIndicators(serviceType, periodId);
}

export async function getResolvedWeightsAction(serviceType: ServiceType, periodId: string) {
  await assertQaActionAccess(['trainer', 'admin']);
  const { qaServiceServer } = await import('./services/qaService.server');
  return await qaServiceServer.getServiceWeights(serviceType, periodId);
}
