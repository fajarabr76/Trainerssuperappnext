import { requirePageAccess } from '@/app/lib/authz';
import { getAccessGroups, getAccessScopeOptions } from '@/app/actions/leader-access';
import AccessGroupsClient from './AccessGroupsClient';

export default async function AccessGroupsPage() {
  const { role } = await requirePageAccess({
    allowedRoles: ['admin', 'trainer'],
  });

  const [groups, scopeOptions] = await Promise.all([
    getAccessGroups(),
    getAccessScopeOptions(),
  ]);

  return (
    <AccessGroupsClient
      role={role}
      initialGroups={groups}
      scopeOptions={scopeOptions}
    />
  );
}
