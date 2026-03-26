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
    trend3m, trend6m, trendAll, 
    agentCount3m, agentCount6m, agentCountAll, 
    auditCount3m, auditCount6m, auditCountAll, 
    activities
  ] = await Promise.all([
    qaServiceServer.getKpiSparkline([], null, 'total', '3m', undefined, context),
    qaServiceServer.getKpiSparkline([], null, 'total', '6m', undefined, context),
    qaServiceServer.getKpiSparkline([], null, 'total', 'all', undefined, context),
    qaServiceServer.getUniqueAgentCountByTimeframe('3m', context),
    qaServiceServer.getUniqueAgentCountByTimeframe('6m', context),
    qaServiceServer.getUniqueAgentCountByTimeframe('all', context),
    qaServiceServer.getAuditCountByTimeframe('3m', context),
    qaServiceServer.getAuditCountByTimeframe('6m', context),
    qaServiceServer.getAuditCountByTimeframe('all', context),
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
    action: normalizeActionText(act.action),
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
