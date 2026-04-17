'use client';

import MonitoringClient from './MonitoringClient';
import { useAuth } from '@/app/lib/hooks/useAuth';

export default function MonitoringPage() {
  const { user, profile, role, loading } = useAuth(['trainer', 'trainers', 'leader', 'admin']);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background text-foreground">Loading...</div>;
  }

  return <MonitoringClient user={user} role={role} profile={profile} />;
}
