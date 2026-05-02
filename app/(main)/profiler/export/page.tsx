import React, { Suspense } from 'react';
import { Metadata } from 'next';
import { profilerServiceServer } from '../services/profilerService.server';
import nextDynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import { requirePageAccess, getCurrentUserContext } from '@/app/lib/authz';
import { getLeaderAccessStatus } from '@/app/lib/access-control/leaderAccess.server';
import LeaderAccessStatus from '@/app/components/access/LeaderAccessStatus';

export const dynamic = 'force-dynamic';

const ProfilerExportClient = nextDynamic(() => import('./components/ProfilerExportClient'), {
  loading: () => (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <Loader2 className="w-10 h-10 animate-spin text-primary opacity-50" />
      <p className="text-muted-foreground animate-pulse font-medium">Memuat fitur ekspor data...</p>
    </div>
  ),
});

export const metadata: Metadata = {
  title: 'Download Profiler | Trainers SuperApp',
  description: 'Download data peserta dalam berbagai format (Excel, CSV, PPTX, PDF).',
};

export default async function ProfilerExportPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const batchName = typeof params.batch === 'string' ? params.batch : '';

  const { role } = await requirePageAccess({
    allowedRoles: ['trainer', 'leader', 'admin']
  });

  let scope = undefined;
  if (role === 'leader') {
    const { user } = await getCurrentUserContext();
    if (user) {
      const accessInfo = await getLeaderAccessStatus(user.id, 'ktp');
      if (!accessInfo.hasAccess && accessInfo.status !== 'approved') {
        return (
          <div className="max-w-2xl mx-auto py-12 px-4">
            <LeaderAccessStatus status={accessInfo.status} module="ktp" moduleLabel="KTP / Profiler" />
          </div>
        );
      }
      scope = accessInfo.scopeFilter;
    }
  }

  // Always fetch years and folders
  const [years, folders] = await Promise.all([
    profilerServiceServer.getYears(),
    profilerServiceServer.getFolders(scope)
  ]);

  // Fetch participants if batchName is present
  let peserta = [];
  if (batchName) {
    peserta = await profilerServiceServer.getByBatch(batchName, scope);
  }

  return (
    <Suspense fallback={null}>
      <ProfilerExportClient
        initialPeserta={peserta}
        initialYears={years}
        initialFolders={folders}
        batchName={batchName}
      />
    </Suspense>
  );
}
