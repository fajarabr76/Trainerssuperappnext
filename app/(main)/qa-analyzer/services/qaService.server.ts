import { createClient } from '@/app/lib/supabase/server';
import { unstable_cache } from 'next/cache';
import { getCachedFolderNames, getCachedAvailableYears } from '@/lib/cache/user-cache';
import { 
  AgentDirectoryEntry,
  AgentPeriodSummary,
  QAPeriod, 
  QAIndicator, 
  QATemuan, 
  DashboardSummary, 
  TrendPoint, 
  calculateQAScoreFromTemuan,
  ServiceType,
  ServiceWeight,
  ScoringMode,
  DEFAULT_SERVICE_WEIGHTS,
  TIM_TO_DEFAULT_SERVICE,
  SharedContext,
  SERVICE_LABELS,
  ServiceComparisonData,
  TopAgentData,
  ParetoData,
  CriticalVsNonCriticalData,
  ExportData,
  ExportPeriod,
  isAgentExcluded
} from '../lib/qa-types';

import { createClient as createJSClient } from '@supabase/supabase-js';

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'];
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
export const QA_DASHBOARD_RANGE_TAG = 'qa-dashboard-range';
export const QA_AGENT_DIRECTORY_TAG = 'qa-agent-directory';
export const QA_AGENT_DETAIL_TAG = 'qa-agent-detail';

// Lazy Service Role client helper (Server-side only)
function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createJSClient(url, key);
}

let phantomSupportCache: boolean | null = null;

function isMissingPhantomColumnError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  const message = (error.message || '').toLowerCase();
  return error.code === '42703'
    || error.code === 'PGRST204'
    || message.includes('is_phantom_padding')
    || message.includes('column')
    || message.includes('schema cache');
}

async function hasPhantomPaddingSupport(
  client: any
): Promise<boolean> {
  if (phantomSupportCache !== null) return phantomSupportCache;

  const probeClient = getServiceSupabase() || client;
  const { error } = await probeClient
    .from('qa_temuan')
    .select('id, is_phantom_padding')
    .limit(1);

  if (!error) {
    phantomSupportCache = true;
    return true;
  }

  if (isMissingPhantomColumnError(error)) {
    phantomSupportCache = false;
    return false;
  }

  // Jika error bukan karena kolom tidak ada (mis. permission/intermitten),
  // default ke true agar filter phantom tetap aktif dan tidak bocor ke metrik temuan.
  console.warn('[QA] Phantom support probe ambiguous, defaulting to enabled:', error.message);
  return true;
}

// ── Cached Fetchers (Pure logic, no cookies() inside) ──────────

const cachedFetchIndicators = unstable_cache(
  async (service_type?: string): Promise<QAIndicator[]> => {
    const serviceSupabase = getServiceSupabase();
    if (!serviceSupabase) return [];

    let query = serviceSupabase
      .from('qa_indicators').select('*')
      .order('category').order('bobot', { ascending: false }).order('created_at', { ascending: true });
    
    if (service_type) query = query.eq('service_type', service_type);
    const { data, error } = await query;
    if (error) return [];
    return data ?? [];
  },
  ['qa_indicators_global'], // Base key
  { revalidate: 3600, tags: ['indicators'] }
);

const cachedFetchPeriods = unstable_cache(
  async (): Promise<QAPeriod[]> => {
    const serviceSupabase = getServiceSupabase();
    if (!serviceSupabase) return [];

    const { data, error } = await serviceSupabase
      .from('qa_periods').select('*')
      .order('year', { ascending: false }).order('month', { ascending: false });
    if (error) return [];
    return (data ?? []).map(p => ({
      ...p,
      label: `${MONTHS[p.month - 1]} ${p.year}`
    }));
  },
  ['qa_periods_global'],
  { revalidate: 3600, tags: ['periods'] }
);

const cachedFetchServiceWeights = unstable_cache(
  async (): Promise<Record<ServiceType, ServiceWeight>> => {
    const serviceSupabase = getServiceSupabase();
    if (!serviceSupabase) return DEFAULT_SERVICE_WEIGHTS;

    const { data, error } = await serviceSupabase.from('qa_service_weights').select('*');
    if (error) return DEFAULT_SERVICE_WEIGHTS;

    const result = { ...DEFAULT_SERVICE_WEIGHTS };
    data?.forEach(row => {
      result[row.service_type as ServiceType] = {
        service_type: row.service_type,
        critical_weight: Number(row.critical_weight),
        non_critical_weight: Number(row.non_critical_weight),
        scoring_mode: row.scoring_mode as ScoringMode,
      };
    });
    return result;
  },
  ['qa_service_weights_global'],
  { revalidate: 3600, tags: ['indicators'] } // Using indicators tag for easy revalidation
);

