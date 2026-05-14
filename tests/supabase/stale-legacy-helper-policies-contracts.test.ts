import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const MIGRATION_PATH = 'supabase/migrations/20260515020000_drop_stale_legacy_helper_policies.sql';
const ROLLBACK_PATH = 'supabase/rollback/20260515020000_drop_stale_legacy_helper_policies.down.sql';

describe('stale legacy helper policy cleanup contracts', () => {
  it('creates the cleanup migration and matching rollback file', () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true);
    expect(existsSync(ROLLBACK_PATH)).toBe(true);
  });

  it('drops policies by scanning pg_policies for legacy helper references', () => {
    const sql = readFileSync(MIGRATION_PATH, 'utf8');

    expect(sql).toContain('FROM pg_policies');
    expect(sql).toContain("ILIKE '%is_approved_trainer%'");
    expect(sql).toContain("ILIKE '%is_super_admin%'");
    expect(sql).toContain("ILIKE '%get_my_role%'");
    expect(sql).toContain("ILIKE '%get_my_status%'");
    expect(sql).toContain('DROP POLICY IF EXISTS');
  });

  it('includes fail-fast guard if any stale references remain', () => {
    const sql = readFileSync(MIGRATION_PATH, 'utf8');

    expect(sql).toContain('CRITICAL: stale legacy-helper policy references still exist');
    expect(sql).toContain('v_remaining > 0');
  });
});
