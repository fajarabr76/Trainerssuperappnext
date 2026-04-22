import { createClient } from '@/app/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import QaAgentDetailClient from './QaAgentDetailClient';
import { qaServiceServer } from '../../services/qaService.server';
import { resolveServiceTypeFromTeam, AgentDetailData, isServiceType, ServiceType } from '../../lib/qa-types';
import { requirePageAccess } from '@/app/lib/authz';

export const dynamic = 'force-dynamic';

function isRedirectError(error: unknown): error is { digest: string } {
  return typeof error === 'object'
    && error !== null
    && 'digest' in error
    && typeof error.digest === 'string'
    && error.digest.startsWith('NEXT_REDIRECT');
}

export default async function QaAgentDetailPage({ 
  params,
  searchParams
}: { 
  params: Promise<{ id: string }>,
  searchParams: Promise<{ year?: string; tstart?: string; tend?: string; service?: string }>
}) {
  const { id: agentId } = await params;
  const { year: qYear, tstart: qStart, tend: qEnd, service: qService } = await searchParams;
  const { user, role } = await requirePageAccess({
    allowedRoles: ['trainer', 'leader', 'agent', 'admin']
  });

  // STRICT FILTERING FOR AGENT ROLE
  if (role === 'agent') {
    const supabase = await createClient();
    const { data: ownPeserta } = await supabase
      .from('profiler_peserta')
      .select('id')
      .eq('email_ojk', user?.email)
      .single();
    
    if (!ownPeserta || ownPeserta.id !== agentId) {
      redirect('/dashboard');
    }
  }

  try {
    const now = new Date();
    
    // 1. Fetch Basic Data First to Validate Context
    const [agent, agentAvailableYears, indicators, weights] = await Promise.all([
      qaServiceServer.getAgentMiniProfile(agentId),
      qaServiceServer.getAgentAvailableYears(agentId),
      qaServiceServer.getIndicators(),
      qaServiceServer.getServiceWeights()
    ]);

    if (!agent) return notFound();

    // 2. Determine Canonical Year Based on Agent Context
    const parsedYear = qYear ? parseInt(qYear) : NaN;
    let canonicalYear = !isNaN(parsedYear) ? parsedYear : now.getFullYear();
    
    if (agentAvailableYears.length > 0) {
      if (!agentAvailableYears.includes(canonicalYear)) {
        const currentYear = now.getFullYear();
        canonicalYear = agentAvailableYears.includes(currentYear) ? currentYear : agentAvailableYears[0];
      }
    } else {
      canonicalYear = now.getFullYear();
    }

    // 3. Absolute Service Canonicalization
    const periodSummary = await qaServiceServer.getAgentPeriodSummaries(agentId, canonicalYear);
    const availableServices = new Set<ServiceType>(periodSummary.periods.map((period) => period.serviceType));
    
    // Logic: Fallback sequence if qService is missing or invalid
    const defaultSvc = resolveServiceTypeFromTeam(agent.tim);
    const requestedService = isServiceType(qService) ? qService : null;
    let initialService: ServiceType = requestedService || periodSummary.periods[0]?.serviceType || defaultSvc;

    // Check against real usage data IF data exists
    if (availableServices.size > 0 && requestedService && !availableServices.has(requestedService)) {
      initialService = periodSummary.periods[0].serviceType;
    } 
    // If NO usage data exists at all, we still strictly clamp qService to valid ServiceType or defaultSvc
    else if (availableServices.size === 0) {
      if (!requestedService) {
        initialService = defaultSvc;
      }
    }

    // 4. Trend Range Sanitization (Scoped as tstart/tend)
    const isCurrentYear = canonicalYear === now.getFullYear();
    const startMonth = qStart && !isNaN(parseInt(qStart)) ? Math.max(1, Math.min(12, parseInt(qStart))) : 1;
    
    let endMonth: number;
    if (qEnd && !isNaN(parseInt(qEnd))) {
      endMonth = Math.max(startMonth, Math.min(12, parseInt(qEnd)));
    } else if (isCurrentYear) {
      endMonth = now.getMonth() + 1;
    } else {
      const latestPeriod = periodSummary.periods.find(p => p.serviceType === initialService);
      endMonth = latestPeriod ? latestPeriod.month : 12;
    }

    // 5. Strict Canonical Redirect with Infinite Loop Protection
    const isNotCanonical = 
      qYear !== canonicalYear.toString() || 
      qService !== initialService || 
      qStart !== startMonth.toString() || 
      qEnd !== endMonth.toString();

    if (isNotCanonical) {
      redirect(`/qa-analyzer/agents/${agentId}?year=${canonicalYear}&tstart=${startMonth}&tend=${endMonth}&service=${initialService}`);
    }

    // 6. Fetch Section-Specific Data
    const [personalTrend, fullYearTemuan] = await Promise.all([
      qaServiceServer.getPersonalTrendWithParameters(agentId, canonicalYear, startMonth, endMonth, initialService),
      qaServiceServer.getAgentTemuanRange(agentId, canonicalYear, 1, 12, initialService)
    ]);

    const initialData: AgentDetailData = {
      indicators,
      periodSummaries: periodSummary.periods,
      selectedPeriod: periodSummary.periods[0] || null,
      temuan: fullYearTemuan,
      temuanHasMore: false,
      temuanTotal: fullYearTemuan.length,
      personalTrend,
      availableYears: agentAvailableYears.length > 0 ? agentAvailableYears : [canonicalYear],
      weights,
      initialYear: canonicalYear,
      initialService,
      initialTrendRange: { start: startMonth, end: endMonth }
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
    if (isRedirectError(err)) throw err;
    console.error('Error loading agent detail:', err);
    return notFound();
  }
}
