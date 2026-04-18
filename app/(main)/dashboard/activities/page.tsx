import ActivitiesClient from './ActivitiesClient';
import { activityServiceServer } from '@/app/lib/services/activityService.server';
import { requirePageAccess } from '@/app/lib/authz';

export default async function ActivitiesPage() {
  const { user, profile, role } = await requirePageAccess({
    allowedRoles: ['trainer', 'admin']
  });

  const initialLogs = await activityServiceServer.getRecentActivities(500);

  return <ActivitiesClient user={user} role={role} profile={profile} initialLogs={initialLogs} />;
}
