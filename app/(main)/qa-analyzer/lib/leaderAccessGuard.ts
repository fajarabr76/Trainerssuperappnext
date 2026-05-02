import { getCurrentUserContext } from '@/app/lib/authz';
import { getLeaderAccessStatus } from '@/app/lib/access-control/leaderAccess.server';
import type { LeaderScopeFilter, LeaderAccessStatus } from '@/app/lib/access-control/leaderScope';

export interface LeaderAccessResult {
  blocked: boolean;
  status: LeaderAccessStatus;
  scope: LeaderScopeFilter | null;
}

/**
 * Check leader access for SIDAK module.
 * Returns { blocked: true } if leader has no approved access -> page should show LeaderAccessStatus.
 * Returns { blocked: false, scope } if leader has approved access with scope -> page should filter data.
 * Returns { blocked: false, scope: null } for non-leader roles (admin/trainer) -> full access.
 */
export async function checkSidakLeaderAccess(): Promise<LeaderAccessResult> {
  const { user, role } = await getCurrentUserContext();

  if (role !== 'leader' || !user) {
    return { blocked: false, status: 'approved', scope: null };
  }

  const accessInfo = await getLeaderAccessStatus(user.id, 'sidak');

  if (!accessInfo.hasAccess) {
    return { blocked: true, status: accessInfo.status, scope: null };
  }

  return {
    blocked: false,
    status: 'approved',
    scope: accessInfo.scopeFilter,
  };
}

/**
 * Check leader access for KTP module.
 */
export async function checkKtpLeaderAccess(): Promise<LeaderAccessResult> {
  const { user, role } = await getCurrentUserContext();

  if (role !== 'leader' || !user) {
    return { blocked: false, status: 'approved', scope: null };
  }

  const accessInfo = await getLeaderAccessStatus(user.id, 'ktp');

  if (!accessInfo.hasAccess) {
    return { blocked: true, status: accessInfo.status, scope: null };
  }

  return {
    blocked: false,
    status: 'approved',
    scope: accessInfo.scopeFilter,
  };
}
