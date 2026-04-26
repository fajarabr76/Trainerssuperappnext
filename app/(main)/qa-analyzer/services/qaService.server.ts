import { createClient } from '@/app/lib/supabase/server';
import { unstable_cache } from 'next/cache';
import { getCachedFolderNames, getCachedAvailableYears } from '@/lib/cache/user-cache';
import {
  Agent,
  AgentDirectoryEntry,
  AgentPeriodSummary,
  QAPeriod, 
  QAIndicator, 
  QATemuan, 
  DashboardSummary, 
  TrendPoint, 
  calculateQAScoreFromTemuan,
  QAScore,
  ServiceType,
  ServiceWeight,
  ScoringMode,
  Category,
  DEFAULT_SERVICE_WEIGHTS,
  SharedContext,
  SERVICE_LABELS,
  ServiceComparisonData,
  TopAgentData,
  ParetoData,
  CriticalVsNonCriticalData,
  ExportData,
  ExportPeriod,
  isAgentExcluded,
  unwrapIndicator,
  unwrapPeriod,
  unwrapAgent,
  resolveServiceTypeFromTeam,
  QARuleVersion,
  QARuleIndicatorSnapshot,
  ResolvedQARule
  } from '../lib/qa-types';
import { createClient as createJSClient, SupabaseClient } from '@supabase/supabase-js';
import {
  buildAgentAuditCollections,
  buildPartitionedAuditRows,
  buildServiceComparisonData,
  buildTopAgentRanking,
  collectPartitionRows,
  countCountableFindings,
  deriveAgentPeriodSummaries,
  deriveDashboardSummary,
  deriveTrendSummary,
  filterCountableFindings,
  filterRealAuditRows,
  isCountableFinding,
  type CountableFindingLike,
  type PhantomFindingLike,
} from './sidakAggregation';
import {
  getDashboardRangeDataFromSummary,
  getDashboardRangeTrendFromSummary,
} from './summaryReader.server';

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
  client: SupabaseClient
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

async function fetchIndicatorsUncached(service_type?: string, period_id?: string): Promise<QAIndicator[] | QARuleIndicatorSnapshot[]> {
  const serviceSupabase = getServiceSupabase();
  if (!serviceSupabase) return [];

  if (period_id && service_type) {
    const resolved = await qaServiceServer.resolveRuleVersion(period_id, service_type as ServiceType);
    if (resolved) return resolved.indicators;
  }

  let query = serviceSupabase
    .from('qa_indicators')
    .select('id, service_type, name, category, bobot, has_na, threshold, created_at');

  if (service_type) {
    query = query.eq('service_type', service_type);
  }

  const { data, error } = await query
    .order('category')
    .order('bobot', { ascending: false })
    .order('name');

  if (error) {
    console.warn('[Cache] qa indicators fallback error:', error.message);
    return [];
  }

  return (data ?? []) as QAIndicator[];
}

const cachedFetchIndicators = unstable_cache(
  async (service_type?: string, period_id?: string): Promise<QAIndicator[] | QARuleIndicatorSnapshot[]> => {
    return fetchIndicatorsUncached(service_type, period_id);
  },
  ['qa_indicators'],
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
  ['qa_periods'],
  { revalidate: 3600, tags: ['periods'] }
);

async function fetchServiceWeightsUncached(service_type?: string, period_id?: string): Promise<Record<ServiceType, ServiceWeight>> {
  const serviceSupabase = getServiceSupabase();
  if (!serviceSupabase) return DEFAULT_SERVICE_WEIGHTS;

  if (period_id && service_type) {
    const resolved = await qaServiceServer.resolveRuleVersion(period_id, service_type as ServiceType);
    if (resolved) {
      return {
        [service_type as ServiceType]: {
          service_type: resolved.version.service_type,
          critical_weight: Number(resolved.version.critical_weight),
          non_critical_weight: Number(resolved.version.non_critical_weight),
          scoring_mode: resolved.version.scoring_mode,
        }
      } as Record<ServiceType, ServiceWeight>;
    }
  }

  let query = serviceSupabase
    .from('qa_service_weights')
    .select('service_type, critical_weight, non_critical_weight, scoring_mode');

  if (service_type) {
    query = query.eq('service_type', service_type);
  }

  const { data, error } = await query;
  if (error) {
    console.warn('[Cache] qa service weights fallback error:', error.message);
    return DEFAULT_SERVICE_WEIGHTS;
  }

  const mergedWeights = { ...DEFAULT_SERVICE_WEIGHTS };
  (data ?? []).forEach((row) => {
    mergedWeights[row.service_type as ServiceType] = {
      service_type: row.service_type as ServiceType,
      critical_weight: Number(row.critical_weight),
      non_critical_weight: Number(row.non_critical_weight),
      scoring_mode: row.scoring_mode as ScoringMode,
    };
  });

  return mergedWeights;
}

