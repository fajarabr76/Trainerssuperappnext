import React from 'react';
import { profilerServiceServer } from './services/profilerService.server';
import ProfilerLandingClient from './components/ProfilerLandingClient';
import { ProfilerYear, ProfilerFolder } from './services/profilerService';

export const dynamic = 'force-dynamic';

export default async function ProfilerIndex() {
  // Fetch initial data on server
  const years = await profilerServiceServer.getYears();
  const folders = await profilerServiceServer.getFolders();
  const countMap = await profilerServiceServer.getFolderCounts();
  
  return (
    <ProfilerLandingClient 
      initialYears={years}
      initialFolders={folders}
      initialCounts={countMap}
      initialPesertaMap={{}}
    />
  );
}
