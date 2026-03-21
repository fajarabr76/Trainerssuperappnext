import { createClient } from '@/app/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import QaAgentDetailClient from './QaAgentDetailClient';
import { qaServiceServer } from '../../services/qaService.server';

export const dynamic = 'force-dynamic';

export default async function QaAgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: agentId } = await params;
  
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get profile and role
  const { data: profile } = await supabase
    .from('profiler_peserta')
    .select('role, tim')
    .eq('id', user.id)
    .single();

  const role = profile?.role || 'trainer';

  // Allowed roles
  const allowedRoles = ['trainer', 'trainers', 'leader', 'admin', 'superadmin'];
  if (!allowedRoles.includes(role)) {
    redirect('/dashboard');
  }

  try {
    // Fetch initial data
    const [agentResult, personalTrend] = await Promise.all([
      qaServiceServer.getAgentWithTemuan(agentId),
      qaServiceServer.getPersonalTrendWithParameters(agentId, '3m')
    ]);

    if (!agentResult.agent) {
      return notFound();
    }

    const { agent, temuan } = agentResult;
    const indicators = await qaServiceServer.getIndicators(agent.tim);

    const initialData = {
      temuan,
      indicators,
      personalTrend
    };

    return (
      <QaAgentDetailClient 
        agentId={agentId}
        user={user} 
        role={role} 
        initialAgent={agent}
        initialData={initialData}
      />
    );
  } catch (err) {
    console.error('Error loading agent detail:', err);
    return notFound();
  }
}
