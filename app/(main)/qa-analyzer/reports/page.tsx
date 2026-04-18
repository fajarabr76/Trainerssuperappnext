import { createClient } from '@/app/lib/supabase/server';
import { redirect } from 'next/navigation';
import nextDynamic from 'next/dynamic';
import { getReportAiModelOptions } from './lib/report-models';
import { qaServiceServer } from '../services/qaService.server';
import { EXCLUDED_FOLDERS } from '../lib/qa-types';

const ReportMakerClient = nextDynamic(() => import('./ReportMakerClient'), {
  loading: () => (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm font-medium text-muted-foreground">Memuat Report Maker...</p>
      </div>
    </div>
  )
});

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export default async function ReportMakerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/?auth=login');
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();

  const role = profile?.role || 'trainer';
  const allowedRoles = ['trainer', 'trainers', 'admin'];
  if (!allowedRoles.includes(role)) {
    redirect('/dashboard');
  }

  const models = getReportAiModelOptions();

  const [agentsRaw, folderRows, availableYears] = await Promise.all([
    qaServiceServer.getAgentListWithScores(),
    supabase.from('profiler_folders').select('name').order('created_at', { ascending: true }),
    qaServiceServer.getAvailableYears(),
  ]);

  const agents = (agentsRaw ?? []).map((a: { id: string; nama: string; batch_name?: string | null }) => ({
    id: a.id,
    nama: a.nama,
    batch_name: a.batch_name,
  }));

  const folders = (folderRows.data ?? [])
    .map((f) => ({ id: f.name, name: f.name }))
    .filter((f) => !EXCLUDED_FOLDERS.some((ef) => ef.toLowerCase() === f.name.toLowerCase()));

  const years =
    availableYears.length > 0 ? availableYears : [new Date().getFullYear()];

  return (
    <ReportMakerClient
      role={role}
      models={models}
      agents={agents}
      folders={folders}
      availableYears={years}
    />
  );
}
