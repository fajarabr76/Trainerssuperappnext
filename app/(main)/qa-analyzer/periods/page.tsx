import { getCurrentUserWithRole, hasRole } from '@/app/lib/authz';
import { redirect } from 'next/navigation';
import QaPeriodsClient from './QaPeriodsClient';
import { qaServiceServer } from '../services/qaService.server';

export const dynamic = 'force-dynamic';

export default async function QaPeriodsPage() {
  const { user, role } = await getCurrentUserWithRole();

  if (!user) {
    redirect('/login');
  }

  if (!hasRole(role, ['trainer', 'admin', 'superadmin'])) {
    redirect('/qa-analyzer/dashboard');
  }

  // Fetch initial data
  const periods = await qaServiceServer.getPeriods();

  return (
    <QaPeriodsClient 
      user={user} 
      role={role} 
      initialPeriods={periods}
    />
  );
}
