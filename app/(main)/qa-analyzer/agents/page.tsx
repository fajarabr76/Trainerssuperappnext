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

  const supabase = await createClient();

  // Fetch initial data
  const [agents, folderData] = await Promise.all([
    qaServiceServer.getAgentListWithScores(),
    supabase.from('profiler_folders').select('name').order('created_at', { ascending: true })
  ]);

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
