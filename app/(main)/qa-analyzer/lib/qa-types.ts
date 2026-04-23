// ── Service & Category ───────────────────────────────────────────
export type ServiceType = 'call' | 'chat' | 'email' | 'cso' | 'pencatatan' | 'bko' | 'slik';
export type Category = 'critical' | 'non_critical' | 'none';
export type ScoringMode = 'weighted' | 'flat' | 'no_category';

export const VALID_SERVICE_TYPES: ServiceType[] = ['call', 'chat', 'email', 'cso', 'pencatatan', 'bko', 'slik'];

export function isServiceType(value: string | null | undefined): value is ServiceType {
  return typeof value === 'string' && VALID_SERVICE_TYPES.includes(value as ServiceType);
}

export interface ServiceWeight {
  service_type: ServiceType;
  critical_weight: number;
  non_critical_weight: number;
  scoring_mode: ScoringMode;
}

export const DEFAULT_SERVICE_WEIGHTS: Record<ServiceType, ServiceWeight> = {
  call:       { service_type: 'call',       critical_weight: 0.50, non_critical_weight: 0.50, scoring_mode: 'weighted'     },
  chat:       { service_type: 'chat',       critical_weight: 0.50, non_critical_weight: 0.50, scoring_mode: 'weighted'     },
  email:      { service_type: 'email',      critical_weight: 0.65, non_critical_weight: 0.35, scoring_mode: 'weighted'     },
  cso:        { service_type: 'cso',        critical_weight: 0.50, non_critical_weight: 0.50, scoring_mode: 'weighted'     },
  pencatatan: { service_type: 'pencatatan', critical_weight: 0.90, non_critical_weight: 0.10, scoring_mode: 'flat'         },
  bko:        { service_type: 'bko',        critical_weight: 0.50, non_critical_weight: 0.50, scoring_mode: 'no_category'  },
  slik:       { service_type: 'slik',       critical_weight: 0.60, non_critical_weight: 0.40, scoring_mode: 'weighted'     },
};

export const SERVICE_LABELS: Record<ServiceType, string> = {
  call: 'Call',
  chat: 'Chat',
  email: 'Email',
  cso: 'CSO',
  pencatatan: 'Pencatatan',
  bko: 'BKO',
  slik: 'SLIK'
};

export const TIM_TO_DEFAULT_SERVICE: Record<string, ServiceType> = {
  'Telepon': 'call',
  'Chat': 'chat',
  'Email': 'email',
  'Mix': 'cso',
  'BKO': 'bko',
  'SLIK': 'slik'
};

export function resolveServiceTypeFromTeam(team?: string | null): ServiceType {
  if (!team) return 'call';
  const raw = team.trim().toLowerCase();

  if (isServiceType(raw)) return raw;

  const ALIAS_MAP: Record<string, ServiceType> = {
    mix: 'cso',
    cso: 'cso',
    telepon: 'call',
    call: 'call',
    chat: 'chat',
    email: 'email',
    bko: 'bko',
    slik: 'slik',
    pencatatan: 'pencatatan',
  };

  for (const [alias, service] of Object.entries(ALIAS_MAP)) {
    if (raw.includes(alias)) return service;
  }

  for (const [key, value] of Object.entries(TIM_TO_DEFAULT_SERVICE)) {
    if (raw === key.trim().toLowerCase()) return value;
  }

  return 'call';
}

/**
 * Menghitung service efektif untuk halaman input QA.
 * Override manual menang > inference dari tim agent > fallback dari props > 'call'.
 */
export function computeEffectiveService(
  serviceOverride: ServiceType | null | undefined,
  agentTim: string | null | undefined,
  fallbackService: ServiceType | null | undefined
): ServiceType {
  return serviceOverride ?? (agentTim ? resolveServiceTypeFromTeam(agentTim) : null) ?? fallbackService ?? 'call';
}

// ── Interfaces ────────────────────────────────────────────────
export interface QAIndicator {
  id: string;
  service_type: ServiceType;
  name: string;
  category: Category;
  bobot: number;
  has_na: boolean;
  threshold?: number | null;
  created_at?: string;
}

export interface QAPeriod {
  id: string;
  month: number;
  year: number;
  created_at?: string;
  label?: string; // Generated column in Supabase
}

