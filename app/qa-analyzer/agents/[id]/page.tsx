'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/app/lib/hooks/useAuth';
import QaAgentDetailClient from './QaAgentDetailClient';

export default function AgentDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { user, profile, role, loading } = useAuth(['trainer', 'trainers', 'leader', 'admin']);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background text-foreground">Loading...</div>;
  }

  return <QaAgentDetailClient agentId={id} user={user} role={role} profile={profile} />;
}
