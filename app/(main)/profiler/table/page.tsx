import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { profilerServiceServer } from '../services/profilerService.server';
import ProfilerTableClient from './components/ProfilerTableClientLoader';
import { requirePageAccess } from '@/app/lib/authz';

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

  // Fetch all data in parallel
  const [peserta, folders, years, timList] = await Promise.all([
    profilerServiceServer.getByBatch(batchName),
    profilerServiceServer.getFolders(),
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
