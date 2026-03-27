import { createClient } from '@/app/lib/supabase/server';
import { redirect } from 'next/navigation';
import DashboardClient from './DashboardClient';
import { qaServiceServer } from '../qa-analyzer/services/qaService.server';
import { activityServiceServer } from '@/app/lib/services/activityService.server';
import { normalizeActionText } from '@/app/lib/utils';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/?auth=login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single();

  const role = profile?.role || 'trainer';

  // 1. Fetch periods first to share as context
  const periods = await qaServiceServer.getPeriods();
  const context = { periods, indicators: [], agents: [] };

  // 2. Fetch all other dashboard data in parallel using the shared context
  const [
    serviceTrend3m, serviceTrend6m, serviceTrendAll,
    activities
  ] = await Promise.all([
    qaServiceServer.getServiceTrendForDashboard('3m', context),
    qaServiceServer.getServiceTrendForDashboard('6m', context),
    qaServiceServer.getServiceTrendForDashboard('all', context),
    activityServiceServer.getRecentActivities(5)
  ]);

  const serviceTrendMap = {
    '3m': serviceTrend3m,
    '6m': serviceTrend6m,
    'all': serviceTrendAll,
  };

  const formattedLogs = activities.map(act => ({
    id: act.id,
    user: act.user_name || 'Hamba Allah',
    action: normalizeActionText(act.action),
    time: activityServiceServer.formatTimeAgo(act.created_at),
    type: act.type
  }));

  return (
    <DashboardClient 
      user={user} 
      role={role} 
      profile={profile} 
      serviceTrendMap={serviceTrendMap}
      initialRecentLogs={formattedLogs}
    />
  );
}
