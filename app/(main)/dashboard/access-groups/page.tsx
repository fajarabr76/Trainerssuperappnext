import { requirePageAccess } from '@/app/lib/authz';
import { getAccessGroups } from '@/app/actions/leader-access';
import AccessGroupsClient from './AccessGroupsClient';

export default async function AccessGroupsPage() {
  const { role } = await requirePageAccess({
    allowedRoles: ['admin', 'trainer'],
  });

  const groups = await getAccessGroups();

  return (
    <AccessGroupsClient
      role={role}
      initialGroups={groups}
    />
  );
}
