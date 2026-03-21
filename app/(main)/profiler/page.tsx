import React from 'react';
import { profilerServiceServer } from './services/profilerService.server';
import ProfilerLandingClient from './components/ProfilerLandingClient';
import { ProfilerYear, ProfilerFolder } from './services/profilerService';

export const dynamic = 'force-dynamic';

export default async function ProfilerIndex() {
  // Fetch initial data on server
  const years = await profilerServiceServer.getYears();
  const folders = await profilerServiceServer.getFolders();
  
  // Load counts and participants for each folder
  // Replicating original logic where all folder data is pre-loaded
  const batchNames = folders.map(f => f.name);
  const results = await Promise.all(
    batchNames.map(batch => profilerServiceServer.getByBatch(batch))
  );

  const countMap: Record<string, number> = {};
  const pMap: Record<string, any[]> = {};
  
  batchNames.forEach((batch, i) => {
    countMap[batch] = results[i].length;
    pMap[batch] = results[i];
  });

  return (
    <ProfilerLandingClient 
      initialYears={years}
      initialFolders={folders}
      initialCounts={countMap}
      initialPesertaMap={pMap}
    />
  );
}
