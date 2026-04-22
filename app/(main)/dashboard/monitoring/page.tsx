import MonitoringClient from './MonitoringClient';
import { requirePageAccess } from '@/app/lib/authz';
import { getMonitoringHistory } from './monitoringData';

export default async function MonitoringPage() {
  await requirePageAccess({
    allowedRoles: ['trainer', 'leader', 'admin']
  });
  const initialResults = await getMonitoringHistory();

  return <MonitoringClient initialResults={initialResults} />;
}
