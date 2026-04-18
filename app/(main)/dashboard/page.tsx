import DashboardClient from './DashboardClient';
import { qaServiceServer } from '../qa-analyzer/services/qaService.server';
import { activityServiceServer } from '@/app/lib/services/activityService.server';
import { normalizeActionText } from '@/app/lib/utils';
import { requirePageAccess } from '@/app/lib/authz';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const { user, profile, role } = await requirePageAccess();

  // 1. Fetch base data
  const periods = await qaServiceServer.getPeriods();
  const periodIds = periods.slice(0, 12).map(p => p.id); 

  // Parallel fetch: Trends (RPC with legacy fallback) + Recent Activities
  const [trendResult, activities] = await Promise.all([
    qaServiceServer.getServiceTrendDashboard(periodIds).catch(err => {
      console.warn('[Dashboard] RPC failed, using fallback:', err);
      return qaServiceServer.getServiceTrendForDashboard('all');
    }),
    activityServiceServer.getRecentActivities(5)
  ]);

  const serviceTrendAll = trendResult;

  // 2. Derive 3m and 6m trends from the 'all' fetch (12m)
  const serviceTrendMap = {
    '3m': qaServiceServer.sliceTrendData(serviceTrendAll, 3),
    '6m': qaServiceServer.sliceTrendData(serviceTrendAll, 6),
    'all': serviceTrendAll,
  };

  const formattedLogs = activities.map(act => ({
    id: act.id,
    user: act.user_name || 'Pengguna internal',
    action: normalizeActionText(act.action),
    time: activityServiceServer.formatTimeAgo(act.created_at),
    type: act.type
  }));

  // 3. Additional metadata
  const availableYears = await qaServiceServer.getAvailableYears();
  const currentYear = new Date().getFullYear();

  return (
    <DashboardClient 
      user={user} 
      role={role} 
      profile={profile} 
      serviceTrendMap={serviceTrendMap}
      initialRecentLogs={formattedLogs}
      availableYears={availableYears}
      initialYear={currentYear}
    />
  );
}
