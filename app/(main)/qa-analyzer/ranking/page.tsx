import RankingAgenClient from './RankingAgenClient';
import { qaServiceServer } from '../services/qaService.server';
import { getRankingAgenAction } from '../actions';
import { SERVICE_LABELS, ServiceType, EXCLUDED_FOLDERS } from '../lib/qa-types';
import { requirePageAccess } from '@/app/lib/authz';
import { checkSidakLeaderAccess } from '../lib/leaderAccessGuard';
import LeaderAccessStatus from '@/app/components/access/LeaderAccessStatus';
import { filterRankingByLeaderScope } from '../lib/leaderScopeFilters';

export const dynamic = 'force-dynamic';

export default async function RankingAgenPage({
  searchParams,
}: {
  searchParams?: { service?: string; year?: string };
}) {
  const { role } = await requirePageAccess({
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

  // Master Data
  const [periods, foldersData, availableYears] = await Promise.all([
    qaServiceServer.getPeriods(),
    qaServiceServer.getFolders(),
    qaServiceServer.getAvailableYears()
  ]);

  let folders = foldersData
    .map((f: string) => ({
      id: f,
      name: f
    }))
    .filter((f) => !EXCLUDED_FOLDERS.some(ef => ef.toLowerCase() === f.name.toLowerCase()));

  let serviceTypes = Object.keys(SERVICE_LABELS) as ServiceType[];
  const defaultServiceType = (searchParams?.service as ServiceType) || serviceTypes[0] || 'call';
  const defaultPeriodId = 'ytd';
  const defaultYear = searchParams?.year ? parseInt(searchParams.year) : new Date().getFullYear();
  const scope = role === 'leader' ? leaderAccess.scope : null;
  const scopedFolderIds = scope ? scope.batch_names ?? [] : [];

  // Initial Ranking Data
  const { data: initialRanking } = await getRankingAgenAction(
    defaultPeriodId,
    defaultServiceType,
    scopedFolderIds,
    defaultYear
  );

  let rankingData = initialRanking || [];

  // Scope filtering for leader
  if (role === 'leader' && scope) {
    rankingData = filterRankingByLeaderScope(rankingData, scope);
    if (scope.batch_names && scope.batch_names.length > 0) {
      folders = folders.filter((f: { id: string; name: string }) => scope.batch_names!.includes(f.name));
    }
    if (scope.service_types && scope.service_types.length > 0) {
      serviceTypes = serviceTypes.filter((s: string) => scope.service_types!.includes(s));
    }
  }

  return (
    <RankingAgenClient
      initialData={rankingData}
      periods={periods}
      folders={folders}
      availableYears={availableYears}
      serviceTypes={serviceTypes}
      defaultServiceType={defaultServiceType}
      defaultPeriodId={defaultPeriodId}
      defaultYear={defaultYear}
      role={role}
    />
  );
}
