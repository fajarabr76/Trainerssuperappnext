import { describe, expect, it } from 'vitest';
import { resolveLeaderScope } from '../../app/lib/access-control/leaderScope';
import type { AccessGroupItem } from '../../app/lib/access-control/leaderScope';

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

describe('resolveLeaderScope', () => {
  // --- KTP module tests ---

  describe('KTP module', () => {
    it('returns empty scope when no items provided', () => {
      const result = resolveLeaderScope('ktp', []);
      expect(result).toEqual({});
    });

    it('returns empty scope when items is null/undefined', () => {
      // @ts-expect-error testing edge case
      expect(resolveLeaderScope('ktp', null)).toEqual({});
      // @ts-expect-error testing edge case
      expect(resolveLeaderScope('ktp', undefined)).toEqual({});
    });

    it('collects peserta_id values for KTP', () => {
      const items = [
        makeItem({ field_name: 'peserta_id', field_value: 'p1' }),
        makeItem({ field_name: 'peserta_id', field_value: 'p2' }),
      ];
      const result = resolveLeaderScope('ktp', items);
      expect(result.peserta_ids).toEqual(['p1', 'p2']);
    });

    it('collects batch_name values for KTP', () => {
      const items = [
        makeItem({ field_name: 'batch_name', field_value: 'Batch A' }),
        makeItem({ field_name: 'batch_name', field_value: 'Batch B' }),
      ];
      const result = resolveLeaderScope('ktp', items);
      expect(result.batch_names).toEqual(['Batch A', 'Batch B']);
    });

    it('collects tim values for KTP', () => {
      const items = [
        makeItem({ field_name: 'tim', field_value: 'Tim Alpha' }),
        makeItem({ field_name: 'tim', field_value: 'Tim Beta' }),
      ];
      const result = resolveLeaderScope('ktp', items);
      expect(result.tims).toEqual(['Tim Alpha', 'Tim Beta']);
    });

    it('ignores service_type for KTP', () => {
      const items = [
        makeItem({ field_name: 'peserta_id', field_value: 'p1' }),
        makeItem({ field_name: 'service_type', field_value: 'call' }),
        makeItem({ field_name: 'service_type', field_value: 'chat' }),
      ];
      const result = resolveLeaderScope('ktp', items);
      expect(result.peserta_ids).toEqual(['p1']);
      expect(result.service_types).toBeUndefined();
      expect(result.batch_names).toBeUndefined();
      expect(result.tims).toBeUndefined();
    });

    it('returns empty scope when all items are inactive', () => {
      const items = [
        makeItem({ field_name: 'peserta_id', field_value: 'p1', is_active: false }),
        makeItem({ field_name: 'batch_name', field_value: 'Batch A', is_active: false }),
      ];
      const result = resolveLeaderScope('ktp', items);
      expect(result).toEqual({});
    });

    it('skips inactive items and keeps active ones', () => {
      const items = [
        makeItem({ field_name: 'peserta_id', field_value: 'p1', is_active: true }),
        makeItem({ field_name: 'peserta_id', field_value: 'p2', is_active: false }),
      ];
      const result = resolveLeaderScope('ktp', items);
      expect(result.peserta_ids).toEqual(['p1']);
    });

    it('deduplicates duplicate values', () => {
      const items = [
        makeItem({ field_name: 'batch_name', field_value: 'Batch A' }),
        makeItem({ field_name: 'batch_name', field_value: 'Batch A' }),
        makeItem({ field_name: 'batch_name', field_value: 'Batch B' }),
      ];
      const result = resolveLeaderScope('ktp', items);
      expect(result.batch_names).toEqual(['Batch A', 'Batch B']);
    });

    it('handles mixed field types for KTP', () => {
      const items = [
        makeItem({ field_name: 'peserta_id', field_value: 'p1' }),
        makeItem({ field_name: 'batch_name', field_value: 'Batch A' }),
        makeItem({ field_name: 'tim', field_value: 'Tim X' }),
        makeItem({ field_name: 'service_type', field_value: 'call' }), // ignored for KTP
      ];
      const result = resolveLeaderScope('ktp', items);
      expect(result.peserta_ids).toEqual(['p1']);
      expect(result.batch_names).toEqual(['Batch A']);
      expect(result.tims).toEqual(['Tim X']);
      expect(result.service_types).toBeUndefined();
    });
  });

  // --- SIDAK module tests ---

  describe('SIDAK module', () => {
    it('returns empty scope when no items provided', () => {
      const result = resolveLeaderScope('sidak', []);
      expect(result).toEqual({});
    });

    it('collects peserta_id values for SIDAK', () => {
      const items = [
        makeItem({ field_name: 'peserta_id', field_value: 'p1' }),
        makeItem({ field_name: 'peserta_id', field_value: 'p2' }),
      ];
      const result = resolveLeaderScope('sidak', items);
      expect(result.peserta_ids).toEqual(['p1', 'p2']);
    });

    it('collects batch_name values for SIDAK', () => {
      const items = [
        makeItem({ field_name: 'batch_name', field_value: 'Batch A' }),
      ];
      const result = resolveLeaderScope('sidak', items);
      expect(result.batch_names).toEqual(['Batch A']);
    });

    it('collects tim values for SIDAK', () => {
      const items = [
        makeItem({ field_name: 'tim', field_value: 'Tim Alpha' }),
      ];
      const result = resolveLeaderScope('sidak', items);
      expect(result.tims).toEqual(['Tim Alpha']);
    });

    it('collects service_type values for SIDAK (unlike KTP)', () => {
      const items = [
        makeItem({ field_name: 'service_type', field_value: 'call' }),
        makeItem({ field_name: 'service_type', field_value: 'chat' }),
      ];
      const result = resolveLeaderScope('sidak', items);
      expect(result.service_types).toEqual(['call', 'chat']);
    });

    it('supports all four field types simultaneously', () => {
      const items = [
        makeItem({ field_name: 'peserta_id', field_value: 'p1' }),
        makeItem({ field_name: 'batch_name', field_value: 'Batch A' }),
        makeItem({ field_name: 'tim', field_value: 'Tim X' }),
        makeItem({ field_name: 'service_type', field_value: 'call' }),
        makeItem({ field_name: 'service_type', field_value: 'chat' }),
      ];
      const result = resolveLeaderScope('sidak', items);
      expect(result.peserta_ids).toEqual(['p1']);
      expect(result.batch_names).toEqual(['Batch A']);
      expect(result.tims).toEqual(['Tim X']);
      expect(result.service_types).toEqual(['call', 'chat']);
    });

    it('skips inactive items for all field types', () => {
      const items = [
        makeItem({ field_name: 'peserta_id', field_value: 'p1', is_active: false }),
        makeItem({ field_name: 'service_type', field_value: 'call', is_active: false }),
        makeItem({ field_name: 'tim', field_value: 'Tim X', is_active: true }),
      ];
      const result = resolveLeaderScope('sidak', items);
      expect(result.tims).toEqual(['Tim X']);
      expect(result.peserta_ids).toBeUndefined();
      expect(result.service_types).toBeUndefined();
    });
  });

  // --- Edge cases ---

  describe('edge cases', () => {
    it('returns empty scope for unknown module', () => {
      const items = [makeItem({ field_name: 'peserta_id', field_value: 'p1' })];
      // @ts-expect-error testing unknown module
      const result = resolveLeaderScope('unknown', items);
      expect(result).toEqual({});
    });

    it('returns empty scope for module "all" (should use specific module)', () => {
      const items = [makeItem({ field_name: 'peserta_id', field_value: 'p1' })];
      // @ts-expect-error testing "all" module
      const result = resolveLeaderScope('all', items);
      // "all" is not a specific module; should return empty since no specific field mapping
      expect(result).toEqual({});
    });

    it('handles empty string field values', () => {
      const items = [
        makeItem({ field_name: 'batch_name', field_value: '' }),
        makeItem({ field_name: 'batch_name', field_value: 'Valid Batch' }),
      ];
      const result = resolveLeaderScope('ktp', items);
      expect(result.batch_names).toEqual(['Valid Batch']);
    });

    it('handles whitespace-only field values', () => {
      const items = [
        makeItem({ field_name: 'tim', field_value: '   ' }),
        makeItem({ field_name: 'tim', field_value: 'Tim X' }),
      ];
      const result = resolveLeaderScope('sidak', items);
      expect(result.tims).toEqual(['Tim X']);
    });

    it('returns empty object (not null/undefined) on empty result', () => {
      const result = resolveLeaderScope('ktp', []);
      expect(result).not.toBeNull();
      expect(result).not.toBeUndefined();
      expect(result).toEqual({});
    });
  });
});
