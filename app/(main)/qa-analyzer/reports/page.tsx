import { requirePageAccess } from '@/app/lib/authz';
import ReportsLandingClient from './ReportsLandingClient';

export default async function ReportsLandingPage() {
  const { role } = await requirePageAccess({
    allowedRoles: ['trainer', 'admin']
  });

  return <ReportsLandingClient role={role} />;
}
