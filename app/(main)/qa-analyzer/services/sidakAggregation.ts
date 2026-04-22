import type {
  AgentPeriodSummary,
  DashboardSummary,
  ServiceComparisonData,
  ServiceType,
  TopAgentData,
} from '../lib/qa-types';

export type CountableFindingLike = {
  nilai?: number | null;
  ketidaksesuaian?: string | null;
  sebaiknya?: string | null;
};

export type PhantomFindingLike = {
  is_phantom_padding?: boolean | null;
};

export type AuditRowPartition<T> = {
  auditPresenceRows: T[];
  scoreRows: T[];
  findingRows: T[];
};

export type AuditedAgentIdentity = {
  id: string;
  nama: string;
  batch_name: string | null;
  tim: string | null;
  jabatan: string | null;
};

export type AgentAuditCollections<T> = {
  auditedAgents: AuditedAgentIdentity[];
  agentScoreRowsMap: Record<string, T[]>;
  agentFindingRowsMap: Record<string, T[]>;
};

export type TrendSummaryPoint = {
  periodId: string;
  label: string;
  total: number;
  avg: number;
  zero: number;
  compliance: number;
  avgAgentScore: number;
  totalAudited: number;
};

type ServiceSeverity = 'Critical' | 'High' | 'Medium' | 'Low';

type ScoreLike = {
  finalScore: number;
};

type PeriodIdentity = {
  id: string;
  month: number;
  year: number;
  label: string;
  serviceType: ServiceType;
};

function roundTo(value: number, digits: number): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(digits));
}

function getServiceSeverity(defects: number): ServiceSeverity {
  if (defects > 50) return 'Critical';
  if (defects > 30) return 'High';
  if (defects > 15) return 'Medium';
  return 'Low';
}

function hasMeaningfulNote(value: string | null | undefined) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isCountableFinding<T extends CountableFindingLike>(item: T | null | undefined): item is T {
  if (!item) return false;
  return Number(item.nilai ?? 3) < 3 || hasMeaningfulNote(item.ketidaksesuaian) || hasMeaningfulNote(item.sebaiknya);
}

export function filterCountableFindings<T extends CountableFindingLike>(items: T[]): T[] {
  return items.filter((item): item is T => isCountableFinding(item));
}

export function countCountableFindings<T extends CountableFindingLike>(items: T[]): number {
  return filterCountableFindings(items).length;
}

export function filterRealAuditRows<T extends PhantomFindingLike>(items: T[]): T[] {
  return items.filter((item): item is T => item.is_phantom_padding !== true);
}

export function partitionAuditRows<T extends PhantomFindingLike & CountableFindingLike>(items: T[]): AuditRowPartition<T> {
  const auditPresenceRows = [...items];
  const realRows = filterRealAuditRows(auditPresenceRows);

  return {
    auditPresenceRows,
    scoreRows: realRows.length > 0 ? realRows : auditPresenceRows,
    findingRows: filterCountableFindings(realRows),
  };
}

export function buildPartitionedAuditRows<T extends PhantomFindingLike & CountableFindingLike>(
  items: T[],
  getKey: (item: T) => string | null | undefined
): Map<string, AuditRowPartition<T>> {
  const grouped = new Map<string, T[]>();

  items.forEach((item) => {
    const key = getKey(item);
    if (!key) return;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(item);
  });

  return new Map(
    [...grouped.entries()].map(([key, group]) => [key, partitionAuditRows(group)])
  );
}

export function collectPartitionRows<T>(
  partitions: Iterable<AuditRowPartition<T>>,
  bucket: keyof AuditRowPartition<T>
): T[] {
  const rows: T[] = [];

  for (const partition of partitions) {
    rows.push(...partition[bucket]);
  }

  return rows;
}

