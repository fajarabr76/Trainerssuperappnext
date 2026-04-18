import React from 'react';
import { profilerServiceServer } from './services/profilerService.server';
import ProfilerLandingClient from './components/ProfilerLandingClient';
import { requirePageAccess } from '@/app/lib/authz';

export const dynamic = 'force-dynamic';

export default async function ProfilerIndex() {
  const { role } = await requirePageAccess({
    allowedRoles: ['trainer', 'leader', 'admin']
  });

  // Fetch initial data in parallel on server
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
