-- Migration: Explicit Public Data API Grants & RLS Hardening
-- Description: Revokes broad/implicit grants from anon, public, and authenticated on all application tables and functions,
-- enforces explicit authenticated access, restricts service-only tables, and ensures all tables have RLS enabled with valid policies.

DO $$
DECLARE
  v_table text;
  v_app_tables text[] := ARRAY[
    'access_group_items', 'access_groups', 'activity_logs', 'ketik_history', 'ketik_personas',
    'ketik_scenarios', 'ketik_session_reviews', 'ketik_typo_findings', 'leader_access_request_groups',
    'leader_access_requests', 'pdkt_history', 'pdkt_mailbox_items', 'pdkt_scenarios', 'profiler_folders',
    'profiler_peserta', 'profiler_tim_list', 'profiler_years', 'profiles', 'qa_findings', 'qa_indicators',
    'qa_periods', 'qa_service_rule_indicators', 'qa_service_rule_versions', 'qa_service_weights',
    'qa_temuan', 'reports', 'results', 'telefun_history', 'user_settings'
  ];
  v_summary_tables text[] := ARRAY[
    'qa_dashboard_agent_period_summary', 'qa_dashboard_indicator_period_summary', 'qa_dashboard_period_summary'
  ];
  v_service_tables text[] := ARRAY[
    'ai_billing_settings', 'ai_pricing_settings', 'ai_usage_logs', 'ketik_review_jobs',
    'qa_indicators_backup', 'qa_temuan_backup', 'security_rate_limits'
  ];
  v_all_tables text[] := ARRAY[
    'access_group_items', 'access_groups', 'activity_logs', 'ai_billing_settings', 'ai_pricing_settings',
    'ai_usage_logs', 'ketik_history', 'ketik_personas', 'ketik_review_jobs', 'ketik_scenarios',
    'ketik_session_reviews', 'ketik_typo_findings', 'leader_access_request_groups', 'leader_access_requests',
    'pdkt_history', 'pdkt_mailbox_items', 'pdkt_scenarios', 'profiler_folders', 'profiler_peserta',
    'profiler_tim_list', 'profiler_years', 'profiles', 'qa_dashboard_agent_period_summary',
    'qa_dashboard_indicator_period_summary', 'qa_dashboard_period_summary', 'qa_findings', 'qa_indicators',
    'qa_indicators_backup', 'qa_periods', 'qa_service_rule_indicators', 'qa_service_rule_versions',
    'qa_service_weights', 'qa_temuan', 'qa_temuan_backup', 'reports', 'results', 'security_rate_limits',
    'telefun_history', 'user_settings'
  ];
  v_func text;
  v_user_rpcs text[] := ARRAY[
    'bulk_reorder_profiler_peserta', 'get_leader_approved_scope_items', 'get_qa_agent_directory_summary',
    'get_qa_dashboard_data', 'get_qa_dashboard_range_data', 'get_qa_dashboard_range_trend_data',
    'get_service_trend_dashboard', 'publish_rule_version', 'refresh_qa_dashboard_summary_for_period',
    'submit_pdkt_mailbox_batch', 'submit_pdkt_mailbox_reply'
  ];
