import React from 'react';
import { Metadata } from 'next';
import { profilerServiceServer } from '../services/profilerService.server';
import ProfilerAnalyticsClient from './components/ProfilerAnalyticsClient';

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

  // Fetch structure always
  const [years, folders] = await Promise.all([
    profilerServiceServer.getYears(),
    profilerServiceServer.getFolders()
  ]);

  // If batchName is provided, fetch participants
  let peserta = [];
  if (batchName) {
    peserta = await profilerServiceServer.getByBatch(batchName);
  } else if (folders.length > 0) {
    // Default to first folder if none selected? 
    // Or just let client handle "no batch selected" state.
    // The original code had initialBatch = searchParams.get('batch') || '';
    // Let's stick to that.
  }

  return (
    <ProfilerAnalyticsClient
      initialPeserta={peserta}
      initialYears={years}
      initialFolders={folders}
      batchName={batchName}
    />
  );
}
