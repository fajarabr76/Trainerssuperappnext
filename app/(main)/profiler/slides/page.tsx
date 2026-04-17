import React from 'react';
import { Metadata } from 'next';
import { createClient } from '@/app/lib/supabase/server';
import { redirect } from 'next/navigation';
import { profilerServiceServer } from '../services/profilerService.server';
import ProfilerSlidesClient from './components/ProfilerSlidesClient';

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
