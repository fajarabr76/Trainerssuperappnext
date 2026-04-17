import { redirect } from 'next/navigation';
import QaDashboardClient from './QaDashboardClient';
import { qaServiceServer } from '../services/qaService.server';
import { profilerServiceServer } from '../../profiler/services/profilerService.server';
import { EXCLUDED_FOLDERS } from '../lib/qa-types';
import { getCurrentUserContext, hasRole } from '@/app/lib/authz';

export const dynamic = 'force-dynamic';

export default async function QaDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = await searchParams;
  const { user, profile, role } = await getCurrentUserContext();

  if (!user) {
    redirect('/?auth=login');
  }

  // Allowed roles - consistent with Level 1 Summary for all personas (EXCLUDING agent now)
  if (!hasRole(role, ['trainer', 'leader', 'admin', 'superadmin'])) {
    redirect('/dashboard');
  }

  // Parse filters from resolvedParams
  const folder = typeof resolvedParams.folder === 'string' ? resolvedParams.folder : 'ALL';
  const service = typeof resolvedParams.service === 'string' ? resolvedParams.service : 'call';
  const yearParam = typeof resolvedParams.year === 'string' ? parseInt(resolvedParams.year) : new Date().getFullYear();

  const startMonth = typeof resolvedParams.start_month === 'string' ? parseInt(resolvedParams.start_month) : 1;
  const endMonth = typeof resolvedParams.end_month === 'string' ? parseInt(resolvedParams.end_month) : (new Date().getMonth() + 1);

  const folderIds = folder === 'ALL' ? [] : [folder];

  let periods;
  let foldersData;
  let availableYears;
  let periodData;
  let trendData;
  try {
    const indicatorsResult = await qaServiceServer.getIndicators(service);

    // 1. Fetch Shared Context Data (Pre-load common metadata)
    [periods, foldersData, availableYears] = await Promise.all([
      qaServiceServer.getPeriods(),
      profilerServiceServer.getFolders(),
      qaServiceServer.getAvailableYears()
    ]);

    const context = {
      periods,
      indicators: indicatorsResult
    };

    // 2. Fetch Dashboard Aggregations using Consolidated Fetchers
    [periodData, trendData] = await Promise.all([
      qaServiceServer.getDashboardRangeData(service, folderIds, context, yearParam, startMonth, endMonth),
      qaServiceServer.getDashboardRangeTrendData(service, folderIds, context, yearParam, startMonth, endMonth)
    ]);
  } catch (error) {
    console.error('Error loading QA dashboard server data:', error);
  }

  if (!periods || !foldersData || !availableYears || !periodData || !trendData) {
    return (
      <div className="p-8 text-center text-red-500">
        Terjadi kendala saat memproses data dashboard. Silakan coba lagi.
      </div>
    );
  }

  const initialData = {
    periods,
    availableYears,
    currentYear: yearParam,
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
    startMonth,
    endMonth,
    folder,
    service,
    year: yearParam
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
