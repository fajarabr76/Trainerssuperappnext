import { createClient } from '@/app/lib/supabase/server';
import { redirect } from 'next/navigation';
import DashboardClient from './DashboardClient';
import { qaServiceServer } from '../qa-analyzer/services/qaService.server';
import { activityServiceServer } from '@/app/lib/services/activityService.server';

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

  // Fetch initial data server-side
  const currentYear = new Date().getFullYear();
  const timeframe = 'all'; // default

  const [trend, summary, activities] = await Promise.all([
    qaServiceServer.getKpiSparkline([], null, 'total', timeframe),
    qaServiceServer.getDashboardSummary([], 'ytd'),
    activityServiceServer.getRecentActivities(5)
  ]);

  const initialTrendData = trend.map(t => ({ name: t.label, findings: t.value }));
  
  const lastVal = trend.length > 0 ? trend[trend.length - 1].value : 0;
  const prevVal = trend.length > 1 ? trend[trend.length - 2].value : 0;
  
  const formattedLogs = activities.map(act => ({
    id: act.id,
    user: act.user_name || 'Hamba Allah',
    action: act.action,
    time: activityServiceServer.formatTimeAgo(act.created_at),
    type: act.type
  }));

  const initialStats = {
    totalFindings: summary.totalDefects,
    avgFindingsPerTeam: Number(summary.avgDefectsPerAudit.toFixed(1)),
    trendStatus: trend.length < 2 ? "Stabil" : (lastVal < prevVal ? "Tren Membaik" : lastVal > prevVal ? "Tren Menurun" : "Stabil"),
    recentLogs: formattedLogs
  };

  return (
    <DashboardClient 
      user={user} 
      role={role} 
      profile={profile} 
      initialTrendData={initialTrendData}
      initialStats={initialStats}
    />
  );
}
