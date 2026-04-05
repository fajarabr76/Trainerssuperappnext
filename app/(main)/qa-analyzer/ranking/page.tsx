import { createClient } from '@/app/lib/supabase/server';
import { redirect } from 'next/navigation';
import RankingAgenClient from './RankingAgenClient';
import { qaServiceServer } from '../services/qaService.server';
import { profilerServiceServer } from '../../profiler/services/profilerService.server';
import { getRankingAgenAction } from '../actions';
import { SERVICE_LABELS, ServiceType, EXCLUDED_FOLDERS } from '../lib/qa-types';

export const dynamic = 'force-dynamic';

export default async function RankingAgenPage({
  searchParams,
}: {
  searchParams?: { service?: string; year?: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/?auth=login');
  }

  // Get user role for consistency with existing module guards
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const role = profile?.role || '';
  const allowedRoles = ['trainer', 'trainers', 'leader', 'admin', 'superadmin'];
  if (!allowedRoles.includes(role)) {
    redirect('/dashboard');
  }

  // Master Data
  const [periods, foldersData, availableYears] = await Promise.all([
    qaServiceServer.getPeriods(),
    profilerServiceServer.getFolders(),
    qaServiceServer.getAvailableYears()
  ]);

  const folders = foldersData
    .map((f: any) => ({
      id: typeof f === 'string' ? f : f.name,
      name: typeof f === 'string' ? f : f.name
    }))
    .filter((f: any) => !EXCLUDED_FOLDERS.some(ef => ef.toLowerCase() === f.name.toLowerCase()));

  const serviceTypes = Object.keys(SERVICE_LABELS) as ServiceType[];
  const defaultServiceType = (searchParams?.service as ServiceType) || serviceTypes[0] || 'call';
  const defaultPeriodId = 'ytd';
  const defaultYear = searchParams?.year ? parseInt(searchParams.year) : new Date().getFullYear();

  // Initial Ranking Data
  const { data: initialRanking } = await getRankingAgenAction(
    defaultPeriodId,
    defaultServiceType,
    [],
    defaultYear
  );

  return (
    <RankingAgenClient
      initialData={initialRanking || []}
      periods={periods}
      folders={folders}
      availableYears={availableYears}
      serviceTypes={serviceTypes}
      defaultServiceType={defaultServiceType}
      defaultPeriodId={defaultPeriodId}
      defaultYear={defaultYear}
      role={role}
    />
  );
}
