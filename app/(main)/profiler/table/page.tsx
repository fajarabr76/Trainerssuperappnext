import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/app/lib/supabase/server';
import { profilerServiceServer } from '../services/profilerService.server';
import ProfilerTableClient from './components/ProfilerTableClient';

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

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/?auth=login');
  }

  // Get profile and role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const role = profile?.role || 'trainer';

  // Allowed roles for this page (including leader for read-only)
  const allowedRoles = ['trainer', 'trainers', 'leader', 'admin', 'superadmin'];
  if (!allowedRoles.includes(role)) {
    redirect('/dashboard');
  }

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
