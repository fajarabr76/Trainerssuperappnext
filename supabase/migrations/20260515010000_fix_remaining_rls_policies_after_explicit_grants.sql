-- =============================================================================
-- Migration: Fix Remaining RLS Policies After Explicit Grants
-- =============================================================================
-- Migration 20260514000000 enabled RLS and revoked broad grants on all tables,
-- but several application tables had zero CREATE POLICY statements in any
-- migration. This migration creates the missing policies per role contract.
--
-- Design:
--   SECURITY DEFINER helper functions for RLS-scoped leader access
--   trainer/admin → full CRUD on managed tables
--   leader → SELECT only, scoped via approved access groups
--   agent → SELECT/INSERT/UPDATE/DELETE own data
--   all authenticated → INSERT on activity_logs, SELECT on qa_periods/qa_indicators
--
-- Tables touched (11): activity_logs, ketik_history, pdkt_history, user_settings,
--   profiler_years, profiler_folders, profiler_tim_list, profiler_peserta,
--   qa_periods, qa_indicators, qa_temuan
--
-- Tables NOT touched (already have policies in prior migrations):
--   profiles, results, telefun_history, pdkt_mailbox_items, ketik_review_jobs,
--   ketik_session_reviews, ketik_typo_findings, access_groups, access_group_items,
--   leader_access_requests, leader_access_request_groups, qa_dashboard_*_summary,
--   reports, ai_billing_settings, ai_pricing_settings, ai_usage_logs,
--   security_rate_limits, storage.objects
-- =============================================================================

-- =============================================================================
-- 1. HELPER FUNCTIONS — SECURITY DEFINER dengan search_path isolation
-- =============================================================================
-- Fungsi-fungsi ini memungkinkan RLS policy mengecek leader scope tanpa
-- rekursi atau infinite loop, menggunakan SECURITY DEFINER dan search_path
-- yang dibatasi ke public + pg_temp.

-- 1a. leader_has_scope_value: cek apakah leader punya scope item tertentu
CREATE OR REPLACE FUNCTION public.leader_has_scope_value(
  p_module text,
  p_field_name text,
  p_field_value text
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.get_leader_approved_scope_items(auth.uid(), p_module) scope
    WHERE scope.field_name = p_field_name
      AND scope.field_value = p_field_value
  );
$$;

