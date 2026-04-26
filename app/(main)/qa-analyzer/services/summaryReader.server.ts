import { SupabaseClient } from '@supabase/supabase-js';
import {
  DashboardSummary,
  ParetoData,
  ServiceComparisonData,
  TopAgentData,
  CriticalVsNonCriticalData,
  TrendPoint,
} from '../lib/qa-types';

const SERVICE_LABELS: Record<string, string> = {
  call: 'Layanan Call',
  chat: 'Layanan Chat',
  email: 'Layanan Email',
  cso: 'Layanan CSO',
  pencatatan: 'Pencatatan',
  bko: 'BKO',
  slik: 'SLIK',
};

function severityFromTotal(total: number): string {
  if (total > 50) return 'Critical';
  if (total > 30) return 'High';
  if (total > 15) return 'Medium';
  return 'Low';
}

function formatPeriodLabel(month: number, year: number) {
  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'];
  return `${months[month - 1]} ${String(year).slice(-2)}`;
}

export async function getDashboardRangeDataFromSummary(
  supabase: SupabaseClient,
  serviceType: string,
  year: number,
  startMonth: number,
  endMonth: number,
  folderIds: string[]
): Promise<{
  summary: DashboardSummary;
  paretoData: ParetoData[];
  serviceData: ServiceComparisonData[];
  donutData: CriticalVsNonCriticalData;
  topAgents: TopAgentData[];
} | null> {
  // V1 summary only supports global scope (__ALL__). If folder filter is active, skip summary.
  if (folderIds.length > 0) return null;

  const { data: periods, error: periodErr } = await supabase
    .from('qa_periods')
    .select('id, month, year')
    .eq('year', year)
    .gte('month', startMonth)
    .lte('month', endMonth)
    .order('month', { ascending: true });

  if (periodErr || !periods || periods.length === 0) return null;

  const periodIds = periods.map(p => p.id);

  // Check if ALL periods have summary data for this service_type
  const { data: summaryRows, error: summaryErr } = await supabase
    .from('qa_dashboard_period_summary')
    .select('*')
    .in('period_id', periodIds)
    .eq('service_type', serviceType)
    .eq('folder_key', '__ALL__');

  if (summaryErr || !summaryRows || summaryRows.length !== periodIds.length) return null;

  // Fetch indicator summaries for ALL service types (needed for serviceData)
  const { data: allPeriodSummaries, error: allServiceErr } = await supabase
    .from('qa_dashboard_period_summary')
    .select('service_type, total_defects')
    .in('period_id', periodIds)
    .eq('folder_key', '__ALL__');

  if (allServiceErr) return null;

  // Validate: every service_type present in summary must have coverage for ALL periods.
  // Otherwise serviceData would be partial/stale.
  const serviceTypeSet = new Set<string>();
  const serviceTypePeriodCount = new Map<string, number>();
  for (const row of (allPeriodSummaries || [])) {
    serviceTypeSet.add(row.service_type);
    serviceTypePeriodCount.set(row.service_type, (serviceTypePeriodCount.get(row.service_type) || 0) + 1);
  }
  for (const count of serviceTypePeriodCount.values()) {
    if (count !== periodIds.length) return null;
  }

  // Fetch indicator summaries for pareto
  const { data: indicatorRows, error: indicatorErr } = await supabase
    .from('qa_dashboard_indicator_period_summary')
    .select('indicator_name, indicator_category, total_defects')
    .in('period_id', periodIds)
    .eq('service_type', serviceType)
    .eq('folder_key', '__ALL__');

  if (indicatorErr) return null;

  // Fetch agent summaries for top agents
  const { data: agentRows, error: agentErr } = await supabase
    .from('qa_dashboard_agent_period_summary')
    .select('peserta_id, nama, batch_name, tim, jabatan, defects, session_scores, score, has_critical')
    .in('period_id', periodIds)
    .eq('service_type', serviceType)
    .eq('folder_key', '__ALL__');

  if (agentErr) return null;

  // Aggregate summary across periods
  let totalAgents = 0;
  let totalDefects = 0;
  let zeroErrorCount = 0;
  let totalAgentScore = 0.0;
  let complianceCount = 0;
  let criticalCount = 0;
  let nonCriticalCount = 0;

  for (const row of summaryRows) {
    totalAgents += row.total_agents;
    totalDefects += row.total_defects;
    zeroErrorCount += row.zero_error_count;
    totalAgentScore += row.avg_agent_score * row.total_agents;
    complianceCount += row.compliance_count;
    criticalCount += row.critical_count;
    nonCriticalCount += row.non_critical_count;
  }

  const avgDefectsPerAudit = totalDefects / Math.max(totalAgents, 1);
  const zeroErrorRate = (zeroErrorCount / Math.max(totalAgents, 1)) * 100.0;
  const avgAgentScore = totalAgentScore / Math.max(totalAgents, 1);
  const complianceRate = (complianceCount / Math.max(totalAgents, 1)) * 100.0;

  const summary: DashboardSummary = {
    totalDefects,
    avgDefectsPerAudit: Math.round(avgDefectsPerAudit * 100) / 100,
    zeroErrorRate: Math.round(zeroErrorRate * 100) / 100,
    avgAgentScore: Math.round(avgAgentScore * 100) / 100,
    complianceRate: Math.round(complianceRate * 100) / 100,
    complianceCount,
    totalAgents,
  };

  // Pareto: sum defects per indicator across periods
  const indicatorMap = new Map<string, { name: string; category: string; count: number }>();
  for (const row of (indicatorRows || [])) {
    const key = row.indicator_name;
    const existing = indicatorMap.get(key);
    if (existing) {
      existing.count += row.total_defects;
    } else {
      indicatorMap.set(key, {
        name: row.indicator_name,
        category: row.indicator_category,
        count: row.total_defects,
      });
    }
  }

  const paretoList = Array.from(indicatorMap.values())
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  let runningTotal = 0;
  const overallTotal = paretoList.reduce((s, i) => s + i.count, 0);
  const paretoData: ParetoData[] = paretoList.map(item => {
    runningTotal += item.count;
    return {
      name: item.name,
      fullName: item.name,
      count: item.count,
      cumulative: Math.round((runningTotal / Math.max(overallTotal, 1)) * 1000) / 10,
      category: (item.category === 'critical' ? 'critical' : 'non_critical') as 'critical' | 'non_critical',
    };
  });

  // Service data: sum defects per service_type across periods
  const serviceMap = new Map<string, number>();
  for (const row of (allPeriodSummaries || [])) {
    serviceMap.set(row.service_type, (serviceMap.get(row.service_type) || 0) + (row.total_defects || 0));
  }

  const serviceData: ServiceComparisonData[] = Array.from(serviceMap.entries()).map(([st, total]) => ({
    name: SERVICE_LABELS[st] || st,
    serviceType: st,
    total,
    severity: severityFromTotal(total) as 'Critical' | 'High' | 'Medium' | 'Low',
  }));

  const donutData: CriticalVsNonCriticalData = {
    critical: criticalCount,
    nonCritical: nonCriticalCount,
    total: criticalCount + nonCriticalCount,
  };

  // Top agents: merge multi-period session scores
  const agentMap = new Map<string, {
    agentId: string;
    nama: string;
    batch: string;
    tim: string;
    jabatan: string;
    defects: number;
    hasCritical: boolean;
    allSessionScores: number[];
  }>();

  for (const row of (agentRows || [])) {
    const existing = agentMap.get(row.peserta_id);
    const sessionScores = (row.session_scores || []).map((s: number) => s);
    if (existing) {
      existing.defects += row.defects;
      existing.hasCritical = existing.hasCritical || row.has_critical;
      existing.allSessionScores.push(...sessionScores);
    } else {
      agentMap.set(row.peserta_id, {
        agentId: row.peserta_id,
        nama: row.nama,
        batch: row.batch_name,
        tim: row.tim,
        jabatan: row.jabatan,
        defects: row.defects,
        hasCritical: row.has_critical,
        allSessionScores: sessionScores,
      });
    }
  }

  const topAgents: TopAgentData[] = Array.from(agentMap.values())
    .map(agent => {
      const sorted = [...agent.allSessionScores].sort((a, b) => a - b).slice(0, 5);
      while (sorted.length < 5) sorted.push(100);
      const score = sorted.reduce((s, v) => s + v, 0) / 5;
      return {
        agentId: agent.agentId,
        nama: agent.nama,
        batch: agent.batch,
        tim: agent.tim,
        jabatan: agent.jabatan,
        defects: agent.defects,
        score: Math.round(score * 100) / 100,
        hasCritical: agent.hasCritical,
      };
    })
    .sort((a, b) => b.defects - a.defects || a.nama.localeCompare(b.nama))
    .slice(0, 5);

  return { summary, paretoData, serviceData, donutData, topAgents };
}

