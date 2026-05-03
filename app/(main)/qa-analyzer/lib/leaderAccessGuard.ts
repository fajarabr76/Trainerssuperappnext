import { getCurrentUserContext } from '@/app/lib/authz';
import { getAllowedParticipantIdsForLeader } from '@/app/lib/access-control/leaderAccess.server';
import type { LeaderScopeFilter, LeaderAccessStatus } from '@/app/lib/access-control/leaderScope';

export interface LeaderAccessResult {
  blocked: boolean;
  status: LeaderAccessStatus;
  scope: LeaderScopeFilter | null;
  participantIds: string[] | null;
}

/**
 * Check leader access for SIDAK module.
 * Returns { blocked: true } if leader has no approved access -> page should show LeaderAccessStatus.
 * Returns { blocked: false, scope, participantIds } if leader has approved access -> page should filter data.
 * Returns { blocked: false, scope: null, participantIds: null } for non-leader roles (admin/trainer) -> full access.
 */
export async function checkSidakLeaderAccess(): Promise<LeaderAccessResult> {
  const { user, role } = await getCurrentUserContext();

  if (!user || role !== 'leader') {
    return { blocked: false, status: 'approved', scope: null, participantIds: null };
  }

  const participantAccess = await getAllowedParticipantIdsForLeader(user.id, 'sidak', role);

  if (!participantAccess.hasAccess) {
    return { blocked: true, status: participantAccess.status, scope: null, participantIds: [] };
  }

  return {
    blocked: false,
    status: 'approved',
    scope: participantAccess.scopeFilter,
    participantIds: participantAccess.participantIds,
  };
}

/**
 * Check leader access for KTP module.
 */
export async function checkKtpLeaderAccess(): Promise<LeaderAccessResult> {
  const { user, role } = await getCurrentUserContext();

  if (!user || role !== 'leader') {
    return { blocked: false, status: 'approved', scope: null, participantIds: null };
  }

  const participantAccess = await getAllowedParticipantIdsForLeader(user.id, 'ktp', role);

  if (!participantAccess.hasAccess) {
    return { blocked: true, status: participantAccess.status, scope: null, participantIds: [] };
  }

  return {
    blocked: false,
    status: 'approved',
    scope: participantAccess.scopeFilter,
    participantIds: participantAccess.participantIds,
  };
}
