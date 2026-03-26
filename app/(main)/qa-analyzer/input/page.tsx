import { createClient } from '@/app/lib/supabase/server';
import { redirect } from 'next/navigation';
import QaInputClient from './QaInputClient';
import { qaServiceServer } from '../services/qaService.server';
import { ServiceType } from '../lib/qa-types';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function QaInputPage({ searchParams }: PageProps) {
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
  const allowedRoles = ['trainer', 'trainers', 'leader', 'admin', 'superadmin'];
  if (!allowedRoles.includes(role)) {
    redirect('/dashboard');
  }

  // Raw resolution of search params
  const sParams = await searchParams;
  const folderParam = typeof sParams.folder === 'string' ? sParams.folder : undefined;
  const agentIdParam = typeof sParams.agentId === 'string' ? sParams.agentId : undefined;
  const periodIdParam = typeof sParams.periodId === 'string' ? sParams.periodId : undefined;

  // Initial common data
  const initialFolders = await qaServiceServer.getFolders();
  const initialPeriods = await qaServiceServer.getPeriods();

  // Selective pre-fetching based on params
  let initialAgent = null;
  let initialIndicators = [];
  let initialTemuan = [];
  let initialStep: 'folder' | 'agent' | 'period' | 'list' = 'folder';

  if (folderParam) {
    initialStep = 'agent';
    if (agentIdParam) {
      try {
        initialAgent = await qaServiceServer.getAgentMiniProfile(agentIdParam);
        let defaultService = 'call';
        const normalizedTim = initialAgent.tim?.toLowerCase()?.trim() || '';
        if (normalizedTim.includes('mix')) defaultService = 'cso';
        else if (normalizedTim.includes('chat')) defaultService = 'chat';
        else if (normalizedTim.includes('email')) defaultService = 'email';
        initialIndicators = await qaServiceServer.getIndicators(defaultService);
        initialStep = 'period';

        if (periodIdParam) {
          initialTemuan = await qaServiceServer.getTemuanByAgentPeriod(agentIdParam, periodIdParam);
          initialStep = 'list';
        }
      } catch (e) {
        console.error("Error pre-fetching QA input data:", e);
      }
    }
  }

  return (
    <QaInputClient 
      user={user} 
      role={role} 
      profile={profile}
      initialFolders={initialFolders}
      initialPeriods={initialPeriods}
      initialAgent={initialAgent}
      initialIndicators={initialIndicators}
      initialTemuan={initialTemuan}
      initialStep={initialStep}
      initialFolder={folderParam}
    />
  );
}