import React from 'react';
import { createClient } from '@/app/lib/supabase/server';
import MainLayoutClient from './MainLayoutClient';
import { redirect } from 'next/navigation';

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    redirect('/?auth=login');
  }

  let role = '';
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, status')
    .eq('id', user.id)
    .single();

  if (profile) {
    role = profile.role;
  }

  return (
    <MainLayoutClient user={user} role={role}>
      {children}
    </MainLayoutClient>
  );
}
