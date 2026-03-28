import React from 'react';
import { profilerServiceServer } from './services/profilerService.server';
import ProfilerLandingClient from './components/ProfilerLandingClient';
import { ProfilerYear, ProfilerFolder } from './services/profilerService';

export const dynamic = 'force-dynamic';

export default async function ProfilerIndex() {
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
    />
  );
}
