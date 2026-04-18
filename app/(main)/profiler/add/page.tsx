import React from 'react';
import { Metadata } from 'next';
import { profilerServiceServer } from '../services/profilerService.server';
import ProfilerAddClient from './components/ProfilerAddClient';
import { requirePageAccess } from '@/app/lib/authz';

export const metadata: Metadata = {
  title: 'Tambah Peserta | Trainers SuperApp',
  description: 'Tambah peserta baru ke database profiler.',
};

export default async function ProfilerAddPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const batchName = typeof params.batch === 'string' ? params.batch : 'Batch 1';

  await requirePageAccess({
    allowedRoles: ['trainer', 'admin']
  });

  // Fetch initial tim list
  const timList = await profilerServiceServer.getTimList();

  return (
    <ProfilerAddClient 
      batchName={batchName} 
      initialTimList={timList}
    />
  );
}