function decodeFolderIds(folderIdsKey: string): string[] {
  if (!folderIdsKey) return [];

  try {
    const parsed = JSON.parse(folderIdsKey);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function encodeFolderIds(folderIds: string[]): string {
  return JSON.stringify([...folderIds].sort());
}

function formatPeriodLabel(month: number, year: number) {
  return `${MONTHS_SHORT[month - 1]} ${String(year).slice(-2)}`;
}

function unwrapPeriod(
  value: { month: number; year: number } | Array<{ month: number; year: number }> | null | undefined
) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

type CountableFindingLike = {
  nilai?: number | null;
  ketidaksesuaian?: string | null;
  sebaiknya?: string | null;
};

function hasMeaningfulNote(value: string | null | undefined) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isCountableFinding<T extends CountableFindingLike>(item: T | null | undefined): item is T {
  if (!item) return false;
  return Number(item.nilai ?? 3) < 3 || hasMeaningfulNote(item.ketidaksesuaian) || hasMeaningfulNote(item.sebaiknya);
}

function filterCountableFindings<T extends CountableFindingLike>(items: T[]): T[] {
  return items.filter((item): item is T => isCountableFinding(item));
}

function countCountableFindings<T extends CountableFindingLike>(items: T[]): number {
  return filterCountableFindings(items).length;
}

function normalizeAgentDirectoryEntry(raw: Record<string, unknown>): AgentDirectoryEntry {
  const avgScore = typeof raw.avgScore === 'number'
    ? raw.avgScore
    : typeof raw.avgscore === 'number'
      ? raw.avgscore
      : null;

  const trendValue = typeof raw.trendValue === 'number'
    ? raw.trendValue
    : typeof raw.trendvalue === 'number'
      ? raw.trendvalue
      : null;

  const atRisk = typeof raw.atRisk === 'boolean'
    ? raw.atRisk
    : typeof raw.atrisk === 'boolean'
      ? raw.atrisk
      : false;

  return {
    id: String(raw.id ?? ''),
    nama: String(raw.nama ?? ''),
    tim: String(raw.tim ?? ''),
    batch: String(raw.batch ?? raw.batch_name ?? ''),
    batch_name: String(raw.batch_name ?? raw.batch ?? ''),
    foto_url: typeof raw.foto_url === 'string' ? raw.foto_url : null,
    jabatan: typeof raw.jabatan === 'string' ? raw.jabatan : null,
    avgScore,
    trend: raw.trend === 'up' || raw.trend === 'down' || raw.trend === 'same' || raw.trend === 'none'
      ? raw.trend
      : 'none',
    trendValue,
    atRisk,
  };
}

function measureStart() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function logServerMetric(label: string, start: number, metadata?: Record<string, unknown>) {
  const end = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const durationMs = Number((end - start).toFixed(1));
  console.info(`[Perf] ${label} ${durationMs}ms`, metadata ?? {});
}

const cachedFetchDashboardRangeData = unstable_cache(
  async (serviceType: string, folderIdsKey: string, year: number, startMonth: number, endMonth: number) => {
    const serviceSupabase = getServiceSupabase();
    if (!serviceSupabase) return null;

    const folderIds = decodeFolderIds(folderIdsKey);
    const { data, error } = await serviceSupabase.rpc('get_qa_dashboard_range_data', {
      p_service_type: serviceType,
      p_year: year,
      p_start_month: startMonth,
      p_end_month: endMonth,
      p_folder_ids: folderIds,
    });

    if (error) {
      console.warn('[RPC] get_qa_dashboard_range_data error:', error.message);
      return null;
    }

    return data as {
      summary: DashboardSummary;
      paretoData: ParetoData[];
      serviceData: ServiceComparisonData[];
      donutData: CriticalVsNonCriticalData;
      topAgents: TopAgentData[];
    } | null;
  },
  ['qa_dashboard_range_data'],
  { revalidate: 300, tags: [QA_DASHBOARD_RANGE_TAG] }
);

const cachedFetchDashboardRangeTrend = unstable_cache(
  async (serviceType: string, folderIdsKey: string, year: number, startMonth: number, endMonth: number) => {
    const serviceSupabase = getServiceSupabase();
    if (!serviceSupabase) return null;

    const folderIds = decodeFolderIds(folderIdsKey);
    const { data, error } = await serviceSupabase.rpc('get_qa_dashboard_range_trend_data', {
      p_service_type: serviceType,
      p_year: year,
      p_start_month: startMonth,
      p_end_month: endMonth,
      p_folder_ids: folderIds,
    });

    if (error) {
      console.warn('[RPC] get_qa_dashboard_range_trend_data error:', error.message);
      return null;
    }

    return data as {
      sparklines: Record<string, TrendPoint[]>;
      paramTrend: { labels: string[]; datasets: Array<{ label: string; data: number[]; isTotal: boolean }> };
    } | null;
  },
  ['qa_dashboard_range_trend_data'],
  { revalidate: 300, tags: [QA_DASHBOARD_RANGE_TAG] }
);

const _cachedFetchAgentDirectorySummary = unstable_cache(
  async (year: number): Promise<AgentDirectoryEntry[] | null> => {
    const serviceSupabase = getServiceSupabase();
    if (!serviceSupabase) return null;

    const pageSize = 500;
    let from = 0;
    let totalCount: number | null = null;
    const rows: Record<string, unknown>[] = [];

    while (totalCount === null || from < totalCount) {
      const { data, error, count } = await serviceSupabase
        .rpc('get_qa_agent_directory_summary', {
          p_year: year,
        }, {
          count: 'exact',
        })
        .range(from, from + pageSize - 1);

      if (error) {
        console.warn('[RPC] get_qa_agent_directory_summary error:', error.message);
        return null;
      }

      if (totalCount === null) {
        totalCount = count ?? data?.length ?? 0;
      }

      if (!data || data.length === 0) {
        break;
      }

      rows.push(...(data as Record<string, unknown>[]));

      if (data.length < pageSize) {
        break;
      }

      from += pageSize;
    }

    return rows.map((entry) => normalizeAgentDirectoryEntry(entry));
  },
  ['qa_agent_directory_summary'],
  { revalidate: 300, tags: [QA_AGENT_DIRECTORY_TAG] }
);

const cachedFetchAgentPeriodSummaries = unstable_cache(
  async (agentId: string, year: number): Promise<AgentPeriodSummary[] | null> => {
    const serviceSupabase = getServiceSupabase();
    if (!serviceSupabase) return null;
    const hasPhantomSupport = await hasPhantomPaddingSupport(serviceSupabase);
    const temuanPromise = hasPhantomSupport
      ? serviceSupabase
          .from('qa_temuan')
          .select('indicator_id, nilai, ketidaksesuaian, sebaiknya, no_tiket, service_type, created_at, period_id, is_phantom_padding, qa_periods(month, year)')
          .eq('peserta_id', agentId)
          .eq('tahun', year)
          .order('created_at', { ascending: false })
      : serviceSupabase
          .from('qa_temuan')
          .select('indicator_id, nilai, ketidaksesuaian, sebaiknya, no_tiket, service_type, created_at, period_id, qa_periods(month, year)')
          .eq('peserta_id', agentId)
          .eq('tahun', year)
          .order('created_at', { ascending: false });

    const [{ data: temuanRaw, error: temuanError }, indicators, weights] = await Promise.all([
      temuanPromise,
      cachedFetchIndicators(),
      cachedFetchServiceWeights(),
    ]);

    if (temuanError) {
      console.warn('[Cache] agent period summaries error:', temuanError.message);
      return null;
    }

    const temuan = ((temuanRaw ?? []) as Array<{
      indicator_id: string;
      nilai: number;
      ketidaksesuaian?: string | null;
      sebaiknya?: string | null;
      no_tiket?: string | null;
      service_type: ServiceType;
      created_at?: string;
      period_id: string;
      is_phantom_padding?: boolean | null;
      qa_periods?: { month: number; year: number } | Array<{ month: number; year: number }> | null;
    }>).map((item) => ({
      ...item,
      qa_periods: unwrapPeriod(item.qa_periods),
    }));

    const periodsMap = new Map<string, AgentPeriodSummary>();
    const grouped = new Map<string, typeof temuan>();

    temuan.forEach((item) => {
      if (!item.qa_periods) return;
      const serviceType = item.service_type;
      const key = `${item.period_id}:${serviceType}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(item);
    });

    grouped.forEach((items, key) => {
      const sample = items[0];
      const period = sample.qa_periods;
      if (!period) return;

      const serviceIndicators = indicators.filter((indicator) => indicator.service_type === sample.service_type);
      const score = calculateQAScoreFromTemuan(
        serviceIndicators,
        items.map((item) => ({
          indicator_id: item.indicator_id,
          nilai: item.nilai,
          no_tiket: item.no_tiket,
          created_at: item.created_at,
          period_id: item.period_id,
        })),
        weights[sample.service_type] || DEFAULT_SERVICE_WEIGHTS[sample.service_type]
      );

      periodsMap.set(key, {
        id: sample.period_id,
        month: period.month,
        year: period.year,
        label: formatPeriodLabel(period.month, period.year),
        serviceType: sample.service_type,
        finalScore: score.finalScore,
        nonCriticalScore: score.nonCriticalScore,
        criticalScore: score.criticalScore,
        sessionCount: score.sessionCount,
        findingsCount: countCountableFindings(items.filter((item) => !item.is_phantom_padding)),
      });
    });

    return [...periodsMap.values()].sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      if (a.month !== b.month) return b.month - a.month;
      return a.serviceType.localeCompare(b.serviceType);
    });
  },
  ['qa_agent_period_summaries'],
  { revalidate: 300, tags: [QA_AGENT_DETAIL_TAG] }
);

export const qaServiceServer = {
  // ── Years (REVERTED TO DIRECT FETCH DUE TO RLS) ──────────────
  async getAvailableYears(): Promise<number[]> {
    try {
      return await getCachedAvailableYears();
    } catch (e) {
      console.error('Error in getAvailableYears:', e);
      return [];
    }
  },

  // ── Indicators (GLOBAL CACHE WITH RL FALLBACK) ───────────────
  async getIndicators(service_type?: string): Promise<QAIndicator[]> {
    // Rely on service-role cache (bypasses RLS)
    const cached = await cachedFetchIndicators(service_type);
    if (cached && cached.length > 0) return cached;

    // Fallback only if cache/service client fails
    const supabase = await createClient();
    let query = supabase
      .from('qa_indicators').select('*')
      .order('category').order('bobot', { ascending: false }).order('created_at', { ascending: true });
    
    if (service_type) query = query.eq('service_type', service_type);
    const { data } = await query;
    return data ?? [];
  },

  // ── Folders (REVERTED TO DIRECT FETCH DUE TO RLS) ────────────
  async getFolders(): Promise<string[]> {
    try {
      const supabase = await createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('Unauthenticated');
      
      return await getCachedFolderNames();
    } catch (e) {
      console.error('Error in getFolders:', e);
      return [];
    }
  },

  // ── Periods (GLOBAL CACHE WITH RL FALLBACK) ──────────────────
  async getPeriods(): Promise<QAPeriod[]> {
    // Rely on service-role cache (bypasses RLS)
    const cached = await cachedFetchPeriods();
    if (cached && cached.length > 0) return cached;

    // Fallback only if cache/service client fails
    const supabase = await createClient();
    const { data } = await supabase
      .from('qa_periods').select('*')
      .order('year', { ascending: false }).order('month', { ascending: false });
    return (data ?? []).map(p => ({
      ...p,
      label: `${MONTHS[p.month - 1]} ${p.year}`
    }));
  },

  async getServiceWeights(): Promise<Record<ServiceType, ServiceWeight>> {
    return await cachedFetchServiceWeights();
  },

  // ── QA Temuan CRUD ────────────────────────────────────────────
  async getTemuanByAgentPeriod(
    peserta_id: string, period_id: string
  ): Promise<QATemuan[]> {
    const supabase = await createClient();
    const supportsPhantom = await hasPhantomPaddingSupport(supabase);
    let query = supabase
      .from('qa_temuan')
      .select('*, qa_indicators(id, name, category, bobot, has_na, service_type), qa_periods(id, month, year)')
      .eq('peserta_id', peserta_id)
      .eq('period_id', period_id);
    if (supportsPhantom) {
      query = query.eq('is_phantom_padding', false);
    }
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  // ── Agents ────────────────────────────────────────────────────
  async getAgentMiniProfile(peserta_id: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('profiler_peserta')
      .select('id, nama, tim, batch_name, foto_url, jabatan, bergabung_date')
      .eq('id', peserta_id)
      .single();
    if (error) throw error;
    return {
      ...data,
      batch: data.batch_name
    };
  },

  async getAgentDirectorySummary(year: number = new Date().getFullYear()) {
    const startedAt = measureStart();
    // Keep directory scores aligned with the detail page by using the same
    // TypeScript scoring path, which already paginates qa_temuan fetches past
    // the 1000-row PostgREST cap.
    const accurate = await this.getAgentListWithScores(year);
    logServerMetric('qa.agentDirectorySummary.accurate', startedAt, { year, count: accurate.length });
    return accurate;
  },

  async getAgentListWithScores(year: number = new Date().getFullYear()) {
    const supabase = await createClient();
    // 1. Fetch agents
    const { data: agentData, error: agentError } = await supabase
      .from('profiler_peserta')
      .select('id, nama, tim, batch_name, foto_url, jabatan')
      .order('nama');
    if (agentError) throw agentError;
    const agents = (agentData ?? []).filter(a => !isAgentExcluded(a.tim, a.batch_name, a.jabatan));

    // 2. Initial service client (bypass RLS for all aggregate lookups)
    const serviceClient = getServiceSupabase() || supabase;

    // 3a. Fetch all indicators
    const { data: indsData, error: indsError } = await serviceClient
      .from('qa_indicators')
      .select('id, name, category, bobot, has_na, service_type');
    if (indsError) throw indsError;
    const allIndicators: QAIndicator[] = indsData ?? [];

    // 3b. Fetch all weights
    const serviceWeights = await this.getServiceWeights();

    // 3c. Fetch all periods
    const { data: periodsData } = await serviceClient
      .from('qa_periods')
      .select('id, month, year');
    const periodsMap = new Map<string, { id: string; month: number; year: number }>();
    (periodsData ?? []).forEach(p => periodsMap.set(p.id, p));

    // 3b. Fetch all temuan WITHOUT join — service client (bypass RLS), period data attached manually below
    // PENTING: Menggunakan pagination manual (range) karena Supabase max_rows dibatasi 1000
    let allTemuanData: any[] = [];
    let from = 0;
    const step = 1000;
    let finished = false;

    while (!finished) {
      const { data, error } = await serviceClient
        .from('qa_temuan')
        .select('peserta_id, indicator_id, nilai, no_tiket, service_type, ketidaksesuaian, sebaiknya, period_id, created_at')
        .eq('tahun', year)
        .range(from, from + step - 1);

      if (error) throw error;
      if (!data || data.length === 0) {
        finished = true;
      } else {
        allTemuanData = [...allTemuanData, ...data];
        if (data.length < step) {
          finished = true;
        } else {
          from += step;
        }
      }
    }

    // 3c. Enrich temuan with period data (safe — no dependency on PostgREST join)
    const allTemuan = allTemuanData.map(t => ({
      ...t,
      qa_periods: periodsMap.get(t.period_id) ?? null,
    }));

    const agentDataMap = new Map<string, any>();
    agents.forEach(a => {
      agentDataMap.set(a.id, {
        ...a,
        avgScore: null,
        trend: 'none',
        trendValue: null,
        atRisk: false
      });
    });

    function periodServiceKey(m: number, y: number, s: string) { return `${y}-${String(m).padStart(2, '0')}-${s}`; }

    const temuanByAgent = new Map<string, any[]>();
    allTemuan.forEach(t => {
      if (!t.qa_periods) return; // skip only if period truly doesn't exist
      if (!temuanByAgent.has(t.peserta_id)) temuanByAgent.set(t.peserta_id, []);
      temuanByAgent.get(t.peserta_id)!.push(t);
    });

    agentDataMap.forEach((agentObj, agentId) => {
      const agentTemuan = temuanByAgent.get(agentId) || [];
      if (agentTemuan.length === 0) return;

      const pSvcMap = new Map<string, any[]>();
      agentTemuan.forEach(t => {
        // Standardize service to lowercase
        const activeService = (t.service_type || TIM_TO_DEFAULT_SERVICE[agentObj.tim] || 'call').toLowerCase();
        const psk = periodServiceKey(t.qa_periods.month, t.qa_periods.year, activeService);
        if (!pSvcMap.has(psk)) pSvcMap.set(psk, []);
        pSvcMap.get(psk)!.push(t);
      });

      const sortedPsk = [...pSvcMap.keys()].sort((a, b) => b.localeCompare(a));
      const latestPsk = sortedPsk[0];
      
      const latestTemuan = pSvcMap.get(latestPsk)!;
      // Standardize service to lowercase
      const activeService = (latestTemuan[0]?.service_type || TIM_TO_DEFAULT_SERVICE[agentObj.tim] || 'call').toLowerCase();
      const teamInds = allIndicators.filter(i => (i.service_type || '').toLowerCase() === activeService);

      // Latest Score
      const latestScore = calculateQAScoreFromTemuan(
        teamInds,
        latestTemuan.map(t => ({ indicator_id: t.indicator_id, nilai: t.nilai, no_tiket: t.no_tiket, created_at: t.created_at, ketidaksesuaian: t.ketidaksesuaian, sebaiknya: t.sebaiknya })),
        serviceWeights[activeService as ServiceType] || DEFAULT_SERVICE_WEIGHTS[activeService as ServiceType]
      );

      agentObj.avgScore = latestScore.finalScore;
      agentObj.atRisk = latestScore.finalScore < 95;

      // Previous Score for Trend - MODIFIED: Search for previous period WITH SAME service type first
      // This prevents cross-service comparisons (e.g., Call vs Email) which are misleading
      let prevPsk = sortedPsk.find((key, idx) => idx > 0 && key.endsWith(activeService));
      if (!prevPsk && sortedPsk.length > 1) {
        prevPsk = sortedPsk[1]; // Fallback to immediate previous if same service not found
      }

      if (prevPsk) {
        const prevTemuan = pSvcMap.get(prevPsk)!;
        const prevActiveService = prevTemuan[0]?.service_type || activeService;
        const prevTeamInds = allIndicators.filter(i => i.service_type === prevActiveService);
        
        const prevScore = calculateQAScoreFromTemuan(
          prevTeamInds,
          prevTemuan.map(t => ({ indicator_id: t.indicator_id, nilai: t.nilai, no_tiket: t.no_tiket, created_at: t.created_at, ketidaksesuaian: t.ketidaksesuaian, sebaiknya: t.sebaiknya })),
          serviceWeights[prevActiveService as ServiceType] || DEFAULT_SERVICE_WEIGHTS[prevActiveService as ServiceType]
        );
        
        agentObj.trendValue = latestScore.finalScore - prevScore.finalScore;
        agentObj.trend = agentObj.trendValue > 0 ? 'up' : agentObj.trendValue < 0 ? 'down' : 'same';
      }
    });

    return [...agentDataMap.values()];
  },

  async getAgentPeriodSummaries(agentId: string, year: number = new Date().getFullYear()) {
    const startedAt = measureStart();
    const cached = await cachedFetchAgentPeriodSummaries(agentId, year);
    if (cached) {
      logServerMetric('qa.agentPeriodSummaries.cache', startedAt, { agentId, year, periods: cached.length });
      return { periods: cached };
    }

    const supabase = await createClient();
    const hasPhantomSupport = await hasPhantomPaddingSupport(supabase);
    const temuanPromise = hasPhantomSupport
      ? supabase
          .from('qa_temuan')
          .select('indicator_id, nilai, ketidaksesuaian, sebaiknya, no_tiket, service_type, created_at, period_id, is_phantom_padding, qa_periods(month, year)')
          .eq('peserta_id', agentId)
          .eq('tahun', year)
          .order('created_at', { ascending: false })
      : supabase
          .from('qa_temuan')
          .select('indicator_id, nilai, ketidaksesuaian, sebaiknya, no_tiket, service_type, created_at, period_id, qa_periods(month, year)')
          .eq('peserta_id', agentId)
          .eq('tahun', year)
          .order('created_at', { ascending: false });
    const [{ data: temuanRaw, error }, allIndicators, weights] = await Promise.all([
      temuanPromise,
      this.getIndicators(),
      this.getServiceWeights(),
    ]);

    if (error) throw error;

    const temuan = ((temuanRaw ?? []) as Array<{
      indicator_id: string;
      nilai: number;
      ketidaksesuaian?: string | null;
      sebaiknya?: string | null;
      no_tiket?: string | null;
      service_type: ServiceType;
      created_at?: string;
      period_id: string;
      is_phantom_padding?: boolean | null;
      qa_periods?: { month: number; year: number } | Array<{ month: number; year: number }> | null;
    }>).map((item) => ({
      ...item,
      qa_periods: unwrapPeriod(item.qa_periods),
    }));

    const grouped = new Map<string, typeof temuan>();
    temuan.forEach((item) => {
      if (!item.qa_periods) return;
      const key = `${item.period_id}:${item.service_type}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(item);
    });

    const periods = [...grouped.values()]
      .map((items) => {
        const sample = items[0];
        const period = sample.qa_periods!;
        const indicators = allIndicators.filter((indicator) => indicator.service_type === sample.service_type);
        const score = calculateQAScoreFromTemuan(
          indicators,
          items.map((item) => ({
            indicator_id: item.indicator_id,
            nilai: item.nilai,
            no_tiket: item.no_tiket,
            created_at: item.created_at,
            period_id: item.period_id,
          })),
          weights[sample.service_type] || DEFAULT_SERVICE_WEIGHTS[sample.service_type]
        );

        return {
          id: sample.period_id,
          month: period.month,
          year: period.year,
          label: formatPeriodLabel(period.month, period.year),
          serviceType: sample.service_type,
          finalScore: score.finalScore,
          nonCriticalScore: score.nonCriticalScore,
          criticalScore: score.criticalScore,
          sessionCount: score.sessionCount,
          findingsCount: countCountableFindings(items.filter((item) => !item.is_phantom_padding)),
        };
      })
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        if (a.month !== b.month) return b.month - a.month;
        return a.serviceType.localeCompare(b.serviceType);
      });

    logServerMetric('qa.agentPeriodSummaries.fallback', startedAt, { agentId, year, periods: periods.length });
    return { periods };
  },

  async getAgentTemuanPage(
    agentId: string,
    year: number,
    periodId: string,
    serviceType: string,
    page: number,
    pageSize: number = 50
  ) {
    const supabase = await createClient();
    const supportsPhantom = await hasPhantomPaddingSupport(supabase);
    const from = Math.max(page, 0) * pageSize;
    const to = from + pageSize;

    let query = supabase
      .from('qa_temuan')
      .select('*, qa_indicators(id, name, category, bobot, has_na, service_type), qa_periods(id, month, year)', {
        count: 'exact',
      })
      .eq('peserta_id', agentId)
      .eq('tahun', year)
      .eq('period_id', periodId)
      .eq('service_type', serviceType);
    if (supportsPhantom) {
      query = query.eq('is_phantom_padding', false);
    }
    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to - 1);

    if (error) throw error;

    const total = count ?? 0;
    return {
      temuan: (data ?? []) as QATemuan[],
      total,
      hasMore: to < total,
    };
  },


  async getAgentWithTemuan(peserta_id: string, year?: number, page?: number) {
    const supabase = await createClient();
    const supportsPhantom = await hasPhantomPaddingSupport(supabase);
    const { data: agentRaw, error: agentError } = await supabase
      .from('profiler_peserta').select('*').eq('id', peserta_id).single();
    if (agentError) throw agentError;

    const agent = {
      ...agentRaw,
      batch: agentRaw.batch_name
    };

    let query = supabase
      .from('qa_temuan')
      .select('*, qa_indicators(id, name, category, bobot, has_na, service_type), qa_periods(id, month, year)')
      .eq('peserta_id', peserta_id)
      .order('created_at', { ascending: false });
    if (supportsPhantom) {
      query = query.eq('is_phantom_padding', false);
    }

    if (year) {
      query = query.eq('tahun', year);
    }

    // Optional Pagination: If page is provided (>= 0), use range. 
    // If page is undefined or null, fetch all for accurate scoring calculation
    if (page !== undefined && page !== null && page >= 0) {
      const from = page * 50;
      const to = from + 49;
      query = query.range(from, to);
    } else {
      // High limit for exhaustive fetch to ensure scoreHistory accuracy
      query = query.limit(5000);
    }

    const { data: temuan, error: temuanError } = await query;
    if (temuanError) throw temuanError;

    return { agent, temuan: temuan ?? [] };
  },


  async getAgentsByFolder(batch: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('profiler_peserta')
      .select('id, nama, tim, batch_name, jabatan')
      .eq('batch_name', batch)
      .order('nama');
    if (error) throw error;
    const byBatch = (data ?? [])
      .filter((a: any) => !isAgentExcluded(a.tim, a.batch_name, a.jabatan))
      .map((a: any) => ({
        id: a.id,
        nama: a.nama,
        tim: a.tim,
        batch: a.batch_name,
        jabatan: a.jabatan
      }));

    if (byBatch.length > 0) {
      return byBatch;
    }

    const normalized = batch.trim().toLowerCase();
    const isSpecialTeam = normalized === 'bko' || normalized === 'slik';
    if (!isSpecialTeam) {
      return byBatch;
    }

    const { data: teamData, error: teamError } = await supabase
      .from('profiler_peserta')
      .select('id, nama, tim, batch_name, jabatan')
      .ilike('tim', `%${batch}%`)
      .order('nama');

    if (teamError) throw teamError;
    return (teamData ?? [])
      .filter((a: any) => !isAgentExcluded(a.tim, a.batch_name, a.jabatan))
      .map((a: any) => ({
        id: a.id,
        nama: a.nama,
        tim: a.tim,
        batch: a.batch_name,
        jabatan: a.jabatan
      }));
  },

  // ── Dashboard Aggregations ────────────────────────────────────
  async resolvePeriodIds(periodId: string, customYear?: number): Promise<string[]> {
    const supabase = await createClient();

    // alltime: ambil semua period id tanpa filter year
    if (periodId === 'alltime') {
      const { data } = await supabase
        .from('qa_periods')
        .select('id');
      return data && data.length > 0 
        ? data.map(p => p.id) 
        : ['none'];
    }

    // ytd: tetap logika yang sudah ada
    if (periodId !== 'ytd') return [periodId];
    const year = customYear || new Date().getFullYear();
    const { data } = await supabase.from('qa_periods').select('id').eq('year', year);
    return data && data.length > 0 ? data.map(p => p.id) : ['none'];
  },

  async getDashboardSummary(periodId: string, serviceType: string, folderIds: string[] = [], context?: SharedContext, year?: number): Promise<DashboardSummary> {
    const supabase = await createClient();
    const hasPhantomSupport = await hasPhantomPaddingSupport(supabase);
    const pIds = await this.resolvePeriodIds(periodId, year);

    // 1. Fetch Findings first to determine audited population
    let query = supabase
      .from('qa_temuan')
      .select('*, qa_indicators(category), profiler_peserta!inner(batch_name, tim)')
      .in('period_id', pIds)
      .eq('tahun', year || new Date().getFullYear())
      .eq('service_type', serviceType);

    if (folderIds.length > 0) {
      query = query.in('profiler_peserta.batch_name', folderIds);
    }
    if (hasPhantomSupport) {
      query = query.eq('is_phantom_padding', false);
    }

    const { data, error } = await query;
    if (error || !data || data.length === 0) {
      return { totalDefects: 0, avgDefectsPerAudit: 0, zeroErrorRate: 0, avgAgentScore: 0, complianceRate: 0, complianceCount: 0, totalAgents: 0 };
    }

    // 2. Determine Audited Population
    const agentTemuanMap: Record<string, any[]> = {};
    const auditedAgentsList: any[] = [];
    const seenAgents = new Set();

    data.forEach(d => {
      if (!agentTemuanMap[d.peserta_id]) {
        agentTemuanMap[d.peserta_id] = [];
      }
      agentTemuanMap[d.peserta_id].push({ 
        indicator_id: d.indicator_id, 
        nilai: d.nilai, 
        no_tiket: d.no_tiket, 
        service_type: d.service_type 
      });

      if (!seenAgents.has(d.peserta_id)) {
        seenAgents.add(d.peserta_id);
        auditedAgentsList.push({
          id: d.peserta_id,
          batch_name: d.profiler_peserta?.batch_name,
          tim: d.profiler_peserta?.tim
        });
      }
    });

    const totalAuditedAgents = auditedAgentsList.length;
    const allIndicators = context?.indicators || (await this.getIndicators()) as QAIndicator[];
    const allFindings = filterCountableFindings(data);

    // 3. Calculate Rates over Audited Population
    let agentsWithZeroError = 0;
    let agentsWithPassScore = 0;
    let totalScore = 0;
    
    // Fetch weights once before the loop
    const serviceWeights = await this.getServiceWeights();
    const activeWeight = serviceWeights[serviceType as ServiceType] || DEFAULT_SERVICE_WEIGHTS[serviceType as ServiceType];
    const teamInds = allIndicators.filter(i => i.service_type === serviceType);

    auditedAgentsList.forEach(agent => {
      const temuanList = agentTemuanMap[agent.id] || [];
      
      // Zero Error Check
      const hasDefect = temuanList.some(t => t.nilai < 3);
      if (!hasDefect) {
        agentsWithZeroError++;
      }

      // Compliance Check
      const result = calculateQAScoreFromTemuan(teamInds, temuanList, activeWeight);
      totalScore += result.finalScore;
      if (result.finalScore >= 95) {
        agentsWithPassScore++;
      }
    });

    return {
      totalDefects: allFindings.length,
      avgDefectsPerAudit: totalAuditedAgents > 0 ? allFindings.length / totalAuditedAgents : 0,
      zeroErrorRate: totalAuditedAgents > 0 ? (agentsWithZeroError / totalAuditedAgents) * 100 : 0,
      avgAgentScore: totalAuditedAgents > 0 ? totalScore / totalAuditedAgents : 0,
      complianceRate: totalAuditedAgents > 0 ? (agentsWithPassScore / totalAuditedAgents) * 100 : 0,
      complianceCount: agentsWithPassScore,
      totalAgents: totalAuditedAgents
    };
  },

  async getKpiSparkline(periodId: string | undefined | null, metric: 'total' | 'avg' | 'zero_error' | 'compliance', timeframe: '3m' | '6m' | 'all' = '3m', serviceType: string = 'call', folderIds: string[] = [], context?: SharedContext, year?: number): Promise<TrendPoint[]> {
    const supabase = await createClient();
    const hasPhantomSupport = await hasPhantomPaddingSupport(supabase);
    // 1. Fetch recent periods
    const limitMap = { '3m': 3, '6m': 6, 'all': 12 };
    const limit = limitMap[timeframe] || 3;
    
    let sortedPeriods: QAPeriod[] = [];
    if (context?.periods) {
      sortedPeriods = [...context.periods].slice(0, limit).reverse();
    } else {
      const periodQuery = supabase.from('qa_periods').select('*').order('year', { ascending: false }).order('month', { ascending: false }).limit(limit);
      const { data: periods, error: pError } = await periodQuery;
      if (pError || !periods || periods.length === 0) return [];
      sortedPeriods = [...periods].reverse();
    }

    // 2. Fetch findings for these periods
    const pIds = sortedPeriods.map(p => p.id);
    if (pIds.length === 0) return [];

    let temuanQuery = supabase
      .from('qa_temuan')
      .select('nilai, ketidaksesuaian, sebaiknya, no_tiket, period_id, peserta_id, indicator_id, qa_indicators(category), profiler_peserta!inner(batch_name, tim)')
      .in('period_id', pIds)
      .eq('tahun', year || (periodId === 'ytd' ? (new Date().getFullYear()) : sortedPeriods[0]?.year || new Date().getFullYear()));

    if (serviceType) {
      temuanQuery = temuanQuery.eq('service_type', serviceType);
    }

    if (folderIds.length > 0) {
      temuanQuery = temuanQuery.in('profiler_peserta.batch_name', folderIds);
    }
    if (hasPhantomSupport) {
      temuanQuery = temuanQuery.eq('is_phantom_padding', false);
    }

    const { data: temuan, error: tError } = await temuanQuery;
    if (tError) return sortedPeriods.map(p => ({ label: `${MONTHS_SHORT[p.month - 1]} ${String(p.year).slice(-2)}`, value: 0 }));

    let allIndicators: QAIndicator[] = [];
    if (metric === 'compliance') {
      allIndicators = context?.indicators || (await this.getIndicators()) as QAIndicator[];
    }

    const temuanByPeriod = (temuan || []).reduce((acc: any, t: any) => {
      if (!acc[t.period_id]) acc[t.period_id] = [];
      acc[t.period_id].push(t);
      return acc;
    }, {});

    const serviceWeights = await this.getServiceWeights();
    const activeWeight = serviceWeights[serviceType as ServiceType] || DEFAULT_SERVICE_WEIGHTS[serviceType as ServiceType];
    const teamInds = allIndicators.filter(i => i.service_type === serviceType);

    return sortedPeriods.map(p => {
      const pTemuan = temuanByPeriod[p.id] || [];
      const auditedAgentsInPeriod = new Set(pTemuan.map((t: any) => t.peserta_id));
      const totalAudited = auditedAgentsInPeriod.size;
      let value = 0;

      if (metric === 'total') {
        value = countCountableFindings(pTemuan);
      }
      else if (metric === 'avg') {
        const totalFindings = countCountableFindings(pTemuan);
        value = totalAudited > 0 ? totalFindings / totalAudited : 0;
      }
      else if (metric === 'zero_error') {
        if (totalAudited > 0) {
          let zeroErrorCount = 0;
          auditedAgentsInPeriod.forEach(agentId => {
            const hasDefect = pTemuan.some((t: any) => t.peserta_id === agentId && t.nilai < 3);
            if (!hasDefect) zeroErrorCount++;
          });
          value = (zeroErrorCount / totalAudited) * 100;
        }
      }
      else if (metric === 'compliance') {
        if (totalAudited > 0) {
          let passCount = 0;
          auditedAgentsInPeriod.forEach(agentId => {
            const agentTemuans = pTemuan.filter((t: any) => t.peserta_id === agentId);
            const result = calculateQAScoreFromTemuan(
              teamInds,
              agentTemuans.map((t: any) => ({ indicator_id: t.indicator_id, nilai: t.nilai, no_tiket: t.no_tiket })),
              activeWeight
            );
            if (result.finalScore >= 95) passCount++;
          });
          value = passCount;
        }
      }

      return {
        label: `${MONTHS_SHORT[p.month - 1]} ${String(p.year).slice(-2)}`,
        value: Number(value.toFixed(1))
      };
    });
  },

  async getTrendWithParameters(periodId: string, serviceType: string, folderIds: string[] = [], timeframe: '3m' | '6m' | 'all' = '3m', context?: SharedContext, year?: number) {
    const supabase = await createClient();
    const hasPhantomSupport = await hasPhantomPaddingSupport(supabase);
    const limitMap = { '3m': 3, '6m': 6, 'all': 12 };
    const limit = limitMap[timeframe] || 3;

    let sortedPeriods: QAPeriod[] = [];
    if (context?.periods) {
      sortedPeriods = [...context.periods].slice(0, limit).reverse();
    } else {
      const { data: periods } = await supabase.from('qa_periods').select('*').order('year', { ascending: false }).order('month', { ascending: false }).limit(limit);
      if (!periods) return { labels: [], datasets: [] };
      sortedPeriods = [...periods].reverse();
    }
    
    const pIds = sortedPeriods.map(p => p.id);
    const labels = sortedPeriods.map(p => `${MONTHS_SHORT[p.month - 1]} ${String(p.year).slice(-2)}`);

    let query = supabase
      .from('qa_temuan')
      .select('nilai, ketidaksesuaian, sebaiknya, period_id, qa_indicators(name), profiler_peserta!inner(batch_name)')
      .in('period_id', pIds)
      .eq('tahun', year || (periodId === 'ytd' ? (new Date().getFullYear()) : sortedPeriods[0]?.year || new Date().getFullYear()))
      .eq('service_type', serviceType);

    if (folderIds.length > 0) query = query.in('profiler_peserta.batch_name', folderIds);
    if (hasPhantomSupport) query = query.eq('is_phantom_padding', false);

    const { data: temuan } = await query;
    if (!temuan) return { labels, datasets: [] };

    const findings = filterCountableFindings(temuan as any[]);

    const counts: Record<string, Record<string, number>> = {};
    const totalByPeriod: Record<string, number> = {};

    findings.forEach((t: any) => {
      const pName = t.qa_indicators?.name || 'Unknown';
      const pid = t.period_id;
      if (!counts[pName]) counts[pName] = {};
      counts[pName][pid] = (counts[pName][pid] || 0) + 1;
      totalByPeriod[pid] = (totalByPeriod[pid] || 0) + 1;
    });

    const topParams = Object.entries(counts)
      .map(([name, periodCounts]) => ({ name, total: Object.values(periodCounts).reduce((a, b) => a + b, 0) }))
      .sort((a, b) => b.total - a.total).map(p => p.name);

    const datasets = [
      { label: 'Total Temuan', data: sortedPeriods.map(p => totalByPeriod[p.id] || 0), isTotal: true },
      ...topParams.map(name => ({ label: name, data: sortedPeriods.map(p => counts[name][p.id] || 0), isTotal: false }))
    ];

    return { labels, datasets };
  },

  async getServiceComparison(periodId: string, folderIds: string[] = [], _context?: SharedContext): Promise<ServiceComparisonData[]> {
    const supabase = await createClient();
    const hasPhantomSupport = await hasPhantomPaddingSupport(supabase);
    const pIds = await this.resolvePeriodIds(periodId);
    let query = supabase
      .from('qa_temuan')
      .select('nilai, ketidaksesuaian, sebaiknya, service_type, profiler_peserta!inner(batch_name)')
      .in('period_id', pIds);

    if (folderIds.length > 0) query = query.in('profiler_peserta.batch_name', folderIds);
    if (hasPhantomSupport) query = query.eq('is_phantom_padding', false);

    const { data, error } = await query;
    if (error || !data) return [];

    const serviceCounts: Record<string, number> = {};
    data.forEach(d => {
      if (!isCountableFinding(d)) return;
      const sType = d.service_type || 'Unknown';
      serviceCounts[sType] = (serviceCounts[sType] || 0) + 1;
    });

    return Object.entries(serviceCounts)
      .map(([sType, total]) => {
        const serviceLabel = SERVICE_LABELS[sType as ServiceType] || sType;
        return {
          name: serviceLabel,
          serviceType: sType,
          total,
          severity: (total > 50 ? 'Critical' : total > 30 ? 'High' : total > 15 ? 'Medium' : 'Low') as 'Critical' | 'High' | 'Medium' | 'Low'
        };
      })
      .sort((a, b) => b.total - a.total);
  },

  async getTopAgentsWithDefects(periodId: string, serviceType: string, limit: number = 5, folderIds: string[] = [], context?: SharedContext): Promise<TopAgentData[]> {
    const supabase = await createClient();
    const allIndicators = context?.indicators || (await this.getIndicators()) as QAIndicator[];
    const pIds = await this.resolvePeriodIds(periodId);
    const hasPhantomSupport = await hasPhantomPaddingSupport(supabase);

    let query = supabase
      .from('qa_temuan')
      .select('nilai, ketidaksesuaian, sebaiknya, no_tiket, indicator_id, is_phantom_padding, qa_indicators(category), profiler_peserta!inner(id, nama, batch_name, tim, jabatan)')
      .in('period_id', pIds)
      .eq('service_type', serviceType);

    if (folderIds.length > 0) query = query.in('profiler_peserta.batch_name', folderIds);

    const { data, error } = await query;
    if (error || !data) return [];

    const agentTemuanMap: Record<string, any[]> = {};
    const agentInfoMap: Record<string, any> = {};

    data.forEach(d => {
      const p = d.profiler_peserta as any;
      if (!p) return;
      if (!agentTemuanMap[p.id]) {
        agentTemuanMap[p.id] = [];
        agentInfoMap[p.id] = { id: p.id, nama: p.nama, batch_name: p.batch_name, tim: p.tim, jabatan: p.jabatan };
      }
      agentTemuanMap[p.id].push({
        indicator_id: d.indicator_id,
        nilai: d.nilai,
        no_tiket: d.no_tiket,
        ketidaksesuaian: d.ketidaksesuaian,
        sebaiknya: d.sebaiknya,
        is_phantom_padding: hasPhantomSupport ? (d as any).is_phantom_padding === true : false,
      });
    });

    const serviceInds = allIndicators.filter(i => i.service_type === serviceType);
    const serviceWeights = await this.getServiceWeights();
    const activeWeight = serviceWeights[serviceType as ServiceType] || DEFAULT_SERVICE_WEIGHTS[serviceType as ServiceType];

    const agentStats = Object.keys(agentTemuanMap).map(id => {
      const info = agentInfoMap[id];
      const temuanList = agentTemuanMap[id];
      const result = calculateQAScoreFromTemuan(serviceInds, temuanList, activeWeight);
      const defects = countCountableFindings(temuanList.filter((t: any) => !t.is_phantom_padding));
      const hasCritical = temuanList.some(t => {
        if (t.is_phantom_padding) return false;
        const ind = serviceInds.find(i => i.id === t.indicator_id);
        return t.nilai === 0 && ind?.category === 'critical';
      });

      return { agentId: id, nama: info.nama, batch: info.batch_name, defects, score: result.finalScore, hasCritical, tim: info.tim, jabatan: info.jabatan };
    })
    .filter(a => !isAgentExcluded(a.tim, a.batch, a.jabatan));

    return agentStats.sort((a, b) => b.defects - a.defects).slice(0, limit);
  },

  async getAllAgentsRanking(
    periodId: string,
    serviceType: string,
    folderIds: string[] = [],
    context?: SharedContext,
    year?: number
  ): Promise<TopAgentData[]> {
    const supabase = await createClient();
    const allIndicators = context?.indicators || (await this.getIndicators()) as QAIndicator[];
    const pIds = await this.resolvePeriodIds(periodId, year);
    const hasPhantomSupport = await hasPhantomPaddingSupport(supabase);

    let query = supabase
      .from('qa_temuan')
      .select('nilai, ketidaksesuaian, sebaiknya, no_tiket, indicator_id, is_phantom_padding, qa_indicators(category), profiler_peserta!inner(id, nama, batch_name, tim, jabatan)')
      .in('period_id', pIds)
      .eq('service_type', serviceType);

    if (folderIds.length > 0) query = query.in('profiler_peserta.batch_name', folderIds);

    const { data, error } = await query;
    if (error || !data) return [];

    const agentTemuanMap: Record<string, any[]> = {};
    const agentInfoMap: Record<string, any> = {};

    data.forEach(d => {
      const p = d.profiler_peserta as any;
      if (!p) return;
      if (!agentTemuanMap[p.id]) {
        agentTemuanMap[p.id] = [];
        agentInfoMap[p.id] = { id: p.id, nama: p.nama, batch_name: p.batch_name, tim: p.tim, jabatan: p.jabatan };
      }
      agentTemuanMap[p.id].push({
        indicator_id: d.indicator_id,
        nilai: d.nilai,
        no_tiket: d.no_tiket,
        ketidaksesuaian: d.ketidaksesuaian,
        sebaiknya: d.sebaiknya,
        is_phantom_padding: hasPhantomSupport ? (d as any).is_phantom_padding === true : false,
      });
    });

    const serviceInds = allIndicators.filter(i => i.service_type === serviceType);
    const serviceWeights = await this.getServiceWeights();
    const activeWeight = serviceWeights[serviceType as ServiceType] || DEFAULT_SERVICE_WEIGHTS[serviceType as ServiceType];

    const agentStats = Object.keys(agentTemuanMap).map(id => {
      const info = agentInfoMap[id];
      const temuanList = agentTemuanMap[id];
      const result = calculateQAScoreFromTemuan(serviceInds, temuanList, activeWeight);
      const defects = countCountableFindings(temuanList.filter((t: any) => !t.is_phantom_padding));
      const hasCritical = temuanList.some(t => {
        if (t.is_phantom_padding) return false;
        const ind = serviceInds.find(i => i.id === t.indicator_id);
        return t.nilai === 0 && ind?.category === 'critical';
      });

      return { agentId: id, nama: info.nama, batch: info.batch_name, defects, score: result.finalScore, hasCritical, tim: info.tim, jabatan: info.jabatan };
    })
    .filter(a => !isAgentExcluded(a.tim, a.batch, a.jabatan));

    return agentStats.sort((a, b) => b.defects - a.defects);
  },

  async getParetoData(periodId: string, serviceType: string, folderIds: string[] = [], _context?: SharedContext): Promise<ParetoData[]> {
    const supabase = await createClient();
    const hasPhantomSupport = await hasPhantomPaddingSupport(supabase);
    const pIds = await this.resolvePeriodIds(periodId);
    let query = supabase
      .from('qa_temuan')
      .select('nilai, ketidaksesuaian, sebaiknya, qa_indicators!inner(id, name, category), profiler_peserta!inner(batch_name)')
      .in('period_id', pIds)
      .eq('service_type', serviceType)
      .order('created_at', { ascending: true });

    if (folderIds.length > 0) query = query.in('profiler_peserta.batch_name', folderIds);
    if (hasPhantomSupport) query = query.eq('is_phantom_padding', false);

    const { data, error } = await query;
    if (error || !data) return [];

    const paramCounts: Record<string, { count: number, name: string, category: string }> = {};
    let totalDefects = 0;

    data.forEach(d => {
      if (!isCountableFinding(d)) return;
      const ind = d.qa_indicators as any;
      if (!ind) return;
      const id = ind.id;
      if (!paramCounts[id]) paramCounts[id] = { count: 0, name: ind.name.trim(), category: ind.category };
      paramCounts[id].count += 1;
      totalDefects += 1;
    });

    let cumulativeCount = 0;
    return Object.entries(paramCounts)
      .map(([_id, info]) => ({
        name: info.name.trim(),
        fullName: info.name.trim(),
        count: info.count,
        category: info.category as 'critical' | 'non_critical',
        cumulative: 0
      }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.fullName.localeCompare(b.fullName);
      })
      .map(item => {
        cumulativeCount += item.count;
        item.cumulative = totalDefects > 0 ? Number(((cumulativeCount / totalDefects) * 100).toFixed(1)) : 0;
        return item;
      });
  },

  // ── Dashboard Trend RPC ──────────────────────────────────────
  async getServiceTrendDashboard(p_period_ids: string[]) {
    const supabase = await createClient();
    const hasPhantomSupport = await hasPhantomPaddingSupport(supabase);

    if (hasPhantomSupport) {
      return this.getServiceTrendForDashboard('all');
    }

    const { data, error } = await supabase.rpc('get_service_trend_dashboard', {
      p_period_ids
    });
    if (error) {
      console.error('[RPC Error] get_service_trend_dashboard:', error);
      throw error;
    }
    // Cast ke type yang dibutuhkan DashboardClient & sliceTrendData
    return data as {
      labels: string[];
      totalData: number[];
      serviceData: Record<string, number[]>;
      activeServices: string[];
      serviceSummary: Record<string, { totalDefects: number; auditedAgents: number }>;
      totalSummary: { totalDefects: number; auditedAgents: number; activeServiceCount: number };
      periodStats: any[];
    };
  },

  // ── Consolidated Dashboard Data ──────────────────────────────
  async getConsolidatedPeriodData(
    periodId: string, 
    serviceType: string, 
    folderIds: string[] = [], 
    context?: SharedContext, 
    year?: number
  ) {
    const supabase = await createClient();
    const hasPhantomSupport = await hasPhantomPaddingSupport(supabase);
    const pIds = await this.resolvePeriodIds(periodId, year);
    const currentYear = year || new Date().getFullYear();

    // Single Query for all relevant finding data
    let query = supabase
      .from('qa_temuan')
      .select('*, qa_indicators(id, name, category, bobot), profiler_peserta!inner(id, nama, batch_name, tim, jabatan)')
      .in('period_id', pIds)
      .eq('tahun', currentYear);
      // Remove .eq('service_type', serviceType) to allow comparison across services

    if (folderIds.length > 0) {
      query = query.in('profiler_peserta.batch_name', folderIds);
    }
    if (hasPhantomSupport) {
      query = query.eq('is_phantom_padding', false);
    }

    const { data, error } = await query;
    console.log('[DEBUG] getConsolidatedPeriodData fetched rows:', data?.length);
    if (error || !data) {
      console.error('[DEBUG] getConsolidatedPeriodData DB Error:', error);
      return null;
    }

    const allIndicators = context?.indicators || (await this.getIndicators()) as QAIndicator[];
    console.log('[DEBUG] getConsolidatedPeriodData total indicators used:', allIndicators.length);
    const serviceInds = allIndicators.filter(i => i.service_type === serviceType);

    const currentServiceData = data.filter(d => d.service_type === serviceType);
    const serviceFindings = filterCountableFindings(currentServiceData);

    // ── 1. Calculate Summary ──
    const agentTemuanMap: Record<string, any[]> = {};
    const auditedAgentsList: any[] = [];
    const seenAgents = new Set();
    
    currentServiceData.forEach(d => {
      if (!agentTemuanMap[d.peserta_id]) agentTemuanMap[d.peserta_id] = [];
      agentTemuanMap[d.peserta_id].push({
        indicator_id: d.indicator_id,
        nilai: d.nilai,
        no_tiket: d.no_tiket,
        ketidaksesuaian: d.ketidaksesuaian,
        sebaiknya: d.sebaiknya,
      });

      if (!seenAgents.has(d.peserta_id)) {
        seenAgents.add(d.peserta_id);
        auditedAgentsList.push({ 
          id: d.peserta_id, 
          batch_name: d.profiler_peserta?.batch_name, 
          tim: d.profiler_peserta?.tim,
          jabatan: d.profiler_peserta?.jabatan
        });
      }
    });

    let agentsWithZeroError = 0;
    let agentsWithPassScore = 0;
    let totalScore = 0;
    auditedAgentsList.forEach(agent => {
      const temuanList = agentTemuanMap[agent.id] || [];
      if (!temuanList.some(t => t.nilai < 3)) agentsWithZeroError++;
      const res = calculateQAScoreFromTemuan(serviceInds, temuanList);
      if (res.finalScore >= 95) agentsWithPassScore++;
      totalScore += res.finalScore;
    });

    const summary: DashboardSummary = {
      totalDefects: serviceFindings.length,
      avgDefectsPerAudit: auditedAgentsList.length > 0 ? serviceFindings.length / auditedAgentsList.length : 0,
      zeroErrorRate: auditedAgentsList.length > 0 ? (agentsWithZeroError / auditedAgentsList.length) * 100 : 0,
      avgAgentScore: auditedAgentsList.length > 0 ? totalScore / auditedAgentsList.length : 0,
      complianceRate: auditedAgentsList.length > 0 ? (agentsWithPassScore / auditedAgentsList.length) * 100 : 0,
      complianceCount: agentsWithPassScore,
      totalAgents: auditedAgentsList.length
    };

    // ── 2. Calculate Pareto ──
    const paramCounts: Record<string, { count: number, name: string, category: string }> = {};
    serviceFindings.forEach(d => {
      const ind = (d.qa_indicators as any);
      if (!ind) return;
      if (!paramCounts[ind.id]) paramCounts[ind.id] = { count: 0, name: ind.name.trim(), category: ind.category };
      paramCounts[ind.id].count++;
    });

    let cumulativeCount = 0;
    const paretoData: ParetoData[] = Object.entries(paramCounts)
      .map(([_id, info]) => ({ name: info.name, fullName: info.name, count: info.count, category: info.category as any, cumulative: 0 }))
      .sort((a, b) => b.count - a.count || a.fullName.localeCompare(b.fullName))
      .map(item => {
        cumulativeCount += item.count;
        item.cumulative = serviceFindings.length > 0 ? Number(((cumulativeCount / serviceFindings.length) * 100).toFixed(1)) : 0;
        return item;
      });

    // ── 3. Calculate Service Comparison ──
    const serviceSummary: Record<string, { totalDefects: number, auditedAgents: number }> = {};
    const serviceAgentsMap: Record<string, Set<string>> = {};
    const activeServicesSet = new Set<string>();

    data.forEach(d => {
      const sType = d.service_type || 'unknown';
      activeServicesSet.add(sType);
      if (!serviceAgentsMap[sType]) serviceAgentsMap[sType] = new Set();
      serviceAgentsMap[sType].add(d.peserta_id);

      if (!isCountableFinding(d)) return;
      if (!serviceSummary[sType]) serviceSummary[sType] = { totalDefects: 0, auditedAgents: 0 };
      serviceSummary[sType].totalDefects++;
    });

    const results: ServiceComparisonData[] = Object.keys(serviceSummary).map(sType => {
      const defects = serviceSummary[sType].totalDefects;
      return {
        name: SERVICE_LABELS[sType as ServiceType] || sType,
        serviceType: sType,
        total: defects,
        severity: defects > 50 ? 'Critical' : defects > 30 ? 'High' : defects > 15 ? 'Medium' : 'Low'
      };
    });

    const serviceData = results;

    // ── 4. Critical vs Non-Critical ──
    // serviceFindings sudah difilter agar sesi tanpa temuan tidak ikut total temuan

    let critical = 0;
    let nonCritical = 0;
    serviceFindings.forEach(d => {
      if ((d.qa_indicators as any)?.category === 'critical') critical++;
      else nonCritical++;
    });
    const donutData = { critical, nonCritical, total: critical + nonCritical };

    // ── 5. Top Agents ──
    // Use auditedAgentsList which only contains agents for the current serviceType now
    const agentStats = auditedAgentsList
      .map(agent => {
        const temuans = agentTemuanMap[agent.id] || [];
        const res = calculateQAScoreFromTemuan(serviceInds, temuans);
        const agentDefects = countCountableFindings(temuans);
        return { 
          agentId: agent.id, 
          nama: (data.find(d => d.peserta_id === agent.id)?.profiler_peserta as any)?.nama, 
          batch: agent.batch_name, 
          tim: agent.tim,
          jabatan: agent.jabatan,
          defects: agentDefects, 
          score: res.finalScore, 
          hasCritical: temuans.some(t => {
            const ind = serviceInds.find(i => i.id === t.indicator_id);
            return t.nilai === 0 && ind?.category === 'critical';
          })
        };
      })
      .filter(a => !isAgentExcluded(a.tim, a.batch, a.jabatan))
      .sort((a, b) => b.defects - a.defects)
      .slice(0, 5);

    const _topAgents = agentStats;

    return { summary, serviceData, paretoData, donutData, topAgents: agentStats };
  },

  async getConsolidatedPeriodDataRPC(
    periodId: string,
    serviceType: string,
    folderIds: string[] = [],
    context?: SharedContext,
    year?: number
  ) {
    const supabase = await createClient();
    const pIds = await this.resolvePeriodIds(periodId, year);
    const currentYear = year || new Date().getFullYear();

    const { data, error } = await supabase.rpc('get_qa_dashboard_data', {
      p_period_ids: pIds,
      p_service_type: serviceType,
      p_year: currentYear,
      p_folder_ids: folderIds.length > 0 ? folderIds : []
    });

    if (error) {
      console.error('[RPC] get_qa_dashboard_data error:', error);
      return null;
    }

    const result = data as {
      summary: DashboardSummary;
      paretoData: ParetoData[];
      serviceData: ServiceComparisonData[];
      donutData: CriticalVsNonCriticalData;
      topAgents: TopAgentData[];
    };

    if (result.topAgents?.length > 0) {
      const agentIds = result.topAgents.map(a => a.agentId);
      const { data: agentDetails } = await supabase
        .from('profiler_peserta')
        .select('id, tim, jabatan')
        .in('id', agentIds);
      
      if (agentDetails) {
        result.topAgents = result.topAgents
          .map(agent => {
            const detail = agentDetails.find(d => d.id === agent.agentId);
            return {
              ...agent,
              tim: detail?.tim,
              jabatan: detail?.jabatan
            };
          })
          .filter(a => !isAgentExcluded(a.tim, a.batch, a.jabatan));
      }
    }

    return result;
  },

  async getDashboardRangeData(
    serviceType: string,
    folderIds: string[] = [],
    context: SharedContext,
    year: number,
    startMonth: number,
    endMonth: number
  ) {
    const startedAt = measureStart();
    const supabase = await createClient();
    const hasPhantomSupport = await hasPhantomPaddingSupport(supabase);

    if (hasPhantomSupport) {
      const fallback = await this.getConsolidatedDashboardDataByRange(
        serviceType,
        folderIds,
        context,
        year,
        startMonth,
        endMonth
      );
      logServerMetric('qa.dashboardRangeData.fallback.phantom', startedAt, { serviceType, year, startMonth, endMonth });
      return fallback;
    }

    const cached = await cachedFetchDashboardRangeData(
      serviceType,
      encodeFolderIds(folderIds),
      year,
      startMonth,
      endMonth
    );

    if (cached) {
      logServerMetric('qa.dashboardRangeData.cache', startedAt, { serviceType, year, startMonth, endMonth });
      return cached;
    }

    const fallback = await this.getConsolidatedDashboardDataByRange(
      serviceType,
      folderIds,
      context,
      year,
      startMonth,
      endMonth
    );
    logServerMetric('qa.dashboardRangeData.fallback', startedAt, { serviceType, year, startMonth, endMonth });
    return fallback;
  },

  async getDashboardRangeTrendData(
    serviceType: string,
    folderIds: string[] = [],
    context: SharedContext,
    year: number,
    startMonth: number,
    endMonth: number
  ) {
    const startedAt = measureStart();
    const supabase = await createClient();
    const hasPhantomSupport = await hasPhantomPaddingSupport(supabase);

    if (hasPhantomSupport) {
      const fallback = await this.getConsolidatedTrendDataByRange(
        serviceType,
        folderIds,
        context,
        year,
        startMonth,
        endMonth
      );
      logServerMetric('qa.dashboardRangeTrend.fallback.phantom', startedAt, { serviceType, year, startMonth, endMonth });
      return fallback;
    }

    const cached = await cachedFetchDashboardRangeTrend(
      serviceType,
      encodeFolderIds(folderIds),
      year,
      startMonth,
      endMonth
    );

    if (cached) {
      logServerMetric('qa.dashboardRangeTrend.cache', startedAt, { serviceType, year, startMonth, endMonth });
      return cached;
    }

    const fallback = await this.getConsolidatedTrendDataByRange(
      serviceType,
      folderIds,
      context,
      year,
      startMonth,
      endMonth
    );
    logServerMetric('qa.dashboardRangeTrend.fallback', startedAt, { serviceType, year, startMonth, endMonth });
    return fallback;
  },

  async getConsolidatedTrendData(
    timeframe: '3m' | '6m' | 'all', 
    serviceType: string, 
    folderIds: string[] = [], 
    context?: SharedContext, 
    _year?: number
  ) {
    const supabase = await createClient();
    const limitMap = { '3m': 3, '6m': 6, 'all': 24 };
    const limit = limitMap[timeframe] || 3;
    
    const allPeriods = context?.periods || (await this.getPeriods());
    const sortedPeriods = [...allPeriods].slice(0, limit).reverse();
    const pIds = sortedPeriods.map(p => p.id);
    const labels = sortedPeriods.map(p => `${MONTHS_SHORT[p.month - 1]} ${String(p.year).slice(-2)}`);
    
    if (pIds.length === 0) return null;

    let query = supabase
      .from('qa_temuan')
      .select('nilai, ketidaksesuaian, sebaiknya, period_id, peserta_id, indicator_id, qa_indicators(name, category), profiler_peserta!inner(batch_name)', { count: 'exact' })
      .in('period_id', pIds)
      .eq('service_type', serviceType);

    if (folderIds.length > 0) query = query.in('profiler_peserta.batch_name', folderIds);

    const { data: temuan, count: totalRowCount, error } = await query;
    if (error) throw error;

    if ((totalRowCount || 0) > 150000) {
      throw new Error(`Data terlalu besar (${totalRowCount?.toLocaleString()} baris). Silakan persempit filter periode atau folder.`);
    }

    if (!temuan) return null;

    const allIndicators = context?.indicators || (await this.getIndicators(serviceType)) as QAIndicator[];
    const serviceInds = allIndicators.filter(i => i.service_type === serviceType);

    // Grouping data by period for sparklines and trends
    const dataByPeriod = sortedPeriods.map(p => {
      const pTemuan = temuan.filter(t => t.period_id === p.id);
      const auditedAgents = new Set(pTemuan.map(t => t.peserta_id));
      const totalAudited = auditedAgents.size;
      const totalFindings = countCountableFindings(pTemuan);

      // Compliance calculation
      let passCount = 0;
      let totalScoreForPeriod = 0;
      if (totalAudited > 0) {
        auditedAgents.forEach(aid => {
          const agentTemuans = pTemuan.filter(t => t.peserta_id === aid);
          const res = calculateQAScoreFromTemuan(serviceInds, agentTemuans);
          if (res.finalScore >= 95) passCount++;
          totalScoreForPeriod += res.finalScore;
        });
      }

      return {
        label: `${MONTHS_SHORT[p.month - 1]} ${String(p.year).slice(-2)}`,
        total: totalFindings,
        avg: totalAudited > 0 ? totalFindings / totalAudited : 0,
        zero: totalAudited > 0 ? (Array.from(auditedAgents).filter(aid => !pTemuan.some(t => t.peserta_id === aid && t.nilai < 3)).length / totalAudited) * 100 : 0,
        compliance: passCount,
        avgAgentScore: totalAudited > 0 ? totalScoreForPeriod / totalAudited : 0
      };
    });

    // Parameter Trend Calculation
    const paramCounts: Record<string, Record<string, number>> = {};
    const totalFindingsByPeriod: Record<string, number> = {};

    temuan.forEach(t => {
      if (!isCountableFinding(t)) return;
      const pName = (t.qa_indicators as any)?.name || 'Unknown';
      if (!paramCounts[pName]) paramCounts[pName] = {};
      paramCounts[pName][t.period_id] = (paramCounts[pName][t.period_id] || 0) + 1;
      totalFindingsByPeriod[t.period_id] = (totalFindingsByPeriod[t.period_id] || 0) + 1;
    });

    const topParams = Object.entries(paramCounts)
      .map(([name, periodCounts]) => ({ name, total: Object.values(periodCounts).reduce((a, b) => a + b, 0) }))
      .sort((a, b) => b.total - a.total).map(p => p.name);

    const datasets = [
      { label: 'Total Temuan', data: sortedPeriods.map(p => totalFindingsByPeriod[p.id] || 0), isTotal: true },
      ...topParams.map(name => ({ label: name, data: sortedPeriods.map(p => paramCounts[name][p.id] || 0), isTotal: false }))
    ];

    return {
      sparklines: {
        total: dataByPeriod.map(d => ({ label: d.label, value: d.total })),
        avg: dataByPeriod.map(d => ({ label: d.label, value: Number(d.avg.toFixed(1)) })),
        zero: dataByPeriod.map(d => ({ label: d.label, value: Number(d.zero.toFixed(1)) })),
        compliance: dataByPeriod.map(d => ({ label: d.label, value: d.compliance })),
        avgAgentScore: dataByPeriod.map(d => ({ label: d.label, value: Number(d.avgAgentScore.toFixed(1)) }))
      },
      paramTrend: { labels, datasets }
    };
  },

  async getConsolidatedTrendDataByRange(
    serviceType: string,
    folderIds: string[] = [],
    context: SharedContext,
    year: number,
    startMonth: number,
    endMonth: number
  ) {
    const supabase = await createClient();
    const hasPhantomSupport = await hasPhantomPaddingSupport(supabase);
    
    // 1. Filter periods from context based on range and year
    const allPeriods = context?.periods || (await this.getPeriods());
    const sortedPeriods = allPeriods
      .filter(p => p.year === year && p.month >= startMonth && p.month <= endMonth)
      .sort((a, b) => a.month - b.month); // Ascending order
    
    const pIds = sortedPeriods.map(p => p.id);
    const labels = sortedPeriods.map(p => `${MONTHS_SHORT[p.month - 1]} ${String(p.year).slice(-2)}`);
    
    if (pIds.length === 0) return { sparklines: {}, paramTrend: { labels: [], datasets: [] } };

    // 2. Fetch findings with PAGINATION and STABLE ORDERING
    let allTemuan: any[] = [];
    let from = 0;
    const PAGE_SIZE = 1000;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from('qa_temuan')
        .select('nilai, ketidaksesuaian, sebaiknya, period_id, peserta_id, indicator_id, qa_indicators(name, category), profiler_peserta!inner(batch_name)')
        .in('period_id', pIds)
        .eq('service_type', serviceType)
        .order('id', { ascending: true }) // Stable ordering for pagination
        .range(from, from + PAGE_SIZE - 1);

      if (folderIds.length > 0) query = query.in('profiler_peserta.batch_name', folderIds);
      if (hasPhantomSupport) query = query.eq('is_phantom_padding', false);

      const { data, error } = await query;
      if (error) throw error;

      if (!data || data.length === 0) {
        hasMore = false;
      } else {
        allTemuan = [...allTemuan, ...data];
        hasMore = data.length === PAGE_SIZE;
        from += PAGE_SIZE;
      }
    }

    const temuan = allTemuan;
    const allIndicators = context?.indicators || (await this.getIndicators(serviceType)) as QAIndicator[];
    const serviceInds = allIndicators.filter(i => i.service_type === serviceType);

    // Grouping data by period
    const dataByPeriod = sortedPeriods.map(p => {
      const pTemuan = temuan.filter(t => t.period_id === p.id);
      const auditedAgents = new Set(pTemuan.map(t => t.peserta_id));
      const totalAudited = auditedAgents.size;
      const totalFindings = countCountableFindings(pTemuan);

      let passCount = 0;
      let totalScoreForPeriod = 0;
      if (totalAudited > 0) {
        auditedAgents.forEach(aid => {
          const agentTemuans = pTemuan.filter(t => t.peserta_id === aid);
          const res = calculateQAScoreFromTemuan(serviceInds, agentTemuans);
          if (res.finalScore >= 95) passCount++;
          totalScoreForPeriod += res.finalScore;
        });
      }

      return {
        label: `${MONTHS_SHORT[p.month - 1]} ${String(p.year).slice(-2)}`,
        total: totalFindings,
        avg: totalAudited > 0 ? totalFindings / totalAudited : 0,
        zero: totalAudited > 0 ? (Array.from(auditedAgents).filter(aid => !pTemuan.some(t => t.peserta_id === aid && t.nilai < 3)).length / totalAudited) * 100 : 0,
        compliance: passCount,
        avgAgentScore: totalAudited > 0 ? totalScoreForPeriod / totalAudited : 0
      };
    });

    // Parameter Trend Calculation
    const paramCounts: Record<string, Record<string, number>> = {};
    const totalFindingsByPeriod: Record<string, number> = {};

    temuan.forEach(t => {
      if (!isCountableFinding(t)) return;
      const pName = (t.qa_indicators as any)?.name || 'Unknown';
      if (!paramCounts[pName]) paramCounts[pName] = {};
      paramCounts[pName][t.period_id] = (paramCounts[pName][t.period_id] || 0) + 1;
      totalFindingsByPeriod[t.period_id] = (totalFindingsByPeriod[t.period_id] || 0) + 1;
    });

    const topParams = Object.entries(paramCounts)
      .map(([name, periodCounts]) => ({ name, total: Object.values(periodCounts).reduce((a, b) => a + b, 0) }))
      .sort((a, b) => b.total - a.total).map(p => p.name);

    const datasets = [
      { label: 'Total Temuan', data: sortedPeriods.map(p => totalFindingsByPeriod[p.id] || 0), isTotal: true },
      ...topParams.map(name => ({ label: name, data: sortedPeriods.map(p => paramCounts[name][p.id] || 0), isTotal: false }))
    ];

    return {
      sparklines: {
        total: dataByPeriod.map(d => ({ label: d.label, value: d.total })),
        avg: dataByPeriod.map(d => ({ label: d.label, value: Number(d.avg.toFixed(1)) })),
        zero: dataByPeriod.map(d => ({ label: d.label, value: Number(d.zero.toFixed(1)) })),
        compliance: dataByPeriod.map(d => ({ label: d.label, value: d.compliance })),
        avgAgentScore: dataByPeriod.map(d => ({ label: d.label, value: Number(d.avgAgentScore.toFixed(1)) }))
      },
      paramTrend: { labels, datasets }
    };
  },

  async getConsolidatedDashboardDataByRange(
    serviceType: string,
    folderIds: string[] = [],
    context: SharedContext,
    year: number,
    startMonth: number,
    endMonth: number
  ) {
    const supabase = await createClient();
    const hasPhantomSupport = await hasPhantomPaddingSupport(supabase);
    
    // 1. Resolve period IDs
    const allPeriods = context?.periods || (await this.getPeriods());
    const sortedPeriods = allPeriods
      .filter(p => p.year === year && p.month >= startMonth && p.month <= endMonth)
      .sort((a, b) => a.month - b.month);
    
    const pIds = sortedPeriods.map(p => p.id);
    if (pIds.length === 0) return null;

    // 2. Fetch all findings in range
    let allTemuan: any[] = [];
    let from = 0;
    const PAGE_SIZE = 1000;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from('qa_temuan')
        .select('*, qa_indicators(id, name, category, bobot), profiler_peserta!inner(id, nama, batch_name, tim, jabatan)')
        .in('period_id', pIds)
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (folderIds.length > 0) query = query.in('profiler_peserta.batch_name', folderIds);
      if (hasPhantomSupport) query = query.eq('is_phantom_padding', false);

      const { data, error } = await query;
      if (error) throw error;

      if (!data || data.length === 0) {
        hasMore = false;
      } else {
        allTemuan = [...allTemuan, ...data];
        hasMore = data.length === PAGE_SIZE;
        from += PAGE_SIZE;
      }
    }

    const data = allTemuan;
    const allIndicators = context?.indicators || (await this.getIndicators()) as QAIndicator[];
    const serviceInds = allIndicators.filter(i => i.service_type === serviceType);

    const currentServiceData = data.filter(d => d.service_type === serviceType);
    const serviceFindings = filterCountableFindings(currentServiceData);

    // ── 1. Calculate Summary ──
    const agentTemuanMap: Record<string, any[]> = {};
    const auditedAgentsList: any[] = [];
    const seenAgents = new Set();
    
    currentServiceData.forEach(d => {
      if (!agentTemuanMap[d.peserta_id]) agentTemuanMap[d.peserta_id] = [];
      agentTemuanMap[d.peserta_id].push({
        indicator_id: d.indicator_id,
        nilai: d.nilai,
        no_tiket: d.no_tiket,
        ketidaksesuaian: d.ketidaksesuaian,
        sebaiknya: d.sebaiknya,
      });

      if (!seenAgents.has(d.peserta_id)) {
        seenAgents.add(d.peserta_id);
        auditedAgentsList.push({ 
          id: d.peserta_id, 
          batch_name: d.profiler_peserta?.batch_name, 
          tim: d.profiler_peserta?.tim,
          jabatan: d.profiler_peserta?.jabatan
        });
      }
    });

    let agentsWithZeroError = 0;
    let agentsWithPassScore = 0;
    let totalScore = 0;
    auditedAgentsList.forEach(agent => {
      const temuanList = agentTemuanMap[agent.id] || [];
      if (!temuanList.some(t => t.nilai < 3)) agentsWithZeroError++;
      const res = calculateQAScoreFromTemuan(serviceInds, temuanList);
      if (res.finalScore >= 95) agentsWithPassScore++;
      totalScore += res.finalScore;
    });

    const summary: DashboardSummary = {
      totalDefects: serviceFindings.length,
      avgDefectsPerAudit: auditedAgentsList.length > 0 ? serviceFindings.length / auditedAgentsList.length : 0,
      zeroErrorRate: auditedAgentsList.length > 0 ? (agentsWithZeroError / auditedAgentsList.length) * 100 : 0,
      avgAgentScore: auditedAgentsList.length > 0 ? totalScore / auditedAgentsList.length : 0,
      complianceRate: auditedAgentsList.length > 0 ? (agentsWithPassScore / auditedAgentsList.length) * 100 : 0,
      complianceCount: agentsWithPassScore,
      totalAgents: auditedAgentsList.length
    };

    // ── 2. Calculate Pareto ──
    const paramCounts: Record<string, { count: number, name: string, category: string }> = {};
    serviceFindings.forEach(d => {
      const ind = (d.qa_indicators as any);
      if (!ind) return;
      if (!paramCounts[ind.id]) paramCounts[ind.id] = { count: 0, name: ind.name.trim(), category: ind.category };
      paramCounts[ind.id].count++;
    });

    let cumulativeCount = 0;
    const paretoData: ParetoData[] = Object.entries(paramCounts)
      .map(([_id, info]) => ({ name: info.name, fullName: info.name, count: info.count, category: info.category as any, cumulative: 0 }))
      .sort((a, b) => b.count - a.count || a.fullName.localeCompare(b.fullName))
      .map(item => {
        cumulativeCount += item.count;
        item.cumulative = serviceFindings.length > 0 ? Number(((cumulativeCount / serviceFindings.length) * 100).toFixed(1)) : 0;
        return item;
      });

    // ── 3. Calculate Service Comparison ──
    const serviceSummary: Record<string, { totalDefects: number, auditedAgents: number }> = {};
    const serviceAgentsMap: Record<string, Set<string>> = {};

    data.forEach(d => {
      const sType = d.service_type || 'unknown';
      if (!serviceAgentsMap[sType]) serviceAgentsMap[sType] = new Set();
      serviceAgentsMap[sType].add(d.peserta_id);

      if (!isCountableFinding(d)) return;
      if (!serviceSummary[sType]) serviceSummary[sType] = { totalDefects: 0, auditedAgents: 0 };
      serviceSummary[sType].totalDefects++;
    });

    const results: ServiceComparisonData[] = Object.keys(serviceSummary).map(sType => {
      const defects = serviceSummary[sType].totalDefects;
      return {
        name: SERVICE_LABELS[sType as ServiceType] || sType,
        serviceType: sType,
        total: defects,
        severity: defects > 50 ? 'Critical' : defects > 30 ? 'High' : defects > 15 ? 'Medium' : 'Low'
      };
    });

    const serviceData = results;

    // ── 4. Critical vs Non-Critical ──
    let critical = 0;
    let nonCritical = 0;
    serviceFindings.forEach(d => {
      if ((d.qa_indicators as any)?.category === 'critical') critical++;
      else nonCritical++;
    });
    const donutData = { critical, nonCritical, total: critical + nonCritical };

    // ── 5. Top Agents ──
    const agentStats = auditedAgentsList
      .map(agent => {
        const temuans = agentTemuanMap[agent.id] || [];
        const res = calculateQAScoreFromTemuan(serviceInds, temuans);
        const agentDefects = temuans.length;
        return { 
          agentId: agent.id, 
          nama: (data.find(d => d.peserta_id === agent.id)?.profiler_peserta as any)?.nama, 
          batch: agent.batch_name, 
          tim: agent.tim,
          jabatan: agent.jabatan,
          defects: agentDefects, 
          score: res.finalScore, 
          hasCritical: temuans.some(t => {
            const ind = serviceInds.find(i => i.id === t.indicator_id);
            return t.nilai === 0 && ind?.category === 'critical';
          })
        };
      })
      .filter(a => !isAgentExcluded(a.tim, a.batch, a.jabatan))
      .sort((a, b) => b.defects - a.defects)
      .slice(0, 5);

    return { summary, serviceData, paretoData, donutData, topAgents: agentStats };
  },

  
  async getPersonalTrendWithParameters(agentId: string, timeframe: '3m' | '6m' | 'all' = '3m', serviceType?: string) {
    const supabase = await createClient();
    const hasPhantomSupport = await hasPhantomPaddingSupport(supabase);
    const periodQuery = supabase.from('qa_periods').select('*').order('year', { ascending: false }).order('month', { ascending: false });
    const limitMap = { '3m': 3, '6m': 6, 'all': 12 };
    const { data: periods } = await periodQuery.limit(limitMap[timeframe]);
    if (!periods) return { labels: [], datasets: [] };

    const sortedPeriods = [...periods].reverse();
    const pIds = sortedPeriods.map(p => p.id);
    const labels = sortedPeriods.map(p => `${MONTHS_SHORT[p.month - 1]} ${String(p.year).slice(-2)}`);

    let temuanQuery = supabase
      .from('qa_temuan')
      .select('nilai, ketidaksesuaian, sebaiknya, period_id, qa_indicators(name)')
      .eq('peserta_id', agentId)
      .in('period_id', pIds);
    if (serviceType) temuanQuery = temuanQuery.eq('service_type', serviceType);
    if (hasPhantomSupport) temuanQuery = temuanQuery.eq('is_phantom_padding', false);
    const { data: temuanRaw } = await temuanQuery;

    if (!temuanRaw) return { labels, datasets: [] };

    const temuan = filterCountableFindings(temuanRaw as any[]);

    const counts: Record<string, Record<string, number>> = {};
    const totalByPeriod: Record<string, number> = {};

    temuan.forEach((t: any) => {
      const pName = t.qa_indicators?.name || 'Unknown';
      const pid = t.period_id;
      if (!counts[pName]) counts[pName] = {};
      counts[pName][pid] = (counts[pName][pid] || 0) + 1;
      totalByPeriod[pid] = (totalByPeriod[pid] || 0) + 1;
    });

    const topParams = Object.entries(counts)
      .map(([name, periodCounts]) => ({ name, total: Object.values(periodCounts).reduce((a, b) => a + b, 0) }))
      .sort((a, b) => b.total - a.total).map(p => p.name);

    const datasets = [
      { label: 'Total Temuan', data: sortedPeriods.map(p => totalByPeriod[p.id] || 0), isTotal: true },
      ...topParams.map(name => ({ label: name, data: sortedPeriods.map(p => counts[name][p.id] || 0), isTotal: false }))
    ];

    return { labels, datasets };
  },

  async getAgentExportData(agentId: string): Promise<ExportData> {
    const supabase = await createClient();
    const { agent, temuan } = await this.getAgentWithTemuan(agentId);
    if (!agent) throw new Error('Agent not found');

    const { data: indicators } = await supabase.from('qa_indicators').select('*');
    const allIndicators = (indicators || []) as QAIndicator[];

    const periodsMap = new Map<string, QATemuan[]>();
    (temuan as QATemuan[]).forEach(t => {
      if (!t.qa_periods) return;
      const sType = t.service_type || t.qa_indicators?.service_type || 'unknown';
      const pk = `${t.qa_periods.year}-${String(t.qa_periods.month).padStart(2, '0')}-${sType}`;
      if (!periodsMap.has(pk)) periodsMap.set(pk, []);
      periodsMap.get(pk)!.push({ ...t, service_type: sType } as QATemuan);
    });

    const periods: ExportPeriod[] = [...periodsMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([_pk, pTemuan]) => {
        const p = pTemuan[0].qa_periods!;
        const teamInds = allIndicators.filter(i => i.service_type === pTemuan[0]?.service_type);
        const scoreResult = calculateQAScoreFromTemuan(
          teamInds,
          pTemuan.map(t => ({ indicator_id: t.indicator_id, nilai: t.nilai, no_tiket: t.no_tiket }))
        );

        return {
          month: p.month,
          year: p.year,
          service_type: (pTemuan[0]?.service_type || 'call') as ServiceType,
          score: scoreResult.finalScore,
          ncScore: scoreResult.nonCriticalScore,
          crScore: scoreResult.criticalScore,
          temuan: pTemuan
        };
      });

    return { agent, periods };
  },

  async getUniqueAgentCountByTimeframe(timeframe: '3m' | '6m' | 'all', context?: SharedContext): Promise<number> {
    const supabase = await createClient();
    const limitMap = { '3m': 3, '6m': 6, 'all': 12 };
    const limit = limitMap[timeframe] || 3;
    
    let periods: any[] = [];
    if (context?.periods) {
      periods = [...context.periods].slice(0, limit);
    } else {
      const { data } = await supabase
        .from('qa_periods').select('id')
        .order('year', { ascending: false }).order('month', { ascending: false })
        .limit(limit);
      periods = data || [];
    }
    
    if (periods.length === 0) return 0;

    const pIds = periods.map(p => p.id);
    // Include ALL temuan records (including nilai=3) as QA findings
    // Use paginated fetch to bypass 1000 row limit
    const data = await this.fetchPaginatedTrendData(supabase, pIds);

    if (!data) return 0;
    return new Set(data.map(d => d.peserta_id)).size;
  },

  async getAuditCountByTimeframe(timeframe: '3m' | '6m' | 'all', context?: SharedContext): Promise<number> {
    const supabase = await createClient();
    const limitMap = { '3m': 3, '6m': 6, 'all': 12 };
    const limit = limitMap[timeframe] || 3;

    let periods: any[] = [];
    if (context?.periods) {
      periods = [...context.periods].slice(0, limit);
    } else {
      const { data } = await supabase
        .from('qa_periods').select('id')
        .order('year', { ascending: false }).order('month', { ascending: false })
        .limit(limit);
      periods = data || [];
    }
    
    if (periods.length === 0) return 0;

    const pIds = periods.map(p => p.id);
    // Include ALL temuan records (including nilai=3) as QA findings
    // Use paginated fetch to bypass 1000 row limit
    const data = await this.fetchPaginatedTrendData(supabase, pIds);

    if (!data) return 0;
    return new Set(data.map(d => d.no_tiket)).size;
  },

  async getServiceTrendForDashboard(timeframe: '3m' | '6m' | 'all' = '3m', context?: SharedContext) {
    const supabase = await createClient();
    const limitMap = { '3m': 3, '6m': 6, 'all': 12 };
    const limit = limitMap[timeframe] || 3;

    let sortedPeriods: QAPeriod[] = [];
    if (context?.periods) {
      sortedPeriods = [...context.periods].slice(0, limit).reverse();
    } else {
      const { data: periods } = await supabase.from('qa_periods').select('*').order('year', { ascending: false }).order('month', { ascending: false }).limit(limit);
      if (!periods) return { labels: [], totalData: [], serviceData: {}, activeServices: [], serviceSummary: {}, totalSummary: { totalDefects: 0, auditedAgents: 0, activeServiceCount: 0 } };
      sortedPeriods = [...periods].reverse();
    }

    const pIds = sortedPeriods.map(p => p.id);
    const labels = sortedPeriods.map(p => `${MONTHS_SHORT[p.month - 1]} ${String(p.year).slice(-2)}`);

    // Use paginated fetch to bypass 1000 row limit
    const temuan = await this.fetchPaginatedTrendData(supabase, pIds, sortedPeriods[0]?.year || new Date().getFullYear());

    if (!temuan || temuan.length === 0) return { labels, totalData: labels.map(() => 0), serviceData: {}, activeServices: [], serviceSummary: {}, totalSummary: { totalDefects: 0, auditedAgents: 0, activeServiceCount: 0 } };

    const activeServicesSet = new Set<string>();
    const totalData = labels.map(() => 0);
    const serviceData: Record<string, number[]> = {};
    const serviceSummary: Record<string, { totalDefects: number, auditedAgents: number }> = {};
    
    // Summary by all services
    const totalAuditedAgentsSet = new Set(temuan.map(t => t.peserta_id));
    const totalDefectsCount = countCountableFindings(temuan);

    temuan.forEach(t => {
      const sType = t.service_type || 'unknown';
      activeServicesSet.add(sType);

      const periodIdx = sortedPeriods.findIndex(p => p.id === t.period_id);
      if (periodIdx === -1) return;

      if (isCountableFinding(t)) {
        totalData[periodIdx]++;
      }
      if (!serviceData[sType]) serviceData[sType] = labels.map(() => 0);
      if (isCountableFinding(t)) {
        serviceData[sType][periodIdx]++;
      }

      if (!serviceSummary[sType]) {
        serviceSummary[sType] = { totalDefects: 0, auditedAgents: 0 };
      }
      if (isCountableFinding(t)) {
        serviceSummary[sType].totalDefects++;
      }
    });

    // Calculate unique audited agents per service
    const serviceAgentsMap: Record<string, Set<string>> = {};
    temuan.forEach(t => {
      const sType = t.service_type || 'unknown';
      if (!serviceAgentsMap[sType]) serviceAgentsMap[sType] = new Set();
      serviceAgentsMap[sType].add(t.peserta_id);
    });

    Object.keys(serviceSummary).forEach(sType => {
      serviceSummary[sType].auditedAgents = serviceAgentsMap[sType]?.size || 0;
    });

    // Per-period stats for slicing
    const periodStats = sortedPeriods.map((p, idx) => {
      const pTemuan = temuan.filter(t => t.period_id === p.id);
      const svcStats: Record<string, { totalDefects: number, auditedAgents: number }> = {};
      
      const pAgents = new Set(pTemuan.map(t => t.peserta_id));
      const pDefects = countCountableFindings(pTemuan);

      activeServicesSet.forEach(svc => {
        const sTemuan = pTemuan.filter(t => t.service_type === svc);
        svcStats[svc] = {
          totalDefects: countCountableFindings(sTemuan),
          auditedAgents: new Set(sTemuan.map(t => t.peserta_id)).size
        };
      });

      return {
        id: p.id,
        label: labels[idx],
        totalDefects: pDefects,
        auditedAgents: pAgents.size,
        serviceStats: svcStats
      };
    });

    return {
      labels,
      totalData,
      serviceData,
      activeServices: Array.from(activeServicesSet),
      serviceSummary,
      totalSummary: {
        totalDefects: totalDefectsCount,
        auditedAgents: totalAuditedAgentsSet.size,
        activeServiceCount: activeServicesSet.size
      },
      periodStats,
      topParameters: this.calculateTopParameters(temuan)
    };
  },

  calculateTopParameters(temuan: any[]) {
    if (!temuan || temuan.length === 0) return {};
    
    const countsPerService: Record<string, Record<string, { count: number, name: string }>> = {};
    
    temuan.forEach(t => {
      if (!isCountableFinding(t)) return;
      const id = t.indicator_id;
      const name = t.qa_indicators?.name || 'Unknown';
      const service = t.service_type || 'unknown';
      if (!id) return;
      
      if (!countsPerService[service]) countsPerService[service] = {};
      if (!countsPerService[service][id]) countsPerService[service][id] = { count: 0, name };
      countsPerService[service][id].count++;
    });

    const result: Record<string, { name: string, count: number }> = {};
    Object.keys(countsPerService).forEach(service => {
      const sorted = Object.values(countsPerService[service]).sort((a, b) => b.count - a.count);
      if (sorted[0]) {
        result[service] = sorted[0];
      }
    });

    return result;
  },

  async getServiceTrendForDashboardByRange(year: number, startMonth: number, endMonth: number, context?: SharedContext) {
    const supabase = await createClient();
    
    const allPeriods = context?.periods || (await this.getPeriods());
    const sortedPeriods = allPeriods
      .filter(p => p.year === year && p.month >= startMonth && p.month <= endMonth)
      .sort((a, b) => a.month - b.month);
    
    const pIds = sortedPeriods.map(p => p.id);
    const labels = sortedPeriods.map(p => `${MONTHS_SHORT[p.month - 1]} ${String(p.year).slice(-2)}`);

    if (pIds.length === 0) return { labels: [], totalData: [], serviceData: {}, activeServices: [], serviceSummary: {}, totalSummary: { totalDefects: 0, auditedAgents: 0, activeServiceCount: 0 }, periodStats: [] };

    // Use paginated fetch to bypass 1000 row limit
    const temuan = await this.fetchPaginatedTrendData(supabase, pIds, year);

    const topParameters = this.calculateTopParameters(temuan);

    if (!temuan || temuan.length === 0) return { labels, totalData: labels.map(() => 0), serviceData: {}, activeServices: [], serviceSummary: {}, totalSummary: { totalDefects: 0, auditedAgents: 0, activeServiceCount: 0 }, periodStats: [], topParameters: {} };

    const activeServicesSet = new Set<string>();
    const totalData = labels.map(() => 0);
    const serviceData: Record<string, number[]> = {};
    const serviceSummary: Record<string, { totalDefects: number, auditedAgents: number }> = {};
    
    const totalAuditedAgentsSet = new Set(temuan.map(t => t.peserta_id));
    const totalDefectsCount = countCountableFindings(temuan);

    temuan.forEach(t => {
      const sType = t.service_type || 'unknown';
      activeServicesSet.add(sType);

      const periodIdx = sortedPeriods.findIndex(p => p.id === t.period_id);
      if (periodIdx === -1) return;

      if (isCountableFinding(t)) {
        totalData[periodIdx]++;
      }
      if (!serviceData[sType]) serviceData[sType] = labels.map(() => 0);
      if (isCountableFinding(t)) {
        serviceData[sType][periodIdx]++;
      }

      if (!serviceSummary[sType]) {
        serviceSummary[sType] = { totalDefects: 0, auditedAgents: 0 };
      }
      if (isCountableFinding(t)) {
        serviceSummary[sType].totalDefects++;
      }
    });

    const serviceAgentsMap: Record<string, Set<string>> = {};
    temuan.forEach(t => {
      const sType = t.service_type || 'unknown';
      if (!serviceAgentsMap[sType]) serviceAgentsMap[sType] = new Set();
      serviceAgentsMap[sType].add(t.peserta_id);
    });

    Object.keys(serviceSummary).forEach(sType => {
      serviceSummary[sType].auditedAgents = serviceAgentsMap[sType]?.size || 0;
    });

    const periodStats = sortedPeriods.map((p, idx) => {
      const pTemuan = temuan.filter(t => t.period_id === p.id);
      const svcStats: Record<string, { totalDefects: number, auditedAgents: number }> = {};
      
      const pAgents = new Set(pTemuan.map(t => t.peserta_id));
      const pDefects = countCountableFindings(pTemuan);

      activeServicesSet.forEach(svc => {
        const sTemuan = pTemuan.filter(t => t.service_type === svc);
        svcStats[svc] = {
          totalDefects: countCountableFindings(sTemuan),
          auditedAgents: new Set(sTemuan.map(t => t.peserta_id)).size
        };
      });

      return {
        id: p.id,
        label: labels[idx],
        totalDefects: pDefects,
        auditedAgents: pAgents.size,
        serviceStats: svcStats
      };
    });

    return {
      labels,
      totalData,
      serviceData,
      activeServices: Array.from(activeServicesSet),
      serviceSummary,
      totalSummary: {
        totalDefects: totalDefectsCount,
        auditedAgents: totalAuditedAgentsSet.size,
        activeServiceCount: activeServicesSet.size
      },
      periodStats,
      topParameters
    };
  },

  sliceTrendData(data: any, months: number) {
    const sliceIdx = Math.max(0, data.labels.length - months);
    const slicedLabels = data.labels.slice(sliceIdx);
    const slicedTotalData = data.totalData.slice(sliceIdx);
    const slicedPeriodStats = data.periodStats.slice(sliceIdx);
    
    const slicedServiceData: Record<string, number[]> = {};
    Object.entries(data.serviceData).forEach(([svc, arr]: [string, any]) => {
      slicedServiceData[svc] = arr.slice(sliceIdx);
    });

    // Re-aggregate summaries based on sliced data
    // For Audited Agents, we take the value from the LATEST month in the slice (as per user condition)
    const latestStat = slicedPeriodStats[slicedPeriodStats.length - 1] || { totalDefects: 0, auditedAgents: 0, serviceStats: {} };
    
    const totalDefects = slicedTotalData.reduce((a: number, b: number) => a + b, 0);
    
    const serviceSummary: Record<string, { totalDefects: number, auditedAgents: number }> = {};
    data.activeServices.forEach((svc: string) => {
      const svcTotalDefects = slicedServiceData[svc]?.reduce((a: number, b: number) => a + b, 0) || 0;
      serviceSummary[svc] = {
        totalDefects: svcTotalDefects,
        auditedAgents: latestStat.serviceStats[svc]?.auditedAgents || 0
      };
    });

    return {
      labels: slicedLabels,
      totalData: slicedTotalData,
      serviceData: slicedServiceData,
      activeServices: data.activeServices,
      serviceSummary,
      totalSummary: {
        totalDefects,
        auditedAgents: latestStat.auditedAgents || 0,
        activeServiceCount: data.activeServices.length
      },
      periodStats: slicedPeriodStats
    };
  },

  /** Rows for Report Maker — detail table (service report). */
  async getServiceReportTemuanDetailRows(
    serviceType: string,
    folderIds: string[],
    context: SharedContext,
    year: number,
    startMonth: number,
    endMonth: number
  ): Promise<
    Array<{
      no_tiket: string | null;
      nilai: number;
      ketidaksesuaian: string | null;
      sebaiknya: string | null;
      parameter: string;
      agen: string;
    }>
  > {
    const supabase = await createClient();
    const hasPhantomSupport = await hasPhantomPaddingSupport(supabase);
    const allPeriods = context?.periods || (await this.getPeriods());
    const sortedPeriods = allPeriods
      .filter((p) => p.year === year && p.month >= startMonth && p.month <= endMonth)
      .sort((a, b) => a.month - b.month);
    const pIds = sortedPeriods.map((p) => p.id);
    if (pIds.length === 0) return [];

    let allTemuan: any[] = [];
    let from = 0;
    const PAGE_SIZE = 1000;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from('qa_temuan')
        .select(
          'no_tiket, nilai, ketidaksesuaian, sebaiknya, qa_indicators(name), profiler_peserta!inner(nama, batch_name)'
        )
        .in('period_id', pIds)
        .eq('service_type', serviceType)
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (folderIds.length > 0) query = query.in('profiler_peserta.batch_name', folderIds);
      if (hasPhantomSupport) query = query.eq('is_phantom_padding', false);

      const { data, error } = await query;
      if (error) throw error;

      if (!data || data.length === 0) {
        hasMore = false;
      } else {
        allTemuan = [...allTemuan, ...data];
        hasMore = data.length === PAGE_SIZE;
        from += PAGE_SIZE;
      }
    }

    return allTemuan.map((d) => ({
      no_tiket: d.no_tiket ?? null,
      nilai: d.nilai,
      ketidaksesuaian: d.ketidaksesuaian ?? null,
      sebaiknya: d.sebaiknya ?? null,
      parameter: ((d.qa_indicators as any)?.name || '').trim() || '—',
      agen: ((d.profiler_peserta as any)?.nama || '').trim() || '—',
    }));
  },

  /** Monthly score + findings for individual report trend chart. */
  async getAgentMonthlyPerformanceForReport(
    agentId: string,
    year: number,
    startMonth: number,
    endMonth: number
  ): Promise<Array<{ label: string; score: number; findings: number }>> {
    const supabase = await createClient();
    const hasPhantomSupport = await hasPhantomPaddingSupport(supabase);
    const { data: periods } = await supabase
      .from('qa_periods')
      .select('id, month, year')
      .eq('year', year)
      .gte('month', startMonth)
      .lte('month', endMonth)
      .order('month', { ascending: true });
    if (!periods?.length) return [];

    const pIds = periods.map((p) => p.id);
    let all: any[] = [];
    let from = 0;
    const PAGE = 1000;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from('qa_temuan')
        .select('indicator_id, nilai, ketidaksesuaian, sebaiknya, no_tiket, service_type, period_id, created_at')
        .eq('peserta_id', agentId)
        .in('period_id', pIds)
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1);
      if (hasPhantomSupport) {
        query = query.eq('is_phantom_padding', false);
      }
      const { data, error } = await query;
      if (error) throw error;
      if (!data?.length) hasMore = false;
      else {
        all = [...all, ...data];
        hasMore = data.length === PAGE;
        from += PAGE;
      }
    }

    const allIndicators = (await this.getIndicators()) as QAIndicator[];
    const serviceWeights = await this.getServiceWeights();

    return periods.map((p) => {
      const pTemuan = all.filter((t) => t.period_id === p.id);
      const bySvc: Record<string, typeof pTemuan> = {};
      pTemuan.forEach((t) => {
        const s = (t.service_type || 'call') as string;
        if (!bySvc[s]) bySvc[s] = [];
        bySvc[s].push(t);
      });
      let sum = 0;
      let w = 0;
      Object.entries(bySvc).forEach(([svc, list]) => {
        const inds = allIndicators.filter((i) => i.service_type === svc);
        if (!inds.length) return;
        const sw =
          serviceWeights[svc as ServiceType] ?? DEFAULT_SERVICE_WEIGHTS[svc as ServiceType];
        const sc = calculateQAScoreFromTemuan(inds, list, sw).finalScore;
        const weight = list.length;
        sum += sc * weight;
        w += weight;
      });
      return {
        label: `${MONTHS_SHORT[p.month - 1]} ${p.year}`,
        score: w > 0 ? Number((sum / w).toFixed(1)) : 100,
        findings: countCountableFindings(pTemuan),
      };
    });
  },

  /**
   * Helper private method to fetch QA findings with pagination to bypass Supabase 1000-row limit
   */
  async fetchPaginatedTrendData(supabase: any, pIds: string[], year?: number) {
    const hasPhantomSupport = await hasPhantomPaddingSupport(supabase);
    let allData: any[] = [];
    let from = 0;
    const step = 1000;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from('qa_temuan')
        .select('nilai, ketidaksesuaian, sebaiknya, period_id, service_type, peserta_id, no_tiket, indicator_id, qa_indicators(name)')
        .in('period_id', pIds)
        .order('id', { ascending: true })
        .range(from, from + step - 1);

      if (year) {
        query = query.eq('tahun', year);
      }
      if (hasPhantomSupport) {
        query = query.eq('is_phantom_padding', false);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      
      if (!data || data.length === 0) {
        hasMore = false;
      } else {
        allData = [...allData, ...data];
        hasMore = data.length === step;
        from += step;
      }
    }

    return allData;
  }
};
