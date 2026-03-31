import { createClient } from '@/app/lib/supabase/server';
import { redirect } from 'next/navigation';
import QaPeriodsClient from './QaPeriodsClient';
import { qaServiceServer } from '../services/qaService.server';

export const dynamic = 'force-dynamic';

export default async function QaPeriodsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get profile and role
  const { data: profile } = await supabase
    .from('profiler_peserta')
    .select('role, tim')
    .eq('id', user.id)
    .single();

  const role = profile?.role || 'trainer';

  // Allowed roles
  const allowedRoles = ['trainer', 'trainers', 'admin', 'superadmin'];
  if (!allowedRoles.includes(role)) {
    redirect('/qa-analyzer/dashboard');
  }

  // Fetch initial data
  const periods = await qaServiceServer.getPeriods();

  return (
    <QaPeriodsClient 
      user={user} 
      role={role} 
      initialPeriods={periods}
    />
  );
}
