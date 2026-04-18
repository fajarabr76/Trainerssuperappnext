import UsersClient from './UsersClient';
import { requirePageAccess } from '@/app/lib/authz';

export default async function UsersPage() {
  const { user, profile, role } = await requirePageAccess({
    allowedRoles: ['admin', 'trainer']
  });

  return <UsersClient user={user} role={role} profile={profile} />;
}
