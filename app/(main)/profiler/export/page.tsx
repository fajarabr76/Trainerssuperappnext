import React from 'react';
import { Metadata } from 'next';
import { profilerServiceServer } from '../services/profilerService.server';
import ProfilerExportClient from './components/ProfilerExportClient';

export const metadata: Metadata = {
  title: 'Download Profiler | Trainers SuperApp',
  description: 'Download data peserta dalam berbagai format (Excel, CSV, PPTX, PDF).',
};

export default async function ProfilerExportPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const batchName = typeof params.batch === 'string' ? params.batch : '';

  // Always fetch years and folders
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
    <ProfilerExportClient
      initialPeserta={peserta}
      initialYears={years}
      initialFolders={folders}
      batchName={batchName}
    />
  );
}
