'use client';

import DashboardClient from './DashboardClient';
import { useAuth } from '@/app/lib/hooks/useAuth';

export default function DashboardPage() {
  const { user, profile, role, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background text-foreground">Loading...</div>;
  }

  return <DashboardClient user={user} role={role} profile={profile} />;
}

