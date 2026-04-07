import { createClient } from '@/app/lib/supabase/server';
import { redirect } from 'next/navigation';
import QaSettingsClient from './QaSettingsClient';
import { qaServiceServer } from '../services/qaService.server';
import { getAllServiceWeightsAction } from '../actions';

export const dynamic = 'force-dynamic';

export default async function QaSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/?auth=login');
  }

  // Get profile and role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const role = profile?.role || 'trainer';

  // Allowed roles
  const allowedRoles = ['trainer', 'trainers', 'admin', 'superadmin'];
  if (!allowedRoles.includes(role)) {
    redirect('/qa-analyzer/dashboard');
  }

  // Fetch initial data - all indicators and weights
  const [indicators, weights] = await Promise.all([
    qaServiceServer.getIndicators(),
    getAllServiceWeightsAction(),
  ]);

  return (
    <QaSettingsClient 
      user={user} 
      role={role} 
      initialIndicators={indicators}
      initialWeights={weights}
    />
  );
}
