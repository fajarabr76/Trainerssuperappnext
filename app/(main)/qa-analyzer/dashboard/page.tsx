import { createClient } from '@/app/lib/supabase/server';
import { redirect } from 'next/navigation';
import QaDashboardClient from './QaDashboardClient';
import { qaServiceServer } from '../services/qaService.server';
import { profilerServiceServer } from '../../profiler/services/profilerService.server';

export const dynamic = 'force-dynamic';

export default async function QaDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = await searchParams;
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

  // Allowed roles - consistent with Level 1 Summary for all personas
  const allowedRoles = ['trainer', 'trainers', 'leader', 'agent', 'admin', 'superadmin'];
  if (!allowedRoles.includes(role)) {
    redirect('/dashboard');
  }

  // Parse filters from resolvedParams
  const period = typeof resolvedParams.period === 'string' ? resolvedParams.period : 'ytd';
  const folder = typeof resolvedParams.folder === 'string' ? resolvedParams.folder : 'ALL';
  const timeframe = (resolvedParams.timeframe === '3m' || resolvedParams.timeframe === '6m' || resolvedParams.timeframe === 'all') 
    ? (resolvedParams.timeframe as '3m' | '6m' | 'all') 
    : '3m';

  const folderIds = folder === 'ALL' ? [] : [folder];

  // Fetch initial data
  const [
    periods,
    foldersData,
    summary,
    teamData,
    topAgents,
    paretoData,
    donutData,
    spark1, spark2, spark3, spark4,
    paramTrend
  ] = await Promise.all([
    qaServiceServer.getPeriods(),
    profilerServiceServer.getFolders(),
    qaServiceServer.getDashboardSummary(folderIds, period),
    qaServiceServer.getTeamComparison(folderIds, period),
    qaServiceServer.getTopAgentsWithDefects(folderIds, period, 5),
    qaServiceServer.getParetoData(folderIds, period),
    qaServiceServer.getCriticalVsNonCritical(folderIds, period),
    qaServiceServer.getKpiSparkline(folderIds, null, 'total', timeframe),
    qaServiceServer.getKpiSparkline(folderIds, null, 'avg', timeframe),
    qaServiceServer.getKpiSparkline(folderIds, null, 'zero_error', timeframe),
    qaServiceServer.getKpiSparkline(folderIds, null, 'compliance', timeframe),
    qaServiceServer.getTrendWithParameters(folderIds, timeframe)
  ]);

  const initialData = {
    periods,
    folders: foldersData.map(f => ({ id: f.name, name: f.name })),
    summary,
    teamData,
    topAgents,
    paretoData,
    donutData,
    paramTrend,
    sparklines: {
      total: spark1,
      avg: spark2,
      critical: spark3,
      compliance: spark4
    }
  };

  const filters = {
    period,
    folder,
    timeframe
  };

  return (
    <QaDashboardClient 
      user={user} 
      role={role} 
      profile={profile} 
      initialData={initialData}
      filters={filters}
    />
  );
}
