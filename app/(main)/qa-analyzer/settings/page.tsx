import { createClient } from '@/app/lib/supabase/server';
import { redirect } from 'next/navigation';
import QaSettingsClient from './QaSettingsClient';
import { qaServiceServer } from '../services/qaService.server';

export const dynamic = 'force-dynamic';

export default async function QaSettingsPage() {
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

  // Fetch initial data - all indicators
  const indicators = await qaServiceServer.getIndicators();

  return (
    <QaSettingsClient 
      user={user} 
      role={role} 
      initialIndicators={indicators}
    />
  );
}
