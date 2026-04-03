import { createClient } from '@/app/lib/supabase/server';
import { redirect } from 'next/navigation';
import UsersClient from './UsersClient';

export default async function UsersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const role = profile?.role?.toLowerCase() || '';
  const allowedRoles = ['admin', 'superadmin'];
  
  if (!allowedRoles.includes(role)) {
    redirect('/');
  }

  return <UsersClient user={user} role={role} profile={profile} />;
}
