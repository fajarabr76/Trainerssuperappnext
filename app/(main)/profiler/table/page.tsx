import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { profilerServiceServer } from '../services/profilerService.server';
import ProfilerTableClient from './components/ProfilerTableClientLoader';
import { requirePageAccess, getCurrentUserContext } from '@/app/lib/authz';
import { getLeaderAccessStatus } from '@/app/lib/access-control/leaderAccess.server';
import LeaderAccessStatus from '@/app/components/access/LeaderAccessStatus';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Profiler Table | Trainers SuperApp',
  description: 'Kelola database peserta profiler dengan mudah.',
};

export default async function ProfilerTablePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const batchName = typeof params.batch === 'string' ? params.batch : '';

  if (!batchName) {
    redirect('/profiler');
  }

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

  // Fetch all data in parallel
  const [peserta, folders, years, timList] = await Promise.all([
    profilerServiceServer.getByBatch(batchName, scope),
    profilerServiceServer.getFolders(scope),
    profilerServiceServer.getYears(),
    profilerServiceServer.getTimList(),
  ]);

  return (
    <ProfilerTableClient
      initialPeserta={peserta}
      initialFolders={folders}
      initialYears={years}
      initialTimList={timList}
      batchName={batchName}
      role={role}
    />
  );
}
