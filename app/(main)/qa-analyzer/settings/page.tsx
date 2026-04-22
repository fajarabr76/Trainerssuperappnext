import QaVersionedSettings from './QaVersionedSettings';
import { qaServiceServer } from '../services/qaService.server';
import { getAllServiceWeightsAction } from '../actions';
import { requirePageAccess } from '@/app/lib/authz';

export const dynamic = 'force-dynamic';

export default async function QaSettingsPage() {
  const { user, role } = await requirePageAccess({
    allowedRoles: ['trainer', 'admin']
  });

  // Fetch initial data
  const [indicators, weightsRes, periods] = await Promise.all([
    qaServiceServer.getIndicators(),
    getAllServiceWeightsAction(),
    qaServiceServer.getPeriods(),
  ]);

  return (
    <QaVersionedSettings
      user={user}
      role={role}
      initialIndicators={indicators}
      initialWeights={weightsRes.data}
      periods={periods}
    />
  );
}
