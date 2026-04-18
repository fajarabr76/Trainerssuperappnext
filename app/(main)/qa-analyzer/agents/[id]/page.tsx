import { createClient } from '@/app/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import QaAgentDetailClient from './QaAgentDetailClient';
import { qaServiceServer } from '../../services/qaService.server';
import { TIM_TO_DEFAULT_SERVICE } from '../../lib/qa-types';
import { requirePageAccess } from '@/app/lib/authz';

export const dynamic = 'force-dynamic';

export default async function QaAgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: agentId } = await params;
  const { user, role } = await requirePageAccess({
    allowedRoles: ['trainer', 'leader', 'agent', 'admin']
  });

  // STRICT FILTERING FOR AGENT ROLE
  if (role === 'agent') {
    const supabase = await createClient();
    // Find the peserta record associated with this user's email
    const { data: ownPeserta } = await supabase
      .from('profiler_peserta')
      .select('id')
      .eq('email_ojk', user?.email)
      .single();
    
    // If agent is not registered as a peserta OR trying to access someone else's ID
    if (!ownPeserta || ownPeserta.id !== agentId) {
      redirect('/dashboard');
    }
  }

  try {
    // Fetch initial data
    const currentYear = new Date().getFullYear();
    const [agent, periodSummary, availableYears, indicators, weights] = await Promise.all([
      qaServiceServer.getAgentMiniProfile(agentId),
      qaServiceServer.getAgentPeriodSummaries(agentId, currentYear),
      qaServiceServer.getAvailableYears(),
      qaServiceServer.getIndicators(),
      qaServiceServer.getServiceWeights()
    ]);

    if (!agent) {
      return notFound();
    }

    const initialPeriod = periodSummary.periods[0] || null;
    const initialService = initialPeriod?.serviceType ||
      (agent.tim ? TIM_TO_DEFAULT_SERVICE[agent.tim] : 'call');

    const [personalTrend, initialTemuan] = await Promise.all([
      qaServiceServer.getPersonalTrendWithParameters(agentId, '3m', initialService),
      initialPeriod
        ? qaServiceServer.getAgentTemuanPage(agentId, currentYear, initialPeriod.id, initialService, 0)
        : Promise.resolve({ temuan: [], hasMore: false, total: 0 })
    ]);

    const initialData = {
      periodSummaries: periodSummary.periods,
      selectedPeriod: initialPeriod,
      temuan: initialTemuan.temuan,
      temuanHasMore: initialTemuan.hasMore,
      temuanTotal: initialTemuan.total,
      indicators,
      personalTrend,
      availableYears,
      weights
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
