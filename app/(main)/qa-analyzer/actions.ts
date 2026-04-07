'use server'

import { createClient } from '@/app/lib/supabase/server';
import {
  ServiceType, Category, ScoringMode, ServiceWeight, DEFAULT_SERVICE_WEIGHTS,
  DashboardData, TrendPoint, TopAgentData, ExportData, EXCLUDED_FOLDERS
} from './lib/qa-types';
import { revalidatePath, revalidateTag } from 'next/cache';


export async function getAgentExportDataAction(agentId: string): Promise<ExportData> {
  const { qaServiceServer } = await import('./services/qaService.server');
  return await qaServiceServer.getAgentExportData(agentId);
}

export async function getPersonalTrendAction(agentId: string, timeframe: '3m' | '6m' | 'all', serviceType?: string) {
  const { qaServiceServer } = await import('./services/qaService.server');
  return await qaServiceServer.getPersonalTrendWithParameters(agentId, timeframe, serviceType);
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

  const allowedMutationRoles = ['trainer', 'trainers', 'admin', 'superadmin'];
  if (!profile || !allowedMutationRoles.includes(profile.role?.toLowerCase() ?? '')) {
    throw new Error('Akses ditolak: Role tidak memiliki izin untuk aksi ini');
  }

  const { data, error } = await supabase.from('qa_periods').insert({ month, year }).select().single();
  if (error) {
    if (error.code === '23505') throw new Error('Periode ini sudah ada.');
    throw error;
  }
  revalidatePath('/qa-analyzer/periods');
  revalidatePath('/qa-analyzer/dashboard');
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

  const allowedMutationRoles = ['trainer', 'trainers', 'admin', 'superadmin'];
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
  revalidatePath('/qa-analyzer/dashboard');
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

  const allowedMutationRoles = ['trainer', 'trainers', 'admin', 'superadmin'];
  if (!profile || !allowedMutationRoles.includes(profile.role?.toLowerCase() ?? '')) {
    throw new Error('Akses ditolak: Role tidak memiliki izin untuk aksi ini');
  }

  const { data, error } = await supabase.from('qa_indicators').insert({ service_type, name, category, bobot, has_na }).select().single();
  if (error) throw error;
  revalidatePath('/qa-analyzer/settings');
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

  const allowedMutationRoles = ['trainer', 'trainers', 'admin', 'superadmin'];
  if (!profile || !allowedMutationRoles.includes(profile.role?.toLowerCase() ?? '')) {
    throw new Error('Akses ditolak: Role tidak memiliki izin untuk aksi ini');
  }

  const { data, error } = await supabase.from('qa_indicators').update(patch).eq('id', id).select().single();
  if (error) throw error;
  revalidatePath('/qa-analyzer/settings');
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

  const allowedMutationRoles = ['trainer', 'trainers', 'admin', 'superadmin'];
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
  revalidateTag('indicators');
}

