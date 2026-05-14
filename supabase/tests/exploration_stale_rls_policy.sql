-- =============================================================================
-- Bug Condition Exploration Test: Stale RLS Policy Blocks Profile Query
-- =============================================================================
--
-- SPEC: admin-stuck-waiting-approval
-- PROPERTY: Property 1 - Bug Condition - Stale RLS Policy Blocks Profile Query
-- VALIDATES: Requirements 1.1, 1.2, 1.3, 1.4, 1.5
--
-- PURPOSE:
--   This test surfaces counterexamples demonstrating that stale RLS policies
--   on the `profiles` table referencing `get_my_role()` cause ALL authenticated
--   SELECT queries to fail with "permission denied for function get_my_role".
--
--   Root cause:
--     - Migration 20260514000000 revoked EXECUTE on ALL public functions from
--       `authenticated`, including the legacy `get_my_role()` function.
--     - Fix 20260514230000 only re-granted EXECUTE on `get_auth_role()`, NOT
--       on `get_my_role()`.
--     - A stale policy `profiles_select_policy` still references `get_my_role()`
--       in its USING clause.
--     - PostgreSQL evaluates ALL RLS policies (OR logic). If ANY policy raises
--       a runtime error (not just returns false), the ENTIRE query fails.
--     - Result: every authenticated SELECT on `profiles` fails with
--       "permission denied for function get_my_role".
--
-- BUG CONDITION (from design.md):
--   isBugCondition(input) WHERE:
--     input.operation = 'SELECT'
--     AND input.table = 'profiles'
--     AND EXISTS stalePolicyReferencing('get_my_role', 'profiles')
--     AND NOT hasExecutePermission('authenticated', 'get_my_role')
--
-- EXPECTED OUTCOME ON UNFIXED DATABASE:
--   - Test cases 1-4 CONFIRM the bug exists (stale policy found, no EXECUTE,
--     query fails with permission denied).
--   - The final assertion block RAISES EXCEPTION if the bug is NOT present,
--     meaning the test PASSES only when the bug is confirmed.
--
-- EXPECTED OUTCOME AFTER FIX (migration 20260515000000):
--   - Stale policy is dropped, legacy functions are removed.
--   - All assertions pass without raising exceptions.
--   - SELECT on profiles succeeds for authenticated users.
--
-- HOW TO RUN:
--   Execute via Supabase Management API or psql against the live database.
--   The test uses service_role context for inspection queries, and simulates
--   authenticated sessions via set_config() for the SELECT attempt.
--
-- COUNTEREXAMPLES DOCUMENTED:
--   1. pg_policies shows `profiles_select_policy` with qual containing `get_my_role()`
--   2. has_function_privilege('authenticated', 'get_my_role()', 'execute') = false
--   3. SELECT on profiles as authenticated raises "permission denied for function get_my_role"
--   4. Direct call SELECT get_my_role() as authenticated raises "permission denied"
--
-- =============================================================================

-- =============================================================================
-- TEST CASE 1: Stale Policy Exists on profiles Referencing get_my_role
-- =============================================================================
-- Query pg_policies to confirm stale policies referencing get_my_role exist.
-- EXPECTED ON UNFIXED DB: At least 1 row returned (stale policy found → bug confirmed)
-- EXPECTED AFTER FIX: 0 rows returned (stale policy dropped)
-- Validates: Requirements 1.1, 1.5

DO $$
DECLARE
  v_stale_policy_count integer;
  v_stale_policy_name  text;
  v_stale_policy_qual  text;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE 'BUG CONDITION EXPLORATION TEST: Stale RLS Policy Blocks Profile Query';
  RAISE NOTICE 'SPEC: admin-stuck-waiting-approval | Property 1';
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE '';
  RAISE NOTICE '--- TEST CASE 1: Stale Policy Exists on profiles Referencing get_my_role ---';

  SELECT count(*), min(policyname), min(qual)
  INTO v_stale_policy_count, v_stale_policy_name, v_stale_policy_qual
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename  = 'profiles'
    AND (qual ILIKE '%get_my_role%' OR with_check ILIKE '%get_my_role%');

  RAISE NOTICE 'Stale policies found on profiles referencing get_my_role: %', v_stale_policy_count;

  IF v_stale_policy_count > 0 THEN
    RAISE NOTICE 'COUNTEREXAMPLE FOUND:';
    RAISE NOTICE '  Policy name : %', v_stale_policy_name;
    RAISE NOTICE '  USING clause: %', v_stale_policy_qual;
    RAISE NOTICE '';
    RAISE NOTICE 'RESULT: BUG CONDITION CONFIRMED — stale policy referencing get_my_role() exists.';
    RAISE NOTICE '  PostgreSQL will evaluate this policy for every authenticated SELECT on profiles.';
    RAISE NOTICE '  Since get_my_role() lacks EXECUTE permission, the evaluation raises an error';
    RAISE NOTICE '  that propagates to the caller, causing the entire query to fail.';
  ELSE
    RAISE NOTICE 'RESULT: No stale policies found — bug may have been fixed or was never present.';
  END IF;
