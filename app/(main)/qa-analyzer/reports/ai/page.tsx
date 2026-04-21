import nextDynamic from 'next/dynamic';
import { Suspense } from 'react';
import { getReportAiModelOptions } from './lib/report-models';
import { qaServiceServer } from '../../services/qaService.server';
import { EXCLUDED_FOLDERS } from '../../lib/qa-types';
import { requirePageAccess } from '@/app/lib/authz';

const ReportMakerClient = nextDynamic(() => import('./ReportMakerClient'), {
  loading: () => <LoadingState />
});

function LoadingState() {
  return (
    <div className="flex min-h-[45vh] items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm font-medium text-muted-foreground">Memuat Report Maker...</p>
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export default async function ReportMakerPage() {
  const { role } = await requirePageAccess({
    allowedRoles: ['trainer', 'admin']
  });

  const models = getReportAiModelOptions();

  const [agentsRaw, foldersData, availableYears] = await Promise.all([
    qaServiceServer.getAgentListWithScores(),
    qaServiceServer.getFolders(),
    qaServiceServer.getAvailableYears(),
  ]);

  const agents = (agentsRaw ?? []).map((a: { id: string; nama: string; batch_name?: string | null }) => ({
    id: a.id,
    nama: a.nama,
    batch_name: a.batch_name,
  }));

  const folders = (foldersData ?? [])
    .map((f) => ({ id: f, name: f }))
    .filter((f) => !EXCLUDED_FOLDERS.some((ef) => ef.toLowerCase() === f.name.toLowerCase()));

  const years =
    availableYears.length > 0 ? availableYears : [new Date().getFullYear()];
  const currentMonth = new Date().getMonth() + 1;

  return (
    <Suspense fallback={<LoadingState />}>
      <ReportMakerClient
        role={role}
        models={models}
        agents={agents}
        folders={folders}
        availableYears={years}
        currentMonth={currentMonth}
      />
    </Suspense>
  );
}
