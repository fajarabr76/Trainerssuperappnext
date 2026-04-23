import nextDynamic from 'next/dynamic';
import { qaServiceServer } from '../services/qaService.server';
import { ServiceType, QAPeriod, EXCLUDED_FOLDERS, Agent, DEFAULT_SERVICE_WEIGHTS, resolveServiceTypeFromTeam } from '../lib/qa-types';
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

  // Initial common data. Keep the RSC render resilient after submit revalidation.
  const [foldersResult, periodsResult, weightsResult] = await Promise.allSettled([
    qaServiceServer.getFolders(),
    qaServiceServer.getPeriods(),
    qaServiceServer.getServiceWeights(),
  ]);

  if (foldersResult.status === 'rejected') {
    console.error("Error pre-fetching QA folders:", foldersResult.reason);
  }
  if (periodsResult.status === 'rejected') {
    console.error("Error pre-fetching QA periods:", periodsResult.reason);
  }
  if (weightsResult.status === 'rejected') {
    console.error("Error pre-fetching QA service weights:", weightsResult.reason);
  }

  const allFolders = foldersResult.status === 'fulfilled' ? foldersResult.value : [];
  const allPeriods = periodsResult.status === 'fulfilled' ? periodsResult.value : [];
  const allWeights = weightsResult.status === 'fulfilled' ? weightsResult.value : DEFAULT_SERVICE_WEIGHTS;

  const priorityQaTeams = ['BKO', 'SLIK'];
  const initialFolders = Array.from(
    new Set([...allFolders, ...priorityQaTeams])
  ).filter(f => !EXCLUDED_FOLDERS.includes(f.toLowerCase().trim()));
  const initialPeriods = allPeriods;

  // Selective pre-fetching based on params
  let initialAgents: Agent[] = [];
  let initialAgent = null;
  let initialIndicators: any[] = [];
  let initialTemuan: any[] = [];
  let initialStep: 'folder' | 'agent' | 'period' | 'list' = 'folder';
  let initialService: ServiceType | undefined;
  let initialPeriod: QAPeriod | null = null;

  if (folderParam) {
    initialStep = 'agent';
    try {
      initialAgents = await qaServiceServer.getAgentsByFolder(folderParam);
    } catch (e) {
      console.error("Error pre-fetching agents list:", e);
    }
    
    if (agentIdParam) {
      try {
        initialAgent = await qaServiceServer.getAgentMiniProfile(agentIdParam);
        if (initialAgent) {
          const defaultService: ServiceType = resolveServiceTypeFromTeam(initialAgent.tim);
          initialService = defaultService;
          initialStep = 'period';

          // Pre-fetch indicators for the default service
          try {
            initialIndicators = await qaServiceServer.getIndicators(defaultService, periodIdParam);
          } catch (indsErr) {
            console.error("Error pre-fetching indicators:", indsErr);
          }

          if (periodIdParam) {
            initialPeriod = allPeriods.find(p => p.id === periodIdParam) || null;
            try {
              initialTemuan = await qaServiceServer.getTemuanByAgentPeriod(agentIdParam, periodIdParam, defaultService);
              initialStep = 'list';
            } catch (temuanErr) {
              console.error("Error pre-fetching temuan:", temuanErr);
            }
          }
        }
      } catch (e) {
        console.error("Error pre-fetching QA agent profile:", e);
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
      initialPeriod={initialPeriod}
    />
  );
}