END $$;

-- =============================================================================
-- TEST CASE 2: authenticated Role Lacks EXECUTE on get_my_role()
-- =============================================================================
-- Check has_function_privilege('authenticated', 'get_my_role()', 'execute').
-- EXPECTED ON UNFIXED DB: false (EXECUTE was revoked by migration 20260514000000)
-- EXPECTED AFTER FIX: function no longer exists (dropped by fix migration)
-- Validates: Requirements 1.1, 1.5

DO $$
DECLARE
  v_has_execute        boolean;
  v_function_exists    boolean;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '--- TEST CASE 2: authenticated Role Lacks EXECUTE on get_my_role() ---';

  -- Check if the function exists at all
  SELECT EXISTS(
    SELECT 1 FROM pg_proc
    WHERE proname = 'get_my_role'
      AND pronamespace = 'public'::regnamespace
  ) INTO v_function_exists;

  IF NOT v_function_exists THEN
    RAISE NOTICE 'get_my_role() does not exist in database.';
    RAISE NOTICE 'RESULT: Function already removed — fix may have been applied.';
    RETURN;
  END IF;

  RAISE NOTICE 'get_my_role() exists in database.';

  -- Check EXECUTE privilege for authenticated role
  SELECT has_function_privilege('authenticated', 'get_my_role()', 'execute')
  INTO v_has_execute;

  RAISE NOTICE 'has_function_privilege(''authenticated'', ''get_my_role()'', ''execute'') = %', v_has_execute;

  IF NOT v_has_execute THEN
    RAISE NOTICE '';
    RAISE NOTICE 'COUNTEREXAMPLE FOUND:';
    RAISE NOTICE '  authenticated role CANNOT execute get_my_role().';
    RAISE NOTICE '  Migration 20260514000000 revoked EXECUTE on all public functions.';
    RAISE NOTICE '  Fix 20260514230000 only re-granted EXECUTE on get_auth_role(), not get_my_role().';
    RAISE NOTICE '';
    RAISE NOTICE 'RESULT: BUG CONDITION CONFIRMED — get_my_role() lacks EXECUTE for authenticated.';
    RAISE NOTICE '  When PostgreSQL evaluates the stale policy USING clause containing get_my_role(),';
    RAISE NOTICE '  it raises "permission denied for function get_my_role" instead of returning false.';
    RAISE NOTICE '  This error propagates and causes the entire SELECT on profiles to fail.';
  ELSE
    RAISE NOTICE 'RESULT: authenticated CAN execute get_my_role() — EXECUTE was re-granted.';
    RAISE NOTICE '  Bug may not be present or was partially fixed.';
  END IF;
END $$;

-- =============================================================================
-- TEST CASE 3: SELECT on profiles as authenticated Fails with Permission Denied
-- =============================================================================
-- Simulate an authenticated user session and attempt SELECT on profiles.
-- EXPECTED ON UNFIXED DB: Error "permission denied for function get_my_role"
-- EXPECTED AFTER FIX: Query succeeds, returns rows
-- Validates: Requirements 1.1, 1.2, 1.3, 1.4

