import React from 'react';
import MainLayoutClient from './MainLayoutClient';
import { requirePageAccess } from '@/app/lib/authz';

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, role, profile } = await requirePageAccess();

  return (
    <MainLayoutClient user={user} role={role} profile={profile}>
      {children}
    </MainLayoutClient>
  );
}
