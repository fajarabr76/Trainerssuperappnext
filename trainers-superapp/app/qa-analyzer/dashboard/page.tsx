'use client';

import QaDashboardClient from './QaDashboardClient';
import { useAuth } from '@/app/lib/hooks/useAuth';

export default function QaDashboardPage() {
  const { user, profile, role, loading } = useAuth(['trainer', 'trainers', 'leader']);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background text-foreground">Loading...</div>;
  }

  return <QaDashboardClient user={user} role={role} profile={profile} />;
}