DO $$
DECLARE
  v_test_user_id   uuid;
  v_row_count      integer;
  v_error_message  text;
  v_query_failed   boolean := false;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '--- TEST CASE 3: SELECT on profiles as authenticated Fails with Permission Denied ---';

  -- Find an existing user to simulate (use service_role to bypass RLS for setup)
  SELECT id INTO v_test_user_id FROM public.profiles LIMIT 1;

  IF v_test_user_id IS NULL THEN
    RAISE EXCEPTION 'SETUP ERROR: No users found in profiles table. Cannot run test.';
  END IF;

  RAISE NOTICE 'Simulating authenticated session for user: %', v_test_user_id;

  -- Simulate authenticated session via JWT claims
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub',  v_test_user_id::text,
    'role', 'authenticated',
    'aud',  'authenticated'
  )::text, true);

  SET LOCAL ROLE authenticated;

  -- Attempt SELECT on profiles — expect "permission denied for function get_my_role"
  BEGIN
    EXECUTE 'SELECT count(*) FROM public.profiles WHERE id = auth.uid()' INTO v_row_count;
    v_query_failed := false;
  EXCEPTION WHEN OTHERS THEN
    v_query_failed  := true;
    v_error_message := SQLERRM;
  END;

  RESET ROLE;

  IF v_query_failed THEN
    RAISE NOTICE '';
    RAISE NOTICE 'COUNTEREXAMPLE FOUND:';
    RAISE NOTICE '  SELECT on profiles as authenticated raised an error:';
    RAISE NOTICE '  Error: %', v_error_message;
    RAISE NOTICE '';
    IF v_error_message ILIKE '%permission denied for function get_my_role%' THEN
      RAISE NOTICE 'RESULT: BUG CONDITION CONFIRMED — exact expected error observed.';
      RAISE NOTICE '  "permission denied for function get_my_role" proves that:';
      RAISE NOTICE '  1. Stale policy with get_my_role() in USING clause is being evaluated.';
      RAISE NOTICE '  2. authenticated role lacks EXECUTE on get_my_role().';
      RAISE NOTICE '  3. PostgreSQL propagates the error (not false) → entire query fails.';
      RAISE NOTICE '  4. Supabase client returns { data: null, error: {...} }.';
      RAISE NOTICE '  5. Middleware passes error, requirePageAccess() sees profile: null.';
      RAISE NOTICE '  6. User is redirected to /waiting-approval as Ghost Profile.';
    ELSE
      RAISE NOTICE 'RESULT: Query failed with unexpected error (not the expected permission denied).';
      RAISE NOTICE '  This may indicate a different bug or misconfiguration.';
    END IF;
  ELSE
    RAISE NOTICE 'Rows returned: %', v_row_count;
    RAISE NOTICE 'RESULT: SELECT succeeded — bug may have been fixed or stale policy was removed.';
  END IF;
END $$;

-- =============================================================================
-- TEST CASE 4: Direct Call SELECT get_my_role() as authenticated Fails
-- =============================================================================
-- Attempt direct invocation of get_my_role() as authenticated role.
-- EXPECTED ON UNFIXED DB: "permission denied for function get_my_role"
-- EXPECTED AFTER FIX: function no longer exists (dropped)
-- Validates: Requirements 1.1, 1.5

DO $$
DECLARE
  v_test_user_id   uuid;
  v_result         text;
  v_error_message  text;
  v_call_failed    boolean := false;
  v_function_exists boolean;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '--- TEST CASE 4: Direct Call SELECT get_my_role() as authenticated Fails ---';

  -- Check if function exists first
  SELECT EXISTS(
    SELECT 1 FROM pg_proc
    WHERE proname = 'get_my_role'
      AND pronamespace = 'public'::regnamespace
  ) INTO v_function_exists;

  IF NOT v_function_exists THEN
    RAISE NOTICE 'get_my_role() does not exist — fix may have been applied (function dropped).';
    RAISE NOTICE 'RESULT: Function already removed — this test case is not applicable post-fix.';
    RETURN;
  END IF;

  -- Find a user to simulate
  SELECT id INTO v_test_user_id FROM public.profiles LIMIT 1;

  IF v_test_user_id IS NULL THEN
    RAISE EXCEPTION 'SETUP ERROR: No users found in profiles table.';
  END IF;

  RAISE NOTICE 'Simulating authenticated session for user: %', v_test_user_id;

  -- Simulate authenticated session
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub',  v_test_user_id::text,
    'role', 'authenticated',
    'aud',  'authenticated'
  )::text, true);

  SET LOCAL ROLE authenticated;

  -- Attempt direct call to get_my_role()
  BEGIN
    EXECUTE 'SELECT public.get_my_role()' INTO v_result;
    v_call_failed := false;
  EXCEPTION WHEN OTHERS THEN
    v_call_failed   := true;
    v_error_message := SQLERRM;
  END;

  RESET ROLE;

  IF v_call_failed THEN
    RAISE NOTICE '';
    RAISE NOTICE 'COUNTEREXAMPLE FOUND:';
    RAISE NOTICE '  Direct call SELECT get_my_role() as authenticated raised:';
    RAISE NOTICE '  Error: %', v_error_message;
    RAISE NOTICE '';
    IF v_error_message ILIKE '%permission denied for function get_my_role%' THEN
      RAISE NOTICE 'RESULT: BUG CONDITION CONFIRMED — direct call to get_my_role() is denied.';
      RAISE NOTICE '  This confirms that authenticated role has no EXECUTE on get_my_role().';
      RAISE NOTICE '  Any RLS policy USING clause that calls get_my_role() will raise this error.';
    ELSE
      RAISE NOTICE 'RESULT: Call failed with unexpected error: %', v_error_message;
    END IF;
  ELSE
    RAISE NOTICE 'get_my_role() returned: %', v_result;
    RAISE NOTICE 'RESULT: Direct call succeeded — EXECUTE may have been re-granted.';
  END IF;
END $$;

