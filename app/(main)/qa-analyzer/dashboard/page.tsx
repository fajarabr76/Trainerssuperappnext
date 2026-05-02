import QaDashboardClient from './QaDashboardClientLoader';
import { qaServiceServer } from '../services/qaService.server';
import { profilerServiceServer } from '../../profiler/services/profilerService.server';
import { DashboardData, EXCLUDED_FOLDERS } from '../lib/qa-types';
import type { LeaderScopeFilter } from '@/app/lib/access-control/leaderScope';
import { ProfilerFolder } from '../../profiler/lib/profiler-types';
import { requirePageAccess } from '@/app/lib/authz';
import { checkSidakLeaderAccess } from '../lib/leaderAccessGuard';
import LeaderAccessStatus from '@/app/components/access/LeaderAccessStatus';

export const dynamic = 'force-dynamic';

const emptyDashboardData = {
  summary: {
    totalDefects: 0,
    avgDefectsPerAudit: 0,
    zeroErrorRate: 0,
    avgAgentScore: 0,
    complianceRate: 0,
    complianceCount: 0,
    totalAgents: 0,
  },
  serviceData: [],
  topAgents: [],
  paretoData: [],
  donutData: {
    critical: 0,
    nonCritical: 0,
    total: 0,
  },
  paramTrend: {
    labels: [],
    datasets: [],
  },
  sparklines: {},
};

function hasUnsupportedDashboardScope(scope?: LeaderScopeFilter | null): boolean {
  if (!scope) return false;
  const hasBatchScope = Boolean(scope.batch_names?.length);
  const hasServiceScope = Boolean(scope.service_types?.length);
  const hasUnsupportedAgentScope = Boolean(scope.peserta_ids?.length || scope.tims?.length);
  return hasUnsupportedAgentScope || (!hasBatchScope && !hasServiceScope);
}

function getEmptyDashboardData() {
  return emptyDashboardData;
}

export default async function QaDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = await searchParams;
  const { user, profile, role } = await requirePageAccess({
    allowedRoles: ['trainer', 'leader', 'admin']
  });

  // Leader access check
  const leaderAccess = await checkSidakLeaderAccess();
  if (leaderAccess.blocked) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <LeaderAccessStatus status={leaderAccess.status} module="sidak" moduleLabel="SIDAK / QA Analyzer" />
      </div>
    );
  }

  // Parse filters from resolvedParams
  const folder = typeof resolvedParams.folder === 'string' ? resolvedParams.folder : 'ALL';
  let service = typeof resolvedParams.service === 'string' ? resolvedParams.service : 'call';
  const yearParam = typeof resolvedParams.year === 'string' ? parseInt(resolvedParams.year) : new Date().getFullYear();

  const startMonth = typeof resolvedParams.start_month === 'string' ? parseInt(resolvedParams.start_month) : 1;
  const endMonth = typeof resolvedParams.end_month === 'string' ? parseInt(resolvedParams.end_month) : (new Date().getMonth() + 1);

  const filters = {
    startMonth,
    endMonth,
    folder,
    service,
    year: yearParam
  };

  // For leader with approved scope: apply scope constraints
  let folderIds = folder === 'ALL' ? [] : [folder];
  if (leaderAccess.scope) {
    if (leaderAccess.scope.batch_names && leaderAccess.scope.batch_names.length > 0) {
      folderIds = leaderAccess.scope.batch_names;
    }
    // Constrain service to allowed types in scope
    if (leaderAccess.scope.service_types && leaderAccess.scope.service_types.length > 0) {
      if (!leaderAccess.scope.service_types.includes(service)) {
        service = leaderAccess.scope.service_types[0];
      }
    }
  }

  if (leaderAccess.scope && hasUnsupportedDashboardScope(leaderAccess.scope)) {
    try {
      const [periodsData, foldersData, availableYearsData] = await Promise.all([
        qaServiceServer.getPeriods(),
        profilerServiceServer.getFolders(),
        qaServiceServer.getAvailableYears()
      ]);

      const allowedFolderNames = new Set(
        leaderAccess.scope.batch_names?.length
          ? leaderAccess.scope.batch_names
          : []
      );

      const scopedEmptyData: DashboardData = {
        periods: periodsData,
        availableYears: availableYearsData,
        currentYear: yearParam,
        folders: foldersData
          .map((f: ProfilerFolder) => ({
            id: f.name,
            name: f.name
          }))
          .filter((f) => !EXCLUDED_FOLDERS.some(ef => ef.toLowerCase() === f.name.toLowerCase()))
          .filter((f) => allowedFolderNames.size === 0 || allowedFolderNames.has(f.name)),
        ...getEmptyDashboardData()
      };

      return (
        <QaDashboardClient
          user={user}
          role={role}
          profile={profile}
          initialData={scopedEmptyData}
          filters={filters}
        />
      );
    } catch (error) {
      console.error('Error loading scoped empty QA dashboard metadata:', error);
      return (
        <div className="p-8 text-center text-red-500">
          Terjadi kendala saat memproses data dashboard. Silakan coba lagi.
        </div>
      );
    }
  }

  let periods;
  let foldersData;
  let availableYears;
  let periodData;
  let trendData;
  try {
    const indicatorsResult = await qaServiceServer.getIndicators(service);

    // 1. Fetch Shared Context Data (Pre-load common metadata)
    [periods, foldersData, availableYears] = await Promise.all([
      qaServiceServer.getPeriods(),
      profilerServiceServer.getFolders(),
      qaServiceServer.getAvailableYears()
    ]);

    const context = {
      periods,
      indicators: indicatorsResult
    };

    // 2. Fetch Dashboard Aggregations using Consolidated Fetchers
    [periodData, trendData] = await Promise.all([
      qaServiceServer.getDashboardRangeData(service, folderIds, context, yearParam, startMonth, endMonth),
      qaServiceServer.getDashboardRangeTrendData(service, folderIds, context, yearParam, startMonth, endMonth)
    ]);
  } catch (error) {
    console.error('Error loading QA dashboard server data:', error);
  }

  if (!periods || !foldersData || !availableYears || !periodData || !trendData) {
    return (
      <div className="p-8 text-center text-red-500">
        Terjadi kendala saat memproses data dashboard. Silakan coba lagi.
      </div>
    );
  }

  const initialData = {
    periods,
    availableYears,
    currentYear: yearParam,
    folders: foldersData
      .map((f: ProfilerFolder) => ({
        id: f.name,
        name: f.name
      }))
      .filter((f) => !EXCLUDED_FOLDERS.some(ef => ef.toLowerCase() === f.name.toLowerCase())),
    summary: periodData.summary,
    serviceData: periodData.serviceData,
    topAgents: periodData.topAgents,
    paretoData: periodData.paretoData,
    donutData: periodData.donutData,
    paramTrend: trendData.paramTrend,
    sparklines: trendData.sparklines
  };

  return (
    <QaDashboardClient
      user={user}
      role={role}
      profile={profile}
      initialData={initialData}
      filters={filters}
    />
  );
}
