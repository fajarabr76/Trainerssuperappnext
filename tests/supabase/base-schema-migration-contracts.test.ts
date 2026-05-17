import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { describe, expect, it } from 'vitest';

const BASELINE_MIGRATION_PATH =
  'supabase/migrations/20260401000000_create_initial_app_base_schema.sql';
const FIRST_SIDAK_MIGRATION_PATH =
  'supabase/migrations/20260407190000_add_service_weights.sql';
const BASELINE_ROLLBACK_PATH =
  'supabase/rollback/20260401000000_create_initial_app_base_schema.down.sql';

function migrationVersion(path: string) {
  return Number(basename(path).split('_')[0]);
}

describe('initial app base schema migration contract', () => {
  it('baseline migration sorts before the first SIDAK migration that depends on qa_indicators', () => {
    expect(migrationVersion(BASELINE_MIGRATION_PATH)).toBeLessThan(
      migrationVersion(FIRST_SIDAK_MIGRATION_PATH)
    );
  });

  it('creates foundational tables referenced by later migrations', () => {
    const sql = readFileSync(BASELINE_MIGRATION_PATH, 'utf8');
    const requiredTables = [
      'profiles',
      'activity_logs',
      'user_settings',
      'profiler_years',
      'profiler_folders',
      'profiler_peserta',
      'profiler_tim_list',
      'ketik_history',
      'pdkt_history',
      'qa_periods',
      'qa_indicators',
      'qa_temuan',
    ];

    for (const table of requiredTables) {
      expect(sql).toMatch(
        new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}\\b`, 'i')
      );
    }
  });

  it('creates helper functions needed before later trigger/policy migrations', () => {
    const sql = readFileSync(BASELINE_MIGRATION_PATH, 'utf8');

    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.get_auth_role()');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.update_updated_at_column()');
    expect(sql).toContain('SET search_path = public, pg_temp');
  });

  it('keeps baseline grants least-privilege and avoids broad public access', () => {
    const sql = readFileSync(BASELINE_MIGRATION_PATH, 'utf8');

    expect(sql).toContain('REVOKE ALL ON public.profiles FROM anon, public;');
    expect(sql).toContain('GRANT UPDATE (full_name) ON public.profiles TO authenticated;');
    expect(sql).not.toMatch(/GRANT\s+ALL\s+ON\s+public\.profiles\s+TO\s+authenticated/i);
    expect(sql).not.toMatch(/GRANT\s+.*ON\s+public\.[a-z_]+\s+TO\s+anon/i);
  });

  it('rollback refuses destructive drops unless tables are empty', () => {
    const sql = readFileSync(BASELINE_ROLLBACK_PATH, 'utf8');

    expect(sql).toContain('Rollback is local/dev only');
    expect(sql).toContain('Refusing to drop non-empty base table');
    expect(sql).toContain('SELECT COUNT(*)');
  });
});