export async function getDashboardRangeTrendFromSummary(
  supabase: SupabaseClient,
  serviceType: string,
  year: number,
  startMonth: number,
  endMonth: number,
  folderIds: string[]
): Promise<{
  sparklines: Record<string, TrendPoint[]>;
  paramTrend: { labels: string[]; datasets: Array<{ label: string; data: number[]; isTotal: boolean }> };
} | null> {
  if (folderIds.length > 0) return null;

  const { data: periods, error: periodErr } = await supabase
    .from('qa_periods')
    .select('id, month, year')
    .eq('year', year)
    .gte('month', startMonth)
    .lte('month', endMonth)
    .order('month', { ascending: true });

  if (periodErr || !periods || periods.length === 0) return null;

  const periodIds = periods.map(p => p.id);

  const { data: summaryRows, error: summaryErr } = await supabase
    .from('qa_dashboard_period_summary')
    .select('*')
    .in('period_id', periodIds)
    .eq('service_type', serviceType)
    .eq('folder_key', '__ALL__');

  if (summaryErr || !summaryRows || summaryRows.length !== periodIds.length) return null;

  const { data: indicatorRows, error: indicatorErr } = await supabase
    .from('qa_dashboard_indicator_period_summary')
    .select('indicator_name, period_id, total_defects')
    .in('period_id', periodIds)
    .eq('service_type', serviceType)
    .eq('folder_key', '__ALL__');

  if (indicatorErr) return null;

  const summaryByPeriod = new Map<string, typeof summaryRows[0]>();
  for (const row of summaryRows) summaryByPeriod.set(row.period_id, row);

  const labels: string[] = [];
  const totalSpark: TrendPoint[] = [];
  const avgSpark: TrendPoint[] = [];
  const zeroSpark: TrendPoint[] = [];
  const complianceSpark: TrendPoint[] = [];
  const avgScoreSpark: TrendPoint[] = [];

  for (const period of periods) {
    const label = formatPeriodLabel(period.month, period.year);
    labels.push(label);
    const row = summaryByPeriod.get(period.id);
    if (!row) return null;

    totalSpark.push({ label, value: row.total_defects });
    avgSpark.push({
      label,
      value: Math.round((row.total_defects / Math.max(row.total_agents, 1)) * 10) / 10,
    });
    zeroSpark.push({
      label,
      value: Math.round((row.zero_error_count / Math.max(row.total_agents, 1)) * 1000) / 10,
    });
    complianceSpark.push({ label, value: row.compliance_count });
    avgScoreSpark.push({
      label,
      value: Math.round(row.avg_agent_score * 10) / 10,
    });
  }

  // Param trend: aggregate top 10 indicators across periods
  const indicatorByPeriod = new Map<string, Map<string, number>>();
  for (const row of (indicatorRows || [])) {
    let periodMap = indicatorByPeriod.get(row.period_id);
    if (!periodMap) {
      periodMap = new Map();
      indicatorByPeriod.set(row.period_id, periodMap);
    }
    periodMap.set(row.indicator_name, (periodMap.get(row.indicator_name) || 0) + row.total_defects);
  }

  const indicatorTotals = new Map<string, number>();
  for (const [_periodId, pmap] of indicatorByPeriod) {
    for (const [name, count] of pmap) {
      indicatorTotals.set(name, (indicatorTotals.get(name) || 0) + count);
    }
  }

  const topIndicators = Array.from(indicatorTotals.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10)
    .map(([name]) => name);

  const totalData: number[] = [];
  for (const period of periods) {
    let periodTotal = 0;
    const pmap = indicatorByPeriod.get(period.id);
    if (pmap) {
      for (const count of pmap.values()) periodTotal += count;
    }
    totalData.push(periodTotal);
  }

  const datasets: Array<{ label: string; data: number[]; isTotal: boolean }> = [
    { label: 'Total Temuan', data: totalData, isTotal: true },
  ];

  for (const indName of topIndicators) {
    const data: number[] = [];
    for (const period of periods) {
      const pmap = indicatorByPeriod.get(period.id);
      data.push(pmap?.get(indName) || 0);
    }
    datasets.push({ label: indName, data, isTotal: false });
  }

  return {
    sparklines: {
      total: totalSpark,
      avg: avgSpark,
      zero: zeroSpark,
      compliance: complianceSpark,
      avgAgentScore: avgScoreSpark,
    },
    paramTrend: { labels, datasets },
  };
}
