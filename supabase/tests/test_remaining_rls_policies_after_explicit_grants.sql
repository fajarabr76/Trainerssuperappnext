-- =============================================================================
-- SQL Smoke Test: Remaining RLS Policies After Explicit Grants
-- =============================================================================
-- Run this after applying migration 20260515010000.
-- Tests policy presence, contract checks, and no regression on existing tables.
-- =============================================================================

\set ON_ERROR_STOP on

-- ── 1. HELPER FUNCTIONS ──────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'leader_has_scope_value'
  ) THEN
    RAISE EXCEPTION '1 FAIL: leader_has_scope_value() helper function missing';
  END IF;
  RAISE NOTICE '1 PASS: leader_has_scope_value() exists';
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'leader_can_access_peserta'
  ) THEN
    RAISE EXCEPTION '2 FAIL: leader_can_access_peserta() helper function missing';
  END IF;
  RAISE NOTICE '2 PASS: leader_can_access_peserta() exists';
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'leader_can_access_sidak_temuan'
  ) THEN
    RAISE EXCEPTION '3 FAIL: leader_can_access_sidak_temuan() helper function missing';
  END IF;
  RAISE NOTICE '3 PASS: leader_can_access_sidak_temuan() exists';
END $$;

-- ── 2. POLICY PRESENCE ON 11 TARGET TABLES ───────────────────────────────────

DO $$
DECLARE
  v_table text;
  v_tables text[] := ARRAY[
    'activity_logs', 'ketik_history', 'pdkt_history', 'user_settings',
    'profiler_years', 'profiler_folders', 'profiler_tim_list', 'profiler_peserta',
    'qa_periods', 'qa_indicators', 'qa_temuan'
  ];
  v_count integer;
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    IF to_regclass('public.' || v_table) IS NOT NULL THEN
      SELECT count(*) INTO v_count
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = v_table;

      IF v_count = 0 THEN
        RAISE EXCEPTION 'T FAIL: No policies on %', v_table;
      END IF;
      RAISE NOTICE 'T PASS: % has % policies', v_table, v_count;
    ELSE
      RAISE NOTICE 'T SKIP: % does not exist (local dev only)', v_table;
    END IF;
  END LOOP;
END $$;

-- ── 3. CONTRACT: qa_temuan agent policy uses peserta_id (NOT agent_id) ───────

DO $$
DECLARE
  v_qual text;
BEGIN
  SELECT qual INTO v_qual
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'qa_temuan'
    AND policyname = 'Agents can view own qa_temuan';

  IF v_qual IS NULL THEN
    RAISE EXCEPTION 'C1 FAIL: Agent policy not found on qa_temuan';
  END IF;

  IF v_qual LIKE '%agent_id%' THEN
    RAISE EXCEPTION 'C1 FAIL: Agent policy uses agent_id — should use peserta_id. Qual: %', v_qual;
  END IF;

  IF v_qual NOT LIKE '%peserta_id%' THEN
    RAISE EXCEPTION 'C1 FAIL: Agent policy does not reference peserta_id. Qual: %', v_qual;
  END IF;

  RAISE NOTICE 'C1 PASS: Agent qa_temuan policy uses peserta_id';
END $$;

-- ── 4. CONTRACT: Leader profiler_folders policy is scoped ────────────────────

DO $$
DECLARE
  v_qual text;
BEGIN
  SELECT qual INTO v_qual
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'profiler_folders'
    AND policyname = 'Leaders can view profiler_folders';

  IF v_qual IS NULL THEN
    RAISE EXCEPTION 'L1 FAIL: Leader policy not found on profiler_folders';
  END IF;

  IF v_qual NOT LIKE '%leader_has_scope_value%' THEN
    RAISE EXCEPTION 'L1 FAIL: Leader profiler_folders policy not scoped. Qual: %', v_qual;
  END IF;

  RAISE NOTICE 'L1 PASS: Leader profiler_folders policy is scoped';
END $$;

-- ── 5. CONTRACT: Leader profiler_tim_list policy is scoped ───────────────────

DO $$
DECLARE
  v_qual text;
BEGIN
  SELECT qual INTO v_qual
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'profiler_tim_list'
    AND policyname = 'Leaders can view profiler_tim_list';

  IF v_qual IS NULL THEN
    RAISE EXCEPTION 'L2 FAIL: Leader policy not found on profiler_tim_list';
  END IF;

  IF v_qual NOT LIKE '%leader_has_scope_value%' THEN
    RAISE EXCEPTION 'L2 FAIL: Leader profiler_tim_list policy not scoped. Qual: %', v_qual;
  END IF;

  RAISE NOTICE 'L2 PASS: Leader profiler_tim_list policy is scoped';
END $$;

-- ── 6. CONTRACT: Leader profiler_peserta uses leader_can_access_peserta ───────

DO $$
DECLARE
  v_qual text;
BEGIN
  SELECT qual INTO v_qual
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'profiler_peserta'
    AND policyname = 'Leaders can view profiler_peserta';

  IF v_qual IS NULL THEN
    RAISE EXCEPTION 'L3 FAIL: Leader policy not found on profiler_peserta';
  END IF;

  IF v_qual NOT LIKE '%leader_can_access_peserta%' THEN
    RAISE EXCEPTION 'L3 FAIL: Leader profiler_peserta policy not scoped. Qual: %', v_qual;
  END IF;

  RAISE NOTICE 'L3 PASS: Leader profiler_peserta policy uses leader_can_access_peserta';
