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
  const service = typeof resolvedParams.service === 'string' ? resolvedParams.service : 'call';

  const folderIds = folder === 'ALL' ? [] : [folder];

  // 1. Fetch Shared Context Data (Pre-load common metadata)
  const [periods, foldersData, indicators] = await Promise.all([
    qaServiceServer.getPeriods(),
    profilerServiceServer.getFolders(),
    qaServiceServer.getIndicators(service)
  ]);

  const context = {
    periods,
    indicators,
    agents: [] // Not pre-filling agents for now to keep context size manageable
  };

  // 2. Fetch Dashboard Aggregations using Shared Context
  const [
    summary,
    teamData,
    topAgents,
    paretoData,
    donutData,
    spark1, spark2, spark3, spark4,
    paramTrend
  ] = await Promise.all([
    qaServiceServer.getDashboardSummary(folderIds, period, service, context),
    qaServiceServer.getTeamComparison(folderIds, period, service, context),
    qaServiceServer.getTopAgentsWithDefects(folderIds, period, 5, service, context),
    qaServiceServer.getParetoData(folderIds, period, service, context),
    qaServiceServer.getCriticalVsNonCritical(folderIds, period, service, context),
    qaServiceServer.getKpiSparkline(folderIds, null, 'total', timeframe, service, context),
    qaServiceServer.getKpiSparkline(folderIds, null, 'avg', timeframe, service, context),
    qaServiceServer.getKpiSparkline(folderIds, null, 'zero_error', timeframe, service, context),
    qaServiceServer.getKpiSparkline(folderIds, null, 'compliance', timeframe, service, context),
    qaServiceServer.getTrendWithParameters(folderIds, timeframe, service, context)
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
    timeframe,
    service
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
