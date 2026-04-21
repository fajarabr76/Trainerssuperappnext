import { requirePageAccess } from '@/app/lib/authz';
import { qaServiceServer } from '../../services/qaService.server';
import { EXCLUDED_FOLDERS } from '../../lib/qa-types';
import DataReportClient from './DataReportClient';

export const dynamic = 'force-dynamic';

export default async function DataReportPage() {
  const { role } = await requirePageAccess({
    allowedRoles: ['trainer', 'admin']
  });

  const [agentsRaw, foldersData, availableYears, allIndicators] = await Promise.all([
    qaServiceServer.getAgentListWithScores(),
    qaServiceServer.getFolders(),
    qaServiceServer.getAvailableYears(),
    qaServiceServer.getIndicators(),
  ]);

  const agents = (agentsRaw ?? []).map((a: { id: string; nama: string; batch_name?: string | null }) => ({
    id: a.id,
    nama: a.nama,
    batch_name: a.batch_name,
  }));

  const folders = (foldersData ?? [])
    .map((f) => ({ id: f, name: f }))
    .filter((f) => !EXCLUDED_FOLDERS.some((ef) => ef.toLowerCase() === f.name.toLowerCase()));

  const years = availableYears.length > 0 ? availableYears : [new Date().getFullYear()];
  const currentMonth = new Date().getMonth() + 1;

  return (
    <DataReportClient
      role={role}
      agents={agents}
      folders={folders}
      availableYears={years}
      currentMonth={currentMonth}
      allIndicators={allIndicators}
    />
  );
}
