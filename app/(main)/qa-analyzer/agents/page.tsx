import { createClient } from '@/app/lib/supabase/server';
import { getCurrentUserWithRole, hasRole } from '@/app/lib/authz';
import { redirect } from 'next/navigation';
import AgentDirectoryClient from './components/AgentDirectoryClient';
import { qaServiceServer } from '../services/qaService.server';
import { EXCLUDED_FOLDERS } from '../lib/qa-types';

export const dynamic = 'force-dynamic';

export default async function AgentDirectoryPage() {
  const { user, role } = await getCurrentUserWithRole();

  if (!user) {
    redirect('/?auth=login');
  }

  if (!hasRole(role, ['trainer', 'leader', 'admin', 'superadmin'])) {
    redirect('/dashboard');
  }

  let agents;
  let folderData;
  try {
    const supabase = await createClient();
    [agents, folderData] = await Promise.all([
      qaServiceServer.getAgentDirectorySummary(),
      supabase.from('profiler_folders').select('name').order('created_at', { ascending: true })
    ]);
  } catch (error) {
    console.error('Error loading agent directory server data:', error);
  }

  if (!agents || !folderData) {
    return (
      <div className="p-8 text-center text-red-500">
        Terjadi kendala saat memproses data agen. Silakan coba lagi.
      </div>
    );
  }

  const batchList = (folderData.data ?? [])
    .map(f => f.name)
    .filter(name => !EXCLUDED_FOLDERS.includes(name.toLowerCase().trim()));

  return (
    <AgentDirectoryClient
      user={user}
      role={role}
      initialAgents={agents}
      initialBatches={batchList}
    />
  );
}
