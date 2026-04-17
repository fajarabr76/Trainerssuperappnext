import React from 'react';
import { Metadata } from 'next';
import { createClient } from '@/app/lib/supabase/server';
import { redirect } from 'next/navigation';
import { profilerServiceServer } from '../services/profilerService.server';
import ProfilerAddClient from './components/ProfilerAddClient';

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

  // Allowed roles for this page (EXCLUDING leader)
  const allowedRoles = ['trainer', 'trainers', 'admin'];
  if (!allowedRoles.includes(role)) {
    redirect('/dashboard');
  }

  // Fetch initial tim list
  const timList = await profilerServiceServer.getTimList();

  return (
    <ProfilerAddClient 
      batchName={batchName} 
      initialTimList={timList}
    />
  );
}
