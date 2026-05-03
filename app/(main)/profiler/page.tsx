import React from 'react';
import { profilerServiceServer } from './services/profilerService.server';
import ProfilerLandingClient from './components/ProfilerLandingClient';
import { requirePageAccess } from '@/app/lib/authz';
import { getCurrentUserContext } from '@/app/lib/authz';
import { getAllowedParticipantIdsForLeader } from '@/app/lib/access-control/leaderAccess.server';
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
      const participantAccess = await getAllowedParticipantIdsForLeader(user.id, 'ktp', role);
      if (!participantAccess.hasAccess) {
        return (
          <div className="max-w-2xl mx-auto py-12 px-4">
            <LeaderAccessStatus
              status={participantAccess.status}
              module="ktp"
              moduleLabel="KTP / Profiler"
            />
          </div>
        );
      }
      const participantIds = participantAccess.participantIds;
      if (participantIds && participantIds.length === 0) {
        return (
          <div className="max-w-2xl mx-auto py-12 px-4">
            <div className="text-center py-8">
              <p className="text-gray-500 text-lg">Akses Anda sudah disetujui, namun belum ada peserta yang tersedia pada daftar akses Anda.</p>
            </div>
          </div>
        );
      }
      const [years, folders, countMap] = await Promise.all([
        profilerServiceServer.getYears(),
        profilerServiceServer.getFolders(null, participantIds),
        profilerServiceServer.getFolderCounts(null, participantIds),
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
