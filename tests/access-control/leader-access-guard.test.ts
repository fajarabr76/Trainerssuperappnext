import { describe, expect, it, vi, beforeEach } from 'vitest';
import { checkSidakLeaderAccess, checkKtpLeaderAccess } from '../../app/(main)/qa-analyzer/lib/leaderAccessGuard';
import * as authz from '../../app/lib/authz';
import * as leaderAccess from '../../app/lib/access-control/leaderAccess.server';

vi.mock('../../app/lib/authz', () => ({
  getCurrentUserContext: vi.fn(),
}));

vi.mock('../../app/lib/access-control/leaderAccess.server', () => ({
  getLeaderAccessStatus: vi.fn(),
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

      const result = await checkSidakLeaderAccess();
      expect(result).toEqual({ blocked: false, status: 'approved', scope: null });
      expect(leaderAccess.getLeaderAccessStatus).not.toHaveBeenCalled();
    });

    it('allows access for non-leader roles (trainer)', async () => {
      vi.mocked(authz.getCurrentUserContext).mockResolvedValue({
        user: { id: 'user-1' } as any,
        role: 'trainer',
        agentData: null,
      });

      const result = await checkSidakLeaderAccess();
      expect(result).toEqual({ blocked: false, status: 'approved', scope: null });
    });

    it('allows access for unauthenticated users (role not leader)', async () => {
      vi.mocked(authz.getCurrentUserContext).mockResolvedValue({
        user: null,
        role: 'guest',
        agentData: null,
      });

      const result = await checkSidakLeaderAccess();
      expect(result).toEqual({ blocked: false, status: 'approved', scope: null });
    });

    it('blocks access if leader does not have approved access', async () => {
      vi.mocked(authz.getCurrentUserContext).mockResolvedValue({
        user: { id: 'leader-1' } as any,
        role: 'leader',
        agentData: null,
      });
      vi.mocked(leaderAccess.getLeaderAccessStatus).mockResolvedValue({
        hasAccess: false,
        status: 'pending',
        scopeFilter: null,
      });

      const result = await checkSidakLeaderAccess();
      expect(result).toEqual({ blocked: true, status: 'pending', scope: null });
      expect(leaderAccess.getLeaderAccessStatus).toHaveBeenCalledWith('leader-1', 'sidak');
    });

    it('grants access with scope if leader has approved access', async () => {
      const mockScope = { batch_names: ['Batch A'] };
      vi.mocked(authz.getCurrentUserContext).mockResolvedValue({
        user: { id: 'leader-2' } as any,
        role: 'leader',
        agentData: null,
      });
      vi.mocked(leaderAccess.getLeaderAccessStatus).mockResolvedValue({
        hasAccess: true,
        status: 'approved',
        scopeFilter: mockScope,
      });

      const result = await checkSidakLeaderAccess();
      expect(result).toEqual({ blocked: false, status: 'approved', scope: mockScope });
    });
  });

  describe('checkKtpLeaderAccess', () => {
    it('blocks access if leader does not have approved access', async () => {
      vi.mocked(authz.getCurrentUserContext).mockResolvedValue({
        user: { id: 'leader-1' } as any,
        role: 'leader',
        agentData: null,
      });
      vi.mocked(leaderAccess.getLeaderAccessStatus).mockResolvedValue({
        hasAccess: false,
        status: 'none',
        scopeFilter: null,
      });

      const result = await checkKtpLeaderAccess();
      expect(result).toEqual({ blocked: true, status: 'none', scope: null });
      expect(leaderAccess.getLeaderAccessStatus).toHaveBeenCalledWith('leader-1', 'ktp');
    });

    it('grants access with scope if leader has approved access', async () => {
      const mockScope = { tims: ['Tim Alpha'] };
      vi.mocked(authz.getCurrentUserContext).mockResolvedValue({
        user: { id: 'leader-3' } as any,
        role: 'leader',
        agentData: null,
      });
      vi.mocked(leaderAccess.getLeaderAccessStatus).mockResolvedValue({
        hasAccess: true,
        status: 'approved',
        scopeFilter: mockScope,
      });

      const result = await checkKtpLeaderAccess();
      expect(result).toEqual({ blocked: false, status: 'approved', scope: mockScope });
    });
  });
});
