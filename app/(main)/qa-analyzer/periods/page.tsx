import QaPeriodsClient from './QaPeriodsClient';
import { qaServiceServer } from '../services/qaService.server';
import { requirePageAccess } from '@/app/lib/authz';

export const dynamic = 'force-dynamic';

export default async function QaPeriodsPage() {
  const { user, role } = await requirePageAccess({
    allowedRoles: ['trainer', 'admin']
  });

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
