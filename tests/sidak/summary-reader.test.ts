import { describe, expect, it } from 'vitest';
import { getDashboardRangeDataFromSummary, getDashboardRangeTrendFromSummary } from '../../app/(main)/qa-analyzer/services/summaryReader.server';

function createMockSupabase(opts: {
  periods: any[];
  period_summary: any[];
  indicator_summary: any[];
  agent_summary: any[];
}) {
  return {
    from: (table: string) => {
      let serviceTypeFilter: string | null = null;
      const chain: any = {
        data: null as any,
        error: null as any,
        select: (_cols: string) => chain,
        eq: (col: string, val: any) => {
          if (table === 'qa_dashboard_period_summary' && col === 'service_type') {
            serviceTypeFilter = val;
          }
          return chain;
        },
        in: (_col: string, _vals: any[]) => chain,
        gte: (_col: string, _val: any) => chain,
        lte: (_col: string, _val: any) => chain,
        order: (_col: string, _opts?: any) => chain,
        // Allow awaiting the chain
        then: (resolve: any) => {
          if (table === 'qa_periods') {
            resolve({ data: opts.periods, error: null });
          } else if (table === 'qa_dashboard_period_summary') {
            if (serviceTypeFilter) {
              resolve({ data: opts.period_summary.filter((r: any) => r.service_type === serviceTypeFilter), error: null });
            } else {
              resolve({ data: opts.period_summary, error: null });
            }
          } else if (table === 'qa_dashboard_indicator_period_summary') {
            resolve({ data: opts.indicator_summary, error: null });
          } else if (table === 'qa_dashboard_agent_period_summary') {
            resolve({ data: opts.agent_summary, error: null });
          } else {
            resolve({ data: null, error: null });
          }
        },
      };
      return chain;
    },
  } as any;
}

