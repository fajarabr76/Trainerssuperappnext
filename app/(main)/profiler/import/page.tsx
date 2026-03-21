import React from 'react';
import { Metadata } from 'next';
import { profilerServiceServer } from '../services/profilerService.server';
import ProfilerImportClient from './components/ProfilerImportClient';

export const metadata: Metadata = {
  title: 'Import Profiler | Trainers SuperApp',
  description: 'Import data peserta dari file Excel.',
};

export default async function ProfilerImportPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const batchName = typeof params.batch === 'string' ? params.batch : '';

  // Fetch initial data on server
  const timList = await profilerServiceServer.getTimList();

  return (
    <ProfilerImportClient
      batchName={batchName}
      initialTimList={timList}
    />
  );
}