export function buildAgentAuditCollections<T, TNormalized>(
  partitions: Iterable<AuditRowPartition<T>>,
  options: {
    getAgentIdentity: (sample: T) => AuditedAgentIdentity | null;
    normalizeScoreRow: (row: T) => TNormalized;
    normalizeFindingRow?: (row: T) => TNormalized;
  }
): AgentAuditCollections<TNormalized> {
  const agentScoreRowsMap: Record<string, TNormalized[]> = {};
  const agentFindingRowsMap: Record<string, TNormalized[]> = {};
  const auditedAgents: AuditedAgentIdentity[] = [];
  const seenAgents = new Set<string>();
  const normalizeFindingRow = options.normalizeFindingRow ?? options.normalizeScoreRow;

  for (const partition of partitions) {
    const sample = partition.auditPresenceRows[0];
    if (!sample) continue;

    const agent = options.getAgentIdentity(sample);
    if (!agent?.id) continue;

    if (!agentScoreRowsMap[agent.id]) agentScoreRowsMap[agent.id] = [];
    if (!agentFindingRowsMap[agent.id]) agentFindingRowsMap[agent.id] = [];

    agentScoreRowsMap[agent.id].push(...partition.scoreRows.map((row) => options.normalizeScoreRow(row)));
    agentFindingRowsMap[agent.id].push(...partition.findingRows.map((row) => normalizeFindingRow(row)));

    if (!seenAgents.has(agent.id)) {
      seenAgents.add(agent.id);
      auditedAgents.push(agent);
    }
  }

  return {
    auditedAgents,
    agentScoreRowsMap,
    agentFindingRowsMap,
  };
}

export async function deriveDashboardSummary<T>(params: {
  auditedAgents: AuditedAgentIdentity[];
  agentScoreRowsMap: Record<string, T[]>;
  agentFindingRowsMap: Record<string, T[]>;
  totalFindings: number;
  evaluateScore: (agent: AuditedAgentIdentity, scoreRows: T[]) => Promise<ScoreLike>;
  complianceThreshold?: number;
}): Promise<DashboardSummary> {
  const complianceThreshold = params.complianceThreshold ?? 95;
  const totalAgents = params.auditedAgents.length;

  if (totalAgents === 0) {
    return {
      totalDefects: params.totalFindings,
      avgDefectsPerAudit: 0,
      zeroErrorRate: 0,
      avgAgentScore: 0,
      complianceRate: 0,
      complianceCount: 0,
      totalAgents: 0,
    };
  }

  const scoredAgents = await Promise.all(
    params.auditedAgents.map(async (agent) => {
      const findingRows = params.agentFindingRowsMap[agent.id] || [];
      const scoreRows = params.agentScoreRowsMap[agent.id] || [];
      const score = await params.evaluateScore(agent, scoreRows);
      return {
        score,
        hasDefect: findingRows.length > 0,
      };
    })
  );

  const agentsWithZeroError = scoredAgents.filter(({ hasDefect }) => !hasDefect).length;
  const complianceCount = scoredAgents.filter(({ score }) => score.finalScore >= complianceThreshold).length;
  const totalScore = scoredAgents.reduce((sum, item) => sum + item.score.finalScore, 0);

  return {
    totalDefects: params.totalFindings,
    avgDefectsPerAudit: roundTo(params.totalFindings / totalAgents, 2),
    zeroErrorRate: roundTo((agentsWithZeroError / totalAgents) * 100, 2),
    avgAgentScore: roundTo(totalScore / totalAgents, 2),
    complianceRate: roundTo((complianceCount / totalAgents) * 100, 2),
    complianceCount,
    totalAgents,
  };
}

