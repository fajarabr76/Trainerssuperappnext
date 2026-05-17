-- Rollback is local/dev only for 20260401000000_create_initial_app_base_schema.sql.
-- It refuses to drop non-empty base tables because these tables can contain
-- user profiles, participant PII, simulation history, and SIDAK audit data.

DO $$
DECLARE
  v_table text;
  v_count bigint;
  v_tables text[] := ARRAY[
    'qa_temuan',
    'qa_indicators',
    'qa_periods',
    'pdkt_history',
    'ketik_history',
    'profiler_peserta',
    'profiler_tim_list',
    'profiler_folders',
    'profiler_years',
    'user_settings',
    'activity_logs',
    'profiles'
  ];
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    IF to_regclass('public.' || v_table) IS NOT NULL THEN
      EXECUTE format('SELECT COUNT(*) FROM public.%I', v_table) INTO v_count;
      IF v_count > 0 THEN
        RAISE EXCEPTION 'Refusing to drop non-empty base table public.% with % rows', v_table, v_count;
      END IF;
    END IF;
  END LOOP;
END $$;

DROP TABLE IF EXISTS public.qa_temuan;
DROP TABLE IF EXISTS public.qa_indicators;
DROP TABLE IF EXISTS public.qa_periods;
DROP TABLE IF EXISTS public.pdkt_history;
DROP TABLE IF EXISTS public.ketik_history;
DROP TABLE IF EXISTS public.profiler_peserta;
DROP TABLE IF EXISTS public.profiler_tim_list;
DROP TABLE IF EXISTS public.profiler_folders;
DROP TABLE IF EXISTS public.profiler_years;
DROP TABLE IF EXISTS public.user_settings;
DROP TABLE IF EXISTS public.activity_logs;
DROP TABLE IF EXISTS public.profiles;

DROP FUNCTION IF EXISTS public.get_auth_role();
DROP FUNCTION IF EXISTS public.update_updated_at_column();