-- =============================================================================
-- ASSERTION BLOCK: Confirm Bug Exists (Test FAILS if bug is NOT present)
-- =============================================================================
-- This block encodes the expected behavior. It RAISES EXCEPTION if the bug
-- conditions are NOT met — meaning the test PASSES only when the bug is confirmed.
--
-- On UNFIXED database: all conditions are true → no exception → test passes
--   (confirming the bug exists)
-- After FIX: conditions are false → exception raised → test fails
--   (confirming the fix worked — re-run task 3.2 to verify)

DO $$
DECLARE
  v_stale_policy_count  integer;
  v_has_execute         boolean;
  v_function_exists     boolean;
  v_bug_confirmed       boolean := true;
  v_reasons             text[]  := ARRAY[]::text[];
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '--- ASSERTION BLOCK: Confirm Bug Conditions Are Present ---';
  RAISE NOTICE '(This block RAISES EXCEPTION if the bug is NOT present)';
  RAISE NOTICE '(On unfixed DB: no exception = bug confirmed)';
  RAISE NOTICE '(After fix: exception raised = fix confirmed)';
  RAISE NOTICE '';

  -- Condition 1: Stale policy exists on profiles referencing get_my_role
  SELECT count(*) INTO v_stale_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename  = 'profiles'
    AND (qual ILIKE '%get_my_role%' OR with_check ILIKE '%get_my_role%');

  IF v_stale_policy_count = 0 THEN
    v_bug_confirmed := false;
    v_reasons := array_append(v_reasons,
      'Condition 1 FAILED: No stale policies referencing get_my_role found on profiles. '
      || 'Expected at least 1 stale policy (e.g., profiles_select_policy).');
  ELSE
    RAISE NOTICE 'Condition 1 MET: % stale policy/policies referencing get_my_role found on profiles.', v_stale_policy_count;
  END IF;

  -- Condition 2: get_my_role() function exists in database
  SELECT EXISTS(
    SELECT 1 FROM pg_proc
    WHERE proname = 'get_my_role'
      AND pronamespace = 'public'::regnamespace
  ) INTO v_function_exists;

  IF NOT v_function_exists THEN
    v_bug_confirmed := false;
    v_reasons := array_append(v_reasons,
      'Condition 2 FAILED: get_my_role() function does not exist. '
      || 'Expected function to exist (legacy function not yet dropped).');
  ELSE
    RAISE NOTICE 'Condition 2 MET: get_my_role() function exists in database.';
  END IF;

  -- Condition 3: authenticated lacks EXECUTE on get_my_role()
  IF v_function_exists THEN
    SELECT has_function_privilege('authenticated', 'get_my_role()', 'execute')
    INTO v_has_execute;

    IF v_has_execute THEN
      v_bug_confirmed := false;
      v_reasons := array_append(v_reasons,
        'Condition 3 FAILED: authenticated role HAS EXECUTE on get_my_role(). '
        || 'Expected EXECUTE to be revoked (migration 20260514000000 should have revoked it).');
    ELSE
      RAISE NOTICE 'Condition 3 MET: authenticated role lacks EXECUTE on get_my_role().';
    END IF;
  END IF;

  -- Final assertion
  IF v_bug_confirmed THEN
    RAISE NOTICE '';
    RAISE NOTICE '=============================================================================';
    RAISE NOTICE 'ALL BUG CONDITIONS CONFIRMED — Bug exists on this database.';
    RAISE NOTICE '';
    RAISE NOTICE 'COUNTEREXAMPLE SUMMARY:';
    RAISE NOTICE '  SELECT on profiles fails with "permission denied for function get_my_role"';
    RAISE NOTICE '  because stale policy evaluates get_my_role() which lacks EXECUTE grant.';
    RAISE NOTICE '';
    RAISE NOTICE '  Stale policy: profiles_select_policy';
    RAISE NOTICE '  USING clause: (id = auth.uid()) OR (get_my_role() = ANY (ARRAY[...]))';
    RAISE NOTICE '  get_my_role() EXECUTE for authenticated: false';
    RAISE NOTICE '  PostgreSQL OR logic: error in any policy = entire query fails';
    RAISE NOTICE '';
    RAISE NOTICE '  Impact: ALL authenticated users redirected to /waiting-approval';
    RAISE NOTICE '  because middleware gets profile: null from failed query.';
    RAISE NOTICE '';
    RAISE NOTICE 'TASK STATUS: Bug condition exploration test PASSED (bug confirmed).';
    RAISE NOTICE '  Proceed to Task 2 (preservation tests) and Task 3 (fix migration).';
    RAISE NOTICE '=============================================================================';
  ELSE
    -- Bug is NOT present — raise exception to signal test failure
    RAISE EXCEPTION
      'BUG NOT CONFIRMED — One or more bug conditions are absent. '
      'This means the bug may have already been fixed, or the test is running '
      'on a database where the bug conditions do not apply. '
      'Reasons: %',
      array_to_string(v_reasons, ' | ');
  END IF;
END $$;
