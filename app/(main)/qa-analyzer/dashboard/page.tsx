import { createClient } from '@/app/lib/supabase/server';
import { redirect } from 'next/navigation';
import QaDashboardClient from './QaDashboardClient';
import { qaServiceServer } from '../services/qaService.server';
import { profilerServiceServer } from '../../profiler/services/profilerService.server';
import { EXCLUDED_FOLDERS } from '../lib/qa-types';

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

  // Allowed roles - consistent with Level 1 Summary for all personas (EXCLUDING agent now)
  const allowedRoles = ['trainer', 'trainers', 'leader', 'admin', 'superadmin'];
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
  const currentYear = new Date().getFullYear();
  const [periods, foldersData, indicators, availableYears] = await Promise.all([
    qaServiceServer.getPeriods(),
    profilerServiceServer.getFolders(),
    qaServiceServer.getIndicators(service),
    qaServiceServer.getAvailableYears()
  ]);

  const context = {
    periods,
    indicators
  };

  // 2. Fetch Dashboard Aggregations using Consolidated Fetchers
  const [periodData, trendData] = await Promise.all([
    qaServiceServer.getConsolidatedPeriodDataRPC(period, service, folderIds, context, currentYear),
    qaServiceServer.getConsolidatedTrendData(timeframe, service, folderIds, context, currentYear)
  ]);

  if (!periodData || !trendData) {
    // Fallback or empty state
    return (
      <div className="p-8 text-center text-red-500">
        Gagal memuat data dashboard. Silakan coba lagi atau perkecil filter Anda.
      </div>
    );
  }

  const initialData = {
    periods,
    availableYears,
    currentYear,
    folders: foldersData
      .map((f: any) => ({ 
        id: typeof f === 'string' ? f : f.name, 
        name: typeof f === 'string' ? f : f.name 
      }))
      .filter((f: any) => !EXCLUDED_FOLDERS.some(ef => ef.toLowerCase() === f.name.toLowerCase())),
    summary: periodData.summary,
    serviceData: periodData.serviceData,
    topAgents: periodData.topAgents,
    paretoData: periodData.paretoData,
    donutData: periodData.donutData,
    paramTrend: trendData.paramTrend,
    sparklines: trendData.sparklines
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
