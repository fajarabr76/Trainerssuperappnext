import React from 'react';
import { Metadata } from 'next';
import { profilerServiceServer } from '../services/profilerService.server';
import ProfilerAnalyticsClient from './components/ProfilerAnalyticsClient';
import { requirePageAccess } from '@/app/lib/authz';

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

  // Fetch structure always
  const [years, folders] = await Promise.all([
    profilerServiceServer.getYears(),
    profilerServiceServer.getFolders()
  ]);

  // If batchName is provided, fetch participants
  let peserta = [];
  if (batchName) {
    peserta = await profilerServiceServer.getByBatch(batchName);
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