export async function createTemuanAction(
  peserta_id: string,
  period_id: string,
  temuan: {
    indicator_id: string;
    no_tiket?: string;
    nilai: number;
    ketidaksesuaian?: string;
    sebaiknya?: string;
    service_type: ServiceType;
  }
) {
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

  const allowedMutationRoles = ['trainer', 'trainers', 'admin', 'superadmin'];
  if (!profile || !allowedMutationRoles.includes(profile.role?.toLowerCase() ?? '')) {
    throw new Error('Akses ditolak: Role tidak memiliki izin untuk aksi ini');
  }

  const { data, error } = await supabase
    .from('qa_temuan')
    .insert({ peserta_id, period_id, ...temuan })
    .select('*, qa_indicators(id, name, category, bobot, has_na, service_type), qa_periods(id, month, year)')
    .single();
  if (error) throw error;
  
  // Log Activity
  await supabase.from('activity_logs').insert({
    user_id: user.id,
    user_name: user.email,
    action: `Input Temuan SIDAK untuk Peserta ID: ${peserta_id}`,
    module: 'SIDAK',
    type: 'add'
  });

  revalidatePath('/qa-analyzer/input');
  revalidatePath('/qa-analyzer/dashboard');
  revalidatePath(`/qa-analyzer/agents/${peserta_id}`);
  return data;
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
) {
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

  const allowedMutationRoles = ['trainer', 'trainers', 'admin', 'superadmin'];
  if (!profile || !allowedMutationRoles.includes(profile.role?.toLowerCase() ?? '')) {
    throw new Error('Akses ditolak: Role tidak memiliki izin untuk aksi ini');
  }

  // 1. Validate period exists
  const { data: period, error: pErr } = await supabase
    .from('qa_periods')
    .select('id')
    .eq('id', period_id)
    .single();
  
  if (pErr || !period) {
    throw new Error('Periode tidak valid atau tidak ditemukan.');
  }

  const insertData = temuanList.map(t => ({
    peserta_id,
    period_id,
    ...t
  }));

  const { data, error } = await supabase
    .from('qa_temuan')
    .insert(insertData)
    .select('*, qa_indicators(id, name, category, bobot, has_na, service_type), qa_periods(id, month, year)');
  
  if (error) throw error;
  
  // Log Activity once for the batch
  await supabase.from('activity_logs').insert({
    user_id: user.id,
    user_name: user.email,
    action: `Input ${temuanList.length} Temuan SIDAK untuk Peserta ID: ${peserta_id}`,
    module: 'SIDAK',
    type: 'add'
  });

  revalidatePath('/qa-analyzer/input');
  revalidatePath('/qa-analyzer/dashboard');
  revalidatePath(`/qa-analyzer/agents/${peserta_id}`);
  
  return data ?? [];
}

export async function updateTemuanAction(
  id: string,
  patch: { nilai: number; ketidaksesuaian?: string; sebaiknya?: string }
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

  const allowedMutationRoles = ['trainer', 'trainers', 'admin', 'superadmin'];
  if (!profile || !allowedMutationRoles.includes(profile.role?.toLowerCase() ?? '')) {
    throw new Error('Akses ditolak: Role tidak memiliki izin untuk aksi ini');
  }
  const { data, error } = await supabase
    .from('qa_temuan')
    .update(patch)
    .eq('id', id)
    .select('*, qa_indicators(id, name, category, bobot, has_na, service_type), qa_periods(id, month, year)')
    .single();
  if (error) throw error;
  
  revalidatePath('/qa-analyzer/input');
  revalidatePath('/qa-analyzer/dashboard');
  if (data?.peserta_id) {
    revalidatePath(`/qa-analyzer/agents/${data.peserta_id}`);
  }
  
  return data;
}

export async function deleteTemuanAction(id: string) {
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

  const allowedMutationRoles = ['trainer', 'trainers', 'admin', 'superadmin'];
  if (!profile || !allowedMutationRoles.includes(profile.role?.toLowerCase() ?? '')) {
    throw new Error('Akses ditolak: Role tidak memiliki izin untuk aksi ini');
  }
  
  const { data: current } = await supabase.from('qa_temuan').select('peserta_id').eq('id', id).single();
  
  const { error } = await supabase.from('qa_temuan').delete().eq('id', id);
  if (error) throw error;

  // Log Activity
  await supabase.from('activity_logs').insert({
    user_id: user.id,
    user_name: user.email,
    action: `Menghapus Temuan SIDAK ID: ${id}`,
    module: 'SIDAK',
    type: 'delete'
  });
  
  revalidatePath('/qa-analyzer/input');
  revalidatePath('/qa-analyzer/dashboard');
  if (current?.peserta_id) {
    revalidatePath(`/qa-analyzer/agents/${current.peserta_id}`);
  }
}

export async function getAgentsByFolderAction(batch: string) {
  const { qaServiceServer } = await import('./services/qaService.server');
  return await qaServiceServer.getAgentsByFolder(batch);
}

