import React from 'react';
import { Metadata } from 'next';
import { profilerServiceServer } from '../services/profilerService.server';
import ProfilerSlidesClient from './components/ProfilerSlidesClient';
import { requirePageAccess } from '@/app/lib/authz';

export const metadata: Metadata = {
  title: 'Tampilan Slide | Trainers SuperApp',
  description: 'Tampilan slide profil peserta untuk presentasi.',
};

export default async function ProfilerSlidesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const batchName = typeof params.batch === 'string' ? params.batch : '';

  const { role } = await requirePageAccess({
    allowedRoles: ['trainer', 'leader', 'admin']
  });

  // Always fetch years and folders for transition
  const [years, folders] = await Promise.all([
    profilerServiceServer.getYears(),
    profilerServiceServer.getFolders()
  ]);

  // Fetch participants if batchName is present
  let peserta = [];
  if (batchName) {
    peserta = await profilerServiceServer.getByBatch(batchName);
  }

  return (
    <ProfilerSlidesClient
      initialPeserta={peserta}
      initialYears={years}
      initialFolders={folders}
      batchName={batchName}
      role={role}
    />
  );
}
