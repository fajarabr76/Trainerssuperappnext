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

  // Fetch trend data for ALL timeframes + unique agent counts in parallel
  const [trend3m, trend6m, trendAll, agentCount3m, agentCount6m, agentCountAll, auditCount3m, auditCount6m, auditCountAll, activities] = await Promise.all([
    qaServiceServer.getKpiSparkline([], null, 'total', '3m'),
    qaServiceServer.getKpiSparkline([], null, 'total', '6m'),
    qaServiceServer.getKpiSparkline([], null, 'total', 'all'),
    qaServiceServer.getUniqueAgentCountByTimeframe('3m'),
    qaServiceServer.getUniqueAgentCountByTimeframe('6m'),
    qaServiceServer.getUniqueAgentCountByTimeframe('all'),
    qaServiceServer.getAuditCountByTimeframe('3m'),
    qaServiceServer.getAuditCountByTimeframe('6m'),
    qaServiceServer.getAuditCountByTimeframe('all'),
    activityServiceServer.getRecentActivities(5)
  ]);

  const trendDataMap = {
    '3m': trend3m.map(t => ({ name: t.label, findings: t.value })),
    '6m': trend6m.map(t => ({ name: t.label, findings: t.value })),
    'all': trendAll.map(t => ({ name: t.label, findings: t.value })),
  };

  const agentCountMap = {
    '3m': agentCount3m,
    '6m': agentCount6m,
    'all': agentCountAll,
  };

  const auditCountMap = {
    '3m': auditCount3m,
    '6m': auditCount6m,
    'all': auditCountAll,
  };

  const formattedLogs = activities.map(act => ({
    id: act.id,
    user: act.user_name || 'Hamba Allah',
    action: act.action,
    time: activityServiceServer.formatTimeAgo(act.created_at),
    type: act.type
  }));

  return (
    <DashboardClient 
      user={user} 
      role={role} 
      profile={profile} 
      trendDataMap={trendDataMap}
      agentCountMap={agentCountMap}
      auditCountMap={auditCountMap}
      initialRecentLogs={formattedLogs}
    />
  );
}
