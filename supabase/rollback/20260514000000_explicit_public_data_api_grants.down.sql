-- Rollback: Explicit Public Data API Grants & RLS Hardening
-- Description: Revokes the explicit authenticated grants and drops the safe policies added by the mitigation migration.
-- Per strict instructions, RLS remains enabled on all tables.

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
  v_func text;
  v_user_rpcs text[] := ARRAY[
    'bulk_reorder_profiler_peserta', 'get_leader_approved_scope_items', 'get_qa_agent_directory_summary',
    'get_qa_dashboard_data', 'get_qa_dashboard_range_data', 'get_qa_dashboard_range_trend_data',
    'get_service_trend_dashboard', 'publish_rule_version', 'refresh_qa_dashboard_summary_for_period',
    'submit_pdkt_mailbox_batch', 'submit_pdkt_mailbox_reply'
  ];
BEGIN
  -- 1. Revoke explicit table privileges added to authenticated
  FOREACH v_table IN ARRAY v_app_tables LOOP
    IF to_regclass('public.' || v_table) IS NOT NULL THEN
      EXECUTE 'REVOKE ALL ON public.' || v_table || ' FROM authenticated';
    END IF;
  END LOOP;

  FOREACH v_table IN ARRAY v_summary_tables LOOP
    IF to_regclass('public.' || v_table) IS NOT NULL THEN
      EXECUTE 'REVOKE ALL ON public.' || v_table || ' FROM authenticated';
    END IF;
  END LOOP;

  -- 2. Revoke execute privileges added to authenticated for client-facing RPCs
  FOR v_func IN 
    SELECT quote_ident(proname) || '(' || pg_get_function_identity_arguments(p.oid) || ')'
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND proname = ANY(v_user_rpcs)
  LOOP
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.' || v_func || ' FROM authenticated';
  END LOOP;

  -- 3. Safely drop policies added by the migration using to_regclass guards
  IF to_regclass('public.qa_dashboard_period_summary') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Authenticated users can read qa dashboard period summary" ON public.qa_dashboard_period_summary;
    DROP POLICY IF EXISTS "Authenticated users can delete qa dashboard period summary" ON public.qa_dashboard_period_summary;
  END IF;

  IF to_regclass('public.qa_dashboard_indicator_period_summary') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Authenticated users can read qa dashboard indicator summary" ON public.qa_dashboard_indicator_period_summary;
    DROP POLICY IF EXISTS "Authenticated users can delete qa dashboard indicator summary" ON public.qa_dashboard_indicator_period_summary;
  END IF;

  IF to_regclass('public.qa_dashboard_agent_period_summary') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Authenticated users can read qa dashboard agent summary" ON public.qa_dashboard_agent_period_summary;
    DROP POLICY IF EXISTS "Authenticated users can delete qa dashboard agent summary" ON public.qa_dashboard_agent_period_summary;
  END IF;

  IF to_regclass('public.ai_billing_settings') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Service role full access ai billing settings" ON public.ai_billing_settings;
  END IF;

  IF to_regclass('public.ai_pricing_settings') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Service role full access ai pricing settings" ON public.ai_pricing_settings;
  END IF;

  IF to_regclass('public.ai_usage_logs') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Service role full access ai usage logs" ON public.ai_usage_logs;
  END IF;

END $$;