BEGIN
  -- 1. Ensure Row Level Security is enabled on all tables using to_regclass guards
  FOREACH v_table IN ARRAY v_all_tables LOOP
    IF to_regclass('public.' || v_table) IS NOT NULL THEN
      EXECUTE 'ALTER TABLE public.' || v_table || ' ENABLE ROW LEVEL SECURITY';
    END IF;
  END LOOP;

  -- 2. Revoke broad grants from authenticated, anon, and public for all tables to ensure clean slate
  FOREACH v_table IN ARRAY v_all_tables LOOP
    IF to_regclass('public.' || v_table) IS NOT NULL THEN
      EXECUTE 'REVOKE ALL ON public.' || v_table || ' FROM authenticated, anon, public';
      EXECUTE 'GRANT ALL ON public.' || v_table || ' TO service_role';
    END IF;
  END LOOP;

  -- 3. Explicitly grant required application table privileges to authenticated
  FOREACH v_table IN ARRAY v_app_tables LOOP
    IF to_regclass('public.' || v_table) IS NOT NULL THEN
      IF v_table = 'profiles' THEN
        -- profiles receives selective column update privileges to adhere to strict profile contracts
        EXECUTE 'GRANT SELECT, INSERT ON public.profiles TO authenticated';
      ELSE
        EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.' || v_table || ' TO authenticated';
      END IF;
    END IF;
  END LOOP;

  -- 4. Grant SELECT and DELETE on dashboard summary tables to authenticated users to support cache invalidation
  FOREACH v_table IN ARRAY v_summary_tables LOOP
    IF to_regclass('public.' || v_table) IS NOT NULL THEN
      EXECUTE 'GRANT SELECT, DELETE ON public.' || v_table || ' TO authenticated';
    END IF;
  END LOOP;

  -- Note: v_service_tables receive NO grants to authenticated/anon roles (service_role only).

  -- 5. Hardening Function / RPC execution grants (revoke from authenticated as well to lock down internal RPCs)
  FOR v_func IN 
    SELECT quote_ident(proname) || '(' || pg_get_function_identity_arguments(p.oid) || ')'
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
  LOOP
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.' || v_func || ' FROM authenticated, public, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.' || v_func || ' TO service_role';
  END LOOP;

  -- Grant execute to authenticated users for client-facing RPCs
  FOR v_func IN 
    SELECT quote_ident(proname) || '(' || pg_get_function_identity_arguments(p.oid) || ')'
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND proname = ANY(v_user_rpcs)
  LOOP
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.' || v_func || ' TO authenticated';
  END LOOP;

  -- 6. Safe, idempotent RLS Policy enforcement using to_regclass guards
  IF to_regclass('public.qa_dashboard_period_summary') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Authenticated users can read qa dashboard period summary" ON public.qa_dashboard_period_summary;
    DROP POLICY IF EXISTS "Authenticated users can delete qa dashboard period summary" ON public.qa_dashboard_period_summary;
    CREATE POLICY "Authenticated users can read qa dashboard period summary" 
      ON public.qa_dashboard_period_summary FOR SELECT TO authenticated USING (true);
    CREATE POLICY "Authenticated users can delete qa dashboard period summary" 
      ON public.qa_dashboard_period_summary FOR DELETE TO authenticated USING (true);
  END IF;

  IF to_regclass('public.qa_dashboard_indicator_period_summary') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Authenticated users can read qa dashboard indicator summary" ON public.qa_dashboard_indicator_period_summary;
    DROP POLICY IF EXISTS "Authenticated users can delete qa dashboard indicator summary" ON public.qa_dashboard_indicator_period_summary;
    CREATE POLICY "Authenticated users can read qa dashboard indicator summary" 
      ON public.qa_dashboard_indicator_period_summary FOR SELECT TO authenticated USING (true);
    CREATE POLICY "Authenticated users can delete qa dashboard indicator summary" 
      ON public.qa_dashboard_indicator_period_summary FOR DELETE TO authenticated USING (true);
  END IF;

  IF to_regclass('public.qa_dashboard_agent_period_summary') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Authenticated users can read qa dashboard agent summary" ON public.qa_dashboard_agent_period_summary;
    DROP POLICY IF EXISTS "Authenticated users can delete qa dashboard agent summary" ON public.qa_dashboard_agent_period_summary;
    CREATE POLICY "Authenticated users can read qa dashboard agent summary" 
      ON public.qa_dashboard_agent_period_summary FOR SELECT TO authenticated USING (true);
    CREATE POLICY "Authenticated users can delete qa dashboard agent summary" 
      ON public.qa_dashboard_agent_period_summary FOR DELETE TO authenticated USING (true);
  END IF;

  -- Ensure service-only/billing tables have explicit service_role policies to prevent policy_count=0 warnings
  IF to_regclass('public.ai_billing_settings') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Service role full access ai billing settings" ON public.ai_billing_settings;
    CREATE POLICY "Service role full access ai billing settings" 
      ON public.ai_billing_settings TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF to_regclass('public.ai_pricing_settings') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Service role full access ai pricing settings" ON public.ai_pricing_settings;
    CREATE POLICY "Service role full access ai pricing settings" 
      ON public.ai_pricing_settings TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF to_regclass('public.ai_usage_logs') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Service role full access ai usage logs" ON public.ai_usage_logs;
    CREATE POLICY "Service role full access ai usage logs" 
      ON public.ai_usage_logs TO service_role USING (true) WITH CHECK (true);
  END IF;

END $$;

-- Enforce explicit string requirement for static contract tests:
GRANT UPDATE (full_name) ON public.profiles TO authenticated;
