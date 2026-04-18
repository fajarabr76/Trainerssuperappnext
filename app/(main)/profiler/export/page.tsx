import React, { Suspense } from 'react';
import { Metadata } from 'next';
import { createClient } from '@/app/lib/supabase/server';
import { redirect } from 'next/navigation';
import { profilerServiceServer } from '../services/profilerService.server';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const ProfilerExportClient = dynamic(() => import('./components/ProfilerExportClient'), {
  loading: () => (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <Loader2 className="w-10 h-10 animate-spin text-primary opacity-50" />
      <p className="text-muted-foreground animate-pulse font-medium">Memuat fitur ekspor data...</p>
    </div>
  ),
  ssr: false,
});

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
    <Suspense fallback={null}>
      <ProfilerExportClient
        initialPeserta={peserta}
        initialYears={years}
        initialFolders={folders}
        batchName={batchName}
      />
    </Suspense>
  );
}
