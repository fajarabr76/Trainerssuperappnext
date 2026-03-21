import { createClient } from '@/app/lib/supabase/client';
import { 
  QAPeriod, 
  QAIndicator, 
  QATemuan, 
  DashboardSummary, 
  TrendPoint, 
  calculateQAScoreFromTemuan,
  TeamType,
  Category,
  MAX_SAMPLING,
  ParameterStat
} from '../lib/qa-types';

const supabase = createClient();

export type { 
  QAPeriod, 
  QAIndicator, 
  QATemuan, 
  DashboardSummary, 
  TrendPoint,
  TeamType,
  Category,
  ParameterStat
};

export interface TeamComparisonData {
  name: string;
  total: number;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
}

export interface TopAgentData {
  agentId: string;
  nama: string;
  batch: string;
  defects: number;
  score: number;
  hasCritical: boolean;
}

export interface ParetoData {
  name: string;
  fullName: string;
  count: number;
  cumulative: number;
  category: 'critical' | 'non_critical';
}

export interface FatalVsNonFatalData {
  fatal: number;
  nonFatal: number;
  total: number;
}


export const qaService = {
  // ── Indicators ───────────────────────────────────────────────
  async getIndicators(team_type?: TeamType): Promise<QAIndicator[]> {
    let query = supabase
      .from('qa_indicators').select('*')
      .order('category').order('bobot', { ascending: false }).order('created_at', { ascending: true });
    if (team_type) query = query.eq('team_type', team_type);
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  },

  async createIndicator(
    team_type: TeamType, name: string, category: Category, bobot: number, has_na: boolean
  ): Promise<QAIndicator> {
    const { data, error } = await supabase
      .from('qa_indicators').insert({ team_type, name, category, bobot, has_na }).select().single();
    if (error) throw error;
    return data;
  },

  async deleteIndicator(id: string): Promise<void> {
    const { count, error: checkError } = await supabase
      .from('qa_temuan').select('*', { count: 'exact', head: true }).eq('indicator_id', id);
    if (checkError) throw checkError;
    if ((count ?? 0) > 0) throw new Error('Indikator ini sudah memiliki data temuan dan tidak bisa dihapus.');
    const { error } = await supabase.from('qa_indicators').delete().eq('id', id);
    if (error) throw error;
  },

  async updateIndicator(
    id: string, patch: { name?: string; category?: Category; bobot?: number; has_na?: boolean }
  ): Promise<QAIndicator> {
    const { data, error } = await supabase
      .from('qa_indicators').update(patch).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  // ── Periods ───────────────────────────────────────────────────
  async getPeriods(): Promise<QAPeriod[]> {
    const { data, error } = await supabase
      .from('qa_periods').select('*')
      .order('year', { ascending: false }).order('month', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async createPeriod(month: number, year: number): Promise<QAPeriod> {
    const { data, error } = await supabase.from('qa_periods').insert({ month, year }).select().single();
    if (error) {
      if (error.code === '23505') throw new Error('Periode ini sudah ada.');
      throw error;
    }
    return data;
  },

  async deletePeriod(id: string): Promise<void> {
    const { count, error: checkError } = await supabase
      .from('qa_temuan').select('*', { count: 'exact', head: true }).eq('period_id', id);
    if (checkError) throw checkError;
    if ((count ?? 0) > 0) throw new Error('Periode ini sudah memiliki data temuan dan tidak bisa dihapus.');
    const { error } = await supabase.from('qa_periods').delete().eq('id', id);
    if (error) throw error;
  },

  // ── QA Temuan CRUD ────────────────────────────────────────────
  async getTemuanByAgentPeriod(
    peserta_id: string, period_id: string
  ): Promise<QATemuan[]> {
    const { data, error } = await supabase
      .from('qa_temuan')
      .select('*, qa_indicators(id, name, category, bobot, has_na, team_type), qa_periods(id, month, year)')
      .eq('peserta_id', peserta_id)
      .eq('period_id', period_id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async createTemuan(
    peserta_id: string,
    period_id: string,
    temuan: {
      indicator_id: string;
      no_tiket?: string;
      nilai: number;
      ketidaksesuaian?: string;
      sebaiknya?: string;
    }
  ): Promise<QATemuan> {
    const { data, error } = await supabase
      .from('qa_temuan')
      .insert({ peserta_id, period_id, ...temuan })
      .select('*, qa_indicators(id, name, category, bobot, has_na, team_type), qa_periods(id, month, year)')
      .single();
    if (error) throw error;
    return data;
  },

  async updateTemuan(
    id: string,
    patch: { nilai: number; ketidaksesuaian?: string; sebaiknya?: string }
  ): Promise<QATemuan> {
    const { data, error } = await supabase
      .from('qa_temuan')
      .update(patch)
      .eq('id', id)
      .select('*, qa_indicators(id, name, category, bobot, has_na, team_type), qa_periods(id, month, year)')
      .single();
    if (error) throw error;
    return data;
  },

  async deleteTemuan(id: string): Promise<void> {
    const { error } = await supabase.from('qa_temuan').delete().eq('id', id);
    if (error) throw error;
  },

  // ── Agents ────────────────────────────────────────────────────
  async getAgentMiniProfile(peserta_id: string) {
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

  async getAgentsByFolder(batch: string) {
    const { data, error } = await supabase
      .from('profiler_peserta').select('id, nama, tim, batch_name').eq('batch_name', batch).order('nama');
    if (error) throw error;
    return (data ?? []).map((a: any) => ({ id: a.id, nama: a.nama, tim: a.tim, batch: a.batch_name }));
  },

  async getAgentListWithScores() {
    // 1. Fetch agents
    const { data: agentData, error: agentError } = await supabase
      .from('profiler_peserta')
      .select('id, nama, tim, batch_name, foto_url')
      .order('nama');
    if (agentError) throw agentError;
    const agents = agentData ?? [];

    // 2. Fetch all indicators
    const { data: indsData, error: indsError } = await supabase
      .from('qa_indicators')
      .select('id, name, category, bobot, has_na, team_type');
    if (indsError) throw indsError;
    const allIndicators: QAIndicator[] = indsData ?? [];

    // 3. Fetch all temuan with period info
    const { data: temuanData, error: temuanError } = await supabase
      .from('qa_temuan')
      .select('peserta_id, indicator_id, nilai, no_tiket, qa_periods(id, month, year)');
    if (temuanError) throw temuanError;
    const allTemuan = temuanData ?? [];

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

    function periodKey(m: number, y: number) { return `${y}-${String(m).padStart(2, '0')}`; }

    const temuanByAgent = new Map<string, any[]>();
    allTemuan.forEach(t => {
      if (!t.qa_periods) return;
      if (!temuanByAgent.has(t.peserta_id)) temuanByAgent.set(t.peserta_id, []);
      temuanByAgent.get(t.peserta_id)!.push(t);
    });

    agentDataMap.forEach((agentObj, agentId) => {
      const agentTemuan = temuanByAgent.get(agentId) || [];
      if (agentTemuan.length === 0) return;

      const periodsMap = new Map<string, any[]>();
      agentTemuan.forEach(t => {
        const pk = periodKey(t.qa_periods.month, t.qa_periods.year);
        if (!periodsMap.has(pk)) periodsMap.set(pk, []);
        periodsMap.get(pk)!.push(t);
      });

      const sortedPeriods = [...periodsMap.keys()].sort((a, b) => b.localeCompare(a));
      const latestPeriodKey = sortedPeriods[0];
      const prevPeriodKey = sortedPeriods.length > 1 ? sortedPeriods[1] : null;

      const teamInds = allIndicators.filter(i => i.team_type === agentObj.tim);

      // Latest Score
      const latestTemuan = periodsMap.get(latestPeriodKey)!;
      const latestScore = calculateQAScoreFromTemuan(
        teamInds,
        latestTemuan.map(t => ({ indicator_id: t.indicator_id, nilai: t.nilai, no_tiket: t.no_tiket }))
      );

      agentObj.avgScore = latestScore.finalScore;
      const hasCriticalFatal = latestScore.criticalDetail.some(d => d.nilai < 3);
      agentObj.atRisk = latestScore.finalScore < 75 || hasCriticalFatal;

      // Previous Score for Trend
      if (prevPeriodKey) {
        const prevTemuan = periodsMap.get(prevPeriodKey)!;
        const prevScore = calculateQAScoreFromTemuan(
          teamInds,
          prevTemuan.map(t => ({ indicator_id: t.indicator_id, nilai: t.nilai, no_tiket: t.no_tiket }))
        );
        
        agentObj.trendValue = latestScore.finalScore - prevScore.finalScore;
        agentObj.trend = agentObj.trendValue > 0 ? 'up' : agentObj.trendValue < 0 ? 'down' : 'same';
      }
    });

    return [...agentDataMap.values()];
  },

  async getAgentWithTemuan(peserta_id: string) {
    const { data: agentRaw, error: agentError } = await supabase
      .from('profiler_peserta').select('*').eq('id', peserta_id).single();
    if (agentError) throw agentError;

    const agent = {
      ...agentRaw,
      batch: agentRaw.batch_name
    };

    const { data: temuan, error: temuanError } = await supabase
      .from('qa_temuan')
      .select('*, qa_indicators(id, name, category, bobot, has_na, team_type), qa_periods(id, month, year)')
      .eq('peserta_id', peserta_id)
      .order('created_at', { ascending: false });
    if (temuanError) throw temuanError;

    return { agent, temuan: temuan ?? [] };
  },

  async getAgentExportData(peserta_id: string) {
    const { agent, temuan } = await this.getAgentWithTemuan(peserta_id);

    const { data: indsData } = await supabase
      .from('qa_indicators').select('*').eq('team_type', agent.tim);
    const indicators: QAIndicator[] = indsData ?? [];

    const periodMap = new Map<string, {
      label: string; month: number; year: number;
      temuan: any[]; score: number; ncScore: number; crScore: number;
    }>();

    (temuan as any[]).forEach(t => {
      const key = `${t.qa_periods.year}-${String(t.qa_periods.month).padStart(2, '0')}`;
      if (!periodMap.has(key)) {
        periodMap.set(key, {
          label: key, month: t.qa_periods.month, year: t.qa_periods.year,
          temuan: [], score: 0, ncScore: 0, crScore: 0
        });
      }
      periodMap.get(key)!.temuan.push(t);
    });

    periodMap.forEach(period => {
      const s = calculateQAScoreFromTemuan(
        indicators,
        period.temuan.map(t => ({ indicator_id: t.indicator_id, nilai: t.nilai, no_tiket: t.no_tiket }))
      );
      period.score = s.finalScore;
      period.ncScore = s.nonCriticalScore;
      period.crScore = s.criticalScore;
    });

    const periods = [...periodMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);

    return { agent, periods };
  },

  // ── Dashboard Aggregations ────────────────────────────────────
  async resolvePeriodIds(periodId: string): Promise<string[]> {
    if (periodId !== 'ytd') return [periodId];
    const year = new Date().getFullYear();
    const { data } = await supabase.from('qa_periods').select('id').eq('year', year);
    return data && data.length > 0 ? data.map(p => p.id) : ['none'];
  },

  async getDashboardSummary(folderIds: string[], periodId: string): Promise<DashboardSummary> {
    const { data: indicators } = await supabase.from('qa_indicators').select('*');
    const allIndicators = (indicators || []) as QAIndicator[];

    const pIds = await this.resolvePeriodIds(periodId);

    let query = supabase
      .from('qa_temuan')
      .select('*, qa_indicators(category)')
      .in('period_id', pIds);

    if (folderIds.length > 0) {
      query = query.in('profiler_peserta.batch_name', folderIds);
    }

    const { data, error } = await query;
    if (error || !data) {
      return { totalDefects: 0, avgDefectsPerAudit: 0, fatalErrorRate: 0, complianceRate: 0 };
    }

    const totalAudits = new Set(data.map(d => d.no_tiket)).size;
    const defects = data.filter(d => d.nilai < 3);
    const fatalErrors = data.filter(d => d.nilai === 0 && d.qa_indicators?.category === 'critical');
    const compliant = data.filter(d => d.nilai === 3);

    return {
      totalDefects: defects.length,
      avgDefectsPerAudit: totalAudits > 0 ? defects.length / totalAudits : 0,
      fatalErrorRate: totalAudits > 0 ? (fatalErrors.length / totalAudits) * 100 : 0,
      complianceRate: data.length > 0 ? (compliant.length / data.length) * 100 : 0
    };
  },

  async getYTDDashboardSummary(year: number): Promise<DashboardSummary> {
    const startOfYear = `${year}-01-01`;
    const endOfYear = `${year}-12-31`;

    // Fetch periods for the given year
    const { data: periods } = await supabase
      .from('qa_periods')
      .select('id')
      .eq('year', year);

    if (!periods || periods.length === 0) {
      return { totalDefects: 0, avgDefectsPerAudit: 0, fatalErrorRate: 0, complianceRate: 0 };
    }

    const periodIds = periods.map(p => p.id);

    const { data, error } = await supabase
      .from('qa_temuan')
      .select('id, indicator_id, nilai, no_tiket, qa_indicators(category)')
      .in('period_id', periodIds.length > 0 ? periodIds : ['none']);
    if (error || !data) {
      return { totalDefects: 0, avgDefectsPerAudit: 0, fatalErrorRate: 0, complianceRate: 0 };
    }

    const totalAudits = new Set(data.map(d => d.no_tiket)).size;
    const defects = data.filter(d => d.nilai < 3);
    const fatalErrors = data.filter(d => {
      const ind = d.qa_indicators as any;
      return d.nilai === 0 && ind?.category === 'critical';
    });
    const compliant = data.filter(d => d.nilai === 3);

    return {
      totalDefects: defects.length,
      avgDefectsPerAudit: totalAudits > 0 ? defects.length / totalAudits : 0,
      fatalErrorRate: totalAudits > 0 ? (fatalErrors.length / totalAudits) * 100 : 0,
      complianceRate: data.length > 0 ? (compliant.length / data.length) * 100 : 0
    };
  },

  async getKpiSparkline(folderIds: string[], periodId: string | undefined | null, metric: 'total' | 'avg' | 'fatal' | 'compliance', timeframe: '3m' | '6m' | 'all' = '3m'): Promise<TrendPoint[]> {
    // 1. Fetch recent periods
    let periodQuery = supabase.from('qa_periods').select('*').order('year', { ascending: false }).order('month', { ascending: false });
    
    // If timeframe is 'all', we might want more than just 3 or 6. Let's say 12 for 'all'.
    const limitMap = { '3m': 3, '6m': 6, 'all': 12 };
    periodQuery = periodQuery.limit(limitMap[timeframe] || 3);
    
    const { data: periods, error: pError } = await periodQuery;
    if (pError || !periods || periods.length === 0) return [];

    // Reverse to chronological order for the sparkline
    const sortedPeriods = [...periods].reverse();

    // 2. Fetch findings for these periods
    const pIds = sortedPeriods.map(p => p.id);
    if (pIds.length === 0) return [];

    let temuanQuery = supabase
      .from('qa_temuan')
      .select('nilai, no_tiket, period_id, qa_indicators(category), profiler_peserta!inner(batch_name)')
      .in('period_id', pIds);

    if (folderIds.length > 0) {
      temuanQuery = temuanQuery.in('profiler_peserta.batch_name', folderIds);
    }

    const { data: temuan, error: tError } = await temuanQuery;
    if (tError) {
      console.error("Sparkline temuan error:", tError);
      return sortedPeriods.map(p => ({ label: `${MONTHS_SHORT[p.month - 1]} ${String(p.year).slice(-2)}`, value: 0 }));
    }

    const temuanByPeriod = (temuan || []).reduce((acc: any, t: any) => {
      if (!acc[t.period_id]) acc[t.period_id] = [];
      acc[t.period_id].push(t);
      return acc;
    }, {});

    // 3. Calculate metric for each period
    const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'];
    
    return sortedPeriods.map(p => {
      const pTemuan = temuanByPeriod[p.id] || [];
      let value = 0;
      
      const totalAudits = new Set(pTemuan.map((t: any) => t.no_tiket)).size;

      if (metric === 'total') {
        value = pTemuan.filter((t: any) => t.nilai < 3).length;
      } else if (metric === 'avg') {
        const defects = pTemuan.filter((t: any) => t.nilai < 3).length;
        value = totalAudits > 0 ? defects / totalAudits : 0;
      } else if (metric === 'fatal') {
        const fatals = pTemuan.filter((t: any) => t.nilai === 0 && t.qa_indicators?.category === 'critical').length;
        value = totalAudits > 0 ? (fatals / totalAudits) * 100 : 0;
      } else if (metric === 'compliance') {
        const total = pTemuan.length;
        const compliant = pTemuan.filter((t: any) => t.nilai === 3).length;
        value = total > 0 ? (compliant / total) * 100 : 0;
      }

      return {
        label: `${MONTHS_SHORT[p.month - 1]} ${String(p.year).slice(-2)}`,
        value: Number(value.toFixed(1))
      };
    });
  },

  async getTrendWithParameters(folderIds: string[], timeframe: '3m' | '6m' | 'all' = '3m') {
    // Simulasikan logic trend parameters
    const periodQuery = supabase.from('qa_periods').select('*').order('year', { ascending: false }).order('month', { ascending: false });
    const limitMap = { '3m': 3, '6m': 6, 'all': 12 };
    const { data: periods } = await periodQuery.limit(limitMap[timeframe]);
    if (!periods) return { labels: [], datasets: [] };

    const sortedPeriods = [...periods].reverse();
    const pIds = sortedPeriods.map(p => p.id);
    const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'];
    const labels = sortedPeriods.map(p => `${MONTHS_SHORT[p.month - 1]} ${String(p.year).slice(-2)}`);

    let query = supabase
      .from('qa_temuan')
      .select('nilai, period_id, qa_indicators(name), profiler_peserta!inner(batch_name)')
      .in('period_id', pIds)
      .lt('nilai', 3);

    if (folderIds.length > 0) {
      query = query.in('profiler_peserta.batch_name', folderIds);
    }

    const { data: temuan } = await query;
    if (!temuan) return { labels, datasets: [] };

    // Count findings per parameter per period
    const counts: Record<string, Record<string, number>> = {}; // param -> periodId -> count
    const totalByPeriod: Record<string, number> = {};

    temuan.forEach((t: any) => {
      const pName = t.qa_indicators?.name || 'Unknown';
      const pid = t.period_id;
      if (!counts[pName]) counts[pName] = {};
      counts[pName][pid] = (counts[pName][pid] || 0) + 1;
      totalByPeriod[pid] = (totalByPeriod[pid] || 0) + 1;
    });

    // Get Top 5 parameters
    const topParams = Object.entries(counts)
      .map(([name, periodCounts]) => ({
        name,
        total: Object.values(periodCounts).reduce((a, b) => a + b, 0)
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
      .map(p => p.name);

    const datasets = [
      {
        label: 'Total Temuan',
        data: sortedPeriods.map(p => totalByPeriod[p.id] || 0),
        isTotal: true
      },
      ...topParams.map(name => ({
        label: name,
        data: sortedPeriods.map(p => counts[name][p.id] || 0),
        isTotal: false
      }))
    ];

    return { labels, datasets };
  },


  async getTeamComparison(folderIds: string[], periodId: string): Promise<TeamComparisonData[]> {
    const pIds = await this.resolvePeriodIds(periodId);
    let query = supabase
      .from('qa_temuan')
      .select('nilai, profiler_peserta!inner(batch_name)')
      .in('period_id', pIds)
      .lt('nilai', 3);

    if (folderIds.length > 0) {
      query = query.in('profiler_peserta.batch_name', folderIds);
    }

    const { data, error } = await query;
    if (error || !data) return [];

    const teamCounts: Record<string, number> = {};
    data.forEach(d => {
      const team = (d.profiler_peserta as any)?.batch_name || 'Unknown';
      teamCounts[team] = (teamCounts[team] || 0) + 1;
    });

    return Object.entries(teamCounts)
      .map(([name, total]) => ({
        name,
        total,
        severity: (total > 50 ? 'Critical' : total > 30 ? 'High' : total > 15 ? 'Medium' : 'Low') as 'Critical' | 'High' | 'Medium' | 'Low'
      }))
      .sort((a, b) => b.total - a.total);
  },

  async getTopAgentsWithDefects(folderIds: string[], periodId: string, limit: number = 5): Promise<TopAgentData[]> {
    const { data: indicators } = await supabase.from('qa_indicators').select('*');
    const allIndicators = (indicators || []) as QAIndicator[];

    const pIds = await this.resolvePeriodIds(periodId);

    let query = supabase
      .from('qa_temuan')
      .select('nilai, no_tiket, indicator_id, qa_indicators(category), profiler_peserta!inner(id, nama, batch_name)')
      .in('period_id', pIds);

    if (folderIds.length > 0) {
      query = query.in('profiler_peserta.batch_name', folderIds);
    }

    const { data, error } = await query;
    if (error || !data) return [];

    const agentTemuanMap: Record<string, any[]> = {};
    const agentInfoMap: Record<string, any> = {};

    data.forEach(d => {
      const p = d.profiler_peserta as any;
      if (!p) return;
      if (!agentTemuanMap[p.id]) {
        agentTemuanMap[p.id] = [];
        agentInfoMap[p.id] = { id: p.id, nama: p.nama, batch_name: p.batch_name };
      }
      agentTemuanMap[p.id].push({
        indicator_id: d.indicator_id,
        nilai: d.nilai,
        no_tiket: d.no_tiket
      });
    });

    const agentStats = Object.keys(agentTemuanMap).map(id => {
      const info = agentInfoMap[id];
      const temuanList = agentTemuanMap[id];
      const result = calculateQAScoreFromTemuan(allIndicators, temuanList);
      
      const defects = temuanList.filter(t => t.nilai < 3).length;
      const hasCritical = temuanList.some(t => {
        const ind = allIndicators.find(i => i.id === t.indicator_id);
        return t.nilai === 0 && ind?.category === 'critical';
      });

      return {
        agentId: id,
        nama: info.nama,
        batch: info.batch_name,
        defects,
        score: result.finalScore,
        hasCritical
      };
    });

    return agentStats
      .sort((a, b) => a.score - b.score) // Sort by lowest score (performing worst)
      .slice(0, limit);
  },

  async getParetoData(folderIds: string[], periodId: string): Promise<ParetoData[]> {
    const pIds = await this.resolvePeriodIds(periodId);
    let query = supabase
      .from('qa_temuan')
      .select('nilai, qa_indicators!inner(name, category), profiler_peserta!inner(batch_name)')
      .in('period_id', pIds)
      .lt('nilai', 3);

    if (folderIds.length > 0) {
      query = query.in('profiler_peserta.batch_name', folderIds);
    }

    const { data, error } = await query;
    if (error || !data) return [];

    const paramCounts: Record<string, { count: number, category: string }> = {};
    let totalDefects = 0;

    data.forEach(d => {
      const ind = d.qa_indicators as any;
      if (!ind) return;
      const name = ind.name;
      if (!paramCounts[name]) {
        paramCounts[name] = { count: 0, category: ind.category };
      }
      paramCounts[name].count += 1;
      totalDefects += 1;
    });

    let cumulativeCount = 0;
    return Object.entries(paramCounts)
      .map(([fullName, info]) => ({
        name: fullName.length > 15 ? fullName.substring(0, 15) + '...' : fullName,
        fullName,
        count: info.count,
        category: info.category as 'critical' | 'non_critical',
        cumulative: 0
      }))
      .sort((a, b) => b.count - a.count)
      .map(item => {
        cumulativeCount += item.count;
        item.cumulative = totalDefects > 0 ? Number(((cumulativeCount / totalDefects) * 100).toFixed(1)) : 0;
        return item;
      });
  },

  async getFatalVsNonFatal(folderIds: string[], periodId: string): Promise<FatalVsNonFatalData> {
    const pIds = await this.resolvePeriodIds(periodId);
    let query = supabase
      .from('qa_temuan')
      .select('nilai, qa_indicators!inner(category), profiler_peserta!inner(batch_name)')
      .in('period_id', pIds)
      .lt('nilai', 3);

    if (folderIds.length > 0) {
      query = query.in('profiler_peserta.batch_name', folderIds);
    }

    const { data, error } = await query;
    if (error || !data) return { fatal: 0, nonFatal: 0, total: 0 };

    let fatal = 0;
    let nonFatal = 0;

    data.forEach(d => {
      const ind = d.qa_indicators as any;
      if (d.nilai === 0 && ind?.category === 'critical') {
        fatal += 1;
      } else {
        nonFatal += 1;
      }
    });

    return { fatal, nonFatal, total: fatal + nonFatal };
  },

  async getPersonalTrendWithParameters(peserta_id: string, timeframe: '3m' | '6m' | 'all' = '3m') {
    const periodQuery = supabase.from('qa_periods').select('*').order('year', { ascending: false }).order('month', { ascending: false });
    const limitMap = { '3m': 3, '6m': 6, 'all': 12 };
    const { data: periods } = await periodQuery.limit(limitMap[timeframe]);
    if (!periods) return { labels: [], datasets: [] };

    const sortedPeriods = [...periods].reverse();
    const pIds = sortedPeriods.map(p => p.id);
    const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'];
    const labels = sortedPeriods.map(p => `${MONTHS_SHORT[p.month - 1]} ${String(p.year).slice(-2)}`);

    let query = supabase
      .from('qa_temuan')
      .select('nilai, period_id, qa_indicators(name)')
      .eq('peserta_id', peserta_id)
      .in('period_id', pIds)
      .lt('nilai', 3);

    const { data: temuan } = await query;
    if (!temuan) return { labels, datasets: [] };

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
      .map(([name, periodCounts]) => ({
        name,
        total: Object.values(periodCounts).reduce((a, b) => a + b, 0)
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 3) // Top 3 for personal view
      .map(p => p.name);

    const datasets = [
      {
        label: 'Total Temuan',
        data: sortedPeriods.map(p => totalByPeriod[p.id] || 0),
        isTotal: true
      },
      ...topParams.map(name => ({
        label: name,
        data: sortedPeriods.map(p => counts[name][p.id] || 0),
        isTotal: false
      }))
    ];

    return { labels, datasets };
  }
};

