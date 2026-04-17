import React from 'react';
import { Metadata } from 'next';
import { createClient } from '@/app/lib/supabase/server';
import { redirect } from 'next/navigation';
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
  const allowedRoles = ['trainer', 'trainers', 'leader', 'admin'];
  if (!allowedRoles.includes(role)) {
    redirect('/dashboard');
  }

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
