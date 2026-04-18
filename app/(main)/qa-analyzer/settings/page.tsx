import QaSettingsClient from './QaSettingsClient';
import { qaServiceServer } from '../services/qaService.server';
import { getAllServiceWeightsAction } from '../actions';
import { requirePageAccess } from '@/app/lib/authz';

export const dynamic = 'force-dynamic';

export default async function QaSettingsPage() {
  const { user, role } = await requirePageAccess({
    allowedRoles: ['trainer', 'admin']
  });

  // Fetch initial data - all indicators and weights
  const [indicators, weights] = await Promise.all([
    qaServiceServer.getIndicators(),
    getAllServiceWeightsAction(),
  ]);

  return (
    <QaSettingsClient 
      user={user} 
      role={role} 
      initialIndicators={indicators}
      initialWeights={weights}
    />
  );
}
