import { getCurrentUserWithRole, hasRole } from '@/app/lib/authz';
import { redirect } from 'next/navigation';
import ActivitiesClient from './ActivitiesClient';
import { activityServiceServer } from '@/app/lib/services/activityService.server';

export default async function ActivitiesPage() {
  const { user, profile, role } = await getCurrentUserWithRole();
  if (!user) {
    redirect('/?auth=login');
  }

  if (!hasRole(role, ['trainer', 'admin', 'superadmin'])) {
    redirect('/dashboard');
  }

  const initialLogs = await activityServiceServer.getRecentActivities(500);

  return <ActivitiesClient user={user} role={role} profile={profile} initialLogs={initialLogs} />;
}
