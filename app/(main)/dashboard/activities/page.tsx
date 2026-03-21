import { createClient } from '@/app/lib/supabase/server';
import { redirect } from 'next/navigation';
import ActivitiesClient from './ActivitiesClient';

export default async function ActivitiesPage() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/?auth=login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const role = profile?.role || 'user';

  return <ActivitiesClient user={user} role={role} profile={profile} />;
}