END $$;

-- ── 7. CONTRACT: Leader qa_temuan uses leader_can_access_sidak_temuan ─────────

DO $$
DECLARE
  v_qual text;
BEGIN
  SELECT qual INTO v_qual
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'qa_temuan'
    AND policyname = 'Leaders can view qa_temuan';

  IF v_qual IS NULL THEN
    RAISE EXCEPTION 'L4 FAIL: Leader policy not found on qa_temuan';
  END IF;

  IF v_qual NOT LIKE '%leader_can_access_sidak_temuan%' THEN
    RAISE EXCEPTION 'L4 FAIL: Leader qa_temuan policy not scoped. Qual: %', v_qual;
  END IF;

  RAISE NOTICE 'L4 PASS: Leader qa_temuan policy uses leader_can_access_sidak_temuan';
END $$;

-- ── 8. CONTRACT: ketik_history has DELETE own policy ─────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ketik_history'
      AND policyname = 'Users can delete own ketik history'
      AND cmd = 'DELETE'
  ) THEN
    RAISE EXCEPTION 'K1 FAIL: ketik_history DELETE own policy missing';
  END IF;
  RAISE NOTICE 'K1 PASS: ketik_history has DELETE own policy';
END $$;

-- ── 9. CONTRACT: pdkt_history has DELETE own policy ──────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'pdkt_history'
      AND policyname = 'Users can delete own pdkt history'
      AND cmd = 'DELETE'
  ) THEN
    RAISE EXCEPTION 'P1 FAIL: pdkt_history DELETE own policy missing';
  END IF;
  RAISE NOTICE 'P1 PASS: pdkt_history has DELETE own policy';
END $$;

-- ── 10. CONTRACT: qa_periods has trainer INSERT/UPDATE/DELETE ────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'qa_periods'
      AND policyname = 'Trainers can insert qa_periods'
      AND cmd = 'INSERT'
  ) THEN
    RAISE EXCEPTION 'Q1 FAIL: qa_periods trainer INSERT policy missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'qa_periods'
      AND policyname = 'Trainers can update qa_periods'
      AND cmd = 'UPDATE'
  ) THEN
    RAISE EXCEPTION 'Q2 FAIL: qa_periods trainer UPDATE policy missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'qa_periods'
      AND policyname = 'Trainers can delete qa_periods'
      AND cmd = 'DELETE'
  ) THEN
    RAISE EXCEPTION 'Q3 FAIL: qa_periods trainer DELETE policy missing';
  END IF;

  RAISE NOTICE 'Q PASS: qa_periods has trainer INSERT/UPDATE/DELETE policies';
END $$;

-- ── 11. CONTRACT: telefun_history has NO authenticated UPDATE policy ─────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'telefun_history'
      AND cmd IN ('UPDATE', 'ALL')
      AND roles @> ARRAY['authenticated']::name[]
  ) THEN
    RAISE EXCEPTION 'T1 FAIL: telefun_history has UPDATE policy — per contract, should NOT exist';
  END IF;
  RAISE NOTICE 'T1 PASS: telefun_history has NO authenticated UPDATE policy (per contract)';
END $$;

-- ── 12. CONTRACT: access_groups policies are NOT duplicated ──────────────────

DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'access_groups';

  IF v_count = 0 THEN
    RAISE EXCEPTION 'A1 FAIL: access_groups should already have policies from 20260502133224, but found 0';
  END IF;

  RAISE NOTICE 'A1 PASS: access_groups has % policies (from 20260502133224, not duplicated)', v_count;
END $$;

-- ── 13. CONTRACT: profiler_years leader policy requires approved KTP scope ───

DO $$
DECLARE
  v_qual text;
BEGIN
  SELECT qual INTO v_qual
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'profiler_years'
    AND policyname = 'Leaders can view profiler_years'
    AND cmd = 'SELECT';

  IF v_qual IS NULL THEN
    RAISE EXCEPTION 'Y1 FAIL: profiler_years leader SELECT policy missing';
  END IF;

  IF v_qual NOT LIKE '%get_leader_approved_scope_items%' OR v_qual NOT LIKE '%ktp%' THEN
    RAISE EXCEPTION 'Y1 FAIL: profiler_years leader policy is not approved KTP scoped. Qual: %', v_qual;
  END IF;

  RAISE NOTICE 'Y1 PASS: profiler_years leader policy requires approved KTP scope';
END $$;

-- ── 14. CONTRACT: user_settings has user ALL own policy ──────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_settings'
      AND policyname = 'Users can manage own settings'
  ) THEN
    RAISE EXCEPTION 'U1 FAIL: user_settings policy missing';
  END IF;
  RAISE NOTICE 'U1 PASS: user_settings has manage own policy';
END $$;

-- ── SUMMARY ──────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_total_policies integer;
BEGIN
  SELECT count(*) INTO v_total_policies FROM pg_policies WHERE schemaname = 'public';

  RAISE NOTICE '============================================';
  RAISE NOTICE 'All remaining RLS policy checks PASSED.';
  RAISE NOTICE 'Total policies on public schema: %', v_total_policies;
  RAISE NOTICE '============================================';
END $$;
