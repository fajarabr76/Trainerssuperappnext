'use client';

import QaInputClient from './QaInputClient';
import { useAuth } from '@/app/lib/hooks/useAuth';

export default function QaInputPage() {
  const { user, profile, role, loading } = useAuth(['trainer', 'trainers', 'leader']);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background text-foreground">Loading...</div>;
  }

  return <QaInputClient user={user} role={role} profile={profile} />;
}