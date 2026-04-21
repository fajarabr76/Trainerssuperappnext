import nextDynamic from 'next/dynamic';
import { qaServiceServer } from '../services/qaService.server';
import { getAllServiceWeightsAction } from '../actions';
import { ServiceType, QAPeriod, EXCLUDED_FOLDERS, Agent } from '../lib/qa-types';
import { Profile } from '@/app/types/auth';
import { requirePageAccess } from '@/app/lib/authz';

const QaInputClient = nextDynamic(() => import('./QaInputClient'), {
  loading: () => (
    <div className="flex min-h-[45vh] items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm font-medium text-muted-foreground">Memuat antarmuka input...</p>
      </div>
    </div>
  )
});

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function QaInputPage({ searchParams }: PageProps) {
  const { user, profile, role } = await requirePageAccess({
    allowedRoles: ['trainer', 'admin']
  });

  // Raw resolution of search params
  const sParams = await searchParams;
  const folderParam = typeof sParams.folder === 'string' ? sParams.folder : undefined;
  const agentIdParam = typeof sParams.agentId === 'string' ? sParams.agentId : undefined;
  const periodIdParam = typeof sParams.periodId === 'string' ? sParams.periodId : undefined;

  // Initial common data
  const [allFolders, allPeriods, allWeights] = await Promise.all([
    qaServiceServer.getFolders(),
    qaServiceServer.getPeriods(),
    getAllServiceWeightsAction(),
  ]);

  const priorityQaTeams = ['BKO', 'SLIK'];
  const initialFolders = Array.from(
    new Set([...allFolders, ...priorityQaTeams])
  ).filter(f => !EXCLUDED_FOLDERS.includes(f.toLowerCase().trim()));
  const initialPeriods = allPeriods;

  // Selective pre-fetching based on params
  let initialAgents: Agent[] = [];
  let initialAgent = null;
  let initialIndicators = [];
  let initialTemuan = [];
  let initialStep: 'folder' | 'agent' | 'period' | 'list' = 'folder';
  let initialService: ServiceType | undefined;
  let initialTeam: string | undefined;
  let initialPeriod: QAPeriod | null = null;

  if (folderParam) {
    try {
      initialAgents = await qaServiceServer.getAgentsByFolder(folderParam);
    } catch (e) {
      console.error("Error pre-fetching agents list:", e);
    }
    
    initialStep = 'agent';
    if (agentIdParam) {
      try {
        initialAgent = await qaServiceServer.getAgentMiniProfile(agentIdParam);
        let defaultService: ServiceType = 'call';
        const team = initialAgent.tim || '';
        const normalizedTim = team.toLowerCase().trim();
        if (normalizedTim.includes('mix')) defaultService = 'cso';
        else if (normalizedTim.includes('chat')) defaultService = 'chat';
        else if (normalizedTim.includes('email')) defaultService = 'email';
        else if (normalizedTim.includes('bko')) defaultService = 'bko';
        else if (normalizedTim.includes('slik')) defaultService = 'slik';
        
        initialIndicators = await qaServiceServer.getIndicators(defaultService);
        initialStep = 'period';
        
        // Pass these to client for initialization
        initialService = defaultService;
        initialTeam = team;

        if (periodIdParam) {
          initialPeriod = initialPeriods.find(p => p.id === periodIdParam) || null;
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
      profile={profile as Profile}
      initialFolders={initialFolders}
      initialPeriods={initialPeriods}
      initialWeights={allWeights}
      initialAgents={initialAgents}
      initialAgent={initialAgent}
      initialIndicators={initialIndicators}
      initialTemuan={initialTemuan}
      initialStep={initialStep}
      initialFolder={folderParam}
      initialService={initialService}
      initialTeam={initialTeam}
      initialPeriod={initialPeriod}
    />
  );
}
