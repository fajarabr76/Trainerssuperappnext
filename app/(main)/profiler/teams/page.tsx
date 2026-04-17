import React from 'react';
import { Metadata } from 'next';
import { createClient } from '@/app/lib/supabase/server';
import { redirect } from 'next/navigation';
import { profilerServiceServer } from '../services/profilerService.server';
import ProfilerTeamsClient from './components/ProfilerTeamsClient';

export const metadata: Metadata = {
  title: 'Manajemen Tim | Trainers SuperApp',
  description: 'Kelola daftar tim kustom untuk peserta.',
};

export default async function ProfilerTeamsPage() {
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

  // Allowed roles for this page (including leader for read-only)
  const allowedRoles = ['trainer', 'trainers', 'leader', 'admin'];
  if (!allowedRoles.includes(role)) {
    redirect('/dashboard');
  }

  // Fetch initial data on server
  const teams = await profilerServiceServer.getTimList();

  return (
    <ProfilerTeamsClient
      initialTeams={teams}
      role={role}
    />
  );
}
