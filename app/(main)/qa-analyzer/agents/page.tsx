import AgentDirectoryClient from './components/AgentDirectoryClient';
import { qaServiceServer } from '../services/qaService.server';
import { EXCLUDED_FOLDERS } from '../lib/qa-types';
import { requirePageAccess } from '@/app/lib/authz';

export const dynamic = 'force-dynamic';

export default async function AgentDirectoryPage() {
  const { user, role } = await requirePageAccess({
    allowedRoles: ['trainer', 'leader', 'admin']
  });

  const [agentsResult, foldersResult] = await Promise.allSettled([
    qaServiceServer.getAgentDirectorySummary(),
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
  const batchList = batchSource
    .filter(name => !EXCLUDED_FOLDERS.includes(name.toLowerCase().trim()));

  return (
    <AgentDirectoryClient
      user={user}
      role={role}
      initialAgents={agentsResult.value}
      initialBatches={batchList}
    />
  );
}
