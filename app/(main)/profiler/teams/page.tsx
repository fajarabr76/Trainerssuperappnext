import React from 'react';
import { Metadata } from 'next';
import { profilerServiceServer } from '../services/profilerService.server';
import ProfilerTeamsClient from './components/ProfilerTeamsClient';

export const metadata: Metadata = {
  title: 'Manajemen Tim | Trainers SuperApp',
  description: 'Kelola daftar tim kustom untuk peserta.',
};

export default async function ProfilerTeamsPage() {
  // Fetch initial data on server
  const teams = await profilerServiceServer.getTimList();

  return (
    <ProfilerTeamsClient
      initialTeams={teams}
    />
  );
}
