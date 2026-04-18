import React from 'react';
import { Metadata } from 'next';
import { createClient } from '@/app/lib/supabase/server';
import { redirect } from 'next/navigation';
import dynamic from 'next/dynamic';
import { profilerServiceServer } from '../services/profilerService.server';

const ProfilerImportClient = dynamic(() => import('./components/ProfilerImportClient'), {
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

  // Fetch initial data on server
  const timList = await profilerServiceServer.getTimList();

  return (
    <ProfilerImportClient
      batchName={batchName}
      initialTimList={timList}
    />
  );
}