REVOKE ALL ON FUNCTION public.leader_has_scope_value(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leader_has_scope_value(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leader_has_scope_value(text, text, text) TO service_role;

-- 1b. leader_can_access_peserta: cek apakah leader punya akses ke peserta tertentu
CREATE OR REPLACE FUNCTION public.leader_can_access_peserta(
  p_peserta_id uuid,
  p_module text
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiler_peserta pp
    WHERE pp.id = p_peserta_id
      AND (
        EXISTS (
          SELECT 1
          FROM public.get_leader_approved_scope_items(auth.uid(), p_module) scope
          WHERE scope.field_name = 'peserta_id'
            AND scope.field_value = pp.id::text
        )
        OR EXISTS (
          SELECT 1
          FROM public.get_leader_approved_scope_items(auth.uid(), p_module) scope
          WHERE scope.field_name = 'batch_name'
            AND scope.field_value = pp.batch_name
        )
        OR EXISTS (
          SELECT 1
          FROM public.get_leader_approved_scope_items(auth.uid(), p_module) scope
          WHERE scope.field_name = 'tim'
            AND scope.field_value = pp.tim
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.leader_can_access_peserta(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leader_can_access_peserta(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leader_can_access_peserta(uuid, text) TO service_role;

-- 1c. leader_can_access_sidak_temuan: cek akses leader ke temuan SIDAK
CREATE OR REPLACE FUNCTION public.leader_can_access_sidak_temuan(
  p_peserta_id uuid,
  p_service_type text
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.leader_can_access_peserta(p_peserta_id, 'sidak') peserta_access
    WHERE peserta_access = true
      AND (
        p_service_type IS NULL
        OR NOT EXISTS (
          SELECT 1
          FROM public.get_leader_approved_scope_items(auth.uid(), 'sidak') scope
          WHERE scope.field_name = 'service_type'
        )
        OR EXISTS (
          SELECT 1
          FROM public.get_leader_approved_scope_items(auth.uid(), 'sidak') scope
          WHERE scope.field_name = 'service_type'
            AND scope.field_value = p_service_type
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.leader_can_access_sidak_temuan(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leader_can_access_sidak_temuan(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leader_can_access_sidak_temuan(uuid, text) TO service_role;

-- =============================================================================
-- 2. activity_logs — all INSERT, trainer/admin SELECT and DELETE
-- =============================================================================
DO $$
BEGIN
  IF to_regclass('public.activity_logs') IS NOT NULL THEN
    DROP POLICY IF EXISTS "All authenticated can insert activity" ON public.activity_logs;
    CREATE POLICY "All authenticated can insert activity"
      ON public.activity_logs FOR INSERT
      TO authenticated
      WITH CHECK (true);

    DROP POLICY IF EXISTS "Trainers can view activities" ON public.activity_logs;
    CREATE POLICY "Trainers can view activities"
      ON public.activity_logs FOR SELECT
      TO authenticated
      USING (public.get_auth_role() IN ('trainer', 'trainers', 'admin'));

    DROP POLICY IF EXISTS "Trainers can delete activities" ON public.activity_logs;
    CREATE POLICY "Trainers can delete activities"
      ON public.activity_logs FOR DELETE
      TO authenticated
      USING (public.get_auth_role() IN ('trainer', 'trainers', 'admin'));
  END IF;
END $$;

-- =============================================================================
-- 3. ketik_history — user SELECT/INSERT/UPDATE/DELETE own; service_role ALL
-- =============================================================================
DO $$
BEGIN
  IF to_regclass('public.ketik_history') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can view own ketik history" ON public.ketik_history;
    CREATE POLICY "Users can view own ketik history"
      ON public.ketik_history FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Users can insert own ketik history" ON public.ketik_history;
    CREATE POLICY "Users can insert own ketik history"
      ON public.ketik_history FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Users can update own ketik history" ON public.ketik_history;
    CREATE POLICY "Users can update own ketik history"
      ON public.ketik_history FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Users can delete own ketik history" ON public.ketik_history;
    CREATE POLICY "Users can delete own ketik history"
      ON public.ketik_history FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Service role full access ketik history" ON public.ketik_history;
    CREATE POLICY "Service role full access ketik history"
      ON public.ketik_history TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- =============================================================================
-- 4. pdkt_history — user SELECT/INSERT/UPDATE/DELETE own; service_role ALL
-- =============================================================================
DO $$
BEGIN
  IF to_regclass('public.pdkt_history') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can view own pdkt history" ON public.pdkt_history;
    CREATE POLICY "Users can view own pdkt history"
      ON public.pdkt_history FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Users can insert own pdkt history" ON public.pdkt_history;
    CREATE POLICY "Users can insert own pdkt history"
      ON public.pdkt_history FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Users can update own pdkt history" ON public.pdkt_history;
    CREATE POLICY "Users can update own pdkt history"
      ON public.pdkt_history FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Users can delete own pdkt history" ON public.pdkt_history;
    CREATE POLICY "Users can delete own pdkt history"
      ON public.pdkt_history FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Service role full access pdkt history" ON public.pdkt_history;
    CREATE POLICY "Service role full access pdkt history"
      ON public.pdkt_history TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- =============================================================================
-- 5. user_settings — user manage own row
-- =============================================================================
DO $$
BEGIN
  IF to_regclass('public.user_settings') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can manage own settings" ON public.user_settings;
    CREATE POLICY "Users can manage own settings"
      ON public.user_settings FOR ALL
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- =============================================================================
-- 6. PROFILER TABLES — trainer/admin ALL, leader SELECT only (RLS-scoped)
-- =============================================================================

-- 6a. profiler_years: trainer/admin ALL, approved KTP leader SELECT
DO $$
BEGIN
  IF to_regclass('public.profiler_years') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Trainers can manage profiler_years" ON public.profiler_years;
    CREATE POLICY "Trainers can manage profiler_years"
      ON public.profiler_years FOR ALL
      TO authenticated
      USING (public.get_auth_role() IN ('trainer', 'trainers', 'admin'))
      WITH CHECK (public.get_auth_role() IN ('trainer', 'trainers', 'admin'));

    DROP POLICY IF EXISTS "Leaders can view profiler_years" ON public.profiler_years;
    CREATE POLICY "Leaders can view profiler_years"
      ON public.profiler_years FOR SELECT
      TO authenticated
      USING (
        public.get_auth_role() = 'leader'
        AND EXISTS (
          SELECT 1
          FROM public.get_leader_approved_scope_items(auth.uid(), 'ktp') scope
        )
      );
  END IF;
END $$;

-- 6b. profiler_folders: trainer/admin ALL, leader SELECT via batch_name scope
DO $$
BEGIN
  IF to_regclass('public.profiler_folders') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Trainers can manage profiler_folders" ON public.profiler_folders;
    CREATE POLICY "Trainers can manage profiler_folders"
      ON public.profiler_folders FOR ALL
      TO authenticated
      USING (public.get_auth_role() IN ('trainer', 'trainers', 'admin'))
      WITH CHECK (public.get_auth_role() IN ('trainer', 'trainers', 'admin'));

    DROP POLICY IF EXISTS "Leaders can view profiler_folders" ON public.profiler_folders;
    CREATE POLICY "Leaders can view profiler_folders"
      ON public.profiler_folders FOR SELECT
      TO authenticated
      USING (
        public.get_auth_role() = 'leader'
        AND public.leader_has_scope_value('ktp', 'batch_name', name)
      );
  END IF;
END $$;

-- 6c. profiler_tim_list: trainer/admin ALL, leader SELECT via tim scope
DO $$
BEGIN
  IF to_regclass('public.profiler_tim_list') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Trainers can manage profiler_tim_list" ON public.profiler_tim_list;
    CREATE POLICY "Trainers can manage profiler_tim_list"
      ON public.profiler_tim_list FOR ALL
      TO authenticated
      USING (public.get_auth_role() IN ('trainer', 'trainers', 'admin'))
      WITH CHECK (public.get_auth_role() IN ('trainer', 'trainers', 'admin'));

    DROP POLICY IF EXISTS "Leaders can view profiler_tim_list" ON public.profiler_tim_list;
    CREATE POLICY "Leaders can view profiler_tim_list"
      ON public.profiler_tim_list FOR SELECT
      TO authenticated
      USING (
        public.get_auth_role() = 'leader'
        AND public.leader_has_scope_value('ktp', 'tim', nama)
      );
  END IF;
END $$;

-- 6d. profiler_peserta: trainer/admin ALL, leader SELECT via peserta scope
DO $$
BEGIN
  IF to_regclass('public.profiler_peserta') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Trainers can manage profiler_peserta" ON public.profiler_peserta;
    CREATE POLICY "Trainers can manage profiler_peserta"
      ON public.profiler_peserta FOR ALL
      TO authenticated
      USING (public.get_auth_role() IN ('trainer', 'trainers', 'admin'))
      WITH CHECK (public.get_auth_role() IN ('trainer', 'trainers', 'admin'));

    DROP POLICY IF EXISTS "Leaders can view profiler_peserta" ON public.profiler_peserta;
    CREATE POLICY "Leaders can view profiler_peserta"
      ON public.profiler_peserta FOR SELECT
      TO authenticated
      USING (
        public.get_auth_role() = 'leader'
        AND public.leader_can_access_peserta(id, 'ktp')
      );
  END IF;
END $$;

-- =============================================================================
-- 7. QA LOOKUP TABLES — all authenticated SELECT, trainer/admin INSERT/UPDATE/DELETE
-- =============================================================================

-- 7a. qa_periods
DO $$
BEGIN
  IF to_regclass('public.qa_periods') IS NOT NULL THEN
    DROP POLICY IF EXISTS "All authenticated can read qa_periods" ON public.qa_periods;
    CREATE POLICY "All authenticated can read qa_periods"
      ON public.qa_periods FOR SELECT
      TO authenticated
      USING (true);

    DROP POLICY IF EXISTS "Trainers can insert qa_periods" ON public.qa_periods;
    CREATE POLICY "Trainers can insert qa_periods"
      ON public.qa_periods FOR INSERT
      TO authenticated
      WITH CHECK (public.get_auth_role() IN ('trainer', 'trainers', 'admin'));

    DROP POLICY IF EXISTS "Trainers can update qa_periods" ON public.qa_periods;
    CREATE POLICY "Trainers can update qa_periods"
      ON public.qa_periods FOR UPDATE
      TO authenticated
      USING (public.get_auth_role() IN ('trainer', 'trainers', 'admin'))
      WITH CHECK (public.get_auth_role() IN ('trainer', 'trainers', 'admin'));

    DROP POLICY IF EXISTS "Trainers can delete qa_periods" ON public.qa_periods;
    CREATE POLICY "Trainers can delete qa_periods"
      ON public.qa_periods FOR DELETE
      TO authenticated
      USING (public.get_auth_role() IN ('trainer', 'trainers', 'admin'));
  END IF;
END $$;

-- 7b. qa_indicators
DO $$
BEGIN
  IF to_regclass('public.qa_indicators') IS NOT NULL THEN
    DROP POLICY IF EXISTS "All authenticated can read qa_indicators" ON public.qa_indicators;
    CREATE POLICY "All authenticated can read qa_indicators"
      ON public.qa_indicators FOR SELECT
      TO authenticated
      USING (true);

    DROP POLICY IF EXISTS "Trainers can insert qa_indicators" ON public.qa_indicators;
    CREATE POLICY "Trainers can insert qa_indicators"
      ON public.qa_indicators FOR INSERT
      TO authenticated
      WITH CHECK (public.get_auth_role() IN ('trainer', 'trainers', 'admin'));

    DROP POLICY IF EXISTS "Trainers can update qa_indicators" ON public.qa_indicators;
    CREATE POLICY "Trainers can update qa_indicators"
      ON public.qa_indicators FOR UPDATE
      TO authenticated
      USING (public.get_auth_role() IN ('trainer', 'trainers', 'admin'))
      WITH CHECK (public.get_auth_role() IN ('trainer', 'trainers', 'admin'));

    DROP POLICY IF EXISTS "Trainers can delete qa_indicators" ON public.qa_indicators;
    CREATE POLICY "Trainers can delete qa_indicators"
      ON public.qa_indicators FOR DELETE
      TO authenticated
      USING (public.get_auth_role() IN ('trainer', 'trainers', 'admin'));
  END IF;
END $$;

-- =============================================================================
-- 8. qa_temuan — MAIN FINDINGS TABLE (CRITICAL)
-- =============================================================================
-- trainer/admin: ALL
-- leader: SELECT only via leader_can_access_sidak_temuan(peserta_id, service_type)
-- agent: SELECT own findings via profiler_peserta.email_ojk = profiles.email
-- NOTE: qa_temuan uses peserta_id, NOT agent_id (no agent_id column exists)
-- =============================================================================
DO $$
BEGIN
  IF to_regclass('public.qa_temuan') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Trainers can manage qa_temuan" ON public.qa_temuan;
    CREATE POLICY "Trainers can manage qa_temuan"
      ON public.qa_temuan FOR ALL
      TO authenticated
      USING (public.get_auth_role() IN ('trainer', 'trainers', 'admin'))
      WITH CHECK (public.get_auth_role() IN ('trainer', 'trainers', 'admin'));

    DROP POLICY IF EXISTS "Leaders can view qa_temuan" ON public.qa_temuan;
    CREATE POLICY "Leaders can view qa_temuan"
      ON public.qa_temuan FOR SELECT
      TO authenticated
      USING (
        public.get_auth_role() = 'leader'
        AND public.leader_can_access_sidak_temuan(peserta_id, service_type)
      );

    DROP POLICY IF EXISTS "Agents can view own qa_temuan" ON public.qa_temuan;
    CREATE POLICY "Agents can view own qa_temuan"
      ON public.qa_temuan FOR SELECT
      TO authenticated
      USING (
        public.get_auth_role() IN ('agent', 'agents')
        AND EXISTS (
          SELECT 1 FROM public.profiler_peserta pp
          WHERE pp.id = qa_temuan.peserta_id
            AND pp.email_ojk = (SELECT email FROM public.profiles WHERE id = auth.uid())
        )
      );
  END IF;
END $$;

-- =============================================================================
-- 9. VERIFY: Helper functions exist
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'leader_has_scope_value'
  ) THEN
    RAISE EXCEPTION 'CRITICAL: leader_has_scope_value() helper function missing!';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'leader_can_access_peserta'
  ) THEN
    RAISE EXCEPTION 'CRITICAL: leader_can_access_peserta() helper function missing!';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'leader_can_access_sidak_temuan'
  ) THEN
    RAISE EXCEPTION 'CRITICAL: leader_can_access_sidak_temuan() helper function missing!';
  END IF;

  RAISE NOTICE 'All 3 leader scope helper functions verified.';
END $$;

-- =============================================================================
-- 10. VERIFY: All 11 target tables have at least one policy
-- =============================================================================
DO $$
DECLARE
  v_missing text[] := ARRAY[]::text[];
  v_tables text[] := ARRAY[
    'activity_logs', 'ketik_history', 'pdkt_history', 'user_settings',
    'profiler_years', 'profiler_folders', 'profiler_tim_list', 'profiler_peserta',
    'qa_periods', 'qa_indicators', 'qa_temuan'
  ];
  v_table text;
  v_policy_count integer;
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    IF to_regclass('public.' || v_table) IS NOT NULL THEN
      SELECT count(*) INTO v_policy_count
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = v_table;

      IF v_policy_count = 0 THEN
        v_missing := array_append(v_missing, v_table);
      END IF;
    END IF;
  END LOOP;

  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'CRITICAL: 0 RLS policies on: %', array_to_string(v_missing, ', ');
  END IF;

  RAISE NOTICE 'All 11 target tables have at least one RLS policy.';
END $$;

-- =============================================================================
-- 11. VERIFY: ketik_history subquery accessible from dependent tables
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ketik_session_reviews'
  ) THEN
    RAISE EXCEPTION 'CRITICAL: ketik_session_reviews policy missing!';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ketik_typo_findings'
  ) THEN
    RAISE EXCEPTION 'CRITICAL: ketik_typo_findings policy missing!';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ketik_review_jobs'
  ) THEN
    RAISE EXCEPTION 'CRITICAL: ketik_review_jobs policy missing!';
  END IF;

  RAISE NOTICE 'All ketik dependency chain intact: history -> reviews, typo findings, review jobs.';
END $$;
