import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('SIDAK dashboard range query construction', () => {
  const qaServiceSource = readFileSync(
    'app/(main)/qa-analyzer/services/qaService.server.ts',
    'utf8'
  );

  it('getConsolidatedDashboardDataByRange applies service_type filter at DB level when serviceType is not all', () => {
    // Extract the function body for getConsolidatedDashboardDataByRange
    const fnMatch = qaServiceSource.match(
      /async getConsolidatedDashboardDataByRange\([\s\S]*?^\s{2}\},?\s*$/m
    );
    const fnBody = fnMatch?.[0] ?? '';

    expect(fnBody).toContain("if (serviceType !== 'all') query = query.eq('service_type', serviceType)");
  });

  it('getConsolidatedDashboardDataByRange does not hardcode service_type=all filter', () => {
    const fnMatch = qaServiceSource.match(
      /async getConsolidatedDashboardDataByRange\([\s\S]*?^\s{2}\},?\s*$/m
    );
    const fnBody = fnMatch?.[0] ?? '';

    // Must NOT contain an unconditional .eq('service_type', 'all')
    expect(fnBody).not.toContain(".eq('service_type', 'all')");
  });

  it('getConsolidatedTrendDataByRange also applies service_type filter at DB level', () => {
    const fnMatch = qaServiceSource.match(
      /async getConsolidatedTrendDataByRange\([\s\S]*?^\s{2}\},?\s*$/m
    );
    const fnBody = fnMatch?.[0] ?? '';

    expect(fnBody).toContain(".eq('service_type', serviceType)");
  });

  it('getConsolidatedDashboardDataByRange preserves existing period, folder, and participant filters', () => {
    const fnMatch = qaServiceSource.match(
      /async getConsolidatedDashboardDataByRange\([\s\S]*?^\s{2}\},?\s*$/m
    );
    const fnBody = fnMatch?.[0] ?? '';

    expect(fnBody).toContain(".in('period_id', pIds)");
    expect(fnBody).toContain(".in('profiler_peserta.batch_name', folderIds)");
    expect(fnBody).toContain(".in('peserta_id', allowedParticipantIds)");
    expect(fnBody).toContain(".range(from, from + PAGE_SIZE - 1)");
    expect(fnBody).toContain(".order('id', { ascending: true })");
  });
});
