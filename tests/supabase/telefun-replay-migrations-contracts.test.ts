import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const MERGED_MIGRATION_PATH = 'supabase/migrations/20260516000000_create_telefun_replay_support.sql';
const REPAIR_MIGRATION_PATH = 'supabase/migrations/20260516000001_telefun_replay_rls_repair.sql';
const ENFORCE_SHAPE_MIGRATION_PATH = 'supabase/migrations/20260517000000_enforce_telefun_coaching_summary_shape.sql';
const COMPLETION_METADATA_MIGRATION_PATH =
  'supabase/migrations/20260517000001_add_telefun_replay_completion_metadata.sql';
const COMPLETION_METADATA_ROLLBACK_PATH =
  'supabase/rollback/20260517000001_add_telefun_replay_completion_metadata.down.sql';
const DELETE_HARDENING_MIGRATION_PATH =
  'supabase/migrations/20260517000002_restrict_telefun_replay_annotation_delete.sql';
const DELETE_HARDENING_ROLLBACK_PATH =
  'supabase/rollback/20260517000002_restrict_telefun_replay_annotation_delete.down.sql';

describe('Telefun replay migration contracts', () => {
  it('merged migration creates telefun_coaching_summary table', () => {
    const sql = readFileSync(MERGED_MIGRATION_PATH, 'utf8');

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS telefun_coaching_summary');
  });

  it('merged migration creates telefun_replay_annotations table', () => {
    const sql = readFileSync(MERGED_MIGRATION_PATH, 'utf8');

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS telefun_replay_annotations');
  });

  it('merged migration adds realistic mode columns to telefun_history', () => {
    const sql = readFileSync(MERGED_MIGRATION_PATH, 'utf8');

    expect(sql).toContain('ADD COLUMN IF NOT EXISTS voice_dashboard_metrics');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS disruption_config');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS disruption_results');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS persona_config');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS realistic_mode_enabled');
  });

  it('merged migration creates upsert_telefun_coaching_summary RPC', () => {
    const sql = readFileSync(MERGED_MIGRATION_PATH, 'utf8');

    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.upsert_telefun_coaching_summary');
  });

  it('merged migration uses improved INSERT policy with session ownership check', () => {
    const sql = readFileSync(MERGED_MIGRATION_PATH, 'utf8');

    expect(sql).toContain('EXISTS (');
    expect(sql).toContain('SELECT 1 FROM telefun_history');
    expect(sql).toContain('id = session_id AND user_id = auth.uid()');
    expect(sql).toContain('is_manual = true');
  });

  it('repair migration includes service_role resolution in upsert RPC', () => {
    const repairSql = readFileSync(REPAIR_MIGRATION_PATH, 'utf8');

    expect(repairSql).toContain("auth.role() = 'service_role'");
    expect(repairSql).toContain('SELECT user_id INTO v_user_id FROM telefun_history WHERE id = p_session_id');
  });

  it('repair migration creates telefun_coaching_summary table if missing', () => {
    const repairSql = readFileSync(REPAIR_MIGRATION_PATH, 'utf8');

    expect(repairSql).toContain('CREATE TABLE IF NOT EXISTS telefun_coaching_summary');
    expect(repairSql).toContain('ALTER TABLE telefun_coaching_summary ENABLE ROW LEVEL SECURITY;');
  });

  it('repair migration restores coaching summary grants, indexes, and RPC execute grant', () => {
    const repairSql = readFileSync(REPAIR_MIGRATION_PATH, 'utf8');

    expect(repairSql).toContain('REVOKE ALL ON telefun_coaching_summary FROM anon, public;');
    expect(repairSql).toContain('GRANT SELECT ON telefun_coaching_summary TO authenticated;');
    expect(repairSql).toContain('CREATE INDEX IF NOT EXISTS idx_telefun_coaching_summary_user_id');
    expect(repairSql).toContain('CREATE INDEX IF NOT EXISTS idx_telefun_coaching_summary_session_id');
    expect(repairSql).toContain('GRANT EXECUTE ON FUNCTION public.upsert_telefun_coaching_summary(UUID, JSONB) TO authenticated, service_role;');
  });

  it('repair migration creates telefun_replay_annotations table if missing', () => {
    const repairSql = readFileSync(REPAIR_MIGRATION_PATH, 'utf8');

    expect(repairSql).toContain('CREATE TABLE IF NOT EXISTS telefun_replay_annotations');
  });

  it('repair migration adds all missing columns to telefun_history', () => {
    const repairSql = readFileSync(REPAIR_MIGRATION_PATH, 'utf8');

    expect(repairSql).toContain('ADD COLUMN IF NOT EXISTS session_duration_ms');
    expect(repairSql).toContain('ADD COLUMN IF NOT EXISTS voice_dashboard_metrics');
    expect(repairSql).toContain('ADD COLUMN IF NOT EXISTS disruption_config');
    expect(repairSql).toContain('ADD COLUMN IF NOT EXISTS disruption_results');
    expect(repairSql).toContain('ADD COLUMN IF NOT EXISTS persona_config');
    expect(repairSql).toContain('ADD COLUMN IF NOT EXISTS realistic_mode_enabled');
  });

  it('repair migration makes coaching summary policy idempotent', () => {
    const repairSql = readFileSync(REPAIR_MIGRATION_PATH, 'utf8');

    expect(repairSql).toContain('DROP POLICY IF EXISTS "Users can view their own coaching summaries"');
    expect(repairSql).toContain('CREATE POLICY "Users can view their own coaching summaries"');
  });

  it('repair migration upgrades INSERT policy with session ownership check', () => {
    const repairSql = readFileSync(REPAIR_MIGRATION_PATH, 'utf8');

    expect(repairSql).toContain('EXISTS (');
    expect(repairSql).toContain('SELECT 1 FROM telefun_history');
    expect(repairSql).toContain('id = session_id AND user_id = auth.uid()');
    expect(repairSql).toContain('is_manual = true');
  });

  it('enforce shape migration adds strict object validation to upsert RPC', () => {
    const sql = readFileSync(ENFORCE_SHAPE_MIGRATION_PATH, 'utf8');

    expect(sql).toContain("jsonb_typeof(v_rec) <> 'object'");
    expect(sql).toContain("k NOT IN ('text', 'priority')");
    expect(sql).toContain("btrim(v_rec->>'text') = ''");
    expect(sql).toContain("length(v_rec->>'text') > 200");
    expect(sql).toContain('v_priority < 1 OR v_priority > 5');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.upsert_telefun_coaching_summary(UUID, JSONB) TO authenticated, service_role;');
  });

  it('enforce shape migration ensures priority is an integer', () => {
    const sql = readFileSync(ENFORCE_SHAPE_MIGRATION_PATH, 'utf8');

    expect(sql).toContain('v_priority <> floor(v_priority)');
    expect(sql).toContain('Invalid recommendation: "priority" must be an integer.');
  });

  it('completion metadata migration adds replay annotation metadata columns', () => {
    const sql = readFileSync(COMPLETION_METADATA_MIGRATION_PATH, 'utf8');

    expect(sql).toContain('ADD COLUMN IF NOT EXISTS ai_annotation_count');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS ai_annotation_checksum');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS ai_annotation_completed_at');
    expect(sql).toContain('DROP FUNCTION IF EXISTS public.upsert_telefun_coaching_summary(UUID, JSONB);');
    expect(sql).toContain('p_ai_annotation_count INTEGER DEFAULT NULL');
    expect(sql).toContain('p_ai_annotation_checksum TEXT DEFAULT NULL');
    expect(sql).toContain('ai_annotation_count = EXCLUDED.ai_annotation_count');
    expect(sql).toContain(
      'GRANT EXECUTE ON FUNCTION public.upsert_telefun_coaching_summary(UUID, JSONB, INTEGER, TEXT) TO authenticated, service_role;'
    );
  });

  it('completion metadata rollback restores the previous RPC signature', () => {
    const sql = readFileSync(COMPLETION_METADATA_ROLLBACK_PATH, 'utf8');

    expect(sql).toContain('DROP FUNCTION IF EXISTS public.upsert_telefun_coaching_summary(UUID, JSONB, INTEGER, TEXT);');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.upsert_telefun_coaching_summary(');
    expect(sql).toContain('p_recommendations JSONB');
    expect(sql).toContain('DROP COLUMN IF EXISTS ai_annotation_count');
    expect(sql).toContain(
      'GRANT EXECUTE ON FUNCTION public.upsert_telefun_coaching_summary(UUID, JSONB) TO authenticated, service_role;'
    );
  });

  it('delete hardening migration removes direct authenticated replay annotation deletes', () => {
    const sql = readFileSync(DELETE_HARDENING_MIGRATION_PATH, 'utf8');

    expect(sql).toContain('DROP POLICY IF EXISTS "Users can delete their own replay annotations"');
    expect(sql).toContain('REVOKE DELETE ON public.telefun_replay_annotations FROM authenticated;');
    expect(sql).toContain(
      "has_table_privilege('authenticated', 'public.telefun_replay_annotations', 'DELETE')"
    );
    expect(sql).toContain('authenticated must not have direct DELETE on telefun_replay_annotations');
    expect(sql).not.toContain('CREATE POLICY "Users can delete their own replay annotations"');
    expect(sql).not.toContain('GRANT SELECT, INSERT, DELETE ON public.telefun_replay_annotations TO authenticated;');
  });

  it('delete hardening rollback explicitly restores the previous owner-only delete contract', () => {
    const sql = readFileSync(DELETE_HARDENING_ROLLBACK_PATH, 'utf8');

    expect(sql).toContain('GRANT DELETE ON public.telefun_replay_annotations TO authenticated;');
    expect(sql).toContain('CREATE POLICY "Users can delete their own replay annotations"');
    expect(sql).toContain('FOR DELETE');
    expect(sql).toContain('USING (auth.uid() = user_id);');
  });
});