export async function createPerfectScoreSessionAction(
  peserta_id: string,
  period_id: string,
  service_type: ServiceType,
  no_tiket?: string
) {
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

  const allowedMutationRoles = ['trainer', 'trainers', 'admin', 'superadmin'];
  if (!profile || !allowedMutationRoles.includes(profile.role?.toLowerCase() ?? '')) {
    throw new Error('Akses ditolak: Role tidak memiliki izin untuk aksi ini');
  }

  // get pesertas info
  const { data: agent, error: agentErr } = await supabase
    .from('profiler_peserta')
    .select('tim, jabatan')
    .eq('id', peserta_id)
    .single();
  if (agentErr || !agent) throw new Error('Agent tidak ditemukan');

  

  // get indicators
  const { data: inds, error: indsErr } = await supabase
    .from('qa_indicators')
    .select('id')
    .eq('service_type', service_type);
  if (indsErr || !inds) throw new Error('Gagal mengambil parameter untuk agent ini');

  if (inds.length === 0) throw new Error('Tidak ada parameter untuk tim agent ini');

  const insertData = inds.map((ind: any) => ({
    peserta_id,
    period_id,
    indicator_id: ind.id,
    no_tiket: no_tiket || undefined,
    nilai: 3,
    service_type
  }));

  const { data, error } = await supabase
    .from('qa_temuan')
    .insert(insertData)
    .select('*, qa_indicators(id, name, category, bobot, has_na, service_type), qa_periods(id, month, year)');
  
  if (error) throw error;

  await supabase.from('activity_logs').insert({
    user_id: user.id,
    user_name: user.email,
    action: `Input Sesi Tanpa Temuan SIDAK untuk Peserta ID: ${peserta_id}`,
    module: 'SIDAK',
    type: 'add'
  });

  revalidatePath('/qa-analyzer/input');
  revalidatePath('/qa-analyzer/dashboard');
  revalidatePath(`/qa-analyzer/agents/${peserta_id}`);
  
  return data ?? [];
}

export async function getDashboardDataAction(period: string, service: string, folderIds: string[], timeframe: '3m' | '6m' | 'all', year: number): Promise<DashboardData> {
  const { qaServiceServer } = await import('./services/qaService.server');
  const { profilerServiceServer } = await import('../profiler/services/profilerService.server');
  
  // Re-fetch context and common metadata
  const [periods, indicators, availableYears, foldersData] = await Promise.all([
    qaServiceServer.getPeriods(),
    qaServiceServer.getIndicators(service),
    qaServiceServer.getAvailableYears(),
    profilerServiceServer.getFolders()
  ]);
  
  const context = { periods, indicators };

   const [periodData, trendData] = await Promise.all([
     qaServiceServer.getConsolidatedPeriodData(period, service, folderIds, context, year),
     qaServiceServer.getConsolidatedTrendData(timeframe, service, folderIds, context, year)
   ]);
   
   if (!periodData || !trendData) {
     throw new Error('Gagal mengambil data dashboard.');
   }
 
   return {
     periods,
     availableYears,
     currentYear: year,
     folders: foldersData
        .map((f: any) => ({
          id: typeof f === 'string' ? f : f.name,
          name: typeof f === 'string' ? f : f.name
        }))
        .filter((f: any) => !EXCLUDED_FOLDERS.some(ef => ef.toLowerCase() === f.name.toLowerCase())),
     summary: periodData.summary,
     serviceData: periodData.serviceData,
     topAgents: periodData.topAgents,
     paretoData: periodData.paretoData,
     donutData: periodData.donutData,
     paramTrend: trendData.paramTrend,
     sparklines: trendData.sparklines
   };
}

export async function getAvailableYearsAction() {
  const { qaServiceServer } = await import('./services/qaService.server');
  return await qaServiceServer.getAvailableYears();
}

export async function getAgentTemuanAction(agentId: string, year: number, page: number) {
  const { qaServiceServer } = await import('./services/qaService.server');
  return await qaServiceServer.getAgentWithTemuan(agentId, year, page);
}

export async function getRankingAgenAction(
  periodId: string,
  serviceType: string,
  folderIds?: string[],
  year?: number
): Promise<{ data: TopAgentData[]; error?: string }> {
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

  const allowedMutationRoles = ['trainer', 'trainers', 'admin', 'superadmin'];
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
  revalidatePath('/qa-analyzer/dashboard');
  revalidateTag('indicators');

  return data;
}
