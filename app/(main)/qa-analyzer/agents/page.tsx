import AgentDirectoryClient from './components/AgentDirectoryClient';
import { qaServiceServer } from '../services/qaService.server';
import { EXCLUDED_FOLDERS } from '../lib/qa-types';
import { requirePageAccess } from '@/app/lib/authz';
import { checkSidakLeaderAccess } from '../lib/leaderAccessGuard';
import LeaderAccessStatus from '@/app/components/access/LeaderAccessStatus';

export const dynamic = 'force-dynamic';

export default async function AgentDirectoryPage() {
  const { user, role } = await requirePageAccess({
    allowedRoles: ['trainer', 'leader', 'admin']
  });

  // Leader access check
  const leaderAccess = await checkSidakLeaderAccess();
  if (leaderAccess.blocked) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <LeaderAccessStatus status={leaderAccess.status} module="sidak" moduleLabel="SIDAK / QA Analyzer" />
      </div>
    );
  }

  const [agentsResult, foldersResult] = await Promise.allSettled([
    qaServiceServer.getAgentDirectorySummary(undefined, false, leaderAccess.scope),
    qaServiceServer.getFolders()
  ]);

  if (agentsResult.status === 'rejected') {
    console.error('Error loading agent directory server data:', agentsResult.reason);
    return (
      <div className="p-8 text-center text-red-500">
        Terjadi kendala saat memproses data agen. Silakan coba lagi.
      </div>
    );
  }

  if (foldersResult.status === 'rejected') {
    console.warn('Error loading QA folder options:', foldersResult.reason);
  }

  const batchSource = foldersResult.status === 'fulfilled' ? foldersResult.value : [];
  let batchList = batchSource
    .filter(name => !EXCLUDED_FOLDERS.includes(name.toLowerCase().trim()));

  const agents = agentsResult.value;

  // Scope filtering for leader
  if (role === 'leader' && leaderAccess.scope) {
    const scope = leaderAccess.scope;
    if (scope.batch_names && scope.batch_names.length > 0) {
      batchList = batchList.filter((b: string) => scope.batch_names!.includes(b));
    } else {
      const scopedBatches = new Set(agents.map((a) => a.batch_name || a.batch).filter(Boolean));
      batchList = batchList.filter((b: string) => scopedBatches.has(b));
    }
  }

  return (
    <AgentDirectoryClient
      user={user}
      role={role}
      initialAgents={agents}
      initialBatches={batchList}
    />
  );
}