export function buildServiceComparisonData<T extends { service_type?: string | null }>(
  partitions: Iterable<AuditRowPartition<T>>,
  getServiceLabel: (serviceType: string) => string
): ServiceComparisonData[] {
  const serviceCounts: Record<string, number> = {};

  for (const partition of partitions) {
    const serviceType = partition.auditPresenceRows[0]?.service_type || 'unknown';
    serviceCounts[serviceType] = (serviceCounts[serviceType] || 0) + partition.findingRows.length;
  }

  return Object.entries(serviceCounts)
    .map(([serviceType, total]) => ({
      name: getServiceLabel(serviceType),
      serviceType,
      total,
      severity: getServiceSeverity(total),
    }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

export async function buildTopAgentRanking<T>(params: {
  auditedAgents: AuditedAgentIdentity[];
  agentScoreRowsMap: Record<string, T[]>;
  agentFindingRowsMap: Record<string, T[]>;
  evaluateScore: (agent: AuditedAgentIdentity, scoreRows: T[]) => Promise<ScoreLike>;
  evaluateHasCritical: (agent: AuditedAgentIdentity, findingRows: T[]) => Promise<boolean>;
  excludeAgent?: (agent: AuditedAgentIdentity) => boolean;
  limit?: number;
}): Promise<TopAgentData[]> {
  const ranked = await Promise.all(
    params.auditedAgents.map(async (agent) => {
      const scoreRows = params.agentScoreRowsMap[agent.id] || [];
      const findingRows = params.agentFindingRowsMap[agent.id] || [];

      return {
        agentId: agent.id,
        nama: agent.nama,
        batch: agent.batch_name || '',
        tim: agent.tim || '',
        jabatan: agent.jabatan || '',
        defects: findingRows.length,
        score: roundTo((await params.evaluateScore(agent, scoreRows)).finalScore, 2),
        hasCritical: await params.evaluateHasCritical(agent, findingRows),
      };
    })
  );

  return ranked
    .filter((agent) => !(params.excludeAgent?.({
      id: agent.agentId,
      nama: agent.nama,
      batch_name: agent.batch || null,
      tim: agent.tim || null,
      jabatan: agent.jabatan || null,
    }) ?? false))
    .sort((a, b) => b.defects - a.defects || a.nama.localeCompare(b.nama))
    .slice(0, params.limit ?? ranked.length);
}

export async function deriveTrendSummary<T>(params: {
  periods: Array<{ id: string; label: string }>;
  partitions: Iterable<AuditRowPartition<T>>;
  getPeriodId: (partition: AuditRowPartition<T>) => string | null | undefined;
  evaluateScore: (partition: AuditRowPartition<T>, periodId: string) => Promise<ScoreLike>;
  complianceThreshold?: number;
}): Promise<TrendSummaryPoint[]> {
  const complianceThreshold = params.complianceThreshold ?? 95;
  const allPartitions = [...params.partitions];

  return Promise.all(
    params.periods.map(async (period) => {
      const scopedPartitions = allPartitions.filter(
        (partition) => params.getPeriodId(partition) === period.id
      );
      const totalAudited = scopedPartitions.length;
      const totalFindings = collectPartitionRows(scopedPartitions, 'findingRows').length;

      if (totalAudited === 0) {
        return {
          periodId: period.id,
          label: period.label,
          total: 0,
          avg: 0,
          zero: 0,
          compliance: 0,
          avgAgentScore: 0,
          totalAudited: 0,
        };
      }

      const scored = await Promise.all(
        scopedPartitions.map(async (partition) => ({
          findingCount: partition.findingRows.length,
          score: await params.evaluateScore(partition, period.id),
        }))
      );

      const zeroCount = scored.filter(({ findingCount }) => findingCount === 0).length;
      const complianceCount = scored.filter(({ score }) => score.finalScore >= complianceThreshold).length;
      const totalScore = scored.reduce((sum, item) => sum + item.score.finalScore, 0);

      return {
        periodId: period.id,
        label: period.label,
        total: totalFindings,
        avg: roundTo(totalFindings / totalAudited, 1),
        zero: roundTo((zeroCount / totalAudited) * 100, 1),
        compliance: complianceCount,
        avgAgentScore: roundTo(totalScore / totalAudited, 1),
        totalAudited,
      };
    })
  );
}

export async function deriveAgentPeriodSummaries<T>(params: {
  partitions: Iterable<AuditRowPartition<T>>;
  getPeriodIdentity: (sample: T) => PeriodIdentity | null;
  evaluateScore: (
    partition: AuditRowPartition<T>,
    period: PeriodIdentity
  ) => Promise<{
    finalScore: number;
    nonCriticalScore: number;
    criticalScore: number;
    sessionCount: number;
  } | null>;
}): Promise<AgentPeriodSummary[]> {
  const summaries = await Promise.all(
    [...params.partitions].map(async (partition) => {
      const sample = partition.auditPresenceRows[0];
      if (!sample) return null;

      const period = params.getPeriodIdentity(sample);
      if (!period) return null;

      const score = await params.evaluateScore(partition, period);
      if (!score) return null;

      return {
        id: period.id,
        month: period.month,
        year: period.year,
        label: period.label,
        serviceType: period.serviceType,
        finalScore: score.finalScore,
        nonCriticalScore: score.nonCriticalScore,
        criticalScore: score.criticalScore,
        sessionCount: score.sessionCount,
        findingsCount: partition.findingRows.length,
      } satisfies AgentPeriodSummary;
    })
  );

  return summaries
    .filter((summary): summary is AgentPeriodSummary => summary !== null)
    .sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      if (a.month !== b.month) return b.month - a.month;
      return b.serviceType.localeCompare(a.serviceType);
    });
}
