import { createClient } from '@/app/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import QaAgentDetailClient from './QaAgentDetailClient';
import { qaServiceServer } from '../../services/qaService.server';
import { TIM_TO_DEFAULT_SERVICE } from '../../lib/qa-types';

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
    const currentYear = new Date().getFullYear();
    
    // 1. Fetch agent and their temuan first to determine active service
    const agentResult = await qaServiceServer.getAgentWithTemuan(agentId, currentYear, 0);
    
    if (!agentResult.agent) {
      return notFound();
    }

    const { agent, temuan } = agentResult;
    
    // 2. Resolve service type: latest from temuan, or default from team
    const initialService = temuan[0]?.service_type || 
                          (agent.tim ? TIM_TO_DEFAULT_SERVICE[agent.tim] : 'call');

    // 3. Fetch remains in parallel
    const [personalTrend, availableYears, indicators] = await Promise.all([
      qaServiceServer.getPersonalTrendWithParameters(agentId, '3m', initialService),
      qaServiceServer.getAvailableYears(),
      qaServiceServer.getIndicators()
    ]);

    const initialData = {
      temuan,
      indicators,
      personalTrend,
      availableYears
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
