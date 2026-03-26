import { createClient } from '@/app/lib/supabase/server';
import { 
  QAPeriod, 
  QAIndicator, 
  QATemuan, 
  DashboardSummary, 
  TrendPoint, 
  calculateQAScoreFromTemuan,
  ServiceType,
  Category,
  TIM_TO_DEFAULT_SERVICE,
  SharedContext,
  TeamComparisonData,
  TopAgentData,
  ParetoData,
  CriticalVsNonCriticalData
} from '../lib/qa-types';

export const qaServiceServer = {
  // ── Indicators ───────────────────────────────────────────────
  async getIndicators(service_type?: string): Promise<QAIndicator[]> {
    const supabase = await createClient();
    let query = supabase
      .from('qa_indicators').select('*')
      .order('category').order('bobot', { ascending: false }).order('created_at', { ascending: true });
    
    if (service_type) query = query.eq('service_type', service_type);
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  },

  // ── Folders ───────────────────────────────────────────────────
  async getFolders(): Promise<string[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('profiler_folders')
      .select('name')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []).map((d: any) => d.name);
  },

  // ── Periods ───────────────────────────────────────────────────
  async getPeriods(): Promise<QAPeriod[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('qa_periods').select('*')
      .order('year', { ascending: false }).order('month', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  // ── QA Temuan CRUD ────────────────────────────────────────────
  async getTemuanByAgentPeriod(
    peserta_id: string, period_id: string
  ): Promise<QATemuan[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('qa_temuan')
      .select('*, qa_indicators(id, name, category, bobot, has_na, service_type), qa_periods(id, month, year)')
      .eq('peserta_id', peserta_id)
      .eq('period_id', period_id)
      .order('created_at', { ascending: false });
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

  async getAgentListWithScores() {
    const supabase = await createClient();
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
      .select('id, name, category, bobot, has_na, service_type');
    if (indsError) throw indsError;
    const allIndicators: QAIndicator[] = indsData ?? [];

    // 3. Fetch all temuan with period info and metadata
    const { data: temuanData, error: temuanError } = await supabase
      .from('qa_temuan')
      .select('peserta_id, indicator_id, nilai, no_tiket, service_type, ketidaksesuaian, sebaiknya, qa_periods(id, month, year)');
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

      const latestTemuan = periodsMap.get(latestPeriodKey)!;
      // Use service_type from the latest audits if available, otherwise fallback to team mapping
      const activeService = latestTemuan[0]?.service_type || TIM_TO_DEFAULT_SERVICE[agentObj.tim] || 'call';
      const teamInds = allIndicators.filter(i => i.service_type === activeService);

      // Latest Score
      const latestScore = calculateQAScoreFromTemuan(
        teamInds,
        latestTemuan.map(t => ({ indicator_id: t.indicator_id, nilai: t.nilai, no_tiket: t.no_tiket, ketidaksesuaian: t.ketidaksesuaian, sebaiknya: t.sebaiknya }))
      );

      agentObj.avgScore = latestScore.finalScore;
      const hasCriticalFatal = latestScore.criticalDetail.some(d => d.nilai < 3);
      agentObj.atRisk = latestScore.finalScore < 75 || hasCriticalFatal;

      // Previous Score for Trend
      if (prevPeriodKey) {
        const prevTemuan = periodsMap.get(prevPeriodKey)!;
        const prevActiveService = prevTemuan[0]?.service_type || activeService; // Use previous period's service type if available
        const prevTeamInds = allIndicators.filter(i => i.service_type === prevActiveService);
        
        const prevScore = calculateQAScoreFromTemuan(
          prevTeamInds,
          prevTemuan.map(t => ({ indicator_id: t.indicator_id, nilai: t.nilai, no_tiket: t.no_tiket, ketidaksesuaian: t.ketidaksesuaian, sebaiknya: t.sebaiknya }))
        );
        
        agentObj.trendValue = latestScore.finalScore - prevScore.finalScore;
        agentObj.trend = agentObj.trendValue > 0 ? 'up' : agentObj.trendValue < 0 ? 'down' : 'same';
      }
    });

    return [...agentDataMap.values()];
  },

  async getAgentWithTemuan(peserta_id: string) {
    const supabase = await createClient();
    const { data: agentRaw, error: agentError } = await supabase
      .from('profiler_peserta').select('*').eq('id', peserta_id).single();
    if (agentError) throw agentError;

    const agent = {
      ...agentRaw,
      batch: agentRaw.batch_name
    };

    const { data: temuan, error: temuanError } = await supabase
      .from('qa_temuan')
      .select('*, qa_indicators(id, name, category, bobot, has_na, service_type), qa_periods(id, month, year)')
      .eq('peserta_id', peserta_id)
      .order('created_at', { ascending: false });
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
    return (data ?? []).map((a: any) => ({
      id: a.id,
      nama: a.nama,
      tim: a.tim,
      batch: a.batch_name,
      jabatan: a.jabatan
    }));
  },

  // ── Dashboard Aggregations ────────────────────────────────────
  async resolvePeriodIds(periodId: string): Promise<string[]> {
    const supabase = await createClient();
    if (periodId !== 'ytd') return [periodId];
    const year = new Date().getFullYear();
    const { data } = await supabase.from('qa_periods').select('id').eq('year', year);
    return data && data.length > 0 ? data.map(p => p.id) : ['none'];
  },

  async getDashboardSummary(folderIds: string[], periodId: string, serviceType?: string, context?: SharedContext): Promise<DashboardSummary> {
    const supabase = await createClient();
    const pIds = await this.resolvePeriodIds(periodId);

    // 1. Fetch Population (All Agents in selected folders)
    let allAgents: any[] = [];
    if (context?.agents) {
      allAgents = folderIds.length > 0 
        ? context.agents.filter(a => folderIds.includes(a.batch_name))
        : context.agents;
    } else {
      let agentQuery = supabase.from('profiler_peserta').select('id, tim, batch_name');
      if (folderIds.length > 0) agentQuery = agentQuery.in('batch_name', folderIds);
      const { data: allAgentsData } = await agentQuery;
      allAgents = allAgentsData || [];
    }
    const totalAgents = allAgents.length;

    // 2. Fetch Findings
    let query = supabase
      .from('qa_temuan')
      .select('*, qa_indicators(category), profiler_peserta!inner(batch_name, tim)')
      .in('period_id', pIds);
    if (serviceType) query = query.eq('service_type', serviceType);

    if (folderIds.length > 0) {
      query = query.in('profiler_peserta.batch_name', folderIds);
    }

    const { data, error } = await query;
    if (error || !data) {
      return { totalDefects: 0, avgDefectsPerAudit: 0, zeroErrorRate: 0, complianceRate: 0, complianceCount: 0, totalAgents: 0 };
    }

    // Filter agents to only those who were actually audited in the selected criteria
    const auditedAgentIds = new Set(data.map(d => d.peserta_id));
    const auditedAgents = allAgents.filter(a => auditedAgentIds.has(a.id));
    const totalAuditedAgents = auditedAgents.length;
    
    if (totalAuditedAgents === 0) {
      return { totalDefects: 0, avgDefectsPerAudit: 0, zeroErrorRate: 0, complianceRate: 0, complianceCount: 0, totalAgents: 0 };
    }

    // 3. Fetch all indicators (needed for scoring)
    const allIndicators = context?.indicators || (await this.getIndicators()) as QAIndicator[];
    
    const defects = data.filter(d => d.nilai < 3);

    // 4. Calculate Zero Error Rate & Compliance Rate over AUDITED POPULATION
    let agentsWithZeroError = 0;
    let agentsWithPassScore = 0;
    
    const agentTemuanMap: Record<string, any[]> = {};

    data.forEach(d => {
      if (!agentTemuanMap[d.peserta_id]) {
        agentTemuanMap[d.peserta_id] = [];
      }
      agentTemuanMap[d.peserta_id].push({ indicator_id: d.indicator_id, nilai: d.nilai, no_tiket: d.no_tiket, service_type: d.service_type });
    });

    auditedAgents.forEach(agent => {
      const temuanList = agentTemuanMap[agent.id] || [];
      
      // Zero Error Check
      const hasDefect = temuanList.some(t => t.nilai < 3);
      if (!hasDefect) {
        agentsWithZeroError++;
      }

      // Compliance Check
      const activeServiceType = temuanList[0]?.service_type || serviceType;
      const teamInds = allIndicators.filter(i => i.service_type === activeServiceType);
      const result = calculateQAScoreFromTemuan(teamInds, temuanList);
      if (result.finalScore >= 95) {
        agentsWithPassScore++;
      }
    });

    return {
      totalDefects: defects.length,
      avgDefectsPerAudit: totalAuditedAgents > 0 ? defects.length / totalAuditedAgents : 0,
      zeroErrorRate: totalAuditedAgents > 0 ? (agentsWithZeroError / totalAuditedAgents) * 100 : 0,
      complianceRate: totalAuditedAgents > 0 ? (agentsWithPassScore / totalAuditedAgents) * 100 : 0,
      complianceCount: agentsWithPassScore,
      totalAgents: totalAuditedAgents
    };
  },

  async getKpiSparkline(folderIds: string[], periodId: string | undefined | null, metric: 'total' | 'avg' | 'zero_error' | 'compliance', timeframe: '3m' | '6m' | 'all' = '3m', serviceType?: string, context?: SharedContext): Promise<TrendPoint[]> {
    const supabase = await createClient();
    // 1. Fetch recent periods
    const limitMap = { '3m': 3, '6m': 6, 'all': 12 };
    const limit = limitMap[timeframe] || 3;
    
    let sortedPeriods: QAPeriod[] = [];
    if (context?.periods) {
      sortedPeriods = [...context.periods].slice(0, limit).reverse();
    } else {
      let periodQuery = supabase.from('qa_periods').select('*').order('year', { ascending: false }).order('month', { ascending: false }).limit(limit);
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
      .in('period_id', pIds);

    if (folderIds.length > 0) {
      temuanQuery = temuanQuery.in('profiler_peserta.batch_name', folderIds);
    }

    const { data: temuan, error: tError } = await temuanQuery;
    if (tError) return sortedPeriods.map(p => ({ label: `${MONTHS_SHORT[p.month - 1]} ${String(p.year).slice(-2)}`, value: 0 }));

    let allIndicators: QAIndicator[] = [];
    if (metric === 'compliance') {
      allIndicators = context?.indicators || (await this.getIndicators()) as QAIndicator[];
    }

    // Fetch population of agents for the exact selected folders
    // We assume the population is relatively constant.
    let allAgents: any[] = [];
    if (context?.agents) {
      allAgents = folderIds.length > 0 
        ? context.agents.filter(a => folderIds.includes(a.batch_name))
        : context.agents;
    } else {
      let agentQuery = supabase.from('profiler_peserta').select('id, tim, batch_name');
      if (folderIds.length > 0) agentQuery = agentQuery.in('batch_name', folderIds);
      const { data: allAgentsData } = await agentQuery;
      allAgents = allAgentsData || [];
    }
    const totalAgents = allAgents.length;

    const temuanByPeriod = (temuan || []).reduce((acc: any, t: any) => {
      if (!acc[t.period_id]) acc[t.period_id] = [];
      acc[t.period_id].push(t);
      return acc;
    }, {});

    const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'];
    
    return sortedPeriods.map(p => {
      const pTemuan = temuanByPeriod[p.id] || [];
      let value = 0;

      if (metric === 'total') {
        value = pTemuan.filter((t: any) => t.nilai < 3 || t.ketidaksesuaian || t.sebaiknya).length;
      }
      else if (metric === 'avg') {
        const auditedInPeriod = new Set(pTemuan.map((t: any) => t.peserta_id)).size;
        value = auditedInPeriod > 0 ? pTemuan.filter((t: any) => t.nilai < 3 || t.ketidaksesuaian || t.sebaiknya).length / auditedInPeriod : 0;
      }
      else if (metric === 'zero_error') {
        if (totalAgents > 0) {
          let zeroErrorCount = 0;
          allAgents.forEach(agent => {
            const hasDefect = pTemuan.some((t: any) => t.peserta_id === agent.id && t.nilai < 3);
            if (!hasDefect) zeroErrorCount++;
          });
          value = (zeroErrorCount / totalAgents) * 100;
        }
      }
      else if (metric === 'compliance') {
        if (totalAgents > 0) {
          let passCount = 0;
          allAgents.forEach(agent => {
            const agentTemuans = pTemuan.filter((t: any) => t.peserta_id === agent.id);
            const teamInds = allIndicators.filter(i => i.service_type === agentTemuans[0]?.service_type);
            const result = calculateQAScoreFromTemuan(
              teamInds,
              agentTemuans.map((t: any) => ({ indicator_id: t.indicator_id, nilai: t.nilai, no_tiket: t.no_tiket }))
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

  async getTrendWithParameters(folderIds: string[], timeframe: '3m' | '6m' | 'all' = '3m', serviceType?: string, context?: SharedContext) {
    const supabase = await createClient();
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
    const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'];
    const labels = sortedPeriods.map(p => `${MONTHS_SHORT[p.month - 1]} ${String(p.year).slice(-2)}`);

    let query = supabase
      .from('qa_temuan')
      .select('nilai, ketidaksesuaian, sebaiknya, period_id, qa_indicators(name), profiler_peserta!inner(batch_name)')
      .in('period_id', pIds);

    if (folderIds.length > 0) query = query.in('profiler_peserta.batch_name', folderIds);

    const { data: temuan } = await query;
    if (!temuan) return { labels, datasets: [] };

    // Filter "Concerns": Score < 3 OR Score 3 with notes
    const findings = temuan.filter((t: any) => t.nilai < 3 || t.ketidaksesuaian || t.sebaiknya);

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
      .sort((a, b) => b.total - a.total).slice(0, 5).map(p => p.name);

    const datasets = [
      { label: 'Total Temuan', data: sortedPeriods.map(p => totalByPeriod[p.id] || 0), isTotal: true },
      ...topParams.map(name => ({ label: name, data: sortedPeriods.map(p => counts[name][p.id] || 0), isTotal: false }))
    ];

    return { labels, datasets };
  },

  async getTeamComparison(folderIds: string[], periodId: string, serviceType?: string, context?: SharedContext): Promise<TeamComparisonData[]> {
    const supabase = await createClient();
    const pIds = await this.resolvePeriodIds(periodId);
    let query = supabase
      .from('qa_temuan')
      .select('nilai, profiler_peserta!inner(batch_name)')
      .in('period_id', pIds)
      .lt('nilai', 3);

    if (folderIds.length > 0) query = query.in('profiler_peserta.batch_name', folderIds);

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
        severity: (total > 50 ? 'Critical' : total > 30 ? 'High' : total > 15 ? 'Medium' : 'Low') as any
      }))
      .sort((a, b) => b.total - a.total);
  },

  async getTopAgentsWithDefects(folderIds: string[], periodId: string, limit: number = 5, serviceType?: string, context?: SharedContext): Promise<TopAgentData[]> {
    const supabase = await createClient();
    const allIndicators = context?.indicators || (await this.getIndicators()) as QAIndicator[];
    const pIds = await this.resolvePeriodIds(periodId);

    let query = supabase
      .from('qa_temuan')
      .select('nilai, no_tiket, indicator_id, qa_indicators(category), profiler_peserta!inner(id, nama, batch_name)')
      .in('period_id', pIds);
    if (serviceType) query = query.eq('service_type', serviceType);

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
        agentInfoMap[p.id] = { id: p.id, nama: p.nama, batch_name: p.batch_name };
      }
      agentTemuanMap[p.id].push({ indicator_id: d.indicator_id, nilai: d.nilai, no_tiket: d.no_tiket });
    });

    const agentStats = Object.keys(agentTemuanMap).map(id => {
      const info = agentInfoMap[id];
      const temuanList = agentTemuanMap[id];
      const activeService = temuanList[0]?.service_type || serviceType || 'call';
      const serviceInds = allIndicators.filter(i => i.service_type === activeService);
      const result = calculateQAScoreFromTemuan(serviceInds, temuanList);
      const defects = temuanList.filter(t => t.nilai < 3).length;
      const hasCritical = temuanList.some(t => {
        const ind = serviceInds.find(i => i.id === t.indicator_id);
        return t.nilai === 0 && ind?.category === 'critical';
      });

      return { agentId: id, nama: info.nama, batch: info.batch_name, defects, score: result.finalScore, hasCritical };
    });

    return agentStats.sort((a, b) => b.defects - a.defects).slice(0, limit);
  },

  async getParetoData(folderIds: string[], periodId: string, serviceType?: string, context?: SharedContext): Promise<ParetoData[]> {
    const supabase = await createClient();
    const pIds = await this.resolvePeriodIds(periodId);
    let query = supabase
      .from('qa_temuan')
      .select('nilai, qa_indicators!inner(name, category), profiler_peserta!inner(batch_name)')
      .in('period_id', pIds)
      .lt('nilai', 3);

    if (folderIds.length > 0) query = query.in('profiler_peserta.batch_name', folderIds);

    const { data, error } = await query;
    if (error || !data) return [];

    const paramCounts: Record<string, { count: number, category: string }> = {};
    let totalDefects = 0;

    data.forEach(d => {
      const ind = d.qa_indicators as any;
      if (!ind) return;
      const name = ind.name;
      if (!paramCounts[name]) paramCounts[name] = { count: 0, category: ind.category };
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

  async getCriticalVsNonCritical(folderIds: string[], periodId: string, serviceType?: string, context?: SharedContext): Promise<CriticalVsNonCriticalData> {
    const supabase = await createClient();
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
    if (error || !data) return { critical: 0, nonCritical: 0, total: 0 };

    let critical = 0;
    let nonCritical = 0;
    data.forEach(d => {
      const ind = d.qa_indicators as any;
      if (ind?.category === 'critical') critical += 1;
      else nonCritical += 1;
    });

    return { critical, nonCritical, total: critical + nonCritical };
  },


  async getPersonalTrendWithParameters(agentId: string, timeframe: '3m' | '6m' | 'all' = '3m', serviceType?: string) {
    const supabase = await createClient();
    const periodQuery = supabase.from('qa_periods').select('*').order('year', { ascending: false }).order('month', { ascending: false });
    const limitMap = { '3m': 3, '6m': 6, 'all': 12 };
    const { data: periods } = await periodQuery.limit(limitMap[timeframe]);
    if (!periods) return { labels: [], datasets: [] };

    const sortedPeriods = [...periods].reverse();
    const pIds = sortedPeriods.map(p => p.id);
    const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'];
    const labels = sortedPeriods.map(p => `${MONTHS_SHORT[p.month - 1]} ${String(p.year).slice(-2)}`);

    let temuanQuery = supabase
      .from('qa_temuan')
      .select('nilai, ketidaksesuaian, sebaiknya, period_id, qa_indicators(name)')
      .eq('peserta_id', agentId)
      .in('period_id', pIds);
    if (serviceType) temuanQuery = temuanQuery.eq('service_type', serviceType);
    const { data: temuanRaw } = await temuanQuery;

    if (!temuanRaw) return { labels, datasets: [] };

    // Filter "Concerns": Score < 3 OR Score 3 with notes
    const temuan = temuanRaw.filter((t: any) => t.nilai < 3 || t.ketidaksesuaian || t.sebaiknya);

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
      .sort((a, b) => b.total - a.total).slice(0, 5).map(p => p.name);

    const datasets = [
      { label: 'Total Temuan', data: sortedPeriods.map(p => totalByPeriod[p.id] || 0), isTotal: true },
      ...topParams.map(name => ({ label: name, data: sortedPeriods.map(p => counts[name][p.id] || 0), isTotal: false }))
    ];

    return { labels, datasets };
  },

  async getAgentExportData(agentId: string) {
    const supabase = await createClient();
    const { agent, temuan } = await this.getAgentWithTemuan(agentId);
    if (!agent) throw new Error('Agent not found');

    const { data: indicators } = await supabase.from('qa_indicators').select('*');
    const allIndicators = (indicators || []) as QAIndicator[];

    const periodsMap = new Map<string, any[]>();
    temuan.forEach(t => {
      if (!t.qa_periods) return;
      const pk = `${t.qa_periods.year}-${String(t.qa_periods.month).padStart(2, '0')}`;
      if (!periodsMap.has(pk)) periodsMap.set(pk, []);
      periodsMap.get(pk)!.push({ ...t, service_type: t.service_type || t.qa_indicators?.service_type });
    });

    const periods = [...periodsMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([pk, pTemuan]) => {
        const p = pTemuan[0].qa_periods;
        const teamInds = allIndicators.filter(i => i.service_type === pTemuan[0]?.service_type);
        const scoreResult = calculateQAScoreFromTemuan(
          teamInds,
          pTemuan.map(t => ({ indicator_id: t.indicator_id, nilai: t.nilai, no_tiket: t.no_tiket }))
        );

        return {
          month: p.month,
          year: p.year,
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
    const { data } = await supabase
      .from('qa_temuan')
      .select('peserta_id')
      .in('period_id', pIds)
      .lt('nilai', 3);
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
    const { data } = await supabase
      .from('qa_temuan')
      .select('no_tiket')
      .in('period_id', pIds)
      .lt('nilai', 3);
    if (!data) return 0;
    return new Set(data.map(d => d.no_tiket)).size;
  }
};
