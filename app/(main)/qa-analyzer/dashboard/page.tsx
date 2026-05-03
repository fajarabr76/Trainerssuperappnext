import QaDashboardClient from './QaDashboardClientLoader';
import { qaServiceServer } from '../services/qaService.server';
import { profilerServiceServer } from '../../profiler/services/profilerService.server';
import { DashboardData, EXCLUDED_FOLDERS } from '../lib/qa-types';
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

  const isLeader = leaderAccess.participantIds !== null;
  const participantIds = leaderAccess.participantIds;

  // Leader with approved access but no valid participants: show empty state
  if (isLeader && participantIds && participantIds.length === 0) {
    try {
      const [periodsData, foldersData, availableYearsData] = await Promise.all([
        qaServiceServer.getPeriods(),
        profilerServiceServer.getFolders(),
        qaServiceServer.getAvailableYears()
      ]);

      const scopedEmptyData: DashboardData = {
        periods: periodsData,
        availableYears: availableYearsData,
        currentYear: yearParam,
        folders: foldersData
          .map((f: ProfilerFolder) => ({
            id: f.name,
            name: f.name
          }))
          .filter((f) => !EXCLUDED_FOLDERS.some(ef => ef.toLowerCase() === f.name.toLowerCase())),
        ...getEmptyDashboardData()
      };

      return (
        <QaDashboardClient
          user={user}
          role={role}
          profile={profile}
          initialData={scopedEmptyData}
          filters={filters}
          leaderLockedService={null}
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

  // Leader with participants: compute dominant service and scoped dashboard
  if (isLeader && participantIds && participantIds.length > 0) {
    try {
      const dominantService = await qaServiceServer.computeDominantService(
        participantIds,
        yearParam,
        startMonth,
        endMonth
      );

      // No dominant service = empty dashboard (fail-closed, no fallback)
      if (!dominantService) {
        const [periodsData, foldersData, availableYearsData] = await Promise.all([
          qaServiceServer.getPeriods(),
          profilerServiceServer.getFolders(null, participantIds),
          qaServiceServer.getAvailableYears()
        ]);

        const scopedEmptyData: DashboardData = {
          periods: periodsData,
          availableYears: availableYearsData,
          currentYear: yearParam,
          folders: foldersData
            .map((f: ProfilerFolder) => ({
              id: f.name,
              name: f.name
            }))
            .filter((f) => !EXCLUDED_FOLDERS.some(ef => ef.toLowerCase() === f.name.toLowerCase())),
          ...getEmptyDashboardData()
        };

        return (
          <QaDashboardClient
            user={user}
            role={role}
            profile={profile}
            initialData={scopedEmptyData}
            filters={filters}
            leaderLockedService={null}
          />
        );
      }

      // For leaders: folder selection limited to folders containing allowed participants
      const foldersData = await profilerServiceServer.getFolders(null, participantIds);
      const periodsData = await qaServiceServer.getPeriods();
      const availableYearsData = await qaServiceServer.getAvailableYears();
      const indicatorsResult = await qaServiceServer.getIndicators(dominantService);

      const context = {
        periods: periodsData,
        indicators: indicatorsResult
      };

      // Force service to dominant service for leaders
      service = dominantService;

      // Leader folder IDs: respect selected folder, constrain to allowed participants
      const allowedFolderNames = foldersData.map((f: ProfilerFolder) => f.name);
      const leaderFolderIds = folder === 'ALL'
        ? allowedFolderNames
        : [folder].filter(f => allowedFolderNames.includes(f));

      const [periodData, trendData] = await Promise.all([
        qaServiceServer.getConsolidatedDashboardDataByRange(
          dominantService,
          leaderFolderIds,
          context,
          yearParam,
          startMonth,
          endMonth,
          participantIds
        ),
        qaServiceServer.getConsolidatedTrendDataByRange(
          dominantService,
          leaderFolderIds,
          context,
          yearParam,
          startMonth,
          endMonth,
          participantIds
        )
      ]);

      if (!periodData || !trendData) {
        return (
          <div className="p-8 text-center text-red-500">
            Terjadi kendala saat memproses data dashboard. Silakan coba lagi.
          </div>
        );
      }

      // Filter serviceData to only show the dominant service for leaders
      const leaderServiceData = (periodData.serviceData || []).filter(
        (s: { serviceType: string }) => s.serviceType === dominantService
      );

      const leaderTopAgents = (periodData.topAgents || []).filter(
        (a: { agentId: string }) => participantIds.includes(a.agentId)
      );

      const initialData = {
        periods: periodsData,
        availableYears: availableYearsData,
        currentYear: yearParam,
        folders: foldersData
          .map((f: ProfilerFolder) => ({
            id: f.name,
            name: f.name
          }))
          .filter((f) => !EXCLUDED_FOLDERS.some(ef => ef.toLowerCase() === f.name.toLowerCase())),
        summary: periodData.summary,
        serviceData: leaderServiceData,
        topAgents: leaderTopAgents,
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
          filters={{ ...filters, service: dominantService }}
          leaderLockedService={dominantService}
        />
      );
    } catch (error) {
      console.error('Error loading leader scoped QA dashboard data:', error);
      return (
        <div className="p-8 text-center text-red-500">
          Terjadi kendala saat memproses data dashboard. Silakan coba lagi.
        </div>
      );
    }
  }

  // Admin/trainer: full access (participantIds is null)
  const folderIds = folder === 'ALL' ? [] : [folder];

  let periods;
  let foldersData;
  let availableYears;
  let periodData;
  let trendData;
  try {
    const indicatorsResult = await qaServiceServer.getIndicators(service);

    [periods, foldersData, availableYears] = await Promise.all([
      qaServiceServer.getPeriods(),
      profilerServiceServer.getFolders(),
      qaServiceServer.getAvailableYears()
    ]);

    const context = {
      periods,
      indicators: indicatorsResult
    };

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