import MonitoringClient from './MonitoringClient';
import { requirePageAccess } from '@/app/lib/authz';

export default async function MonitoringPage() {
  const { user, profile, role } = await requirePageAccess({
    allowedRoles: ['trainer', 'leader', 'admin']
  });

  return <MonitoringClient user={user} role={role} profile={profile} />;
}
