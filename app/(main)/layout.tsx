import React from 'react';
import MainLayoutClient from './MainLayoutClient';
import { redirect } from 'next/navigation';
import { getCurrentUserContext } from '@/app/lib/authz';

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, role, profile } = await getCurrentUserContext();

  if (!user) {
    redirect('/?auth=login');
  }

  return (
    <MainLayoutClient user={user} role={role} profile={profile}>
      {children}
    </MainLayoutClient>
  );
}
