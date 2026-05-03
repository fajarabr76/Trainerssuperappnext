import { describe, expect, it, vi, beforeEach } from 'vitest';
import { checkSidakLeaderAccess, checkKtpLeaderAccess } from '../../app/(main)/qa-analyzer/lib/leaderAccessGuard';
import * as authz from '../../app/lib/authz';
import * as leaderAccess from '../../app/lib/access-control/leaderAccess.server';

vi.mock('../../app/lib/authz', () => ({
  getCurrentUserContext: vi.fn(),
}));

vi.mock('../../app/lib/access-control/leaderAccess.server', () => ({
  getLeaderAccessStatus: vi.fn(),
  getAllowedParticipantIdsForLeader: vi.fn(),
  isPrivilegedRole: vi.fn(),
  normalizeRole: vi.fn(),
  resolveLeaderScope: vi.fn(),
  requestLeaderModuleAccess: vi.fn(),
  assertPrivilegedAccess: vi.fn(),
}));

describe('Leader Access Guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkSidakLeaderAccess', () => {
    it('allows access for non-leader roles (admin)', async () => {
      vi.mocked(authz.getCurrentUserContext).mockResolvedValue({
        user: { id: 'user-1' } as any,
        role: 'admin',
        agentData: null,
      });
      vi.mocked(leaderAccess.isPrivilegedRole).mockReturnValue(true);
      vi.mocked(leaderAccess.getAllowedParticipantIdsForLeader).mockResolvedValue({
        hasAccess: true,
        status: 'approved',
        scopeFilter: {},
        participantIds: null,
      });

      const result = await checkSidakLeaderAccess();
      expect(result.blocked).toBe(false);
      expect(result.status).toBe('approved');
      expect(result.scope).toBeNull();
      expect(result.participantIds).toBeNull();
    });

    it('allows access for non-leader roles (trainer)', async () => {
      vi.mocked(authz.getCurrentUserContext).mockResolvedValue({
        user: { id: 'user-1' } as any,
        role: 'trainer',
        agentData: null,
      });
      vi.mocked(leaderAccess.isPrivilegedRole).mockReturnValue(true);
      vi.mocked(leaderAccess.getAllowedParticipantIdsForLeader).mockResolvedValue({
        hasAccess: true,
        status: 'approved',
        scopeFilter: {},
        participantIds: null,
      });

      const result = await checkSidakLeaderAccess();
      expect(result.blocked).toBe(false);
      expect(result.participantIds).toBeNull();
    });

    it('allows access for unauthenticated users (role not leader)', async () => {
      vi.mocked(authz.getCurrentUserContext).mockResolvedValue({
        user: null,
        role: 'guest',
        agentData: null,
      });

      const result = await checkSidakLeaderAccess();
      expect(result).toEqual({ blocked: false, status: 'approved', scope: null, participantIds: null });
    });

    it('blocks access if leader does not have approved access', async () => {
      vi.mocked(authz.getCurrentUserContext).mockResolvedValue({
        user: { id: 'leader-1' } as any,
        role: 'leader',
        agentData: null,
      });
      vi.mocked(leaderAccess.getAllowedParticipantIdsForLeader).mockResolvedValue({
        hasAccess: false,
        status: 'pending',
        scopeFilter: {},
        participantIds: [],
      });

      const result = await checkSidakLeaderAccess();
      expect(result).toEqual({ blocked: true, status: 'pending', scope: null, participantIds: [] });
      expect(leaderAccess.getAllowedParticipantIdsForLeader).toHaveBeenCalledWith('leader-1', 'sidak', 'leader');
    });

    it('grants access with scope and participantIds if leader has approved access', async () => {
      const mockScope = { batch_names: ['Batch A'] };
      const mockParticipantIds = ['p1', 'p2', 'p3'];
      vi.mocked(authz.getCurrentUserContext).mockResolvedValue({
        user: { id: 'leader-2' } as any,
        role: 'leader',
        agentData: null,
      });
      vi.mocked(leaderAccess.getAllowedParticipantIdsForLeader).mockResolvedValue({
        hasAccess: true,
        status: 'approved',
        scopeFilter: mockScope,
        participantIds: mockParticipantIds,
      });

      const result = await checkSidakLeaderAccess();
      expect(result.blocked).toBe(false);
      expect(result.status).toBe('approved');
      expect(result.scope).toEqual(mockScope);
      expect(result.participantIds).toEqual(mockParticipantIds);
    });
  });

  describe('checkKtpLeaderAccess', () => {
    it('blocks access if leader does not have approved access', async () => {
      vi.mocked(authz.getCurrentUserContext).mockResolvedValue({
        user: { id: 'leader-1' } as any,
        role: 'leader',
        agentData: null,
      });
      vi.mocked(leaderAccess.getAllowedParticipantIdsForLeader).mockResolvedValue({
        hasAccess: false,
        status: 'none',
        scopeFilter: {},
        participantIds: [],
      });

      const result = await checkKtpLeaderAccess();
      expect(result).toEqual({ blocked: true, status: 'none', scope: null, participantIds: [] });
      expect(leaderAccess.getAllowedParticipantIdsForLeader).toHaveBeenCalledWith('leader-1', 'ktp', 'leader');
    });

    it('grants access with scope and participantIds if leader has approved access', async () => {
      const mockScope = { tims: ['Tim Alpha'] };
      const mockParticipantIds = ['p5', 'p6'];
      vi.mocked(authz.getCurrentUserContext).mockResolvedValue({
        user: { id: 'leader-3' } as any,
        role: 'leader',
        agentData: null,
      });
      vi.mocked(leaderAccess.getAllowedParticipantIdsForLeader).mockResolvedValue({
        hasAccess: true,
        status: 'approved',
        scopeFilter: mockScope,
        participantIds: mockParticipantIds,
      });

      const result = await checkKtpLeaderAccess();
      expect(result.blocked).toBe(false);
      expect(result.status).toBe('approved');
      expect(result.scope).toEqual(mockScope);
      expect(result.participantIds).toEqual(mockParticipantIds);
    });
  });
});