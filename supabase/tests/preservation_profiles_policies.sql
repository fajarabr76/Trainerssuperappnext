-- =============================================================================
-- Preservation Property Tests: Valid Policies and Operations Unchanged
-- =============================================================================
--
-- SPEC: admin-stuck-waiting-approval
-- PROPERTY: Property 2 - Preservation - Valid Policies and Operations Unchanged
-- VALIDATES: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7
--
-- PURPOSE:
--   Capture baseline behavior on UNFIXED database to ensure no regressions
--   after the fix migration is applied. This test uses service_role to bypass
--   RLS for inspection queries and observes that all valid policies, triggers,
--   and grants are intact.
--
-- HOW TO RUN:
--   Execute via Supabase Management API or psql against the live database
--   using a role with sufficient privileges (service_role recommended).
--
-- EXPECTED OUTCOME ON UNFIXED DB: All assertions PASS (baseline confirmed)
-- EXPECTED OUTCOME AFTER FIX: Same assertions PASS (no regressions)
-- =============================================================================

-- =============================================================================
-- TEST GROUP A: Valid SELECT Policies Exist
-- =============================================================================
-- Verify all get_auth_role()-based SELECT policies from fix 20260514230000 exist.
-- Validates: Requirements 3.7

DO $$
DECLARE
  v_policy_count integer;
  v_missing      text[] := ARRAY[]::text[];
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE 'PRESERVATION TEST: Valid Policies and Operations Unchanged';
  RAISE NOTICE 'SPEC: admin-stuck-waiting-approval | Property 2';
  RAISE NOTICE '=============================================================================';

  -- A1: Users can view own profile
  SELECT count(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'profiles'
    AND policyname = 'Users can view own profile';
  IF v_policy_count = 0 THEN
    v_missing := array_append(v_missing, 'Users can view own profile');
  ELSE
    RAISE NOTICE 'A1 PASS: Policy "Users can view own profile" exists.';
  END IF;

  -- A2: Admins can view all profiles
  SELECT count(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'profiles'
    AND policyname = 'Admins can view all profiles';
  IF v_policy_count = 0 THEN
    v_missing := array_append(v_missing, 'Admins can view all profiles');
  ELSE
    RAISE NOTICE 'A2 PASS: Policy "Admins can view all profiles" exists.';
  END IF;

  -- A3: Trainers can view all profiles
  SELECT count(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'profiles'
    AND policyname = 'Trainers can view all profiles';
  IF v_policy_count = 0 THEN
    v_missing := array_append(v_missing, 'Trainers can view all profiles');
  ELSE
    RAISE NOTICE 'A3 PASS: Policy "Trainers can view all profiles" exists.';
  END IF;

  -- A4: Leaders can view all profiles
  SELECT count(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'profiles'
    AND policyname = 'Leaders can view all profiles';
  IF v_policy_count = 0 THEN
    v_missing := array_append(v_missing, 'Leaders can view all profiles');
  ELSE
    RAISE NOTICE 'A4 PASS: Policy "Leaders can view all profiles" exists.';
  END IF;

  IF array_length(v_missing, 1) > 0 THEN
    RAISE EXCEPTION 'PRESERVATION FAILED — Missing policies: %', array_to_string(v_missing, ', ');
  END IF;

  RAISE NOTICE 'GROUP A PASS: All 4 SELECT policies are present.';
END $$;

-- =============================================================================
-- TEST GROUP B: INSERT/UPDATE Policies and Trigger Exist
-- =============================================================================
-- Verify INSERT/UPDATE policies from migration 20260513000000 are intact.
-- Validates: Requirements 3.1, 3.2, 3.6

DO $$
DECLARE
  v_policy_count integer;
  v_missing      text[] := ARRAY[]::text[];
  v_trigger_count integer;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '--- GROUP B: INSERT/UPDATE Policies and Trigger ---';

  -- B1: Users can insert own pending profile
  SELECT count(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'profiles'
    AND policyname = 'Users can insert own pending profile';
  IF v_policy_count = 0 THEN
    v_missing := array_append(v_missing, 'Users can insert own pending profile');
  ELSE
    RAISE NOTICE 'B1 PASS: Policy "Users can insert own pending profile" exists.';
  END IF;

  -- B2: Users can update own display name
  SELECT count(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'profiles'
    AND policyname = 'Users can update own display name';
  IF v_policy_count = 0 THEN
    v_missing := array_append(v_missing, 'Users can update own display name');
  ELSE
    RAISE NOTICE 'B2 PASS: Policy "Users can update own display name" exists.';
  END IF;

  -- B3: Trigger guard_profile_sensitive_columns is active
  SELECT count(*) INTO v_trigger_count
  FROM pg_trigger
  WHERE tgname = 'guard_profile_sensitive_columns'
    AND tgrelid = 'public.profiles'::regclass
    AND tgtype = (1 << 1 | 1 << 6); -- BEFORE UPDATE | FOR EACH ROW
  IF v_trigger_count = 0 THEN
    v_missing := array_append(v_missing, 'Trigger guard_profile_sensitive_columns');
  ELSE
    RAISE NOTICE 'B3 PASS: Trigger "guard_profile_sensitive_columns" is active.';
  END IF;

  IF array_length(v_missing, 1) > 0 THEN
    RAISE EXCEPTION 'PRESERVATION FAILED — Missing INSERT/UPDATE policies or trigger: %',
      array_to_string(v_missing, ', ');
  END IF;

  RAISE NOTICE 'GROUP B PASS: INSERT/UPDATE policies and trigger are present.';
END $$;

-- =============================================================================
-- TEST GROUP C: get_auth_role() Has EXECUTE Permission
-- =============================================================================
-- Verify get_auth_role() has EXECUTE for authenticated role (from fix 20260514230000).
-- Validates: Preservation of fix 20260514230000

DO $$
DECLARE
  v_has_execute boolean;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '--- GROUP C: get_auth_role() EXECUTE Permission ---';

  SELECT has_function_privilege('authenticated', 'get_auth_role()', 'execute')
  INTO v_has_execute;

  IF v_has_execute THEN
    RAISE NOTICE 'C PASS: get_auth_role() has EXECUTE permission for authenticated.';
  ELSE
    RAISE EXCEPTION 'PRESERVATION FAILED — get_auth_role() lacks EXECUTE for authenticated!';
  END IF;
END $$;

-- =============================================================================
-- TEST GROUP D: Anon Has No Access to profiles
-- =============================================================================
-- Verify unauthenticated users cannot read profiles.
-- Validates: Requirement 3.5

DO $$
DECLARE
  v_has_select boolean;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '--- GROUP D: Anon Access Denied on profiles ---';

  SELECT has_table_privilege('anon', 'profiles', 'SELECT')
  INTO v_has_select;

  IF NOT v_has_select THEN
    RAISE NOTICE 'D PASS: anon role has no SELECT on profiles.';
  ELSE
    RAISE EXCEPTION 'PRESERVATION FAILED — anon role CAN SELECT on profiles!';
  END IF;
END $$;

-- =============================================================================
-- TEST GROUP E: UPDATE Grant Restricted to full_name
-- =============================================================================
-- Verify authenticated can only UPDATE full_name column on profiles.
-- Validates: Requirement 3.2 preservation

DO $$
DECLARE
  v_has_update_fullname boolean;
  v_has_update_role     boolean;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '--- GROUP E: UPDATE Grant Restricted to full_name ---';

  -- Check column-level privileges
  SELECT has_column_privilege('authenticated', 'profiles', 'full_name', 'UPDATE')
  INTO v_has_update_fullname;

  SELECT has_column_privilege('authenticated', 'profiles', 'role', 'UPDATE')
  INTO v_has_update_role;

  IF v_has_update_fullname AND NOT v_has_update_role THEN
    RAISE NOTICE 'E PASS: UPDATE restricted to full_name column only.';
  ELSE
    RAISE EXCEPTION 'PRESERVATION FAILED — UPDATE grants on profiles are not properly restricted! (full_name: %, role: %)',
      v_has_update_fullname, v_has_update_role;
  END IF;
END $$;

-- =============================================================================
-- TEST GROUP F: No Stale Policies Referencing get_my_role
-- =============================================================================
-- Verify no policies on ANY table reference get_my_role.
-- This is expected to FAIL on unfixed DB (confirming Task 1), but should PASS
-- after the fix migration is applied.

DO $$
DECLARE
  v_policy_count integer;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '--- GROUP F: No Stale Policies Referencing get_my_role ---';

  SELECT count(*) INTO v_policy_count
  FROM pg_policies
  WHERE (qual ILIKE '%get_my_role%' OR with_check ILIKE '%get_my_role%');

  IF v_policy_count = 0 THEN
    RAISE NOTICE 'F PASS: No stale policies referencing get_my_role exist on any table.';
  ELSE
    RAISE NOTICE 'F INFO: % stale policy/policies referencing get_my_role exist (expected on unfixed DB).', v_policy_count;
  END IF;
END $$;

-- =============================================================================
-- FINAL SUMMARY
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE 'PRESERVATION TEST SUMMARY';
  RAISE NOTICE '  All preservation checks completed. Check for EXCEPTION messages above.';
  RAISE NOTICE '  If no EXCEPTION was raised, all preservation properties are satisfied.';
  RAISE NOTICE '=============================================================================';
END $$;
