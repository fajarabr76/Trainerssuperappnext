import { createClient } from '@/app/lib/supabase/server';
import { redirect } from 'next/navigation';
import SettingsClient from './SettingsClient';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/?auth=login');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    // Graceful fallback if profile is missing
    console.warn('Profile not found for user:', user.id);
  }

  return (
    <SettingsClient 
      user={user} 
      profile={profile} 
    />
  );
}
