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

  // Get profile and role from PROFILES table (system identity)
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const role = profile?.role || 'trainer';

  // Allowed roles - Agent is now allowed but will be filtered below
  const allowedRoles = ['trainer', 'trainers', 'leader', 'agent', 'admin', 'superadmin'];
  if (!allowedRoles.includes(role)) {
    redirect('/dashboard');
  }

  // STSRICT FILTERING FOR AGENT ROLE
  if (role.toLowerCase() === 'agent') {
    // Find the peserta record associated with this user's email
    const { data: ownPeserta } = await supabase
      .from('profiler_peserta')
      .select('id')
      .eq('email_ojk', user.email)
      .single();
    
    // If agent is not registered as a peserta OR trying to access someone else's ID
    if (!ownPeserta || ownPeserta.id !== agentId) {
      redirect('/dashboard');
    }
  }

  try {
    // Fetch initial data
    const currentYear = new Date().getFullYear();
    
    // 1. Fetch agent and their temuan first to determine active service
    const agentResult = await qaServiceServer.getAgentWithTemuan(agentId, currentYear);

    
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
