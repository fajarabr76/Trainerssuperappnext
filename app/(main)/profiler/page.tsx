import React from 'react';
import { profilerServiceServer } from './services/profilerService.server';
import ProfilerLandingClient from './components/ProfilerLandingClient';
import { requirePageAccess } from '@/app/lib/authz';
import { getCurrentUserContext } from '@/app/lib/authz';
import { getLeaderAccessStatus } from '@/app/lib/access-control/leaderAccess.server';
import LeaderAccessStatus from '@/app/components/access/LeaderAccessStatus';

export const dynamic = 'force-dynamic';

export default async function ProfilerIndex() {
  const { role } = await requirePageAccess({
    allowedRoles: ['trainer', 'leader', 'admin']
  });

  // Leader access check
  if (role === 'leader') {
    const { user } = await getCurrentUserContext();
    if (user) {
      const accessInfo = await getLeaderAccessStatus(user.id, 'ktp');
      if (!accessInfo.hasAccess && accessInfo.status !== 'approved') {
        return (
          <div className="max-w-2xl mx-auto py-12 px-4">
            <LeaderAccessStatus
              status={accessInfo.status}
              module="ktp"
              moduleLabel="KTP / Profiler"
            />
          </div>
        );
      }
      // Approved: scoped data
      const scope = accessInfo.scopeFilter;
      const [years, folders, countMap] = await Promise.all([
        profilerServiceServer.getYears(),
        profilerServiceServer.getFolders(scope),
        profilerServiceServer.getFolderCounts(scope),
      ]);
      return (
        <ProfilerLandingClient
          initialYears={years}
          initialFolders={folders}
          initialCounts={countMap}
          initialPesertaMap={{}}
          role={role}
        />
      );
    }
  }

  // Admin/trainer: full access
  const [years, folders, countMap] = await Promise.all([
    profilerServiceServer.getYears(),
    profilerServiceServer.getFolders(),
    profilerServiceServer.getFolderCounts()
  ]);
  
  return (
    <ProfilerLandingClient 
      initialYears={years}
      initialFolders={folders}
      initialCounts={countMap}
      initialPesertaMap={{}}
      role={role}
    />
  );
}
