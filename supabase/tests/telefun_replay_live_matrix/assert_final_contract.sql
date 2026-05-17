\set ON_ERROR_STOP on

CREATE OR REPLACE FUNCTION pg_temp.assert_true(condition boolean, message text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT condition THEN
    RAISE EXCEPTION '%', message;
  END IF;
END;
$$;

SELECT pg_temp.assert_true(
  to_regclass('public.telefun_coaching_summary') IS NOT NULL,
  'telefun_coaching_summary must exist'
);

SELECT pg_temp.assert_true(
  to_regclass('public.telefun_replay_annotations') IS NOT NULL,
  'telefun_replay_annotations must exist'
);

SELECT pg_temp.assert_true(
  (
    SELECT count(*)
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'telefun_history'
      AND column_name IN (
        'session_duration_ms',
        'voice_dashboard_metrics',
        'disruption_config',
        'disruption_results',
        'persona_config',
        'realistic_mode_enabled'
      )
  ) = 6,
  'telefun_history must have all replay/realistic columns'
);

SELECT pg_temp.assert_true(
  (
    SELECT relrowsecurity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'telefun_replay_annotations'
  ),
  'telefun_replay_annotations must have RLS enabled'
);

SELECT pg_temp.assert_true(
  has_table_privilege('authenticated', 'public.telefun_replay_annotations', 'SELECT'),
  'authenticated must be able to SELECT owned replay annotations through RLS'
);

SELECT pg_temp.assert_true(
  has_table_privilege('authenticated', 'public.telefun_replay_annotations', 'INSERT'),
  'authenticated must be able to INSERT manual replay annotations through RLS'
);

SELECT pg_temp.assert_true(
  NOT has_table_privilege('authenticated', 'public.telefun_replay_annotations', 'DELETE'),
  'authenticated must not have direct DELETE on replay annotations'
);

SELECT pg_temp.assert_true(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'telefun_replay_annotations'
      AND policyname = 'Users can insert their own replay annotations'
      AND cmd = 'INSERT'
      AND with_check ILIKE '%is_manual = true%'
      AND with_check ILIKE '%telefun_history%'
  ),
  'replay annotation INSERT policy must require manual rows and session ownership'
);

SELECT pg_temp.assert_true(
  (
    SELECT count(*)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'upsert_telefun_coaching_summary'
      AND oidvectortypes(p.proargtypes) = 'uuid, jsonb, integer, text'
  ) = 1,
  'final upsert_telefun_coaching_summary(uuid,jsonb,integer,text) signature must exist exactly once'
);

SELECT pg_temp.assert_true(
  (
    SELECT count(*)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'upsert_telefun_coaching_summary'
      AND oidvectortypes(p.proargtypes) = 'uuid, jsonb'
  ) = 0,
  'legacy upsert_telefun_coaching_summary(uuid,jsonb) signature must be removed'
);

SELECT pg_temp.assert_true(
  has_function_privilege(
    'authenticated',
    'public.upsert_telefun_coaching_summary(uuid,jsonb,integer,text)',
    'EXECUTE'
  ),
  'authenticated must have EXECUTE on final coaching summary RPC'
);

SELECT pg_temp.assert_true(
  has_function_privilege(
    'service_role',
    'public.upsert_telefun_coaching_summary(uuid,jsonb,integer,text)',
    'EXECUTE'
  ),
  'service_role must have EXECUTE on final coaching summary RPC'
);

DO $$
BEGIN
  SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000000"}';
  PERFORM public.upsert_telefun_coaching_summary(
    '00000000-0000-0000-0000-000000000001'::uuid,
    '[]'::jsonb,
    0,
    repeat('0', 64)
  );
  RAISE EXCEPTION 'RPC should reject a missing session';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'Session not found:%' THEN
      RAISE;
    END IF;
END;
$$;
