import { describe, expect, it } from 'vitest';

import { calculateQAScoreFromTemuan } from '../../app/(main)/qa-analyzer/lib/qa-types';
import {
  buildAgentAuditCollections,
  buildPartitionedAuditRows,
  buildServiceComparisonData,
  buildTopAgentRanking,
  deriveAgentPeriodSummaries,
  deriveDashboardSummary,
  deriveTrendSummary,
} from '../../app/(main)/qa-analyzer/services/sidakAggregation';
import {
  sidakHarnessExpected,
  sidakHarnessIndicators,
  sidakHarnessPeriods,
  sidakHarnessRows,
  sidakHarnessWeight,
  type HarnessRow,
} from './fixtures/cleanSession.fixture';

function buildHarnessPartitions(rows: HarnessRow[]) {
  return buildPartitionedAuditRows(
    rows,
    (row) => `${row.peserta_id}:${row.period_id}:${row.service_type}`
  );
}

function toScoringRow(row: HarnessRow) {
  return {
    indicator_id: row.indicator_id,
    nilai: row.nilai,
    no_tiket: row.no_tiket,
    period_id: row.period_id,
  };
}

async function scoreRows(rows: HarnessRow[]) {
  return calculateQAScoreFromTemuan(
    sidakHarnessIndicators,
    rows.map((row) => toScoringRow(row)),
    sidakHarnessWeight
  );
}

function buildCollections(rows: HarnessRow[]) {
  const partitions = buildHarnessPartitions(rows);
  const collections = buildAgentAuditCollections(partitions.values(), {
    getAgentIdentity: (sample) => ({
      id: sample.profiler_peserta.id,
      nama: sample.profiler_peserta.nama,
      batch_name: sample.profiler_peserta.batch_name,
      tim: sample.profiler_peserta.tim,
      jabatan: sample.profiler_peserta.jabatan,
    }),
    normalizeScoreRow: (row) => row,
  });

  return { partitions, collections };
}

describe('SIDAK clean-session harness', () => {
  it('keeps phantom-only audited presence and strips phantom rows from mixed scoring/finding buckets', () => {
    const partitions = buildHarnessPartitions(sidakHarnessRows);

    const alphaPartition = partitions.get('agent-alpha:period-jan:bko');
    const gammaPartition = partitions.get('agent-gamma:period-feb:bko');

    expect(alphaPartition).toBeDefined();
    expect(alphaPartition?.auditPresenceRows).toHaveLength(sidakHarnessExpected.partition.alpha.auditPresence);
    expect(alphaPartition?.scoreRows).toHaveLength(sidakHarnessExpected.partition.alpha.scoreRows);
    expect(alphaPartition?.findingRows).toHaveLength(sidakHarnessExpected.partition.alpha.findingRows);

    expect(gammaPartition).toBeDefined();
    expect(gammaPartition?.auditPresenceRows).toHaveLength(sidakHarnessExpected.partition.gamma.auditPresence);
    expect(gammaPartition?.scoreRows).toHaveLength(sidakHarnessExpected.partition.gamma.scoreRows);
    expect(gammaPartition?.findingRows).toHaveLength(sidakHarnessExpected.partition.gamma.findingRows);
    expect(gammaPartition?.scoreRows.map((row) => row.id)).toEqual(sidakHarnessExpected.partition.gamma.scoreRowIds);
    expect(gammaPartition?.findingRows.map((row) => row.id)).toEqual(sidakHarnessExpected.partition.gamma.scoreRowIds);
  });

  it('produces period summaries that keep phantom-only months audited and mixed months non-100', async () => {
    const alphaPartitions = buildHarnessPartitions(
      sidakHarnessRows.filter((row) => row.peserta_id === 'agent-alpha')
    );
    const gammaPartitions = buildHarnessPartitions(
      sidakHarnessRows.filter((row) => row.peserta_id === 'agent-gamma')
    );

    const [alphaSummary] = await deriveAgentPeriodSummaries({
      partitions: alphaPartitions.values(),
      getPeriodIdentity: (sample) => {
        const period = sidakHarnessPeriods.find((item) => item.id === sample.period_id);
        if (!period?.label) return null;
        return {
          id: period.id,
          month: period.month,
          year: period.year,
          label: period.label,
          serviceType: sample.service_type,
        };
      },
      evaluateScore: async (partition) => scoreRows(partition.scoreRows),
    });

    const [gammaSummary] = await deriveAgentPeriodSummaries({
      partitions: gammaPartitions.values(),
      getPeriodIdentity: (sample) => {
        const period = sidakHarnessPeriods.find((item) => item.id === sample.period_id);
        if (!period?.label) return null;
        return {
          id: period.id,
          month: period.month,
          year: period.year,
          label: period.label,
          serviceType: sample.service_type,
        };
      },
      evaluateScore: async (partition) => scoreRows(partition.scoreRows),
    });

    expect(alphaSummary).toMatchObject({
      id: 'period-jan',
      label: 'Jan 26',
      ...sidakHarnessExpected.periodSummary.alphaJan,
    });
    expect(gammaSummary).toMatchObject({
      id: 'period-feb',
      label: 'Feb 26',
      ...sidakHarnessExpected.periodSummary.gammaFeb,
    });
  });

  it('derives dashboard summary, service comparison, and ranking from audited population instead of countable findings only', async () => {
    const { partitions, collections } = buildCollections(sidakHarnessRows);

    const summary = await deriveDashboardSummary({
      ...collections,
      totalFindings: 2,
      evaluateScore: async (_agent, rows) => scoreRows(rows),
    });

    const serviceData = buildServiceComparisonData(
      partitions.values(),
      (serviceType) => serviceType.toUpperCase()
    );

    const topAgents = await buildTopAgentRanking({
      ...collections,
      evaluateScore: async (_agent, rows) => scoreRows(rows),
      evaluateHasCritical: async (_agent, rows) =>
        rows.some((row) => row.nilai === 0 && row.qa_indicators.category === 'critical'),
    });

    expect(summary).toEqual(sidakHarnessExpected.dashboardSummary);
    expect(serviceData).toEqual(sidakHarnessExpected.serviceData);
    expect(
      topAgents.map(({ agentId, nama, defects, score, hasCritical }) => ({
        agentId,
        nama,
        defects,
        score,
        hasCritical,
      }))
    ).toEqual(sidakHarnessExpected.topAgents);
  });

  it('builds trend points where phantom-only periods stay audited with zero findings and mixed periods ignore phantom padding', async () => {
    const partitions = buildHarnessPartitions(sidakHarnessRows);

    const trend = await deriveTrendSummary({
      periods: sidakHarnessPeriods
        .filter((period): period is typeof period & { label: string } => Boolean(period.label))
        .map((period) => ({ id: period.id, label: period.label })),
      partitions: partitions.values(),
      getPeriodId: (partition) => partition.auditPresenceRows[0]?.period_id,
      evaluateScore: async (partition) => scoreRows(partition.scoreRows),
    });

    expect(trend).toEqual(sidakHarnessExpected.trend);
  });
});