const cachedFetchServiceWeights = unstable_cache(
  async (service_type?: string, period_id?: string): Promise<Record<ServiceType, ServiceWeight>> => {
    return fetchServiceWeightsUncached(service_type, period_id);
  },
  ['qa_service_weights'],
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

type ScoringTemuanLike = {
  indicator_id?: string | null;
  rule_indicator_id?: string | null;
  nilai: number;
  no_tiket?: string | null;
  created_at?: string;
  period_id?: string;
  service_type?: string | null;
  ketidaksesuaian?: string | null;
  sebaiknya?: string | null;
  qa_indicators?: unknown;
  is_phantom_padding?: boolean;
};

type ScopedAuditFindingLike = CountableFindingLike & PhantomFindingLike & {
  peserta_id?: string | null;
  indicator_id?: string | null;
  rule_indicator_id?: string | null;
  no_tiket?: string | null;
  service_type?: string | null;
  created_at?: string;
  period_id?: string | null;
  qa_indicators?: unknown;
  profiler_peserta?: unknown;
};

type ScoringContext = {
  indicators: QAIndicator[];
  activeWeight: ServiceWeight;
  scoreIdByAnyId: Map<string, string>;
  indicatorByAnyId: Map<string, QAIndicator>;
};

type ResolvedFindingMeta = {
  id: string | null;
  name: string;
  category: Category | null;
};

function normalizeIndicatorForScoring(indicator: QAIndicator | QARuleIndicatorSnapshot): QAIndicator {
  return {
    id: indicator.id,
    service_type: indicator.service_type,
    name: indicator.name,
    category: indicator.category,
    bobot: Number(indicator.bobot),
    has_na: Boolean(indicator.has_na),
    threshold: indicator.threshold ?? null,
    created_at: indicator.created_at,
  };
}

async function buildScoringContext(
  serviceType: ServiceType,
  periodId?: string
): Promise<ScoringContext> {
  const [rawIndicators, weightsMap] = await Promise.all([
    qaServiceServer.getIndicators(serviceType, periodId),
    qaServiceServer.getServiceWeights(serviceType, periodId),
  ]);

  const indicators = rawIndicators.map((indicator) =>
    normalizeIndicatorForScoring(indicator as QAIndicator | QARuleIndicatorSnapshot)
  );

  const scoreIdByAnyId = new Map<string, string>();
  const indicatorByAnyId = new Map<string, QAIndicator>();

  rawIndicators.forEach((indicator) => {
    const normalized = normalizeIndicatorForScoring(indicator as QAIndicator | QARuleIndicatorSnapshot);
    scoreIdByAnyId.set(normalized.id, normalized.id);
    indicatorByAnyId.set(normalized.id, normalized);

    const legacyIndicatorId = (indicator as QARuleIndicatorSnapshot).legacy_indicator_id;
    if (typeof legacyIndicatorId === 'string' && legacyIndicatorId.length > 0) {
      scoreIdByAnyId.set(legacyIndicatorId, normalized.id);
      indicatorByAnyId.set(legacyIndicatorId, normalized);
    }
  });

  return {
    indicators,
    activeWeight: weightsMap[serviceType] || DEFAULT_SERVICE_WEIGHTS[serviceType],
    scoreIdByAnyId,
    indicatorByAnyId,
  };
}

function createScoringContextLoader() {
  const cache = new Map<string, Promise<ScoringContext>>();

  return (serviceType: ServiceType, periodId?: string) => {
    const key = `${serviceType}:${periodId ?? 'global'}`;
    if (!cache.has(key)) {
      cache.set(key, buildScoringContext(serviceType, periodId));
    }
    return cache.get(key)!;
  };
}

function isKnownServiceType(value: string): value is ServiceType {
  return Object.prototype.hasOwnProperty.call(DEFAULT_SERVICE_WEIGHTS, value);
}

function getJoinedFindingMeta(item: ScoringTemuanLike): ResolvedFindingMeta | null {
  const joined = unwrapIndicator(item.qa_indicators) as Partial<QAIndicator & QARuleIndicatorSnapshot> | null;
  if (!joined) return null;

  const name = typeof joined.name === 'string' ? joined.name.trim() : '';
  const category = joined.category === 'critical' || joined.category === 'non_critical'
    ? joined.category
    : null;
  const id = typeof joined.id === 'string' && joined.id.length > 0 ? joined.id : null;

  if (!name && !category && !id) return null;

  return {
    id,
    name: name || 'Unknown',
    category,
  };
}

async function resolveFindingIndicatorMeta(
  item: ScoringTemuanLike,
  loadScoringContext: ReturnType<typeof createScoringContextLoader>,
  serviceTypeOverride?: string
): Promise<ResolvedFindingMeta | null> {
  const joinedMeta = getJoinedFindingMeta(item);
  if (joinedMeta?.name !== 'Unknown' && joinedMeta.category) {
    return joinedMeta;
  }

  const serviceType = serviceTypeOverride || item.service_type || '';
  if (!isKnownServiceType(serviceType)) {
    return joinedMeta;
  }

  const context = await loadScoringContext(serviceType, item.period_id);
  const indicator = context.indicatorByAnyId.get(getScoringIndicatorId(item, context));
  if (!indicator) {
    return joinedMeta;
  }

  return {
    id: indicator.id,
    name: indicator.name.trim() || joinedMeta?.name || 'Unknown',
    category: indicator.category ?? joinedMeta?.category ?? null,
  };
}

function getScoringIndicatorId(item: ScoringTemuanLike, context: ScoringContext): string {
  if (typeof item.rule_indicator_id === 'string' && item.rule_indicator_id.length > 0) {
    return item.rule_indicator_id;
  }

  const rawIndicatorId = typeof item.indicator_id === 'string' ? item.indicator_id : '';
  return context.scoreIdByAnyId.get(rawIndicatorId) ?? rawIndicatorId;
}

function normalizeTemuanForScoring(
  items: ScoringTemuanLike[],
  context: ScoringContext
): Array<{ indicator_id: string; nilai: number; no_tiket?: string | null; created_at?: string; period_id?: string }> {
  return items.map((item) => ({
    indicator_id: getScoringIndicatorId(item, context),
    nilai: item.nilai,
    no_tiket: item.no_tiket,
    created_at: item.created_at,
    period_id: item.period_id,
  }));
}

function normalizeScopedFindingForScoring(item: ScopedAuditFindingLike): ScoringTemuanLike {
  return {
    indicator_id: item.indicator_id ?? '',
    rule_indicator_id: item.rule_indicator_id ?? null,
    nilai: Number(item.nilai ?? 0),
    no_tiket: item.no_tiket ?? null,
    service_type: item.service_type ?? null,
    created_at: item.created_at,
    period_id: item.period_id ?? undefined,
    ketidaksesuaian: item.ketidaksesuaian ?? null,
    sebaiknya: item.sebaiknya ?? null,
    qa_indicators: item.qa_indicators,
    is_phantom_padding: item.is_phantom_padding === true,
  };
}

async function calculateScopedScoreAcrossPeriods(
  serviceType: ServiceType,
  items: ScoringTemuanLike[],
  loadScoringContext: ReturnType<typeof createScoringContextLoader>
): Promise<QAScore> {
  if (items.length === 0) {
    return {
      finalScore: 100,
      nonCriticalScore: 100,
      criticalScore: 100,
      nonCriticalDetail: [],
      criticalDetail: [],
      sessionCount: 0,
      sessionScores: [],
    };
  }

  const grouped = new Map<string, ScoringTemuanLike[]>();
  items.forEach((item) => {
    const key = item.period_id || '__global__';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(item);
  });

  const periodScores = await Promise.all(
    [...grouped.entries()].map(async ([periodId, group]) => {
      const context = await loadScoringContext(
        serviceType,
        periodId === '__global__' ? undefined : periodId
      );
      return calculateQAScoreFromTemuan(
        context.indicators,
        normalizeTemuanForScoring(group, context),
        context.activeWeight
      );
    })
  );

  let totalWeight = 0;
  let weightedFinal = 0;
  let weightedNonCritical = 0;
  let weightedCritical = 0;
  let sessionCount = 0;
  const sessionScores: number[] = [];

  periodScores.forEach((score) => {
    const weight = Math.max(score.sessionCount, 1);
    totalWeight += weight;
    weightedFinal += score.finalScore * weight;
    weightedNonCritical += score.nonCriticalScore * weight;
    weightedCritical += score.criticalScore * weight;
    sessionCount += score.sessionCount;
    sessionScores.push(...score.sessionScores);
  });

  if (totalWeight === 0) {
    return {
      finalScore: 100,
      nonCriticalScore: 100,
      criticalScore: 100,
      nonCriticalDetail: [],
      criticalDetail: [],
      sessionCount,
      sessionScores,
    };
  }

  return {
    finalScore: weightedFinal / totalWeight,
    nonCriticalScore: weightedNonCritical / totalWeight,
    criticalScore: weightedCritical / totalWeight,
    nonCriticalDetail: [],
    criticalDetail: [],
    sessionCount,
    sessionScores,
  };
}

async function hasCriticalDefectAcrossPeriods(
  serviceType: ServiceType,
  items: ScoringTemuanLike[],
  loadScoringContext: ReturnType<typeof createScoringContextLoader>
): Promise<boolean> {
  for (const item of items) {
    if (item.nilai !== 0) continue;
    const context = await loadScoringContext(serviceType, item.period_id);
    const indicator = context.indicatorByAnyId.get(getScoringIndicatorId(item, context));
    if (indicator?.category === 'critical') {
      return true;
    }
  }

  return false;
}

const cachedFetchDashboardRangeData = unstable_cache(
  async (serviceType: string, folderIdsKey: string, year: number, startMonth: number, endMonth: number) => {
    const serviceSupabase = getServiceSupabase();
    if (!serviceSupabase) return null;

    const folderIds = decodeFolderIds(folderIdsKey);

    // V1: try summary tables first (global scope only)
    const fromSummary = await getDashboardRangeDataFromSummary(
      serviceSupabase,
      serviceType,
      year,
      startMonth,
      endMonth,
      folderIds
    );
    if (fromSummary) {
      return fromSummary;
    }

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
  ['qa_dashboard_range_data_rpc'],
  { revalidate: 300, tags: [QA_DASHBOARD_RANGE_TAG] }
);

const cachedFetchDashboardRangeTrend = unstable_cache(
  async (serviceType: string, folderIdsKey: string, year: number, startMonth: number, endMonth: number) => {
    const serviceSupabase = getServiceSupabase();
    if (!serviceSupabase) return null;

    const folderIds = decodeFolderIds(folderIdsKey);

    // V1: try summary tables first (global scope only)
    const fromSummary = await getDashboardRangeTrendFromSummary(
      serviceSupabase,
      serviceType,
      year,
      startMonth,
      endMonth,
      folderIds
    );
    if (fromSummary) {
      return fromSummary;
    }

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
  ['qa_dashboard_range_trend_data_rpc'],
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
    const loadScoringContext = createScoringContextLoader();
    const hasPhantomSupport = await hasPhantomPaddingSupport(serviceSupabase);
    const temuanPromise = hasPhantomSupport
      ? serviceSupabase
          .from('qa_temuan')
          .select('indicator_id, rule_indicator_id, nilai, ketidaksesuaian, sebaiknya, no_tiket, service_type, created_at, period_id, is_phantom_padding, qa_periods(month, year)')
          .eq('peserta_id', agentId)
          .eq('tahun', year)
          .order('created_at', { ascending: false })
      : serviceSupabase
          .from('qa_temuan')
          .select('indicator_id, rule_indicator_id, nilai, ketidaksesuaian, sebaiknya, no_tiket, service_type, created_at, period_id, qa_periods(month, year)')
          .eq('peserta_id', agentId)
          .eq('tahun', year)
          .order('created_at', { ascending: false });

    const [{ data: temuanRaw, error: temuanError }] = await Promise.all([temuanPromise]);

    if (temuanError) {
      console.warn('[Cache] agent period summaries error:', temuanError.message);
      return null;
    }

    const temuan = ((temuanRaw ?? []) as Array<{
      indicator_id: string;
      rule_indicator_id?: string | null;
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
      qa_periods: unwrapPeriod(item.qa_periods) as QAPeriod,
    }));

    const grouped = buildPartitionedAuditRows(temuan, (item) => {
      if (!item.qa_periods) return null;
      return `${item.period_id}:${item.service_type}`;
    });

    return deriveAgentPeriodSummaries({
      partitions: grouped.values(),
      getPeriodIdentity: (sample) => {
        const period = sample.qa_periods as QAPeriod;
        if (!period) return null;

        return {
          id: sample.period_id,
          month: period.month,
          year: period.year,
          label: formatPeriodLabel(period.month, period.year),
          serviceType: sample.service_type,
        };
      },
      evaluateScore: async (partition, period) => {
        const context = await loadScoringContext(period.serviceType, period.id);
        if (context.indicators.length === 0) {
          console.warn('[Cache] agent period summary has no indicators', {
            agentId,
            periodId: period.id,
            serviceType: period.serviceType,
          });
          return null;
        }

        const score = calculateQAScoreFromTemuan(
          context.indicators,
          normalizeTemuanForScoring(partition.scoreRows, context),
          context.activeWeight
        );

        return {
          finalScore: score.finalScore,
          nonCriticalScore: score.nonCriticalScore,
          criticalScore: score.criticalScore,
          sessionCount: score.sessionCount,
        };
      },
    });
  },
  ['qa_agent_period_summaries'],
  { revalidate: 300, tags: [QA_AGENT_DETAIL_TAG] }
);

// ── Dashboard Trend Contract ─────────────────────────────────
type DashboardTrendData = {
  labels: string[];
  totalData: number[];
  serviceData: Record<string, number[]>;
  activeServices: string[];
  serviceSummary: Record<string, { totalDefects: number; auditedAgents: number }>;
  totalSummary: { totalDefects: number; auditedAgents: number; activeServiceCount: number };
  periodStats: Array<{
    id: string;
    label: string;
    totalDefects: number;
    auditedAgents: number;
    serviceStats: Record<string, { totalDefects: number; auditedAgents: number }>;
  }>;
};

function isValidDashboardTrendData(value: unknown): value is DashboardTrendData {
  if (!value || typeof value !== 'object') return false;
  const d = value as Record<string, unknown>;
  if (!Array.isArray(d.labels)) return false;
  if (!Array.isArray(d.totalData)) return false;
  if (typeof d.serviceData !== 'object' || d.serviceData === null) return false;
  if (!Array.isArray(d.activeServices)) return false;
  if (typeof d.serviceSummary !== 'object' || d.serviceSummary === null) return false;
  if (typeof d.totalSummary !== 'object' || d.totalSummary === null) return false;
  if (!Array.isArray(d.periodStats)) return false;

  // Nested validation: serviceData values must be arrays
  for (const [, arr] of Object.entries(d.serviceData)) {
    if (!Array.isArray(arr)) return false;
  }

  // Nested validation: periodStats items must have serviceStats object
  for (const stat of d.periodStats) {
    if (!stat || typeof stat !== 'object') return false;
    const s = stat as Record<string, unknown>;
    if (typeof s.serviceStats !== 'object' || s.serviceStats === null) return false;
  }

  return true;
}

export const qaServiceServer = {
  // ── Rule Versioning ──────────────────────────────────────────
  async resolveRuleVersion(periodId: string, serviceType: ServiceType): Promise<ResolvedQARule | null> {
    const serviceSupabase = getServiceSupabase();
    const queryClient = serviceSupabase ?? await createClient();

    const { data: targetPeriod } = await queryClient
      .from('qa_periods')
      .select('year, month')
      .eq('id', periodId)
      .single();

    const { data: versionRows, error: vErr } = await queryClient
      .from('qa_service_rule_versions')
      .select('*, qa_periods!inner(year, month)')
      .eq('service_type', serviceType)
      .eq('status', 'published')
      .order('published_at', { ascending: false });

    if (vErr || !versionRows || versionRows.length === 0) {
      return null;
    }

    const eligibleVersions = versionRows.filter((row) => {
      const effectivePeriod = unwrapPeriod((row as { qa_periods?: QAPeriod | QAPeriod[] | null }).qa_periods);
      if (!effectivePeriod) return false;
      if (!targetPeriod) return true;
      if (effectivePeriod.year < targetPeriod.year) return true;
      return effectivePeriod.year === targetPeriod.year && effectivePeriod.month <= targetPeriod.month;
    });

    if (eligibleVersions.length === 0) {
      return null;
    }

    const version = eligibleVersions.sort((a, b) => {
      const periodA = unwrapPeriod((a as { qa_periods?: QAPeriod | QAPeriod[] | null }).qa_periods);
      const periodB = unwrapPeriod((b as { qa_periods?: QAPeriod | QAPeriod[] | null }).qa_periods);

      const yearA = Number(periodA?.year ?? 0);
      const yearB = Number(periodB?.year ?? 0);
      if (yearA !== yearB) return yearB - yearA;

      const monthA = Number(periodA?.month ?? 0);
      const monthB = Number(periodB?.month ?? 0);
      if (monthA !== monthB) return monthB - monthA;

      return new Date(b.published_at ?? b.created_at).getTime() - new Date(a.published_at ?? a.created_at).getTime();
    })[0];

    const { data: indicators, error: iErr } = await queryClient
      .from('qa_service_rule_indicators')
      .select('*')
      .eq('rule_version_id', version.id)
      .order('sort_order', { ascending: true })
      .order('category')
      .order('bobot', { ascending: false });

    if (iErr || !indicators) return null;

    return {
      version: version as unknown as QARuleVersion,
      indicators: indicators as QARuleIndicatorSnapshot[]
    };
  },

  // ── Years per Agent ──────────────────────────────────────────
  async getAgentAvailableYears(agentId: string): Promise<number[]> {
    const supabase = await createClient();
    const serviceClient = getServiceSupabase() || supabase;
    const hasPhantomSupport = await hasPhantomPaddingSupport(serviceClient);

    let query = serviceClient
      .from('qa_temuan')
      .select('tahun')
      .eq('peserta_id', agentId);

    if (hasPhantomSupport) {
      query = query.eq('is_phantom_padding', false);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error in getAgentAvailableYears:', error);
      return [];
    }

    const years = Array.from(new Set((data || []).map(d => Number(d.tahun)))).sort((a, b) => b - a);
    return years;
  },

  // ── Years (REVERTED TO DIRECT FETCH DUE TO RLS) ──────────────
  async getAvailableYears(): Promise<number[]> {
    try {
      return await getCachedAvailableYears();
    } catch (e) {
      console.error('Error in getAvailableYears:', e);
      return [];
    }
  },

  async getIndicators(service_type?: string, period_id?: string): Promise<QAIndicator[] | QARuleIndicatorSnapshot[]> {
    if (process.env.NODE_ENV !== 'production') {
      return await fetchIndicatorsUncached(service_type, period_id);
    }

    const cached = await cachedFetchIndicators(service_type, period_id);
    if (cached && cached.length > 0) return cached;

    return [];
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

  async getServiceWeights(service_type?: string, period_id?: string): Promise<Record<ServiceType, ServiceWeight>> {
    if (process.env.NODE_ENV !== 'production') {
      return await fetchServiceWeightsUncached(service_type, period_id);
    }

    return await cachedFetchServiceWeights(service_type, period_id);
  },

  // ── QA Temuan CRUD ────────────────────────────────────────────
  async getTemuanByAgentPeriod(
    peserta_id: string, period_id: string, serviceType?: ServiceType
  ): Promise<QATemuan[]> {
    const supabase = await createClient();
    const queryClient = getServiceSupabase() || supabase;
    const supportsPhantom = await hasPhantomPaddingSupport(queryClient);
    let query = queryClient
      .from('qa_temuan')
      .select('*, qa_indicators:qa_service_rule_indicators(id, name, category, bobot, has_na, service_type), qa_periods(id, month, year)')
      .eq('peserta_id', peserta_id)
      .eq('period_id', period_id);
    if (serviceType) {
      query = query.eq('service_type', serviceType);
    }
    if (supportsPhantom) {
      query = query.eq('is_phantom_padding', false);
    }
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async getAgentTemuanRange(agentId: string, year: number, startMonth: number, endMonth: number, serviceType: string) {
    const supabase = await createClient();
    const queryClient = getServiceSupabase() || supabase;
    const hasPhantomSupport = await hasPhantomPaddingSupport(queryClient);

    const { data: periods } = await queryClient
      .from('qa_periods')
      .select('id')
      .eq('year', year)
      .gte('month', startMonth)
      .lte('month', endMonth);
    
    if (!periods || periods.length === 0) return [];
    const pIds = periods.map(p => p.id);

    let query = queryClient
      .from('qa_temuan')
      .select('*, qa_periods!inner(*), qa_indicators:qa_service_rule_indicators(id, name, category, bobot, has_na, service_type, threshold)')
      .eq('peserta_id', agentId)
      .eq('service_type', serviceType)
      .in('period_id', pIds)
      .order('created_at', { ascending: false });

    if (hasPhantomSupport) {
      query = query.eq('is_phantom_padding', false);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as QATemuan[];
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
    let cachedSummary: AgentDirectoryEntry[] | null = null;

    try {
      cachedSummary = await _cachedFetchAgentDirectorySummary(year);
    } catch (error) {
      console.warn('[QA] qa.agentDirectorySummary.rpc-cache-hit fetch failed', {
        year,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    if (Array.isArray(cachedSummary) && cachedSummary.length > 0) {
      logServerMetric('qa.agentDirectorySummary.rpc-cache-hit', startedAt, { year, count: cachedSummary.length });
      return cachedSummary;
    }

    try {
      // Keep directory scores aligned with the detail page by using the same
      // TypeScript scoring path, which already paginates qa_temuan fetches past
      // the 1000-row PostgREST cap.
      const accurate = await this.getAgentListWithScores(year);
      if (!Array.isArray(accurate)) {
        throw new Error('Invalid agent directory summary payload');
      }
      logServerMetric('qa.agentDirectorySummary.accurate-fallback', startedAt, { year, count: accurate.length });
      return accurate;
    } catch (error) {
      console.error('[QA] qa.agentDirectorySummary.directory-failed', {
        year,
        cachedCount: Array.isArray(cachedSummary) ? cachedSummary.length : null,
        error: error instanceof Error ? error.message : String(error),
      });

      if (Array.isArray(cachedSummary)) {
        return cachedSummary;
      }

      if (error instanceof Error) throw error;
      throw new Error('Failed to load agent directory summary');
    }
  },

  async getAgentListWithScores(year: number = new Date().getFullYear()) {
    const supabase = await createClient();
    const loadScoringContext = createScoringContextLoader();
    // 1. Fetch agents
    const { data: agentData, error: agentError } = await supabase
      .from('profiler_peserta')
      .select('id, nama, tim, batch_name, foto_url, jabatan')
      .order('nama');
    if (agentError) throw agentError;
    const agents = (agentData ?? []).filter(a => !isAgentExcluded(a.tim, a.batch_name, a.jabatan));

    // 2. Initial service client (bypass RLS for all aggregate lookups)
    const serviceClient = getServiceSupabase() || supabase;

    // 3b. Fetch all weights
    // 3c. Fetch all periods
    const { data: periodsData } = await serviceClient
      .from('qa_periods')
      .select('id, month, year');
    const periodsMap = new Map<string, { id: string; month: number; year: number }>();
    (periodsData ?? []).forEach(p => periodsMap.set(p.id, p));

    // 3b. Fetch all temuan WITHOUT join — service client (bypass RLS), period data attached manually below
    // PENTING: Menggunakan pagination manual (range) karena Supabase max_rows dibatasi 1000
    let allTemuanData: Partial<QATemuan>[] = [];
    let from = 0;
    const step = 1000;
    let finished = false;

    while (!finished) {
      const { data, error } = await serviceClient
        .from('qa_temuan')
        .select('peserta_id, indicator_id, rule_indicator_id, nilai, no_tiket, service_type, ketidaksesuaian, sebaiknya, period_id, created_at, is_phantom_padding')
        .eq('tahun', year)
        .range(from, from + step - 1);

      if (error) throw error;
      if (!data || data.length === 0) {
        finished = true;
      } else {
        allTemuanData = [...allTemuanData, ...(data as Partial<QATemuan>[])];
        if (data.length < step) {
          finished = true;
        } else {
          from += step;
        }
      }
    }

    // 3c. Enrich temuan with period data (safe — no dependency on PostgREST join)
    const allTemuan = filterRealAuditRows(allTemuanData).map(t => ({
      ...t,
      qa_periods: periodsMap.get(t.period_id || '') ?? null,
    }));

    const agentDataMap = new Map<string, AgentDirectoryEntry>();
    agents.forEach(a => {
      agentDataMap.set(a.id, {
        ...a,
        batch: a.batch_name || '',
        avgScore: null,
        trend: 'none',
        trendValue: null,
        atRisk: false
      } as AgentDirectoryEntry);
    });

    function periodServiceKey(m: number, y: number, s: string) { return `${y}-${String(m).padStart(2, '0')}-${s}`; }

    const temuanByAgent = new Map<string, QATemuan[]>();
    allTemuan.forEach(t => {
      if (!t.qa_periods) return; 
      if (!temuanByAgent.has(t.peserta_id!)) temuanByAgent.set(t.peserta_id!, []);
      temuanByAgent.get(t.peserta_id!)!.push(t as QATemuan);
    });

    for (const [agentId, agentObj] of agentDataMap.entries()) {
      const agentTemuan = temuanByAgent.get(agentId) || [];
      if (agentTemuan.length === 0) continue;

      try {
        const pSvcMap = new Map<string, QATemuan[]>();
        agentTemuan.forEach(t => {
          const activeService = (t.service_type || resolveServiceTypeFromTeam(agentObj.tim)).toLowerCase();
          const period = t.qa_periods as QAPeriod;
          const psk = periodServiceKey(period.month, period.year, activeService);
          if (!pSvcMap.has(psk)) pSvcMap.set(psk, []);
          pSvcMap.get(psk)!.push(t);
        });

        const sortedPsk = [...pSvcMap.keys()].sort((a, b) => b.localeCompare(a));
        const latestPsk = sortedPsk[0];
        if (!latestPsk) continue;

        const latestTemuan = pSvcMap.get(latestPsk);
        if (!latestTemuan || latestTemuan.length === 0) continue;

        const activeService = (latestTemuan[0]?.service_type || resolveServiceTypeFromTeam(agentObj.tim)).toLowerCase();

        // Resolve versioned rules
        const latestContext = await loadScoringContext(activeService as ServiceType, latestTemuan[0].period_id);

        // Latest Score
        const latestScore = calculateQAScoreFromTemuan(
          latestContext.indicators,
          normalizeTemuanForScoring(latestTemuan, latestContext),
          latestContext.activeWeight
        );

        agentObj.avgScore = latestScore.finalScore;
        agentObj.atRisk = latestScore.finalScore < 95;

        let prevPsk = sortedPsk.find((key, idx) => idx > 0 && key.endsWith(activeService));
        if (!prevPsk && sortedPsk.length > 1) {
          prevPsk = sortedPsk[1];
        }

        if (prevPsk) {
          const prevTemuan = pSvcMap.get(prevPsk);
          if (!prevTemuan || prevTemuan.length === 0) continue;

          const prevActiveService = (prevTemuan[0]?.service_type || activeService).toLowerCase();

          const prevContext = await loadScoringContext(prevActiveService as ServiceType, prevTemuan[0].period_id);

          const prevScore = calculateQAScoreFromTemuan(
            prevContext.indicators,
            normalizeTemuanForScoring(prevTemuan, prevContext),
            prevContext.activeWeight
          );

          agentObj.trendValue = latestScore.finalScore - prevScore.finalScore;
          agentObj.trend = agentObj.trendValue > 0 ? 'up' : agentObj.trendValue < 0 ? 'down' : 'same';
        }
      } catch (error) {
        const sample = agentTemuan[0];
        agentObj.avgScore = null;
        agentObj.trend = 'none';
        agentObj.trendValue = null;
        agentObj.atRisk = false;
        console.warn('[QA] Failed to score agent directory entry', {
          agentId,
          period_id: sample?.period_id ?? null,
          service_type: sample?.service_type ?? null,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return [...agentDataMap.values()];
  },

  async getAgentPeriodSummaries(agentId: string, year: number = new Date().getFullYear()) {
    const startedAt = measureStart();
    if (process.env.NODE_ENV === 'production') {
      const cached = await cachedFetchAgentPeriodSummaries(agentId, year);
      if (cached) {
        logServerMetric('qa.agentPeriodSummaries.cache', startedAt, { agentId, year, periods: cached.length });
        return { periods: cached };
      }
    }

    const supabase = await createClient();
    const queryClient = getServiceSupabase() || supabase;
    const loadScoringContext = createScoringContextLoader();
    const hasPhantomSupport = await hasPhantomPaddingSupport(queryClient);
    const temuanPromise = hasPhantomSupport
      ? queryClient
          .from('qa_temuan')
          .select('indicator_id, rule_indicator_id, nilai, ketidaksesuaian, sebaiknya, no_tiket, service_type, created_at, period_id, is_phantom_padding, qa_periods(month, year)')
          .eq('peserta_id', agentId)
          .eq('tahun', year)
          .order('created_at', { ascending: false })
      : queryClient
          .from('qa_temuan')
          .select('indicator_id, rule_indicator_id, nilai, ketidaksesuaian, sebaiknya, no_tiket, service_type, created_at, period_id, qa_periods(month, year)')
          .eq('peserta_id', agentId)
          .eq('tahun', year)
          .order('created_at', { ascending: false });
    const { data: temuanRaw, error } = await temuanPromise;

    if (error) throw error;

    const temuan = ((temuanRaw ?? []) as Array<{
      indicator_id: string;
      rule_indicator_id?: string | null;
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
      qa_periods: unwrapPeriod(item.qa_periods) as QAPeriod,
    }));

    const grouped = buildPartitionedAuditRows(temuan, (item) => {
      if (!item.qa_periods) return null;
      return `${item.period_id}:${item.service_type}`;
    });

    const periodResults = await Promise.all([...grouped.values()].map(async ({ auditPresenceRows, scoreRows, findingRows }) => {
      const sample = auditPresenceRows[0];
      const period = sample.qa_periods as QAPeriod;
      if (!period) return null;

      const context = await loadScoringContext(sample.service_type, sample.period_id);
      if (context.indicators.length === 0) {
        console.warn('[QA] agent period summary has no indicators', {
          agentId,
          periodId: sample.period_id,
          serviceType: sample.service_type,
        });
        return null;
      }

      const score = calculateQAScoreFromTemuan(
        context.indicators,
        normalizeTemuanForScoring(scoreRows, context),
        context.activeWeight
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
        findingsCount: findingRows.length,
      };
    }));

    const periods = periodResults
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        if (a.month !== b.month) return b.month - a.month;
        return b.serviceType.localeCompare(a.serviceType);
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
    const queryClient = getServiceSupabase() || supabase;
    const supportsPhantom = await hasPhantomPaddingSupport(queryClient);
    const from = Math.max(page, 0) * pageSize;
    const to = from + pageSize;

    let query = queryClient
      .from('qa_temuan')
      .select('*, qa_indicators:qa_service_rule_indicators(id, name, category, bobot, has_na, service_type), qa_periods(id, month, year)', {
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
    const queryClient = getServiceSupabase() || supabase;
    const supportsPhantom = await hasPhantomPaddingSupport(queryClient);
    const { data: agentRaw, error: agentError } = await supabase
      .from('profiler_peserta').select('*').eq('id', peserta_id).single();
    if (agentError) throw agentError;

    const agent = {
      ...agentRaw,
      batch: agentRaw.batch_name
    };

    let query = queryClient
      .from('qa_temuan')
      .select('*, qa_indicators:qa_service_rule_indicators(id, name, category, bobot, has_na, service_type), qa_periods(id, month, year)')
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
      .filter((a) => !isAgentExcluded(a.tim, a.batch_name, a.jabatan))
      .map((a) => ({
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
      .filter((a) => !isAgentExcluded(a.tim, a.batch_name, a.jabatan))
      .map((a) => ({
        id: a.id,
        nama: a.nama,
        tim: a.tim,
        batch: a.batch_name,
        jabatan: a.jabatan
      }));
  },

  // ── Rule Versioning Management ──────────────────────────────
  async getRuleVersions(serviceType: ServiceType): Promise<QARuleVersion[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('qa_service_rule_versions')
      .select('*, qa_periods(id, month, year)')
      .eq('service_type', serviceType)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async getIndicatorsByVersion(versionId: string): Promise<QARuleIndicatorSnapshot[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('qa_service_rule_indicators')
      .select('*')
      .eq('rule_version_id', versionId)
      .order('sort_order', { ascending: true })
      .order('category')
      .order('bobot', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async createRuleDraft(serviceType: ServiceType, createdBy: string, sourceVersionId?: string): Promise<QARuleVersion> {
    const supabase = await createClient();
    
    // 1. Get base data from source or current weights
    let baseWeights: { critical_weight: number, non_critical_weight: number, scoring_mode: ScoringMode };
    let baseIndicators: any[];

    if (sourceVersionId) {
      const { data: sourceVer, error: verErr } = await supabase
        .from('qa_service_rule_versions').select('*').eq('id', sourceVersionId).single();
      if (verErr) throw verErr;
      baseWeights = { 
        critical_weight: Number(sourceVer.critical_weight), 
        non_critical_weight: Number(sourceVer.non_critical_weight), 
        scoring_mode: sourceVer.scoring_mode as ScoringMode 
      };
      
      const { data: sourceInds, error: indsErr } = await supabase
        .from('qa_service_rule_indicators').select('*').eq('rule_version_id', sourceVersionId);
      if (indsErr) throw indsErr;
      baseIndicators = sourceInds;
    } else {
      const weightsMap = await this.getServiceWeights(serviceType);
      const activeWeight = weightsMap[serviceType] || DEFAULT_SERVICE_WEIGHTS[serviceType];
      baseWeights = { 
        critical_weight: activeWeight.critical_weight, 
        non_critical_weight: activeWeight.non_critical_weight, 
        scoring_mode: activeWeight.scoring_mode 
      };
      
      const inds = await this.getIndicators(serviceType);
      baseIndicators = inds;
    }

    // 2. Find a default effective period (latest period)
    const periods = await this.getPeriods();
    const effectivePeriodId = periods[0]?.id;

    // 3. Create Draft Version
    const { data: newVer, error: createErr } = await supabase
      .from('qa_service_rule_versions')
      .insert({
        service_type: serviceType,
        effective_period_id: effectivePeriodId,
        status: 'draft',
        critical_weight: baseWeights.critical_weight,
        non_critical_weight: baseWeights.non_critical_weight,
        scoring_mode: baseWeights.scoring_mode,
        created_by: createdBy,
      })
      .select().single();
    
    if (createErr) throw createErr;

    // 4. Copy Indicators
    const newInds = baseIndicators.map(ind => ({
      rule_version_id: newVer.id,
      service_type: serviceType,
      name: ind.name,
      category: ind.category,
      bobot: Number(ind.bobot),
      has_na: ind.has_na || false,
      threshold: ind.threshold || null,
      sort_order: ind.sort_order || 0,
      legacy_indicator_id: ind.id,
    }));

    const { error: copyErr } = await supabase.from('qa_service_rule_indicators').insert(newInds);
    if (copyErr) throw copyErr;

    return newVer;
  },

  async updateRuleDraft(versionId: string, patch: Partial<QARuleVersion>): Promise<QARuleVersion> {
    const supabase = await createClient();
    
    const { data: current } = await supabase
      .from('qa_service_rule_versions').select('status').eq('id', versionId).single();
    if (current?.status === 'published') throw new Error('Cannot update a published rule version');

    const { data, error } = await supabase
      .from('qa_service_rule_versions')
      .update(patch)
      .eq('id', versionId)
      .eq('status', 'draft')
      .select().single();
    if (error) throw error;
    return data;
  },

  async deleteRuleDraft(versionId: string) {
    const supabase = await createClient();

    const { data: current } = await supabase
      .from('qa_service_rule_versions').select('status').eq('id', versionId).single();
    if (current?.status === 'published') throw new Error('Cannot delete a published rule version');

    const { error } = await supabase
      .from('qa_service_rule_versions')
      .delete()
      .eq('id', versionId)
      .eq('status', 'draft');
    if (error) throw error;
  },

  async publishRuleVersion(versionId: string, publishedBy: string, effectivePeriodId: string): Promise<QARuleVersion> {
    const supabase = await createClient();
    
    // Check if another version is already published for same period/service
    const { data: currentVer } = await supabase
      .from('qa_service_rule_versions')
      .select('service_type')
      .eq('id', versionId)
      .single();
    
    if (!currentVer) throw new Error('Versi tidak ditemukan');

    const { data: existing } = await supabase
      .from('qa_service_rule_versions')
      .select('id')
      .eq('service_type', currentVer.service_type)
      .eq('effective_period_id', effectivePeriodId)
      .eq('status', 'published')
      .maybeSingle();
    
    if (existing) throw new Error('Sudah ada versi published untuk periode ini. Batalkan atau ubah periode target.');

    const { data, error } = await supabase
      .from('qa_service_rule_versions')
      .update({
        status: 'published',
        published_by: publishedBy,
        published_at: new Date().toISOString(),
        effective_period_id: effectivePeriodId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', versionId)
      .select().single();
    
    if (error) throw error;
    return data;
  },

  async addDraftIndicator(versionId: string, indicator: Partial<QARuleIndicatorSnapshot>): Promise<QARuleIndicatorSnapshot> {
    const supabase = await createClient();

    const { data: current } = await supabase
      .from('qa_service_rule_versions').select('status, service_type').eq('id', versionId).single();
    if (current?.status === 'published') throw new Error('Cannot add indicators to a published rule version');

    const { data, error } = await supabase
      .from('qa_service_rule_indicators')
      .insert({
        ...indicator,
        rule_version_id: versionId,
        service_type: current?.service_type
      })
      .select().single();
    if (error) throw error;
    return data;
  },

  async updateDraftIndicator(id: string, patch: Partial<QARuleIndicatorSnapshot>): Promise<QARuleIndicatorSnapshot> {
    const supabase = await createClient();

    const { data: version } = await supabase
      .from('qa_service_rule_indicators')
      .select('qa_service_rule_versions(status)')
      .eq('id', id)
      .single();
    
    const status = (version?.qa_service_rule_versions as any)?.status;
    if (status === 'published') throw new Error('Cannot update indicator of a published rule version');

    const { data, error } = await supabase
      .from('qa_service_rule_indicators')
      .update(patch)
      .eq('id', id)
      .select().single();
    if (error) throw error;
    return data;
  },

  async deleteDraftIndicator(id: string) {
    const supabase = await createClient();

    const { data: version } = await supabase
      .from('qa_service_rule_indicators')
      .select('qa_service_rule_versions(status)')
      .eq('id', id)
      .single();
    
    const status = (version?.qa_service_rule_versions as any)?.status;
    if (status === 'published') throw new Error('Cannot delete indicator of a published rule version');

    const { error } = await supabase
      .from('qa_service_rule_indicators')
      .delete()
      .eq('id', id);
    if (error) throw error;
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
    const loadScoringContext = createScoringContextLoader();
    const hasPhantomSupport = await hasPhantomPaddingSupport(supabase);
    const pIds = await this.resolvePeriodIds(periodId, year);

    // 1. Fetch Findings first to determine audited population
    let query = supabase
      .from('qa_temuan')
      .select('*, qa_indicators:qa_service_rule_indicators(category), profiler_peserta!inner(batch_name, tim)')
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
    const agentTemuanMap: Record<string, { indicator_id: string; nilai: number; no_tiket: string | null; service_type: string }[]> = {};
    const auditedAgentsList: { id: string; batch_name: string | null; tim: string | null }[] = [];
    const seenAgents = new Set<string>();

    data.forEach(d => {
      if (!agentTemuanMap[d.peserta_id]) {
        agentTemuanMap[d.peserta_id] = [];
      }
      agentTemuanMap[d.peserta_id].push({ 
        indicator_id: d.indicator_id, 
        nilai: d.nilai, 
        no_tiket: d.no_tiket || null, 
        service_type: d.service_type 
      });

      if (!seenAgents.has(d.peserta_id)) {
        seenAgents.add(d.peserta_id);
        const p = unwrapAgent(d.profiler_peserta) as Agent;
        auditedAgentsList.push({
          id: d.peserta_id,
          batch_name: p?.batch_name || null,
          tim: p?.tim || null
        });
      }
    });

    const totalAuditedAgents = auditedAgentsList.length;
    const allFindings = filterCountableFindings(data);

    // 3. Calculate Rates over Audited Population
    let agentsWithZeroError = 0;
    let agentsWithPassScore = 0;
    let totalScore = 0;
    
    const scoreResults = await Promise.all(auditedAgentsList.map(async (agent) => {
      const temuanList = agentTemuanMap[agent.id] || [];
      return {
        hasDefect: temuanList.some(t => t.nilai < 3),
        score: await calculateScopedScoreAcrossPeriods(
          serviceType as ServiceType,
          temuanList,
          loadScoringContext
        ),
      };
    }));

    scoreResults.forEach(({ hasDefect, score }) => {
      if (!hasDefect) {
        agentsWithZeroError++;
      }
      totalScore += score.finalScore;
      if (score.finalScore >= 95) {
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
    const loadScoringContext = createScoringContextLoader();
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
      .select('nilai, ketidaksesuaian, sebaiknya, no_tiket, period_id, peserta_id, indicator_id, qa_indicators:qa_service_rule_indicators(category), profiler_peserta!inner(batch_name, tim)')
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

    const temuanByPeriod = (temuan || []).reduce((acc: Record<string, typeof temuan>, t) => {
      if (!acc[t.period_id]) acc[t.period_id] = [];
      acc[t.period_id].push(t);
      return acc;
    }, {});

    const points = await Promise.all(sortedPeriods.map(async (p) => {
      const pTemuan = temuanByPeriod[p.id] || [];
      const auditedAgentsInPeriod = new Set<string>(pTemuan.map((t) => t.peserta_id));
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
            const hasDefect = pTemuan.some((t) => t.peserta_id === agentId && t.nilai < 3);
            if (!hasDefect) zeroErrorCount++;
          });
          value = (zeroErrorCount / totalAudited) * 100;
        }
      }
      else if (metric === 'compliance') {
        if (totalAudited > 0) {
          let passCount = 0;
          const scoringContext = await loadScoringContext(serviceType as ServiceType, p.id);
          auditedAgentsInPeriod.forEach(agentId => {
            const agentTemuans = pTemuan.filter((t) => t.peserta_id === agentId);
            const result = calculateQAScoreFromTemuan(
              scoringContext.indicators,
              normalizeTemuanForScoring(agentTemuans as ScoringTemuanLike[], scoringContext),
              scoringContext.activeWeight
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
    }));

    return points;
  },

  async getTrendWithParameters(periodId: string, serviceType: string, folderIds: string[] = [], timeframe: '3m' | '6m' | 'all' = '3m', context?: SharedContext, year?: number) {
    const supabase = await createClient();
    const loadScoringContext = createScoringContextLoader();
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
      .select('nilai, ketidaksesuaian, sebaiknya, period_id, indicator_id, rule_indicator_id, qa_indicators:qa_service_rule_indicators(id, name, category), profiler_peserta!inner(batch_name)')
      .in('period_id', pIds)
      .eq('tahun', year || (periodId === 'ytd' ? (new Date().getFullYear()) : sortedPeriods[0]?.year || new Date().getFullYear()))
      .eq('service_type', serviceType);

    if (folderIds.length > 0) query = query.in('profiler_peserta.batch_name', folderIds);

    const { data: temuan } = await query;
    if (!temuan) return { labels, datasets: [] };

    const findings = filterCountableFindings(temuan as unknown as QATemuan[]);

    const counts: Record<string, Record<string, number>> = {};
    const totalByPeriod: Record<string, number> = {};

    for (const finding of findings as ScoringTemuanLike[]) {
      const pName = (await resolveFindingIndicatorMeta(
        { ...finding, service_type: serviceType },
        loadScoringContext,
        serviceType
      ))?.name || 'Unknown';
      const pid = finding.period_id;
      if (!pid) continue;
      if (!counts[pName]) counts[pName] = {};
      counts[pName][pid] = (counts[pName][pid] || 0) + 1;
      totalByPeriod[pid] = (totalByPeriod[pid] || 0) + 1;
    }

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
    const pIds = await this.resolvePeriodIds(periodId);
    let query = supabase
      .from('qa_temuan')
      .select('nilai, ketidaksesuaian, sebaiknya, service_type, profiler_peserta!inner(batch_name)')
      .in('period_id', pIds);

    if (folderIds.length > 0) query = query.in('profiler_peserta.batch_name', folderIds);

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

  async getTopAgentsWithDefects(periodId: string, serviceType: string, limit: number = 5, folderIds: string[] = [], _context?: SharedContext): Promise<TopAgentData[]> {
    const supabase = await createClient();
    const loadScoringContext = createScoringContextLoader();
    const pIds = await this.resolvePeriodIds(periodId);
    const hasPhantomSupport = await hasPhantomPaddingSupport(supabase);

    let query = supabase
      .from('qa_temuan')
      .select('period_id, rule_indicator_id, nilai, ketidaksesuaian, sebaiknya, no_tiket, indicator_id, is_phantom_padding, qa_indicators:qa_service_rule_indicators(category), profiler_peserta!inner(id, nama, batch_name, tim, jabatan)')
      .in('period_id', pIds)
      .eq('service_type', serviceType);

    if (folderIds.length > 0) query = query.in('profiler_peserta.batch_name', folderIds);

    const { data, error } = await query;
    if (error || !data) return [];

    const temuan = data.map((d) => ({
      period_id: d.period_id,
      indicator_id: d.indicator_id,
      rule_indicator_id: d.rule_indicator_id,
      nilai: d.nilai,
      no_tiket: d.no_tiket || null,
      ketidaksesuaian: d.ketidaksesuaian,
      sebaiknya: d.sebaiknya,
      qa_indicators: d.qa_indicators as QATemuan['qa_indicators'],
      is_phantom_padding: hasPhantomSupport ? (d as unknown as QATemuan).is_phantom_padding === true : false,
      profiler_peserta: unwrapAgent(d.profiler_peserta) as Agent | null,
    }));
    const partitions = buildPartitionedAuditRows(temuan, (item) => item.period_id || null);
    const collections = buildAgentAuditCollections(partitions.values(), {
      getAgentIdentity: (sample) => {
        const profile = sample.profiler_peserta;
        if (!profile?.id) return null;
        return {
          id: profile.id,
          nama: profile.nama || '',
          batch_name: profile.batch_name || null,
          tim: profile.tim || null,
          jabatan: profile.jabatan || null,
        };
      },
      normalizeScoreRow: (row) => ({
        period_id: row.period_id,
        indicator_id: row.indicator_id,
        rule_indicator_id: row.rule_indicator_id,
        nilai: row.nilai,
        no_tiket: row.no_tiket,
        ketidaksesuaian: row.ketidaksesuaian,
        sebaiknya: row.sebaiknya,
        qa_indicators: row.qa_indicators,
        is_phantom_padding: row.is_phantom_padding,
      }),
    });

    return buildTopAgentRanking({
      ...collections,
      limit,
      excludeAgent: (agent) => isAgentExcluded(agent.tim, agent.batch_name, agent.jabatan),
      evaluateScore: async (_agent, scoreRows) => calculateScopedScoreAcrossPeriods(
        serviceType as ServiceType,
        scoreRows,
        loadScoringContext
      ),
      evaluateHasCritical: async (_agent, findingRows) => hasCriticalDefectAcrossPeriods(
        serviceType as ServiceType,
        findingRows,
        loadScoringContext
      ),
    });
  },

  async getAllAgentsRanking(
    periodId: string,
    serviceType: string,
    folderIds: string[] = [],
    _context?: SharedContext,
    year?: number
  ): Promise<TopAgentData[]> {
    const supabase = await createClient();
    const loadScoringContext = createScoringContextLoader();
    const pIds = await this.resolvePeriodIds(periodId, year);
    const hasPhantomSupport = await hasPhantomPaddingSupport(supabase);
    const queryClient = getServiceSupabase() || supabase;

    // Fetch all rows with pagination to avoid PostgREST 1000-row truncation.
    // Service-role client ensures phantom padding rows are visible.
    let allData: any[] = [];
    let from = 0;
    const step = 1000;
    let finished = false;

    while (!finished) {
      let query = queryClient
        .from('qa_temuan')
        .select('peserta_id, period_id, rule_indicator_id, nilai, ketidaksesuaian, sebaiknya, no_tiket, indicator_id, is_phantom_padding, qa_indicators:qa_service_rule_indicators(category), profiler_peserta!inner(id, nama, batch_name, tim, jabatan)')
        .in('period_id', pIds)
        .eq('service_type', serviceType)
        .range(from, from + step - 1);

      if (folderIds.length > 0) query = query.in('profiler_peserta.batch_name', folderIds);

      const { data, error } = await query;
      if (error) {
        console.error('[getAllAgentsRanking] query error:', error);
        return [];
      }
      if (!data || data.length === 0) {
        finished = true;
      } else {
        allData = [...allData, ...data];
        if (data.length < step) {
          finished = true;
        } else {
          from += step;
        }
      }
    }

    const temuan = allData.map((d) => ({
      peserta_id: String(d.peserta_id ?? ''),
      period_id: d.period_id,
      indicator_id: d.indicator_id,
      rule_indicator_id: d.rule_indicator_id,
      nilai: d.nilai,
      no_tiket: d.no_tiket || null,
      ketidaksesuaian: d.ketidaksesuaian,
      sebaiknya: d.sebaiknya,
      qa_indicators: d.qa_indicators as QATemuan['qa_indicators'],
      is_phantom_padding: hasPhantomSupport ? (d as unknown as QATemuan).is_phantom_padding === true : false,
      profiler_peserta: unwrapAgent(d.profiler_peserta) as Agent | null,
    }));
    const partitions = buildPartitionedAuditRows(temuan, (item) => {
      if (!item.peserta_id || !item.period_id) return null;
      return `${item.peserta_id}:${item.period_id}`;
    });
    const collections = buildAgentAuditCollections(partitions.values(), {
      getAgentIdentity: (sample) => {
        const profile = sample.profiler_peserta;
        if (!profile?.id) return null;
        return {
          id: profile.id,
          nama: profile.nama || '',
          batch_name: profile.batch_name || null,
          tim: profile.tim || null,
          jabatan: profile.jabatan || null,
        };
      },
      normalizeScoreRow: (row) => ({
        period_id: row.period_id,
        indicator_id: row.indicator_id,
        rule_indicator_id: row.rule_indicator_id,
        nilai: row.nilai,
        no_tiket: row.no_tiket,
        ketidaksesuaian: row.ketidaksesuaian,
        sebaiknya: row.sebaiknya,
        qa_indicators: row.qa_indicators,
        is_phantom_padding: row.is_phantom_padding,
      }),
    });

    return buildTopAgentRanking({
      ...collections,
      excludeAgent: (agent) => isAgentExcluded(agent.tim, agent.batch_name, agent.jabatan),
      evaluateScore: async (_agent, scoreRows) => calculateScopedScoreAcrossPeriods(
        serviceType as ServiceType,
        scoreRows,
        loadScoringContext
      ),
      evaluateHasCritical: async (_agent, findingRows) => hasCriticalDefectAcrossPeriods(
        serviceType as ServiceType,
        findingRows,
        loadScoringContext
      ),
    });
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
      const ind = unwrapIndicator(d.qa_indicators) as QAIndicator;
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

    if (!isValidDashboardTrendData(data)) {
      console.warn('[RPC] get_service_trend_dashboard returned unexpected shape. Payload keys:', Object.keys(data || {}).join(', '));
      return this.getServiceTrendForDashboard('all');
    }

    return data;
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
    const loadScoringContext = createScoringContextLoader();
    const pIds = await this.resolvePeriodIds(periodId, year);
    const currentYear = year || new Date().getFullYear();

    // Single Query for all relevant finding data
    let query = supabase
      .from('qa_temuan')
      .select('*, qa_indicators:qa_service_rule_indicators(id, name, category, bobot), profiler_peserta!inner(id, nama, batch_name, tim, jabatan)')
      .in('period_id', pIds)
      .eq('tahun', currentYear);
      // Remove .eq('service_type', serviceType) to allow comparison across services

    if (folderIds.length > 0) {
      query = query.in('profiler_peserta.batch_name', folderIds);
    }

    const { data, error } = await query;
    console.log('[DEBUG] getConsolidatedPeriodData fetched rows:', data?.length);
    if (error || !data) {
      console.error('[DEBUG] getConsolidatedPeriodData DB Error:', error);
      return null;
    }

    const eligibleData = data.filter((entry) => {
      const agentProfile = unwrapAgent(entry.profiler_peserta) as Agent;
      return !isAgentExcluded(agentProfile?.tim, agentProfile?.batch_name, agentProfile?.jabatan);
    });
    const currentServiceData = eligibleData.filter(
      (entry) => entry.service_type === serviceType
    ) as Array<ScopedAuditFindingLike & { peserta_id: string; period_id: string; service_type: ServiceType }>;
    const currentServicePartitions = buildPartitionedAuditRows(
      currentServiceData,
      (entry) => `${entry.peserta_id}:${entry.period_id}:${entry.service_type}`
    );
    const serviceFindings = collectPartitionRows(currentServicePartitions.values(), 'findingRows')
      .map((finding) => normalizeScopedFindingForScoring(finding));
    const currentServiceCollections = buildAgentAuditCollections(currentServicePartitions.values(), {
      getAgentIdentity: (sample) => {
        const profile = unwrapAgent(sample.profiler_peserta) as Agent;
        if (!sample.peserta_id) return null;
        return {
          id: sample.peserta_id,
          nama: profile?.nama || '',
          batch_name: profile?.batch_name || null,
          tim: profile?.tim || null,
          jabatan: profile?.jabatan || null,
        };
      },
      normalizeScoreRow: (row) => normalizeScopedFindingForScoring(row),
    });
    const summary = await deriveDashboardSummary({
      ...currentServiceCollections,
      totalFindings: serviceFindings.length,
      evaluateScore: async (_agent, scoreRows) => calculateScopedScoreAcrossPeriods(
        serviceType as ServiceType,
        scoreRows,
        loadScoringContext
      ),
    });

    // ── 2. Calculate Pareto ──
    const paramCounts: Record<string, { count: number, name: string, category: string }> = {};
    for (const finding of serviceFindings as ScoringTemuanLike[]) {
      const meta = await resolveFindingIndicatorMeta(
        { ...finding, service_type: serviceType },
        loadScoringContext,
        serviceType
      );
      if (!meta) continue;
      const metaId = meta.id || `${finding.rule_indicator_id || finding.indicator_id || meta.name}`;
      if (!paramCounts[metaId]) {
        paramCounts[metaId] = {
          count: 0,
          name: meta.name.trim(),
          category: (meta.category || 'non_critical') as string,
        };
      }
      paramCounts[metaId].count++;
    }

    let cumulativeCount = 0;
    const paretoData: ParetoData[] = Object.entries(paramCounts)
      .map(([_id, info]) => ({ name: info.name, fullName: info.name, count: info.count, category: info.category as 'critical' | 'non_critical', cumulative: 0 }))
      .sort((a, b) => b.count - a.count || a.fullName.localeCompare(b.fullName))
      .map(item => {
        cumulativeCount += item.count;
        item.cumulative = serviceFindings.length > 0 ? Number(((cumulativeCount / serviceFindings.length) * 100).toFixed(1)) : 0;
        return item;
      });

    // ── 3. Calculate Service Comparison ──
    const servicePartitions = buildPartitionedAuditRows(
      eligibleData as Array<ScopedAuditFindingLike & { peserta_id: string; period_id: string; service_type: string }>,
      (entry) => `${entry.peserta_id}:${entry.period_id}:${entry.service_type}`
    );
    const serviceData = buildServiceComparisonData(
      servicePartitions.values(),
      (sType) => SERVICE_LABELS[sType as ServiceType] || sType
    );

    // ── 4. Critical vs Non-Critical ──
    // serviceFindings sudah difilter agar sesi tanpa temuan tidak ikut total temuan

    let critical = 0;
    let nonCritical = 0;
    for (const finding of serviceFindings as ScoringTemuanLike[]) {
      const category = (await resolveFindingIndicatorMeta(
        { ...finding, service_type: serviceType },
        loadScoringContext,
        serviceType
      ))?.category;
      if (category === 'critical') critical++;
      else nonCritical++;
    }
    const donutData = { critical, nonCritical, total: critical + nonCritical };

    const agentStats = await buildTopAgentRanking({
      ...currentServiceCollections,
      limit: 5,
      excludeAgent: (agent) => isAgentExcluded(agent.tim, agent.batch_name, agent.jabatan),
      evaluateScore: async (_agent, scoreRows) => calculateScopedScoreAcrossPeriods(
        serviceType as ServiceType,
        scoreRows,
        loadScoringContext
      ),
      evaluateHasCritical: async (_agent, findingRows) => hasCriticalDefectAcrossPeriods(
        serviceType as ServiceType,
        findingRows,
        loadScoringContext
      ),
    });

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
    const loadScoringContext = createScoringContextLoader();
    const hasPhantomSupport = await hasPhantomPaddingSupport(supabase);
    const limitMap = { '3m': 3, '6m': 6, 'all': 24 };
    const limit = limitMap[timeframe] || 3;
    
    const allPeriods = context?.periods || (await this.getPeriods());
    const sortedPeriods = [...allPeriods].slice(0, limit).reverse();
    const pIds = sortedPeriods.map(p => p.id);
    const labels = sortedPeriods.map(p => `${MONTHS_SHORT[p.month - 1]} ${String(p.year).slice(-2)}`);
    
    if (pIds.length === 0) return null;

    let query = hasPhantomSupport
      ? supabase
          .from('qa_temuan')
          .select('nilai, ketidaksesuaian, sebaiknya, period_id, peserta_id, indicator_id, rule_indicator_id, is_phantom_padding, qa_indicators:qa_service_rule_indicators(id, name, category), profiler_peserta!inner(batch_name)', { count: 'exact' })
          .in('period_id', pIds)
          .eq('service_type', serviceType)
      : supabase
          .from('qa_temuan')
          .select('nilai, ketidaksesuaian, sebaiknya, period_id, peserta_id, indicator_id, rule_indicator_id, qa_indicators:qa_service_rule_indicators(id, name, category), profiler_peserta!inner(batch_name)', { count: 'exact' })
          .in('period_id', pIds)
          .eq('service_type', serviceType);

    if (folderIds.length > 0) query = query.in('profiler_peserta.batch_name', folderIds);

    const { data: temuan, count: totalRowCount, error } = await query;
    if (error) throw error;

    if ((totalRowCount || 0) > 150000) {
      throw new Error(`Data terlalu besar (${totalRowCount?.toLocaleString()} baris). Silakan persempit filter periode atau folder.`);
    }

    if (!temuan) return null;

    const scopedTemuan = temuan as Array<ScopedAuditFindingLike & { peserta_id: string; period_id: string }>;
    const allScopedPartitions = buildPartitionedAuditRows(
      scopedTemuan,
      (entry) => `${entry.peserta_id}:${entry.period_id}`
    );

    const dataByPeriod = await deriveTrendSummary({
      periods: sortedPeriods.map((p) => ({
        id: p.id,
        label: `${MONTHS_SHORT[p.month - 1]} ${String(p.year).slice(-2)}`,
      })),
      partitions: allScopedPartitions.values(),
      getPeriodId: (partition) => partition.auditPresenceRows[0]?.period_id,
      evaluateScore: async (partition, periodId) => {
        const scoringContext = await loadScoringContext(serviceType as ServiceType, periodId);
        return calculateQAScoreFromTemuan(
          scoringContext.indicators,
          normalizeTemuanForScoring(
            partition.scoreRows.map((row) => normalizeScopedFindingForScoring(row)),
            scoringContext
          ),
          scoringContext.activeWeight
        );
      },
    });

    // Parameter Trend Calculation
    const paramCounts: Record<string, Record<string, number>> = {};
    const totalFindingsByPeriod: Record<string, number> = {};

    const findingRows = collectPartitionRows(allScopedPartitions.values(), 'findingRows');

    for (const rawFinding of findingRows) {
      const finding = normalizeScopedFindingForScoring(rawFinding);
      const pName = (await resolveFindingIndicatorMeta(
        { ...finding, service_type: serviceType },
        loadScoringContext,
        serviceType
      ))?.name || 'Unknown';
      const pid = finding.period_id;
      if (!pid) continue;
      if (!paramCounts[pName]) paramCounts[pName] = {};
      paramCounts[pName][pid] = (paramCounts[pName][pid] || 0) + 1;
      totalFindingsByPeriod[pid] = (totalFindingsByPeriod[pid] || 0) + 1;
    }

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
        avg: dataByPeriod.map(d => ({ label: d.label, value: d.avg })),
        zero: dataByPeriod.map(d => ({ label: d.label, value: d.zero })),
        compliance: dataByPeriod.map(d => ({ label: d.label, value: d.compliance })),
        avgAgentScore: dataByPeriod.map(d => ({ label: d.label, value: d.avgAgentScore }))
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
    const loadScoringContext = createScoringContextLoader();
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
    let allTemuan: QATemuan[] = [];
    let from = 0;
    const PAGE_SIZE = 1000;
    let hasMore = true;

    while (hasMore) {
      let query = hasPhantomSupport
        ? supabase
            .from('qa_temuan')
            .select('nilai, ketidaksesuaian, sebaiknya, period_id, peserta_id, indicator_id, rule_indicator_id, is_phantom_padding, qa_indicators:qa_service_rule_indicators(id, name, category), profiler_peserta!inner(batch_name)')
            .in('period_id', pIds)
            .eq('service_type', serviceType)
            .order('id', { ascending: true }) // Stable ordering for pagination
            .range(from, from + PAGE_SIZE - 1)
        : supabase
            .from('qa_temuan')
            .select('nilai, ketidaksesuaian, sebaiknya, period_id, peserta_id, indicator_id, rule_indicator_id, qa_indicators:qa_service_rule_indicators(id, name, category), profiler_peserta!inner(batch_name)')
            .in('period_id', pIds)
            .eq('service_type', serviceType)
            .order('id', { ascending: true }) // Stable ordering for pagination
            .range(from, from + PAGE_SIZE - 1);

      if (folderIds.length > 0) query = query.in('profiler_peserta.batch_name', folderIds);

      const { data, error } = await (query as any);
      if (error) throw error;

      if (!data || data.length === 0) {
        hasMore = false;
      } else {
        allTemuan = [...allTemuan, ...(data as QATemuan[])];
        hasMore = data.length === PAGE_SIZE;
        from += PAGE_SIZE;
      }
    }

    const temuan = allTemuan as Array<ScopedAuditFindingLike & { peserta_id: string; period_id: string }>;
    const allScopedPartitions = buildPartitionedAuditRows(
      temuan,
      (entry) => `${entry.peserta_id}:${entry.period_id}`
    );

    const dataByPeriod = await deriveTrendSummary({
      periods: sortedPeriods.map((p) => ({
        id: p.id,
        label: `${MONTHS_SHORT[p.month - 1]} ${String(p.year).slice(-2)}`,
      })),
      partitions: allScopedPartitions.values(),
      getPeriodId: (partition) => partition.auditPresenceRows[0]?.period_id,
      evaluateScore: async (partition, periodId) => {
        const scoringContext = await loadScoringContext(serviceType as ServiceType, periodId);
        return calculateQAScoreFromTemuan(
          scoringContext.indicators,
          normalizeTemuanForScoring(
            partition.scoreRows.map((row) => normalizeScopedFindingForScoring(row)),
            scoringContext
          ),
          scoringContext.activeWeight
        );
      },
    });

    // Parameter Trend Calculation
    const paramCounts: Record<string, Record<string, number>> = {};
    const totalFindingsByPeriod: Record<string, number> = {};

    const findingRows = collectPartitionRows(allScopedPartitions.values(), 'findingRows');

    for (const rawFinding of findingRows) {
      const finding = normalizeScopedFindingForScoring(rawFinding);
      const pName = (await resolveFindingIndicatorMeta(
        { ...finding, service_type: serviceType },
        loadScoringContext,
        serviceType
      ))?.name || 'Unknown';
      const pid = finding.period_id;
      if (!pid) continue;
      if (!paramCounts[pName]) paramCounts[pName] = {};
      paramCounts[pName][pid] = (paramCounts[pName][pid] || 0) + 1;
      totalFindingsByPeriod[pid] = (totalFindingsByPeriod[pid] || 0) + 1;
    }

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
        avg: dataByPeriod.map(d => ({ label: d.label, value: d.avg })),
        zero: dataByPeriod.map(d => ({ label: d.label, value: d.zero })),
        compliance: dataByPeriod.map(d => ({ label: d.label, value: d.compliance })),
        avgAgentScore: dataByPeriod.map(d => ({ label: d.label, value: d.avgAgentScore }))
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
    const loadScoringContext = createScoringContextLoader();
    
    // 1. Resolve period IDs
    const allPeriods = context?.periods || (await this.getPeriods());
    const sortedPeriods = allPeriods
      .filter(p => p.year === year && p.month >= startMonth && p.month <= endMonth)
      .sort((a, b) => a.month - b.month);
    
    const pIds = sortedPeriods.map(p => p.id);
    if (pIds.length === 0) return null;

    // 2. Fetch all findings in range
    let allTemuan: Partial<QATemuan>[] = [];
    let from = 0;
    const PAGE_SIZE = 1000;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from('qa_temuan')
        .select('*, qa_indicators:qa_service_rule_indicators(id, name, category, bobot), profiler_peserta!inner(id, nama, batch_name, tim, jabatan)')
        .in('period_id', pIds)
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (folderIds.length > 0) query = query.in('profiler_peserta.batch_name', folderIds);

      const { data, error } = await query;
      if (error) throw error;

      if (!data || data.length === 0) {
        hasMore = false;
      } else {
        allTemuan = [...allTemuan, ...(data as Partial<QATemuan>[])];
        hasMore = data.length === PAGE_SIZE;
        from += PAGE_SIZE;
      }
    }

    const data = allTemuan;
    const eligibleData = data.filter((entry) => {
      const agentProfile = entry.profiler_peserta as unknown as { tim: string; batch_name: string; jabatan: string };
      return !isAgentExcluded(agentProfile?.tim, agentProfile?.batch_name, agentProfile?.jabatan);
    });

    const currentServiceData = eligibleData.filter(d => d.service_type === serviceType);
    const currentServicePartitions = buildPartitionedAuditRows(
      currentServiceData as Array<ScopedAuditFindingLike & { peserta_id: string; period_id: string; service_type: ServiceType }>,
      (entry) => `${entry.peserta_id}:${entry.period_id}:${entry.service_type}`
    );
    const serviceFindings = collectPartitionRows(currentServicePartitions.values(), 'findingRows')
      .map((finding) => normalizeScopedFindingForScoring(finding));
    const currentServiceCollections = buildAgentAuditCollections(currentServicePartitions.values(), {
      getAgentIdentity: (sample) => {
        const profile = unwrapAgent(sample.profiler_peserta) as Agent;
        if (!sample.peserta_id) return null;
        return {
          id: sample.peserta_id,
          nama: profile?.nama || '',
          batch_name: profile?.batch_name || null,
          tim: profile?.tim || null,
          jabatan: profile?.jabatan || null,
        };
      },
      normalizeScoreRow: (row) => normalizeScopedFindingForScoring(row),
    });
    const summary = await deriveDashboardSummary({
      ...currentServiceCollections,
      totalFindings: serviceFindings.length,
      evaluateScore: async (_agent, scoreRows) => calculateScopedScoreAcrossPeriods(
        serviceType as ServiceType,
        scoreRows,
        loadScoringContext
      ),
    });

    // ── 2. Calculate Pareto ──
    const paramCounts: Record<string, { count: number, name: string, category: Category }> = {};
    for (const finding of serviceFindings as ScoringTemuanLike[]) {
      const meta = await resolveFindingIndicatorMeta(
        { ...finding, service_type: serviceType },
        loadScoringContext,
        serviceType
      );
      if (!meta) continue;
      const metaId = meta.id || `${finding.rule_indicator_id || finding.indicator_id || meta.name}`;
      if (!paramCounts[metaId]) {
        paramCounts[metaId] = { count: 0, name: meta.name.trim(), category: (meta.category || 'non_critical') as Category };
      }
      paramCounts[metaId].count++;
    }

    let cumulativeCount = 0;
    const paretoData: ParetoData[] = Object.entries(paramCounts)
      .map(([_id, info]) => ({ 
        name: info.name, 
        fullName: info.name, 
        count: info.count, 
        category: info.category as 'critical' | 'non_critical', 
        cumulative: 0 
      }))
      .sort((a, b) => b.count - a.count || a.fullName.localeCompare(b.fullName))
      .map(item => {
        cumulativeCount += item.count;
        item.cumulative = serviceFindings.length > 0 ? Number(((cumulativeCount / serviceFindings.length) * 100).toFixed(1)) : 0;
        return item;
      });

    // ── 3. Calculate Service Comparison ──
    const servicePartitions = buildPartitionedAuditRows(
      eligibleData as Array<ScopedAuditFindingLike & { peserta_id: string; period_id: string; service_type: string }>,
      (entry) => `${entry.peserta_id}:${entry.period_id}:${entry.service_type}`
    );
    const serviceData = buildServiceComparisonData(
      servicePartitions.values(),
      (sType) => SERVICE_LABELS[sType as ServiceType] || sType
    );

    // ── 4. Critical vs Non-Critical ──
    let critical = 0;
    let nonCritical = 0;
    for (const finding of serviceFindings as ScoringTemuanLike[]) {
      const category = (await resolveFindingIndicatorMeta(
        { ...finding, service_type: serviceType },
        loadScoringContext,
        serviceType
      ))?.category;
      if (category === 'critical') critical++;
      else nonCritical++;
    }
    const donutData = { critical, nonCritical, total: critical + nonCritical };

    const agentStats = await buildTopAgentRanking({
      ...currentServiceCollections,
      limit: 5,
      excludeAgent: (agent) => isAgentExcluded(agent.tim, agent.batch_name, agent.jabatan),
      evaluateScore: async (_agent, scoreRows) => calculateScopedScoreAcrossPeriods(
        serviceType as ServiceType,
        scoreRows,
        loadScoringContext
      ),
      evaluateHasCritical: async (_agent, findingRows) => hasCriticalDefectAcrossPeriods(
        serviceType as ServiceType,
        findingRows,
        loadScoringContext
      ),
    });

    return { summary, serviceData, paretoData, donutData, topAgents: agentStats };
  },

  
  async getPersonalTrendWithParameters(agentId: string, year: number, startMonth: number, endMonth: number, serviceType?: string) {
    const supabase = await createClient();
    const queryClient = getServiceSupabase() || supabase;
    const hasPhantomSupport = await hasPhantomPaddingSupport(queryClient);
    
    if (endMonth < startMonth) return { labels: [], datasets: [] };

    const { data: periods } = await queryClient
      .from('qa_periods')
      .select('*')
      .eq('year', year)
      .gte('month', startMonth)
      .lte('month', endMonth)
      .order('month', { ascending: true });

    if (!periods || periods.length === 0) {
      const labels = [];
      for (let m = startMonth; m <= endMonth; m++) {
        labels.push(`${MONTHS_SHORT[m - 1]} ${String(year).slice(-2)}`);
      }
      return { labels, datasets: [] };
    }

    const pIds = periods.map(p => p.id);
    const periodIdByMonth = Object.fromEntries(periods.map(p => [p.month, p.id]));

    const labels: string[] = [];
    const validMonths: number[] = [];
    for (let m = startMonth; m <= endMonth; m++) {
      labels.push(`${MONTHS_SHORT[m - 1]} ${String(year).slice(-2)}`);
      validMonths.push(m);
    }

    let temuanQuery = queryClient
      .from('qa_temuan')
      .select('nilai, ketidaksesuaian, sebaiknya, period_id, indicator_id, rule_indicator_id, service_type, qa_indicators:qa_service_rule_indicators(id, name, category)')
      .eq('peserta_id', agentId)
      .in('period_id', pIds);
    if (serviceType) temuanQuery = temuanQuery.eq('service_type', serviceType);
    if (hasPhantomSupport) temuanQuery = temuanQuery.eq('is_phantom_padding', false);
    const { data: temuanRaw } = await temuanQuery;

    if (!temuanRaw) return { labels, datasets: [] };

    const temuan = filterCountableFindings(temuanRaw as unknown as QATemuan[]);

    const counts: Record<string, Record<string, number>> = {};
    const totalByPeriod: Record<string, number> = {};

    const loadScoringContext = createScoringContextLoader();
    for (const finding of temuan as ScoringTemuanLike[]) {
      const pName = (await resolveFindingIndicatorMeta(
        finding,
        loadScoringContext,
        serviceType || finding.service_type || undefined
      ))?.name || 'Unknown';
      const pid = finding.period_id;
      if (!pid) continue;
      if (!counts[pName]) counts[pName] = {};
      counts[pName][pid] = (counts[pName][pid] || 0) + 1;
      totalByPeriod[pid] = (totalByPeriod[pid] || 0) + 1;
    }

    const topParams = Object.entries(counts)
      .map(([name, periodCounts]) => ({ name, total: Object.values(periodCounts).reduce((a, b) => a + b, 0) }))
      .sort((a, b) => b.total - a.total).map(p => p.name);

    const getCountForMonth = (m: number, countMap: Record<string, number>) => {
      const pid = periodIdByMonth[m];
      return pid ? (countMap[pid] || 0) : 0;
    };

    const datasets = [
      { label: 'Total Temuan', data: validMonths.map(m => getCountForMonth(m, totalByPeriod)), isTotal: true },
      ...topParams.map(name => ({ label: name, data: validMonths.map(m => getCountForMonth(m, counts[name])), isTotal: false }))
    ];

    return { labels, datasets };
  },

  async getAgentExportData(agentId: string): Promise<ExportData> {
    const { agent, temuan } = await this.getAgentWithTemuan(agentId);
    if (!agent) throw new Error('Agent not found');

    const periodsMap = new Map<string, QATemuan[]>();
    (temuan as QATemuan[]).forEach(t => {
      const p = unwrapPeriod(t.qa_periods) as QAPeriod;
      if (!p) return;
      const ind = unwrapIndicator(t.qa_indicators) as QAIndicator | QARuleIndicatorSnapshot | null;
      const sType = t.service_type || ind?.service_type || 'unknown';
      const pk = `${p.year}-${String(p.month).padStart(2, '0')}-${sType}`;
      if (!periodsMap.has(pk)) periodsMap.set(pk, []);
      periodsMap.get(pk)!.push({ ...t, service_type: sType as ServiceType } as QATemuan);
    });

    const periods: ExportPeriod[] = await Promise.all(
      [...periodsMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(async ([_pk, pTemuan]) => {
        const p = unwrapPeriod(pTemuan[0].qa_periods) as QAPeriod;
        const serviceType = (pTemuan[0]?.service_type || 'call') as ServiceType;
        const periodId = pTemuan[0]?.period_id;

        // Prefer snapshot indicators already joined on findings for this period/service.
        const joinedIndicators = pTemuan
          .map((item) => unwrapIndicator(item.qa_indicators) as QARuleIndicatorSnapshot | QAIndicator | null)
          .filter((item): item is QARuleIndicatorSnapshot | QAIndicator => Boolean(item?.id))
          .reduce<QARuleIndicatorSnapshot[]>((acc, indicator) => {
            const alreadyExists = acc.some((existing) => existing.id === indicator.id);
            if (!alreadyExists) {
              acc.push({
                id: indicator.id,
                rule_version_id: (indicator as QARuleIndicatorSnapshot).rule_version_id || '',
                legacy_indicator_id: (indicator as QARuleIndicatorSnapshot).legacy_indicator_id ?? null,
                service_type: indicator.service_type as ServiceType,
                name: indicator.name,
                category: indicator.category,
                bobot: Number(indicator.bobot),
                has_na: Boolean(indicator.has_na),
                threshold: indicator.threshold ?? null,
                sort_order: (indicator as QARuleIndicatorSnapshot).sort_order ?? 0,
                created_at: (indicator as QARuleIndicatorSnapshot).created_at || '',
                updated_at: (indicator as QARuleIndicatorSnapshot).updated_at || '',
              });
            }
            return acc;
          }, []);

        const resolvedRule = periodId
          ? await this.resolveRuleVersion(periodId, serviceType)
          : null;
        const fallbackIndicators = (
          periodId
            ? await this.getIndicators(serviceType, periodId)
            : await this.getIndicators(serviceType)
        ) as Array<QAIndicator | QARuleIndicatorSnapshot>;

        const teamInds = (
          joinedIndicators.length > 0
            ? joinedIndicators
            : (resolvedRule?.indicators?.length
              ? resolvedRule.indicators
              : fallbackIndicators)
        ).map((indicator) => ({
          id: indicator.id,
          service_type: indicator.service_type,
          name: indicator.name,
          category: indicator.category,
          bobot: Number(indicator.bobot),
          has_na: Boolean(indicator.has_na),
          threshold: indicator.threshold ?? null,
          created_at: indicator.created_at,
        })) as QAIndicator[];

        const resolvedWeights = periodId
          ? await this.getServiceWeights(serviceType, periodId)
          : await this.getServiceWeights(serviceType);
        const activeWeight = resolvedWeights[serviceType] || DEFAULT_SERVICE_WEIGHTS[serviceType];

        const scoreTemuan = pTemuan.map((item) => {
          let scoringIndicatorId = item.rule_indicator_id || item.indicator_id;

          // Backward compatibility: legacy indicator_id can be translated via snapshot mapping.
          if (!item.rule_indicator_id && resolvedRule?.indicators?.length) {
            const byLegacy = resolvedRule.indicators.find((ind) => ind.legacy_indicator_id === item.indicator_id);
            if (byLegacy) scoringIndicatorId = byLegacy.id;
          }

          return {
            indicator_id: scoringIndicatorId,
            nilai: item.nilai,
            no_tiket: item.no_tiket,
          };
        });

        const scoreResult = calculateQAScoreFromTemuan(
          teamInds,
          scoreTemuan,
          activeWeight
        );

        return {
          month: p.month,
          year: p.year,
          service_type: serviceType,
          score: scoreResult.finalScore,
          ncScore: scoreResult.nonCriticalScore,
          crScore: scoreResult.criticalScore,
          temuan: pTemuan
        };
      })
    );

    return { agent, periods };
  },

  async getUniqueAgentCountByTimeframe(timeframe: '3m' | '6m' | 'all', context?: SharedContext): Promise<number> {
    const supabase = await createClient();
    const limitMap = { '3m': 3, '6m': 6, 'all': 12 };
    const limit = limitMap[timeframe] || 3;
    
    let periods: QAPeriod[] = [];
    if (context?.periods) {
      periods = [...context.periods].slice(0, limit);
    } else {
      const { data } = await supabase
        .from('qa_periods').select('id, month, year')
        .order('year', { ascending: false }).order('month', { ascending: false })
        .limit(limit);
      periods = (data || []) as QAPeriod[];
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

    let periods: QAPeriod[] = [];
    if (context?.periods) {
      periods = [...context.periods].slice(0, limit);
    } else {
      const { data } = await supabase
        .from('qa_periods').select('id, month, year')
        .order('year', { ascending: false }).order('month', { ascending: false })
        .limit(limit);
      periods = (data || []) as QAPeriod[];
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
    const totalDefectsCount = countCountableFindings(temuan as QATemuan[]);

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
      if (!serviceAgentsMap[sType]) serviceAgentsMap[sType] = new Set<string>();
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
      const pDefects = countCountableFindings(pTemuan as QATemuan[]);

      activeServicesSet.forEach(svc => {
        const sTemuan = pTemuan.filter(t => t.service_type === svc);
        svcStats[svc] = {
          totalDefects: countCountableFindings(sTemuan as QATemuan[]),
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
      topParameters: await this.calculateTopParameters(temuan)
    };
  },

  async calculateTopParameters(temuan: Partial<QATemuan>[]) {
    if (!temuan || temuan.length === 0) return {};
    
    const loadScoringContext = createScoringContextLoader();
    const countsPerService: Record<string, Record<string, { count: number, name: string }>> = {};
    
    for (const finding of temuan as ScoringTemuanLike[]) {
      if (!isCountableFinding(finding)) continue;
      const service = finding.service_type || 'unknown';
      const meta = await resolveFindingIndicatorMeta(finding, loadScoringContext, finding.service_type || undefined);
      const id = meta?.id || finding.rule_indicator_id || finding.indicator_id;
      const name = meta?.name || 'Unknown';
      if (!id) continue;

      if (!countsPerService[service]) countsPerService[service] = {};
      if (!countsPerService[service][id]) countsPerService[service][id] = { count: 0, name };
      countsPerService[service][id].count++;
    }

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

    const topParameters = await this.calculateTopParameters(temuan);

    if (!temuan || temuan.length === 0) return { labels, totalData: labels.map(() => 0), serviceData: {}, activeServices: [], serviceSummary: {}, totalSummary: { totalDefects: 0, auditedAgents: 0, activeServiceCount: 0 }, periodStats: [], topParameters: {} };

    const activeServicesSet = new Set<string>();
    const totalData = labels.map(() => 0);
    const serviceData: Record<string, number[]> = {};
    const serviceSummary: Record<string, { totalDefects: number, auditedAgents: number }> = {};
    
    const totalAuditedAgentsSet = new Set(temuan.map(t => t.peserta_id));
    const totalDefectsCount = countCountableFindings(temuan as QATemuan[]);

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
      if (!serviceAgentsMap[sType]) serviceAgentsMap[sType] = new Set<string>();
      serviceAgentsMap[sType].add(t.peserta_id);
    });

    Object.keys(serviceSummary).forEach(sType => {
      serviceSummary[sType].auditedAgents = serviceAgentsMap[sType]?.size || 0;
    });

    const periodStats = sortedPeriods.map((p, idx) => {
      const pTemuan = temuan.filter(t => t.period_id === p.id);
      const svcStats: Record<string, { totalDefects: number, auditedAgents: number }> = {};
      
      const pAgents = new Set(pTemuan.map(t => t.peserta_id));
      const pDefects = countCountableFindings(pTemuan as QATemuan[]);

      activeServicesSet.forEach(svc => {
        const sTemuan = pTemuan.filter(t => t.service_type === svc);
        svcStats[svc] = {
          totalDefects: countCountableFindings(sTemuan as QATemuan[]),
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

  sliceTrendData(data: { 
    labels?: string[] | null; 
    totalData?: number[] | null; 
    serviceData?: Record<string, number[]> | null; 
    activeServices?: string[] | null; 
    serviceSummary?: Record<string, { totalDefects: number; auditedAgents: number }> | null; 
    totalSummary?: { totalDefects: number; auditedAgents: number; activeServiceCount: number } | null; 
    periodStats?: Array<{ id: string; label: string; totalDefects: number; auditedAgents: number; serviceStats: Record<string, { totalDefects: number; auditedAgents: number }> }> | null
  }, months: number) {
    const safeLabels = data.labels || [];
    const safeTotalData = data.totalData || [];
    const safeServiceData = data.serviceData || {};
    const safeActiveServices = data.activeServices || [];
    const safePeriodStats = data.periodStats || [];

    const sliceIdx = Math.max(0, safeLabels.length - months);
    const slicedLabels = safeLabels.slice(sliceIdx);
    const slicedTotalData = safeTotalData.slice(sliceIdx);

    // Normalize periodStats items: filter out null/undefined, ensure serviceStats exists
    type NormalizedPeriodStat = {
      id: string;
      label: string;
      totalDefects: number;
      auditedAgents: number;
      serviceStats: Record<string, { totalDefects: number; auditedAgents: number }>;
    };
    const normalizedPeriodStats: NormalizedPeriodStat[] = safePeriodStats
      .filter((stat): stat is NonNullable<typeof stat> => Boolean(stat) && typeof stat === 'object')
      .map((stat) => {
        const s = stat as Record<string, unknown>;
        return {
          id: String(s.id ?? ''),
          label: String(s.label ?? ''),
          totalDefects: Number(s.totalDefects ?? 0),
          auditedAgents: Number(s.auditedAgents ?? 0),
          serviceStats: (s.serviceStats && typeof s.serviceStats === 'object') ? s.serviceStats as Record<string, { totalDefects: number; auditedAgents: number }> : {},
        };
      });
    const slicedPeriodStats = normalizedPeriodStats.slice(sliceIdx);

    // Normalize serviceData entries: only keep arrays, then slice
    const slicedServiceData: Record<string, number[]> = {};
    Object.entries(safeServiceData).forEach(([svc, arr]) => {
      if (Array.isArray(arr)) {
        slicedServiceData[svc] = arr.slice(sliceIdx);
      }
    });

    // Re-aggregate summaries based on sliced data
    // For Audited Agents, we take the value from the LATEST month in the slice (as per user condition)
    const latestStat = slicedPeriodStats[slicedPeriodStats.length - 1] || { 
      totalDefects: 0, 
      auditedAgents: 0, 
      serviceStats: {} as Record<string, { totalDefects: number; auditedAgents: number }> 
    };
    
    const totalDefects = slicedTotalData.reduce((a: number, b: number) => a + b, 0);
    
    const serviceSummary: Record<string, { totalDefects: number, auditedAgents: number }> = {};
    safeActiveServices.forEach((svc: string) => {
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
      activeServices: safeActiveServices,
      serviceSummary,
      totalSummary: {
        totalDefects,
        auditedAgents: latestStat.auditedAgents || 0,
        activeServiceCount: safeActiveServices.length
      },
      periodStats: slicedPeriodStats
    };
  },

  /** Fetches raw findings for Data Report workspace with specific filters. */
  async getDataReportRows(filter: {
    serviceType: ServiceType;
    indicatorId?: string;
    year: number;
    startMonth: number;
    endMonth: number;
    folderId?: string;
    pesertaId?: string;
  }) {
    const supabase = await createClient();
    const hasPhantomSupport = await hasPhantomPaddingSupport(supabase);
    const indicatorFilterId = filter.indicatorId && filter.indicatorId !== 'ALL'
      ? filter.indicatorId
      : null;

    let indicatorFilterName: string | null = null;
    if (indicatorFilterId) {
      const { data: legacyIndicator } = await supabase
        .from('qa_indicators')
        .select('name')
        .eq('id', indicatorFilterId)
        .maybeSingle();
      indicatorFilterName = (legacyIndicator?.name || '').trim().toLowerCase() || null;
    }

    let query = supabase
      .from('qa_temuan')
      .select(`
        id,
        period_id,
        indicator_id,
        rule_indicator_id,
        service_type,
        no_tiket,
        nilai,
        ketidaksesuaian,
        sebaiknya,
        is_phantom_padding,
        qa_periods!inner (
          month,
          year
        ),
        qa_indicators:qa_service_rule_indicators (
          id,
          name,
          category
        ),
        profiler_peserta!inner (
          nama,
          batch_name,
          tim,
          jabatan
        )
      `)
      .eq('service_type', filter.serviceType)
      .eq('tahun', filter.year)
      .gte('qa_periods.month', filter.startMonth)
      .lte('qa_periods.month', filter.endMonth);

    if (filter.pesertaId) {
      query = query.eq('peserta_id', filter.pesertaId);
    }
    if (filter.folderId && filter.folderId !== 'ALL') {
      query = query.eq('profiler_peserta.batch_name', filter.folderId);
    }
    if (hasPhantomSupport) {
      query = query.eq('is_phantom_padding', false);
    }

    // Only meaningful findings (has issues)
    query = query.or('nilai.lt.3,ketidaksesuaian.not.is.null,sebaiknya.not.is.null');

    const { data, error } = await query
      .order('id', { ascending: true }) // Stable for pagination
      .limit(2000); // Higher limit for data report

    if (error) throw error;
    const loadScoringContext = createScoringContextLoader();
    const rows = await Promise.all((data || []).map(async (item: any) => {
      const agentProfile = item.profiler_peserta as {
        nama?: string;
        batch_name?: string;
        tim?: string;
        jabatan?: string;
      } | null;

      if (isAgentExcluded(agentProfile?.tim, agentProfile?.batch_name, agentProfile?.jabatan)) {
        return null;
      }

      const indicatorMeta = await resolveFindingIndicatorMeta(
        { ...(item as ScoringTemuanLike), service_type: filter.serviceType },
        loadScoringContext,
        filter.serviceType
      );

      const rawIndicatorId = typeof item.indicator_id === 'string' ? item.indicator_id : '';
      const rawRuleIndicatorId = typeof item.rule_indicator_id === 'string' ? item.rule_indicator_id : '';
      const resolvedIndicatorId = indicatorMeta?.id || '';
      const resolvedIndicatorName = (indicatorMeta?.name || '').trim().toLowerCase();

      const includeByIndicator = !indicatorFilterId
        || rawIndicatorId === indicatorFilterId
        || rawRuleIndicatorId === indicatorFilterId
        || resolvedIndicatorId === indicatorFilterId
        || (Boolean(indicatorFilterName) && resolvedIndicatorName === indicatorFilterName);

      if (!includeByIndicator) {
        return null;
      }

      const period = item.qa_periods as { month?: number; year?: number } | null;
      const month = Number(period?.month || 0);
      const year = Number(period?.year || 0);
      const periodLabel = month >= 1 && month <= 12
        ? `${MONTHS_SHORT[month - 1]} ${year}`
        : '—';

      return {
        id: item.id as string,
        service: item.service_type as ServiceType,
        period: periodLabel,
        periodSortValue: year * 12 + month,
        agentName: (agentProfile?.nama || '').trim() || '—',
        batch: (agentProfile?.batch_name || '').trim() || '—',
        ticketNumber: item.no_tiket || '—',
        parameter: (indicatorMeta?.name || '').trim() || '—',
        finding: item.ketidaksesuaian || '—',
        expected: item.sebaiknya || '—',
        score: item.nilai,
      };
    }));

    return rows.filter((row): row is {
      id: string;
      service: ServiceType;
      period: string;
      periodSortValue: number;
      agentName: string;
      batch: string;
      ticketNumber: string;
      parameter: string;
      finding: string;
      expected: string;
      score: number;
    } => row !== null);
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

    let allTemuan: Partial<QATemuan>[] = [];
    let from = 0;
    const PAGE_SIZE = 1000;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from('qa_temuan')
        .select(
          'period_id, indicator_id, rule_indicator_id, no_tiket, nilai, ketidaksesuaian, sebaiknya, qa_indicators:qa_service_rule_indicators(id, name, category), profiler_peserta!inner(nama, batch_name)'
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
        allTemuan = [...allTemuan, ...(data as Partial<QATemuan>[])];
        hasMore = data.length === PAGE_SIZE;
        from += PAGE_SIZE;
      }
    }

    const loadScoringContext = createScoringContextLoader();
    return Promise.all(allTemuan.map(async (d) => ({
      no_tiket: d.no_tiket ?? null,
      nilai: d.nilai || 0,
      ketidaksesuaian: d.ketidaksesuaian ?? null,
      sebaiknya: d.sebaiknya ?? null,
      parameter: ((await resolveFindingIndicatorMeta(
        { ...(d as ScoringTemuanLike), service_type: serviceType },
        loadScoringContext,
        serviceType
      ))?.name || '').trim() || '—',
      agen: ((d.profiler_peserta as unknown as { nama: string })?.nama || '').trim() || '—',
    })));
  },

  /** Monthly score + findings for individual report trend chart. */
  async getAgentMonthlyPerformanceForReport(
    agentId: string,
    year: number,
    startMonth: number,
    endMonth: number
  ): Promise<Array<{ label: string; score: number; findings: number }>> {
    const supabase = await createClient();
    const loadScoringContext = createScoringContextLoader();
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
    let all: Partial<QATemuan>[] = [];
    let from = 0;
    const PAGE = 1000;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from('qa_temuan')
        .select('indicator_id, rule_indicator_id, nilai, ketidaksesuaian, sebaiknya, no_tiket, service_type, period_id, created_at')
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
        all = [...all, ...(data as Partial<QATemuan>[])];
        hasMore = data.length === PAGE;
        from += PAGE;
      }
    }

    const periodsData = await Promise.all(periods.map(async (p) => {
      const pTemuan = all.filter((t) => t.period_id === p.id);
      const bySvc: Record<string, typeof pTemuan> = {};
      pTemuan.forEach((t) => {
        const s = (t.service_type || 'call') as string;
        if (!bySvc[s]) bySvc[s] = [];
        bySvc[s].push(t);
      });
      let sum = 0;
      let w = 0;
      for (const [svc, list] of Object.entries(bySvc)) {
        const scoringContext = await loadScoringContext(svc as ServiceType, p.id);
        if (!scoringContext.indicators.length) continue;
        const score = calculateQAScoreFromTemuan(
          scoringContext.indicators,
          normalizeTemuanForScoring(list as ScoringTemuanLike[], scoringContext),
          scoringContext.activeWeight
        );
        const weight = Math.max(score.sessionCount, 1);
        const sc = score.finalScore;
        sum += sc * weight;
        w += weight;
      }
      return {
        label: `${MONTHS_SHORT[p.month - 1]} ${p.year}`,
        score: w > 0 ? Number((sum / w).toFixed(1)) : 100,
        findings: countCountableFindings(pTemuan as QATemuan[]),
      };
    }));

    return periodsData;
  },

  /**
   * Helper private method to fetch QA findings with pagination to bypass Supabase 1000-row limit
   */
  async fetchPaginatedTrendData(supabase: SupabaseClient, pIds: string[], year?: number) {
    const hasPhantomSupport = await hasPhantomPaddingSupport(supabase);
    let allData: Partial<QATemuan>[] = [];
    let from = 0;
    const step = 1000;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from('qa_temuan')
        .select('nilai, ketidaksesuaian, sebaiknya, period_id, service_type, peserta_id, no_tiket, indicator_id, rule_indicator_id, qa_indicators:qa_service_rule_indicators(id, name, category)')
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
        allData = [...allData, ...(data as Partial<QATemuan>[])];
        hasMore = data.length === step;
        from += step;
      }
    }

    return allData;
  }
};