export interface QAFinding {
  id: string;
  peserta_id: string;
  indicator_id: string;
  period_id: string;
  value: number;
  is_na: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface QATemuan {
  id: string;
  peserta_id: string;
  period_id: string;
  indicator_id: string;
  rule_version_id?: string | null;
  rule_indicator_id?: string | null;
  service_type: ServiceType;
  no_tiket?: string | null;
  is_phantom_padding?: boolean;
  phantom_batch_id?: string | null;
  nilai: number;
  ketidaksesuaian?: string | null;
  sebaiknya?: string | null;
  created_at?: string;
  tahun?: number;
  qa_indicators?: QAIndicator | QAIndicator[] | QARuleIndicatorSnapshot | QARuleIndicatorSnapshot[];
  qa_periods?: QAPeriod | QAPeriod[];
  profiler_peserta?: Agent | Agent[];
}

export interface QARuleVersion {
  id: string;
  service_type: ServiceType;
  effective_period_id: string;
  status: 'draft' | 'published';
  critical_weight: number;
  non_critical_weight: number;
  scoring_mode: ScoringMode;
  created_by?: string | null;
  published_by?: string | null;
  created_at: string;
  updated_at: string;
  published_at?: string | null;
}

export interface QARuleIndicatorSnapshot {
  id: string;
  rule_version_id: string;
  legacy_indicator_id?: string | null;
  service_type: ServiceType;
  name: string;
  category: Category;
  bobot: number;
  has_na: boolean;
  threshold?: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ResolvedQARule {
  version: QARuleVersion;
  indicators: QARuleIndicatorSnapshot[];
}

export function unwrapIndicator(value: QAIndicator | QAIndicator[] | QARuleIndicatorSnapshot | QARuleIndicatorSnapshot[] | Partial<QAIndicator> | Partial<QAIndicator>[] | null | undefined): QAIndicator | QARuleIndicatorSnapshot | Partial<QAIndicator> | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value as QAIndicator | QARuleIndicatorSnapshot | Partial<QAIndicator> | null;
}

export function unwrapPeriod(value: QAPeriod | QAPeriod[] | Partial<QAPeriod> | Partial<QAPeriod>[] | null | undefined): QAPeriod | Partial<QAPeriod> | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function unwrapAgent(value: Agent | Agent[] | Partial<Agent> | Partial<Agent>[] | null | undefined): Agent | Partial<Agent> | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export interface QAScore {
  finalScore: number;
  nonCriticalScore: number;
  criticalScore: number;
  nonCriticalDetail: ScoreDetail[];
  criticalDetail: ScoreDetail[];
  sessionCount: number;
  sessionScores: number[];
}

export interface ScoreDetail {
  indicatorId: string;
  name: string;
  bobot: number;
  nilai: number; // Average nilai (0-3) for this indicator
  temuanCount: number;
  isNa: boolean;
  contribution: number; // Contribution to final score
  selectedForScoring: boolean;
}

export interface DashboardSummary {
  totalDefects: number;
  avgDefectsPerAudit: number;
  zeroErrorRate: number;
  avgAgentScore: number;
  complianceRate: number;
  complianceCount: number;
  totalAgents: number;
}

export interface ServiceComparisonData {
  name: string;
  serviceType: string;
  total: number;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
}

export interface TopAgentData {
  agentId: string;
  nama: string;
  batch: string;
  tim?: string;
  jabatan?: string;
  defects: number;
  score: number;
  hasCritical: boolean;
}

export interface Agent {
  id: string;
  nama: string;
  tim: string;
  batch: string;
  batch_name?: string;
  foto_url?: string | null;
  jabatan?: string | null;
  bergabung_date?: string | null;
}

export interface AgentDirectoryEntry extends Agent {
  avgScore: number | null;
  trend: 'up' | 'down' | 'same' | 'none';
  trendValue: number | null;
  atRisk: boolean;
}

export interface TrendDataset {
  label: string;
  data: number[];
  isTotal: boolean;
}

export interface TrendData {
  labels: string[];
  datasets: TrendDataset[];
}

export interface ParetoData {
  name: string;
  fullName: string;
  count: number;
  cumulative: number;
  category: 'critical' | 'non_critical';
}

export interface ExportPeriod {
  month: number;
  year: number;
  service_type: ServiceType;
  score: number;
  ncScore: number;
  crScore: number;
  temuan: QATemuan[];
}

export interface ExportData {
  agent: Agent;
  periods: ExportPeriod[];
}

export interface AgentDetailData {
  indicators: QAIndicator[];
  periodSummaries: AgentPeriodSummary[];
  selectedPeriod?: AgentPeriodSummary | null;
  temuan: QATemuan[];
  temuanHasMore?: boolean;
  temuanTotal?: number;
  personalTrend: TrendData;
  availableYears?: number[];
  scoreHistory?: ScoreResult[];
  weights?: Record<ServiceType, ServiceWeight>;
  initialYear: number;
  initialService: ServiceType;
  initialTrendRange: { start: number; end: number };
}

export interface AgentPeriodSummary {
  id: string;
  month: number;
  year: number;
  label: string;
  serviceType: ServiceType;
  finalScore: number;
  nonCriticalScore: number;
  criticalScore: number;
  sessionCount: number;
  findingsCount: number;
}

export interface ScoreResult {
  month: number;
  year: number;
  finalScore: number;
  nonCriticalScore: number;
  criticalScore: number;
  sessionCount: number;
  service_type: ServiceType;
}

export interface PeriodSelection {
  month: number;
  year: number;
  label: string;
  serviceType: string;
  id?: string;
}

export interface EditFormState {
  nilai: number;
  ketidaksesuaian: string;
  sebaiknya: string;
}

export interface CoachingInsight {
  parameter: string;
  count: number;
  recommendation: string;
  isCritical: boolean;
}

export interface GroupedTemuan {
  urutan: number;
  no_tiket: string | null;
  items: QATemuan[];
}

export interface CriticalVsNonCriticalData {
  critical: number;
  nonCritical: number;
  total: number;
}

export interface DashboardData {
  periods: QAPeriod[];
  folders: { id: string, name: string }[];
  summary: DashboardSummary | null;
  serviceData: ServiceComparisonData[];
  topAgents: TopAgentData[];
  paretoData: ParetoData[];
  donutData: CriticalVsNonCriticalData | null;
  paramTrend: TrendData;
  sparklines: Record<string, TrendPoint[]>;
  availableYears: number[];
  currentYear: number;
}

export interface SharedContext {
  indicators: QAIndicator[];
  periods: QAPeriod[];
}


export interface TrendPoint {
  label: string;
  value: number;
}

// ── Constants ─────────────────────────────────────────────────
const MAX_SAMPLING = 5;

export const NILAI_LABELS: Record<number, string> = {
  0: 'Sangat Tidak Sesuai',
  1: 'Tidak Sesuai',
  2: 'Perlu Perbaikan',
  3: 'Sesuai',
};

// UI Helpers
export const scoreColor = (score: number) => {
  if (score >= 85) return 'text-green-500';
  if (score >= 70) return 'text-amber-500';
  return 'text-red-500';
};

export const scoreBg = (score: number) => {
  if (score >= 85) return 'bg-green-500';
  if (score >= 70) return 'bg-amber-500';
  return 'bg-red-500';
};

export const scoreLabel = (score: number) => {
  if (score >= 85) return 'Baik';
  if (score >= 70) return 'Cukup';
  return 'Perlu Perhatian';
};

// ── Scoring Algorithm (Flexible Weight Logic) ─────────────────────────

/**
 * Menghitung skor untuk satu sesi (satu no_tiket)
 */
function scoreSession(
  indicators: QAIndicator[],
  temuan: { indicator_id: string; nilai: number }[],
  weight: ServiceWeight = DEFAULT_SERVICE_WEIGHTS['call']
): number {
  const getNilai = (ind: QAIndicator) => {
    const t = temuan.find(f => f.indicator_id === ind.id);
    return t ? t.nilai : 3;
  };

  // MODE: no_category & flat — rumus sama: Σ(nilai/3 × bobot) / Σbobot
  if (weight.scoring_mode === 'flat' || weight.scoring_mode === 'no_category') {
    let totalB = 0, earnedB = 0;
    indicators.forEach(ind => {
      totalB  += ind.bobot;
      earnedB += (getNilai(ind) / 3) * ind.bobot;
    });
    return totalB === 0 ? 100 : (earnedB / totalB) * 100;
  }

  // MODE: weighted — normalize per kategori, lalu timbang antar-kategori
  const calcCat = (cat: Category) => {
    const inds = indicators.filter(i => i.category === cat);
    let total = 0, earned = 0;
    inds.forEach(ind => {
      total  += ind.bobot;
      earned += (getNilai(ind) / 3) * ind.bobot;
    });
    return total === 0 ? 100 : (earned / total) * 100;
  };

  return calcCat('non_critical') * weight.non_critical_weight
       + calcCat('critical')     * weight.critical_weight;
}

export function calculateSessionScoreFromTemuan(
  indicators: QAIndicator[],
  temuan: { indicator_id: string; nilai: number }[],
  serviceWeight: ServiceWeight = DEFAULT_SERVICE_WEIGHTS['call']
): number {
  return scoreSession(indicators, temuan, serviceWeight);
}

/**
 * Menghitung skor QA berdasarkan temuan
 */
export function calculateQAScoreFromTemuan(
  indicators: QAIndicator[],
  temuan: { indicator_id: string; nilai: number; no_tiket?: string | null;
            created_at?: string; period_id?: string }[],
  serviceWeight?: ServiceWeight
): QAScore {
  const weight = serviceWeight ?? DEFAULT_SERVICE_WEIGHTS['call'];
  const sessions: Record<string, { indicator_id: string; nilai: number }[]> = {};
  
  temuan.forEach((t, i) => {
    const key = t.no_tiket?.trim() || `__no_ticket_${t.created_at ?? t.period_id ?? i}`;
    if (!sessions[key]) sessions[key] = [];
    sessions[key].push(t);
  });

  const sessionScoresArr = Object.values(sessions).map(s =>
    scoreSession(indicators, s, weight)
  );
  
  const sortedScores = [...sessionScoresArr].sort((a, b) => a - b);
  const selectedScores = sortedScores.slice(0, MAX_SAMPLING);
  
  // Phantom padding: if tickets < 5, fill the rest with 100 (no findings)
  const paddedScores = [...selectedScores];
  while (paddedScores.length < MAX_SAMPLING) {
    paddedScores.push(100);
  }

  const finalScore = paddedScores.reduce((a, b) => a + b, 0) / MAX_SAMPLING;

  // calculateQuickCategoryScore — sesuaikan untuk no_category
  const calculateQuickCategoryScore = (cat: Category) => {
    if (weight.scoring_mode === 'no_category') return finalScore;
    
    const catInds = indicators.filter(i => i.category === cat);
    if (catInds.length === 0) return 100;
    let totalB = 0, earnedB = 0;
    catInds.forEach(ind => {
      const tList = temuan.filter(t => t.indicator_id === ind.id);
      const val = tList.length > 0 ? Math.min(...tList.map(t => t.nilai)) : 3;
      totalB  += ind.bobot;
      earnedB += (val / 3) * ind.bobot;
    });
    return (earnedB / totalB) * 100;
  };

  // buildDetail — untuk no_category gunakan category 'none'
  const buildDetail = (cat: Category) => {
    const targetInds = weight.scoring_mode === 'no_category'
      ? indicators  // semua parameter masuk satu list
      : indicators.filter(i => i.category === cat);

    return targetInds.map(ind => {
      const matchingTemuan = temuan.filter(t => t.indicator_id === ind.id);
      const avgNilai = matchingTemuan.length > 0
        ? matchingTemuan.reduce((a, b) => a + b.nilai, 0) / matchingTemuan.length
        : 3;
      return {
        indicatorId: ind.id,
        name:        ind.name,
        bobot:       ind.bobot,
        nilai:       avgNilai,
        temuanCount: matchingTemuan.length,
        isNa:        false,
        contribution: (avgNilai / 3) * ind.bobot,
        selectedForScoring: true
      };
    });
  };

  return {
    finalScore,
    nonCriticalScore:   calculateQuickCategoryScore('non_critical'),
    criticalScore:      calculateQuickCategoryScore('critical'),
    nonCriticalDetail:  weight.scoring_mode === 'no_category' ? [] : buildDetail('non_critical'),
    criticalDetail:     weight.scoring_mode === 'no_category' ? buildDetail('none') : buildDetail('critical'),
    sessionCount:       Object.keys(sessions).length,
    sessionScores:      sortedScores,
  };
}

// ── Agent Exclusion Logic ────────────────────────────────────
export const EXCLUDED_FOLDERS = ['tim om', 'tim qa', 'tim spv', 'tim da & konten'];
export const EXCLUDED_JABATAN = ['qa', 'trainer', 'wfm', 'team leader', 'team_leader', 'supervisor', 'spv', 'operational manager', 'operation_manager', 'operation manager'];

export function isAgentExcluded(
  tim?: string | null,
  batchName?: string | null,
  jabatan?: string | null
): boolean {
  const t = (tim ?? '').toLowerCase().trim();
  const b = (batchName ?? '').toLowerCase().trim();
  const j = (jabatan ?? '').toLowerCase().trim();
  
  return EXCLUDED_FOLDERS.includes(t)
      || EXCLUDED_FOLDERS.includes(b)
      || EXCLUDED_JABATAN.includes(j);
}