describe('Summary Reader', () => {
  it('returns null when folder filter is active', async () => {
    const supabase = createMockSupabase({ periods: [], period_summary: [], indicator_summary: [], agent_summary: [] });
    const result = await getDashboardRangeDataFromSummary(supabase, 'call', 2026, 1, 3, ['FolderA']);
    expect(result).toBeNull();
  });

  it('returns null when summary data is incomplete for the range', async () => {
    // 3 periods but only 2 summary rows
    const supabase = createMockSupabase({
      periods: [
        { id: 'p1', month: 1, year: 2026 },
        { id: 'p2', month: 2, year: 2026 },
        { id: 'p3', month: 3, year: 2026 },
      ],
      period_summary: [
        { period_id: 'p1', service_type: 'call', folder_key: '__ALL__', total_agents: 5, total_defects: 10, zero_error_count: 1, avg_agent_score: 90, compliance_count: 3, critical_count: 2, non_critical_count: 8 },
        { period_id: 'p2', service_type: 'call', folder_key: '__ALL__', total_agents: 4, total_defects: 8, zero_error_count: 0, avg_agent_score: 88, compliance_count: 2, critical_count: 1, non_critical_count: 7 },
      ],
      indicator_summary: [],
      agent_summary: [],
    });
    const result = await getDashboardRangeDataFromSummary(supabase, 'call', 2026, 1, 3, []);
    expect(result).toBeNull();
  });

  it('aggregates period summaries correctly for global scope', async () => {
    const supabase = createMockSupabase({
      periods: [
        { id: 'p1', month: 1, year: 2026 },
        { id: 'p2', month: 2, year: 2026 },
      ],
      period_summary: [
        { period_id: 'p1', service_type: 'call', folder_key: '__ALL__', total_agents: 10, total_defects: 20, zero_error_count: 2, avg_agent_score: 92, compliance_count: 5, critical_count: 3, non_critical_count: 17 },
        { period_id: 'p2', service_type: 'call', folder_key: '__ALL__', total_agents: 8, total_defects: 12, zero_error_count: 1, avg_agent_score: 94, compliance_count: 4, critical_count: 2, non_critical_count: 10 },
        { period_id: 'p1', service_type: 'chat', folder_key: '__ALL__', total_agents: 5, total_defects: 5, zero_error_count: 0, avg_agent_score: 85, compliance_count: 1, critical_count: 1, non_critical_count: 4 },
        { period_id: 'p2', service_type: 'chat', folder_key: '__ALL__', total_agents: 6, total_defects: 3, zero_error_count: 1, avg_agent_score: 88, compliance_count: 2, critical_count: 0, non_critical_count: 3 },
      ],
      indicator_summary: [
        { period_id: 'p1', service_type: 'call', folder_key: '__ALL__', indicator_name: 'ParamA', indicator_category: 'critical', total_defects: 5 },
        { period_id: 'p1', service_type: 'call', folder_key: '__ALL__', indicator_name: 'ParamB', indicator_category: 'non_critical', total_defects: 15 },
        { period_id: 'p2', service_type: 'call', folder_key: '__ALL__', indicator_name: 'ParamA', indicator_category: 'critical', total_defects: 3 },
        { period_id: 'p2', service_type: 'call', folder_key: '__ALL__', indicator_name: 'ParamB', indicator_category: 'non_critical', total_defects: 9 },
      ],
      agent_summary: [
        { period_id: 'p1', peserta_id: 'a1', nama: 'Agent1', batch_name: 'B1', tim: 'T1', jabatan: 'J1', defects: 5, session_scores: [80, 90], score: 85, has_critical: true },
        { period_id: 'p2', peserta_id: 'a1', nama: 'Agent1', batch_name: 'B1', tim: 'T1', jabatan: 'J1', defects: 3, session_scores: [95], score: 95, has_critical: false },
        { period_id: 'p1', peserta_id: 'a2', nama: 'Agent2', batch_name: 'B2', tim: 'T2', jabatan: 'J2', defects: 8, session_scores: [70], score: 70, has_critical: true },
      ],
    });

    const result = await getDashboardRangeDataFromSummary(supabase, 'call', 2026, 1, 3, []);
    expect(result).not.toBeNull();
    expect(result!.summary).toEqual({
      totalDefects: 32,
      avgDefectsPerAudit: 1.78,
      zeroErrorRate: 16.67,
      avgAgentScore: 92.89,
      complianceRate: 50,
      complianceCount: 9,
      totalAgents: 18,
    });
    expect(result!.donutData).toEqual({ critical: 5, nonCritical: 27, total: 32 });
    expect(result!.paretoData).toHaveLength(2);
    expect(result!.paretoData[0].name).toBe('ParamB');
    expect(result!.paretoData[0].count).toBe(24);
    expect(result!.paretoData[1].name).toBe('ParamA');
    expect(result!.paretoData[1].count).toBe(8);
    expect(result!.serviceData).toHaveLength(2);
    expect(result!.topAgents).toHaveLength(2);
    // Both a1 and a2 have 8 defects; sorted by nama asc => Agent1 first
    expect(result!.topAgents[0].agentId).toBe('a1');
    expect(result!.topAgents[0].defects).toBe(8);
    expect(result!.topAgents[0].score).toBe(93); // (80+90+95+100+100)/5 = 93
    expect(result!.topAgents[1].agentId).toBe('a2');
    expect(result!.topAgents[1].defects).toBe(8);
  });

  it('builds trend from period summaries', async () => {
    const supabase = createMockSupabase({
      periods: [
        { id: 'p1', month: 1, year: 2026 },
        { id: 'p2', month: 2, year: 2026 },
      ],
      period_summary: [
        { period_id: 'p1', service_type: 'call', folder_key: '__ALL__', total_agents: 10, total_defects: 20, zero_error_count: 2, avg_agent_score: 92, compliance_count: 5, critical_count: 3, non_critical_count: 17 },
        { period_id: 'p2', service_type: 'call', folder_key: '__ALL__', total_agents: 8, total_defects: 12, zero_error_count: 1, avg_agent_score: 94, compliance_count: 4, critical_count: 2, non_critical_count: 10 },
      ],
      indicator_summary: [
        { period_id: 'p1', service_type: 'call', folder_key: '__ALL__', indicator_name: 'ParamA', total_defects: 5 },
        { period_id: 'p2', service_type: 'call', folder_key: '__ALL__', indicator_name: 'ParamA', total_defects: 3 },
        { period_id: 'p1', service_type: 'call', folder_key: '__ALL__', indicator_name: 'ParamB', total_defects: 15 },
        { period_id: 'p2', service_type: 'call', folder_key: '__ALL__', indicator_name: 'ParamB', total_defects: 9 },
      ],
      agent_summary: [],
    });

    const result = await getDashboardRangeTrendFromSummary(supabase, 'call', 2026, 1, 3, []);
    expect(result).not.toBeNull();
    expect(result!.sparklines.total).toHaveLength(2);
    expect(result!.sparklines.total[0].value).toBe(20);
    expect(result!.sparklines.total[1].value).toBe(12);
    expect(result!.paramTrend.datasets[0].label).toBe('Total Temuan');
    expect(result!.paramTrend.datasets[0].data).toEqual([20, 12]);
  });
});
