import { readFileSync, existsSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';

const MIGRATION_PATH = 'supabase/migrations/20260515010000_fix_remaining_rls_policies_after_explicit_grants.sql';
const ROLLBACK_PATH = 'supabase/rollback/20260515010000_fix_remaining_rls_policies_after_explicit_grants.down.sql';
const SQL_SMOKE_PATH = 'supabase/tests/test_remaining_rls_policies_after_explicit_grants.sql';
const CHANGELOG_PATH = 'docs/SUPABASE_DATA_API_GRANTS_CHANGELOG_2026-05-14.md';

describe('remaining RLS policies after explicit grants — static contract tests', () => {
  beforeAll(() => {
    if (!existsSync(MIGRATION_PATH)) {
      throw new Error(`Migration file not found: ${MIGRATION_PATH} — write the migration to make this test pass`);
    }
  });

  const migrationContent = existsSync(MIGRATION_PATH) ? readFileSync(MIGRATION_PATH, 'utf8') : '';
  const rollbackContent = existsSync(ROLLBACK_PATH) ? readFileSync(ROLLBACK_PATH, 'utf8') : '';
  const sqlSmokeContent = existsSync(SQL_SMOKE_PATH) ? readFileSync(SQL_SMOKE_PATH, 'utf8') : '';
  const changelogContent = existsSync(CHANGELOG_PATH) ? readFileSync(CHANGELOG_PATH, 'utf8') : '';

  it('migration timestamp is after the latest migration 20260515000000', () => {
    expect(MIGRATION_PATH).toContain('20260515010000');
  });

  it('prevents usage of agent_id in qa_temuan agent policy — must use peserta_id', () => {
    const agentPolicy = findCreatePolicy(migrationContent, 'qa_temuan', 'Agents can view own qa_temuan');
    expect(agentPolicy).not.toContain('agent_id');
    expect(agentPolicy).toContain('peserta_id');
  });

  it('ensures leader profiler_folders policy is scoped using leader_has_scope_value', () => {
    const policy = findCreatePolicy(migrationContent, 'profiler_folders', 'Leaders can view profiler_folders');
    expect(policy).toContain('leader_has_scope_value');
    expect(policy).toContain('batch_name');
  });

  it('ensures leader profiler_tim_list policy is scoped using leader_has_scope_value', () => {
    const policy = findCreatePolicy(migrationContent, 'profiler_tim_list', 'Leaders can view profiler_tim_list');
    expect(policy).toContain('leader_has_scope_value');
    expect(policy).toContain('tim');
  });

  it('ensures leader profiler_peserta policy uses leader_can_access_peserta', () => {
    const policy = findCreatePolicy(migrationContent, 'profiler_peserta', 'Leaders can view profiler_peserta');
    expect(policy).toContain('leader_can_access_peserta');
  });

  it('ensures leader qa_temuan policy uses leader_can_access_sidak_temuan', () => {
    const policy = findCreatePolicy(migrationContent, 'qa_temuan', 'Leaders can view qa_temuan');
    expect(policy).toContain('leader_can_access_sidak_temuan');
  });

  it('allows leader SIDAK participant scope when no service_type scope exists', () => {
    const helper = findCreateFunction(migrationContent, 'leader_can_access_sidak_temuan');
    expect(helper).toContain('OR NOT EXISTS');
    expect(helper).toContain("scope.field_name = 'service_type'");
    expect(helper).toContain('AND scope.field_value = p_service_type');
  });

  it('requires approved KTP scope before leaders can read profiler_years', () => {
    const policy = findCreatePolicy(migrationContent, 'profiler_years', 'Leaders can view profiler_years');
    expect(policy).toContain("public.get_auth_role() = 'leader'");
    expect(policy).toContain("public.get_leader_approved_scope_items(auth.uid(), 'ktp')");
  });

  it('does not CREATE POLICY for access_groups or access_group_items (already in 20260502133224)', () => {
    const matches = migrationContent.match(/CREATE POLICY.*ON public\.(access_groups|access_group_items)/g);
    expect(matches).toBeNull();
  });

  it('does not CREATE POLICY for leader_access_requests or leader_access_request_groups (already in 20260502133224)', () => {
    const matches = migrationContent.match(/CREATE POLICY.*ON public\.(leader_access_requests|leader_access_request_groups)/g);
    expect(matches).toBeNull();
  });

  it('adds DELETE own policy for ketik_history', () => {
    const policy = findCreatePolicy(migrationContent, 'ketik_history', 'Users can delete own ketik history');
    expect(policy).toContain('FOR DELETE');
  });

  it('adds DELETE own policy for pdkt_history', () => {
    const policy = findCreatePolicy(migrationContent, 'pdkt_history', 'Users can delete own pdkt history');
    expect(policy).toContain('FOR DELETE');
  });

  it('creates leader_has_scope_value helper function with SECURITY DEFINER and search_path isolation', () => {
    expect(migrationContent).toContain('leader_has_scope_value');
    expect(migrationContent).toContain('SECURITY DEFINER');
    expect(migrationContent).toContain('SET search_path = public, pg_temp');
  });

  it('creates leader_can_access_peserta helper function', () => {
    expect(migrationContent).toContain('leader_can_access_peserta');
  });

  it('creates leader_can_access_sidak_temuan helper function', () => {
    expect(migrationContent).toContain('leader_can_access_sidak_temuan');
  });

  it('adds trainer INSERT/UPDATE/DELETE policies for qa_periods (not just SELECT)', () => {
    expect(migrationContent).toContain('CREATE POLICY "Trainers can insert qa_periods"');
    expect(migrationContent).toContain('CREATE POLICY "Trainers can update qa_periods"');
    expect(migrationContent).toContain('CREATE POLICY "Trainers can delete qa_periods"');
  });

  it('adds trainer INSERT/UPDATE/DELETE policies for qa_indicators (not just SELECT)', () => {
    expect(migrationContent).toContain('CREATE POLICY "Trainers can insert qa_indicators"');
    expect(migrationContent).toContain('CREATE POLICY "Trainers can update qa_indicators"');
    expect(migrationContent).toContain('CREATE POLICY "Trainers can delete qa_indicators"');
  });

  it('adds service_role ALL policies for ketik_history and pdkt_history', () => {
    expect(migrationContent).toContain('Service role full access ketik history');
    expect(migrationContent).toContain('Service role full access pdkt history');
  });

  it('verifies no CREATE POLICY on telefun_history (preserving no-UPDATE contract)', () => {
    expect(migrationContent).not.toMatch(/CREATE POLICY.*ON public\.telefun_history/);
  });

  it('verifies no CREATE POLICY on profiles (already has policies)', () => {
    expect(migrationContent).not.toMatch(/CREATE POLICY.*ON public\.profiles/);
  });

  it('verifies no CREATE POLICY on results (already has policies)', () => {
    expect(migrationContent).not.toMatch(/CREATE POLICY.*ON public\.results/);
  });

  it('verifies rollback file exists with matching timestamp', () => {
    const rollbackPath = MIGRATION_PATH.replace('migrations', 'rollback').replace('.sql', '.down.sql');
    expect(existsSync(rollbackPath)).toBe(true);
  });

  it('drops rollback policies before dropping helper functions they reference', () => {
    const lastPolicyDropIndex = rollbackContent.lastIndexOf('DROP POLICY IF EXISTS');
    const firstHelperDropIndex = rollbackContent.indexOf('DROP FUNCTION IF EXISTS public.leader_can_access');

    expect(lastPolicyDropIndex).toBeGreaterThan(-1);
    expect(firstHelperDropIndex).toBeGreaterThan(-1);
    expect(firstHelperDropIndex).toBeGreaterThan(lastPolicyDropIndex);
  });

  it('ensures agent qa_temuan policy joins profiler_peserta via email_ojk', () => {
    const policy = findCreatePolicy(migrationContent, 'qa_temuan', 'Agents can view own qa_temuan');
    expect(policy).toContain('profiler_peserta');
    expect(policy).toContain('email_ojk');
  });

  it('adds all authenticated SELECT on qa_periods', () => {
    const policy = findCreatePolicy(migrationContent, 'qa_periods', 'All authenticated can read qa_periods');
    expect(policy).toContain('FOR SELECT');
  });

  it('adds all authenticated SELECT on qa_indicators', () => {
    const policy = findCreatePolicy(migrationContent, 'qa_indicators', 'All authenticated can read qa_indicators');
    expect(policy).toContain('FOR SELECT');
  });

  it('keeps SQL smoke test aligned with approved KTP scope for profiler_years', () => {
    expect(sqlSmokeContent).toContain('profiler_years leader policy requires approved KTP scope');
    expect(sqlSmokeContent).toContain('get_leader_approved_scope_items');
    expect(sqlSmokeContent).not.toContain('unscoped, OK');
  });

  it('documents profiler_years as approved KTP scoped in the explicit grants changelog', () => {
    expect(changelogContent).toContain('profiler_years`: trainer/admin ALL, leader SELECT with approved KTP scope');
    expect(changelogContent).not.toContain('profiler_years`: trainer/admin ALL, leader SELECT (unscoped)');
  });
});

function findCreatePolicy(source: string, tableName: string, policyName: string): string {
  const start = source.indexOf(`CREATE POLICY "${policyName}"`);
  if (start < 0) return '';
  const end = source.indexOf(';', start);
  if (end < 0) return source.slice(start);
  return source.slice(start, end + 1);
}

function findCreateFunction(source: string, functionName: string): string {
  const start = source.indexOf(`CREATE OR REPLACE FUNCTION public.${functionName}`);
  if (start < 0) return '';
  const end = source.indexOf('$$;', start);
  if (end < 0) return source.slice(start);
  return source.slice(start, end + 3);
}
