import { requirePageAccess } from '@/app/lib/authz';
import { getPendingLeaderAccessRequests, getApprovedLeaderAccessList, getAccessGroups } from '@/app/actions/leader-access';
import AccessApprovalClient from './AccessApprovalClient';

export default async function AccessApprovalPage() {
  const { role } = await requirePageAccess({
    allowedRoles: ['admin', 'trainer'],
  });

  const [pending, approved, groups] = await Promise.all([
    getPendingLeaderAccessRequests(),
    getApprovedLeaderAccessList(),
    getAccessGroups(),
  ]);

  return (
    <AccessApprovalClient
      role={role}
      initialPending={pending}
      initialApproved={approved}
      accessGroups={groups}
    />
  );
}
