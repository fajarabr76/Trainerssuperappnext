import RankingAgenClient from './RankingAgenClient';
import { qaServiceServer } from '../services/qaService.server';
import { getRankingAgenAction } from '../actions';
import { SERVICE_LABELS, ServiceType, EXCLUDED_FOLDERS } from '../lib/qa-types';
import { requirePageAccess } from '@/app/lib/authz';

export const dynamic = 'force-dynamic';

export default async function RankingAgenPage({
  searchParams,
}: {
  searchParams?: { service?: string; year?: string };
}) {
  const { role } = await requirePageAccess({
    allowedRoles: ['trainer', 'leader', 'admin']
  });

  // Master Data
  const [periods, foldersData, availableYears] = await Promise.all([
    qaServiceServer.getPeriods(),
    qaServiceServer.getFolders(),
    qaServiceServer.getAvailableYears()
  ]);

  const folders = foldersData
    .map((f: string) => ({
      id: f,
      name: f
    }))
    .filter((f) => !EXCLUDED_FOLDERS.some(ef => ef.toLowerCase() === f.name.toLowerCase()));

  const serviceTypes = Object.keys(SERVICE_LABELS) as ServiceType[];
  const defaultServiceType = (searchParams?.service as ServiceType) || serviceTypes[0] || 'call';
  const defaultPeriodId = 'ytd';
  const defaultYear = searchParams?.year ? parseInt(searchParams.year) : new Date().getFullYear();

  // Initial Ranking Data
  const { data: initialRanking } = await getRankingAgenAction(
    defaultPeriodId,
    defaultServiceType,
    [],
    defaultYear
  );

  return (
    <RankingAgenClient
      initialData={initialRanking || []}
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
