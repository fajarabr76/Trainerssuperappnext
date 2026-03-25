// ── Team & Category ───────────────────────────────────────────
export type TeamType = 'Telepon' | 'Chat' | 'Email' | 'telepon' | 'chat' | 'email';
export type Category = 'critical' | 'non_critical';

// ── Interfaces ────────────────────────────────────────────────
export interface QAIndicator {
  id: string;
  team_type: TeamType;
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
  no_tiket?: string | null;
  nilai: number;
  ketidaksesuaian?: string | null;
  sebaiknya?: string | null;
  created_at?: string;
  qa_indicators?: QAIndicator;
  qa_periods?: QAPeriod;
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
  complianceRate: number;
  complianceCount: number;
  totalAgents: number;
}

export interface ParameterStat {
  indicator_id: string;
  name: string;
  category: Category;
  dist: Record<number, number>;
  total: number;
  bermasalah: number;
}

export interface TrendPoint {
  label: string;
  value: number;
}

// ── Constants ─────────────────────────────────────────────────
export const MAX_SAMPLING = 5;

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

// ── Scoring Algorithm (Legacy Logic) ─────────────────────────

/**
 * Menghitung skor untuk satu sesi (satu no_tiket)
 */
function scoreSession(indicators: QAIndicator[], temuan: { indicator_id: string; nilai: number }[]) {
  const ncIndicators = indicators.filter((i) => i.category === 'non_critical');
  const crIndicators = indicators.filter((i) => i.category === 'critical');

  const calculateCategoryScore = (catIndicators: QAIndicator[]) => {
    let totalBobot = 0;
    let earnedBobot = 0;

    catIndicators.forEach((ind) => {
      const t = temuan.find((f) => f.indicator_id === ind.id);
      const nilai = t ? t.nilai : 3;
      totalBobot += ind.bobot;
      earnedBobot += (nilai / 3) * ind.bobot;
    });

    if (totalBobot === 0) return 100;
    return (earnedBobot / totalBobot) * 100;
  };

  const ncScore = calculateCategoryScore(ncIndicators);
  const crScore = calculateCategoryScore(crIndicators);

  return (ncScore + crScore) / 2;
}

/**
 * Menghitung skor QA berdasarkan temuan
 */
export function calculateQAScoreFromTemuan(
  indicators: QAIndicator[],
  temuan: { indicator_id: string; nilai: number; no_tiket?: string | null }[]
): QAScore {
  const sessions: Record<string, { indicator_id: string; nilai: number }[]> = {};
  
  temuan.forEach((t, i) => {
    const key = t.no_tiket?.trim() || `__no_ticket_${i}`;
    if (!sessions[key]) sessions[key] = [];
    sessions[key].push(t);
  });

  const sessionScoresArr = Object.values(sessions).map((s) => scoreSession(indicators, s));
  const sortedScores = [...sessionScoresArr].sort((a, b) => a - b);
  const selectedScores = sortedScores.slice(0, MAX_SAMPLING);
  
  const finalScore = selectedScores.length > 0 
    ? selectedScores.reduce((a, b) => a + b, 0) / selectedScores.length 
    : 100;

  const buildDetail = (cat: Category) => {
    return indicators
      .filter((i) => i.category === cat)
      .map((ind) => {
        const matchingTemuan = temuan.filter((t) => t.indicator_id === ind.id);
        const avgNilai = matchingTemuan.length > 0
          ? matchingTemuan.reduce((a, b) => a + b.nilai, 0) / matchingTemuan.length
          : 3;
        
        return {
          indicatorId: ind.id,
          name: ind.name,
          bobot: ind.bobot,
          nilai: avgNilai,
          temuanCount: matchingTemuan.length,
          isNa: false,
          contribution: (avgNilai / 3) * ind.bobot,
          selectedForScoring: true
        };
      });
  };

  const calculateQuickCategoryScore = (cat: Category) => {
    const catInds = indicators.filter(i => i.category === cat);
    if (catInds.length === 0) return 100;
    
    let totalB = 0;
    let earnedB = 0;
    catInds.forEach(ind => {
      const tList = temuan.filter(t => t.indicator_id === ind.id);
      const val = tList.length > 0 ? Math.min(...tList.map(t => t.nilai)) : 3;
      totalB += ind.bobot;
      earnedB += (val / 3) * ind.bobot;
    });
    return (earnedB / totalB) * 100;
  };

  return {
    finalScore,
    nonCriticalScore: calculateQuickCategoryScore('non_critical'),
    criticalScore: calculateQuickCategoryScore('critical'),
    nonCriticalDetail: buildDetail('non_critical'),
    criticalDetail: buildDetail('critical'),
    sessionCount: Object.keys(sessions).length,
    sessionScores: sortedScores,
  };
}

export const calculateQAScore = calculateQAScoreFromTemuan;
