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
    indicators
  };

  // 2. Fetch Dashboard Aggregations using Shared Context
  const [
    summary,
    serviceData,
    topAgents,
    paretoData,
    donutData,
    spark1, spark2, spark3, spark4,
    paramTrend
  ] = await Promise.all([
    qaServiceServer.getDashboardSummary(period, service, folderIds, context),
    qaServiceServer.getServiceComparison(period, folderIds, context),
    qaServiceServer.getTopAgentsWithDefects(period, service, 5, folderIds, context),
    qaServiceServer.getParetoData(period, service, folderIds, context),
    qaServiceServer.getCriticalVsNonCritical(period, service, folderIds, context),
    qaServiceServer.getKpiSparkline(null, 'total', timeframe, service, folderIds, context),
    qaServiceServer.getKpiSparkline(null, 'avg', timeframe, service, folderIds, context),
    qaServiceServer.getKpiSparkline(null, 'zero_error', timeframe, service, folderIds, context),
    qaServiceServer.getKpiSparkline(null, 'compliance', timeframe, service, folderIds, context),
    qaServiceServer.getTrendWithParameters(period, service, folderIds, timeframe, context)
  ]);

  const initialData = {
    periods,
    folders: foldersData.map((f: any) => ({ 
      id: typeof f === 'string' ? f : f.name, 
      name: typeof f === 'string' ? f : f.name 
    })),
    summary,
    serviceData,
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
