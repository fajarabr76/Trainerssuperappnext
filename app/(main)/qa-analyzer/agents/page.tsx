import { createClient } from '@/app/lib/supabase/server';
import { redirect } from 'next/navigation';
import AgentDirectoryClient from './components/AgentDirectoryClient';
import { qaServiceServer } from '../services/qaService.server';

export const dynamic = 'force-dynamic';

export default async function AgentDirectoryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/?auth=login');
  }

  // Get profile and role
  const { data: profile } = await supabase
    .from('profiler_peserta')
    .select('role, tim')
    .eq('id', user.id)
    .single();

  const role = profile?.role || 'trainer';

  // Allowed roles
  const allowedRoles = ['trainer', 'trainers', 'leader', 'admin', 'superadmin'];
  if (!allowedRoles.includes(role)) {
    redirect('/dashboard');
  }

  // Fetch initial data
  const [agents, folderData] = await Promise.all([
    qaServiceServer.getAgentListWithScores(),
    supabase.from('profiler_folders').select('name').order('created_at', { ascending: true })
  ]);

  const batchList = (folderData.data ?? []).map(f => f.name);

  return (
    <AgentDirectoryClient 
      user={user} 
      role={role} 
      initialAgents={agents}
      initialBatches={batchList}
    />
  );
}
