import type { QAIndicator, QAPeriod, ServiceType, ServiceWeight } from '../../../app/(main)/qa-analyzer/lib/qa-types';
import { DEFAULT_SERVICE_WEIGHTS } from '../../../app/(main)/qa-analyzer/lib/qa-types';

export type HarnessRow = {
  id: string;
  peserta_id: string;
  period_id: string;
  service_type: ServiceType;
  indicator_id: string;
  nilai: number;
  no_tiket: string | null;
  ketidaksesuaian?: string | null;
  sebaiknya?: string | null;
  is_phantom_padding?: boolean;
  qa_indicators: {
    id: string;
    name: string;
    category: 'critical' | 'non_critical';
  };
  profiler_peserta: {
    id: string;
    nama: string;
    batch_name: string;
    tim: string;
    jabatan: string;
  };
};

const serviceType: ServiceType = 'bko';

export const sidakHarnessIndicators: QAIndicator[] = [
  {
    id: 'ind-critical',
    service_type: serviceType,
    name: 'Critical Check',
    category: 'critical',
    bobot: 1,
    has_na: false,
  },
  {
    id: 'ind-noncritical',
    service_type: serviceType,
    name: 'Non Critical Check',
    category: 'non_critical',
    bobot: 1,
    has_na: false,
  },
];

export const sidakHarnessWeight: ServiceWeight = DEFAULT_SERVICE_WEIGHTS[serviceType];

export const sidakHarnessPeriods: QAPeriod[] = [
  { id: 'period-jan', month: 1, year: 2026, label: 'Jan 26' },
  { id: 'period-feb', month: 2, year: 2026, label: 'Feb 26' },
];

export const sidakHarnessRows: HarnessRow[] = [
  {
    id: 'alpha-jan-phantom',
    peserta_id: 'agent-alpha',
    period_id: 'period-jan',
    service_type: serviceType,
    indicator_id: 'ind-critical',
    nilai: 3,
    no_tiket: 'ALPHA-CLEAN',
    is_phantom_padding: true,
    qa_indicators: { id: 'ind-critical', name: 'Critical Check', category: 'critical' },
    profiler_peserta: {
      id: 'agent-alpha',
      nama: 'Alpha Phantom',
      batch_name: 'Batch A',
      tim: 'BKO',
      jabatan: 'agent',
    },
  },
  {
    id: 'beta-feb-real',
    peserta_id: 'agent-beta',
    period_id: 'period-feb',
    service_type: serviceType,
    indicator_id: 'ind-critical',
    nilai: 0,
    no_tiket: 'BETA-1',
    ketidaksesuaian: 'Critical defect',
    is_phantom_padding: false,
    qa_indicators: { id: 'ind-critical', name: 'Critical Check', category: 'critical' },
    profiler_peserta: {
      id: 'agent-beta',
      nama: 'Beta Real',
      batch_name: 'Batch B',
      tim: 'BKO',
      jabatan: 'agent',
    },
  },
  {
    id: 'gamma-feb-real',
    peserta_id: 'agent-gamma',
    period_id: 'period-feb',
    service_type: serviceType,
    indicator_id: 'ind-noncritical',
    nilai: 0,
    no_tiket: 'GAMMA-1',
    ketidaksesuaian: 'Non critical defect',
    is_phantom_padding: false,
    qa_indicators: { id: 'ind-noncritical', name: 'Non Critical Check', category: 'non_critical' },
    profiler_peserta: {
      id: 'agent-gamma',
      nama: 'Gamma Mixed',
      batch_name: 'Batch C',
      tim: 'BKO',
      jabatan: 'agent',
    },
  },
  {
    id: 'gamma-feb-phantom',
    peserta_id: 'agent-gamma',
    period_id: 'period-feb',
    service_type: serviceType,
    indicator_id: 'ind-critical',
    nilai: 3,
    no_tiket: 'GAMMA-CLEAN',
    is_phantom_padding: true,
    qa_indicators: { id: 'ind-critical', name: 'Critical Check', category: 'critical' },
    profiler_peserta: {
      id: 'agent-gamma',
      nama: 'Gamma Mixed',
      batch_name: 'Batch C',
      tim: 'BKO',
      jabatan: 'agent',
    },
  },
];

export const sidakHarnessExpected = {
  partition: {
    alpha: { auditPresence: 1, scoreRows: 1, findingRows: 0 },
    gamma: { auditPresence: 2, scoreRows: 1, findingRows: 1, scoreRowIds: ['gamma-feb-real'] },
  },
  periodSummary: {
    alphaJan: {
      finalScore: 100,
      nonCriticalScore: 100,
      criticalScore: 100,
      sessionCount: 1,
      findingsCount: 0,
    },
    gammaFeb: {
      finalScore: 90,
      nonCriticalScore: 90,
      criticalScore: 90,
      sessionCount: 1,
      findingsCount: 1,
    },
  },
  dashboardSummary: {
    totalDefects: 2,
    avgDefectsPerAudit: 0.67,
    zeroErrorRate: 33.33,
    avgAgentScore: 93.33,
    complianceRate: 33.33,
    complianceCount: 1,
    totalAgents: 3,
  },
  serviceData: [
    {
      name: 'BKO',
      serviceType,
      total: 2,
      severity: 'Low',
    },
  ],
  topAgents: [
    { agentId: 'agent-beta', nama: 'Beta Real', defects: 1, score: 90, hasCritical: true },
    { agentId: 'agent-gamma', nama: 'Gamma Mixed', defects: 1, score: 90, hasCritical: false },
    { agentId: 'agent-alpha', nama: 'Alpha Phantom', defects: 0, score: 100, hasCritical: false },
  ],
  trend: [
    { periodId: 'period-jan', label: 'Jan 26', total: 0, avg: 0, zero: 100, compliance: 1, avgAgentScore: 100, totalAudited: 1 },
    { periodId: 'period-feb', label: 'Feb 26', total: 2, avg: 1, zero: 0, compliance: 0, avgAgentScore: 90, totalAudited: 2 },
  ],
} as const;
