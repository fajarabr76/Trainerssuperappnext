import React from 'react';
import { Metadata } from 'next';
import { profilerServiceServer } from '../services/profilerService.server';
import ProfilerAnalyticsClient from './components/ProfilerAnalyticsClientLoader';
import { requirePageAccess, getCurrentUserContext } from '@/app/lib/authz';
import { getLeaderAccessStatus } from '@/app/lib/access-control/leaderAccess.server';
import LeaderAccessStatus from '@/app/components/access/LeaderAccessStatus';

export const metadata: Metadata = {
  title: 'Statistik Peserta | Trainers SuperApp',
  description: 'Analisis dan statistik distribusi peserta profiler.',
};

export default async function ProfilerAnalyticsPage({
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

  // Fetch structure always
  const [years, folders] = await Promise.all([
    profilerServiceServer.getYears(),
    profilerServiceServer.getFolders(scope)
  ]);

  // If batchName is provided, fetch participants
  let peserta = [];
  if (batchName) {
    peserta = await profilerServiceServer.getByBatch(batchName, scope);
  }

  return (
    <ProfilerAnalyticsClient
      initialPeserta={peserta}
      initialYears={years}
      initialFolders={folders}
      batchName={batchName}
      role={role}
    />
  );
}
