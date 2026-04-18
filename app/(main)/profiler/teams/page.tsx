import React from 'react';
import { Metadata } from 'next';
import { profilerServiceServer } from '../services/profilerService.server';
import ProfilerTeamsClient from './components/ProfilerTeamsClient';
import { requirePageAccess } from '@/app/lib/authz';

export const metadata: Metadata = {
  title: 'Manajemen Tim | Trainers SuperApp',
  description: 'Kelola daftar tim kustom untuk peserta.',
};

export default async function ProfilerTeamsPage() {
  const { role } = await requirePageAccess({
    allowedRoles: ['trainer', 'leader', 'admin']
  });

  // Fetch initial data on server
  const teams = await profilerServiceServer.getTimList();

  return (
    <ProfilerTeamsClient
      initialTeams={teams}
      role={role}
    />
  );
}
