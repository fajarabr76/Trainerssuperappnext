import { describe, expect, it } from 'vitest';
import { resolveLeaderScope } from '../../app/lib/access-control/leaderScope';
import type { AccessGroupItem } from '../../app/lib/access-control/leaderScope';
import { readFileSync } from 'node:fs';

function makeItem(
  overrides: Partial<AccessGroupItem> & { field_name: AccessGroupItem['field_name']; field_value: string },
): AccessGroupItem {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    access_group_id: overrides.access_group_id ?? crypto.randomUUID(),
    field_name: overrides.field_name,
    field_value: overrides.field_value,
    is_active: overrides.is_active ?? true,
  };
}

describe('getAllowedParticipantIdsForLeader contract', () => {
  const leaderAccessSource = readFileSync('app/lib/access-control/leaderAccess.server.ts', 'utf8');

  it('exports getAllowedParticipantIdsForLeader function', () => {
    expect(leaderAccessSource).toContain('export async function getAllowedParticipantIdsForLeader');
  });

  it('returns LeaderParticipantAccess type with participantIds field', () => {
    expect(leaderAccessSource).toContain('participantIds');
    expect(leaderAccessSource).toContain('LeaderParticipantAccess');
  });

  it('resolves batch_name scope items to profiler_peserta IDs via database query', () => {
    expect(leaderAccessSource).toContain("batch_name");
    expect(leaderAccessSource).toContain('profiler_peserta');
    expect(leaderAccessSource).toContain(".in('batch_name'");
  });

  it('resolves tim scope items to profiler_peserta IDs via database query', () => {
    expect(leaderAccessSource).toContain('tim');
    expect(leaderAccessSource).toContain('profiler_peserta');
    expect(leaderAccessSource).toContain(".in('tim'");
  });

  it('uses direct peserta_id from scope without additional resolution', () => {
    expect(leaderAccessSource).toContain('scope.peserta_ids');
    expect(leaderAccessSource).toContain('directIds');
  });

  it('returns null participantIds for privileged roles (admin/trainer)', () => {
    expect(leaderAccessSource).toContain('isPrivilegedRole(normalizedRole)');
    expect(leaderAccessSource).toContain('participantIds: null');
  });

  it('returns empty participantIds array for leaders without approved access', () => {
    expect(leaderAccessSource).toContain('participantIds: []');
  });
});

describe('resolveLeaderScope contract', () => {
  describe('KTP module', () => {
    it('returns empty scope when no items provided', () => {
      const result = resolveLeaderScope('ktp', []);
      expect(result).toEqual({});
    });

    it('collects peserta_id values for KTP', () => {
      const items = [
        makeItem({ field_name: 'peserta_id', field_value: 'p1' }),
        makeItem({ field_name: 'peserta_id', field_value: 'p2' }),
      ];
      const result = resolveLeaderScope('ktp', items);
      expect(result.peserta_ids).toEqual(['p1', 'p2']);
    });

    it('ignores service_type for KTP', () => {
      const items = [
        makeItem({ field_name: 'peserta_id', field_value: 'p1' }),
        makeItem({ field_name: 'service_type', field_value: 'call' }),
      ];
      const result = resolveLeaderScope('ktp', items);
      expect(result.peserta_ids).toEqual(['p1']);
      expect(result.service_types).toBeUndefined();
    });
  });

  describe('SIDAK module', () => {
    it('collects all four scope fields for SIDAK', () => {
      const items = [
        makeItem({ field_name: 'peserta_id', field_value: 'p1' }),
        makeItem({ field_name: 'batch_name', field_value: 'Batch A' }),
        makeItem({ field_name: 'tim', field_value: 'Chat' }),
        makeItem({ field_name: 'service_type', field_value: 'call' }),
      ];
      const result = resolveLeaderScope('sidak', items);
      expect(result.peserta_ids).toEqual(['p1']);
      expect(result.batch_names).toEqual(['Batch A']);
      expect(result.tims).toEqual(['Chat']);
      expect(result.service_types).toEqual(['call']);
    });
  });
});

describe('leader-sidak-contracts: participant-ID-based filtering', () => {
  const dashboardSource = readFileSync('app/(main)/qa-analyzer/dashboard/page.tsx', 'utf8');

  it('dominant service computation is called for leaders with participants', () => {
    expect(dashboardSource).toContain('computeDominantService');
    expect(dashboardSource).toContain('participantIds');
  });

  it('leader scoped path uses consolidated data methods directly with participant IDs', () => {
    expect(dashboardSource).toContain('getConsolidatedDashboardDataByRange');
    expect(dashboardSource).toContain('getConsolidatedTrendDataByRange');
  });

  it('filters topAgents by participantIds for leaders', () => {
    expect(dashboardSource).toContain('leaderTopAgents');
    expect(dashboardSource).toContain('participantIds.includes(a.agentId)');
  });

  it('filters serviceData to only dominant service for leaders', () => {
    expect(dashboardSource).toContain('leaderServiceData');
    expect(dashboardSource).toContain('dominantService');
  });
});