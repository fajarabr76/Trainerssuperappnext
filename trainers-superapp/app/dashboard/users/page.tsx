'use client';

import UsersClient from './UsersClient';
import { useAuth } from '@/app/lib/hooks/useAuth';

export default function UsersPage() {
  const { user, profile, role, loading } = useAuth(['trainer', 'trainers']);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background text-foreground">Loading...</div>;
  }

  return <UsersClient user={user} role={role} profile={profile} />;
}
