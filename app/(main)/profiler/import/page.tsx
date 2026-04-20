import React from 'react';
import { Metadata } from 'next';
import nextDynamic from 'next/dynamic';
import { profilerServiceServer } from '../services/profilerService.server';
import { requirePageAccess } from '@/app/lib/authz';

export const dynamic = 'force-dynamic';

const ProfilerImportClient = nextDynamic(() => import('./components/ProfilerImportClient'), {
  loading: () => (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm font-medium text-muted-foreground">Memuat alat impor...</p>
      </div>
    </div>
  )
});

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

  await requirePageAccess({
    allowedRoles: ['trainer', 'admin']
  });

  // Fetch initial data on server
  const timList = await profilerServiceServer.getTimList();

  return (
    <ProfilerImportClient
      batchName={batchName}
      initialTimList={timList}
    />
  );
}
