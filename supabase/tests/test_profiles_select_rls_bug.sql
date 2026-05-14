-- =============================================================================
-- Bug Condition Exploration Test: RLS SELECT Blocking on profiles Table
-- =============================================================================
--
-- SPEC: admin-login-fix-after-migration
-- PROPERTY: Property 1 - Bug Condition - Profile SELECT Blocked After Migration
-- VALIDATES: Requirements 1.1, 1.2, 1.3
--
-- PURPOSE:
--   This test demonstrates that after migration 20260514000000 runs, authenticated
--   users CANNOT read from the profiles table because:
--     1. RLS is enabled on profiles (by the migration)
--     2. No SELECT policies exist in the migration path (they only exist in
--        supabase/scripts/supabase_rbac_setup.sql which is NOT a migration)
--     3. EXECUTE on get_auth_role() was revoked from authenticated (by the migration)
--     4. Even if policies from the setup script were manually applied, they use
--        case-sensitive comparison (e.g., 'Trainer') against lowercase-stored roles
--
-- BUG CONDITION (from design.md):
--   isBugCondition(input) WHERE:
--     input.operation = 'SELECT'
--     AND input.table = 'profiles'
--     AND rlsEnabled('profiles') = true
--     AND (
--       NOT EXISTS selectPolicyFor(input.userId, 'profiles')
--       OR get_auth_role() uses case-sensitive comparison against lowercase-stored roles
--     )
--
-- EXPECTED OUTCOME ON UNFIXED DATABASE:
--   All SELECT queries return 0 rows despite valid authenticated session.
--   This CONFIRMS the bug exists.
--
-- EXPECTED OUTCOME AFTER FIX (migration 20260514230000):
--   SELECT queries return the expected rows based on user role.
--   This CONFIRMS the fix works.
--
-- HOW TO RUN:
--   Execute this script against the Supabase database AFTER migration
--   20260514000000 has been applied. Use psql or Supabase SQL Editor.
--   The script simulates authenticated user sessions using set_config().
--
-- =============================================================================

-- =============================================================================
-- SETUP: Verify preconditions
-- =============================================================================

-- Verify RLS is enabled on profiles (should be true after 20260514000000)
DO $$
DECLARE
  v_rls_enabled boolean;
BEGIN
  SELECT relrowsecurity INTO v_rls_enabled
  FROM pg_class
  WHERE oid = 'public.profiles'::regclass;

  IF NOT v_rls_enabled THEN
    RAISE EXCEPTION 'PRECONDITION FAILED: RLS is not enabled on profiles table. '
      'Migration 20260514000000 may not have been applied.';
  END IF;

  RAISE NOTICE 'PRECONDITION OK: RLS is enabled on profiles table.';
END $$;

-- Verify that NO SELECT policies exist on profiles for authenticated role
-- (This is the core of the bug - policies only exist in the setup script, not migrations)
DO $$
DECLARE
  v_select_policy_count integer;
BEGIN
  SELECT count(*) INTO v_select_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'profiles'
    AND cmd = 'SELECT'
    AND roles @> ARRAY['authenticated'];

  RAISE NOTICE 'SELECT policies on profiles for authenticated: %', v_select_policy_count;

  IF v_select_policy_count = 0 THEN
    RAISE NOTICE 'BUG CONFIRMED: No SELECT policies exist on profiles for authenticated users.';
    RAISE NOTICE 'This means ALL SELECT queries will return 0 rows due to RLS.';
  ELSE
    RAISE NOTICE 'NOTE: % SELECT policies found. Bug may have been partially fixed or '
      'setup script was manually applied.', v_select_policy_count;
  END IF;
END $$;

-- =============================================================================
-- TEST 1: Self-Profile Read (Any Authenticated User)
-- =============================================================================
-- Simulates: An authenticated user (e.g., admin) tries to read their own profile.
-- Expected on UNFIXED DB: 0 rows returned (BUG - RLS blocks SELECT)
-- Expected on FIXED DB: 1 row returned (user's own profile)
-- Validates: Requirement 1.1, 2.1

DO $$
DECLARE
  v_test_user_id uuid;
  v_row_count integer;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== TEST 1: Self-Profile Read as Authenticated User ===';

  -- Find an existing user in profiles to use as test subject
  SELECT id INTO v_test_user_id FROM public.profiles LIMIT 1;

  IF v_test_user_id IS NULL THEN
    RAISE EXCEPTION 'SETUP ERROR: No users found in profiles table. Cannot run test.';
  END IF;

  RAISE NOTICE 'Test user ID: %', v_test_user_id;

  -- Simulate authenticated session by setting JWT claims
  -- This is how Supabase PostgREST passes auth context to RLS policies
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', v_test_user_id::text,
    'role', 'authenticated',
    'aud', 'authenticated'
  )::text, true);

  -- Set the role to authenticated (simulates Data API request)
  PERFORM set_config('role', 'authenticated', true);

  -- Attempt to SELECT own profile
  -- On unfixed DB: RLS will block this, returning 0 rows
  EXECUTE format(
    'SELECT count(*) FROM public.profiles WHERE id = %L',
    v_test_user_id
  ) INTO v_row_count;

  RAISE NOTICE 'Rows returned for own profile SELECT: %', v_row_count;

  IF v_row_count = 0 THEN
    RAISE NOTICE 'RESULT: FAIL (BUG CONFIRMED) - Authenticated user cannot read own profile.';
    RAISE NOTICE 'COUNTEREXAMPLE: SELECT from profiles WHERE id = auth.uid() returns 0 rows';
    RAISE NOTICE '  due to missing RLS SELECT policies after migration 20260514000000.';
    RAISE NOTICE '  This causes middleware to treat user as Ghost Profile and redirect to /waiting-approval.';
  ELSIF v_row_count = 1 THEN
    RAISE NOTICE 'RESULT: PASS - User can read own profile (fix is applied or policies exist).';
  ELSE
    RAISE NOTICE 'RESULT: UNEXPECTED - Got % rows (expected 0 or 1).', v_row_count;
  END IF;

  -- Reset role
  PERFORM set_config('role', 'postgres', true);
  RESET role;
END $$;

-- =============================================================================
-- TEST 2: Admin All-Profiles Read
-- =============================================================================
-- Simulates: An admin user tries to read all profiles.
-- Expected on UNFIXED DB: 0 rows returned (BUG - no admin SELECT policy)
-- Expected on FIXED DB: all profile rows returned
-- Validates: Requirement 1.3, 2.2

DO $$
DECLARE
  v_admin_user_id uuid;
  v_total_profiles integer;
  v_row_count integer;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== TEST 2: Admin All-Profiles Read ===';

  -- Find an admin user
  SELECT id INTO v_admin_user_id
  FROM public.profiles
  WHERE lower(role) = 'admin'
  LIMIT 1;

  IF v_admin_user_id IS NULL THEN
    RAISE NOTICE 'SKIP: No admin user found in profiles. Cannot test admin SELECT.';
    RETURN;
  END IF;

  -- Count total profiles for comparison
  SELECT count(*) INTO v_total_profiles FROM public.profiles;
  RAISE NOTICE 'Admin user ID: %', v_admin_user_id;
  RAISE NOTICE 'Total profiles in table: %', v_total_profiles;

  -- Simulate admin authenticated session
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', v_admin_user_id::text,
    'role', 'authenticated',
    'aud', 'authenticated'
  )::text, true);

  PERFORM set_config('role', 'authenticated', true);

  -- Attempt to SELECT all profiles as admin
  EXECUTE 'SELECT count(*) FROM public.profiles' INTO v_row_count;

  RAISE NOTICE 'Rows returned for admin SELECT all profiles: %', v_row_count;

  IF v_row_count = 0 THEN
    RAISE NOTICE 'RESULT: FAIL (BUG CONFIRMED) - Admin cannot read any profiles.';
    RAISE NOTICE 'COUNTEREXAMPLE: Admin SELECT from profiles returns 0 rows.';
    RAISE NOTICE '  No "Admins can view all profiles" SELECT policy exists in migration path.';
  ELSIF v_row_count = v_total_profiles THEN
    RAISE NOTICE 'RESULT: PASS - Admin can read all % profiles.', v_total_profiles;
  ELSE
    RAISE NOTICE 'RESULT: PARTIAL - Admin can read %/% profiles (may only see own).', v_row_count, v_total_profiles;
  END IF;

  -- Reset role
  PERFORM set_config('role', 'postgres', true);
  RESET role;
END $$;

-- =============================================================================
-- TEST 3: Trainer All-Profiles Read (Case-Sensitivity Bug)
-- =============================================================================
-- Simulates: A trainer user tries to read all profiles.
-- Expected on UNFIXED DB: 0 rows returned (BUG - even if policy exists,
--   get_auth_role() = 'Trainer' won't match lowercase 'trainer')
-- Expected on FIXED DB: all profile rows returned
-- Validates: Requirement 1.2, 2.3

DO $$
DECLARE
  v_trainer_user_id uuid;
  v_stored_role text;
  v_total_profiles integer;
  v_row_count integer;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== TEST 3: Trainer All-Profiles Read (Case-Sensitivity Bug) ===';

  -- Find a trainer user
  SELECT id, role INTO v_trainer_user_id, v_stored_role
  FROM public.profiles
  WHERE lower(role) IN ('trainer', 'trainers')
  LIMIT 1;

  IF v_trainer_user_id IS NULL THEN
    RAISE NOTICE 'SKIP: No trainer user found in profiles. Cannot test trainer SELECT.';
    RETURN;
  END IF;

  SELECT count(*) INTO v_total_profiles FROM public.profiles;
  RAISE NOTICE 'Trainer user ID: %', v_trainer_user_id;
  RAISE NOTICE 'Stored role value: "%"', v_stored_role;
  RAISE NOTICE 'Total profiles in table: %', v_total_profiles;

  -- Demonstrate the case-sensitivity issue:
  -- The setup script policy uses: get_auth_role() = 'Trainer' (capital T)
  -- But after migration 20260417110001, roles are stored as lowercase: 'trainer'
  -- So get_auth_role() returns 'trainer' which != 'Trainer'
  RAISE NOTICE '';
  RAISE NOTICE 'Case-sensitivity analysis:';
  RAISE NOTICE '  Policy condition: get_auth_role() = ''Trainer'' (capital T)';
  RAISE NOTICE '  Actual stored role: ''%'' (lowercase after migration 20260417110001)', v_stored_role;
  RAISE NOTICE '  Match result: % (will be false if case differs)',
    (v_stored_role = 'Trainer');

  -- Simulate trainer authenticated session
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', v_trainer_user_id::text,
    'role', 'authenticated',
    'aud', 'authenticated'
  )::text, true);

  PERFORM set_config('role', 'authenticated', true);

  -- Attempt to SELECT all profiles as trainer
  EXECUTE 'SELECT count(*) FROM public.profiles' INTO v_row_count;

  RAISE NOTICE 'Rows returned for trainer SELECT all profiles: %', v_row_count;

  IF v_row_count = 0 THEN
    RAISE NOTICE 'RESULT: FAIL (BUG CONFIRMED) - Trainer cannot read any profiles.';
    RAISE NOTICE 'COUNTEREXAMPLE: Trainer SELECT from profiles returns 0 rows.';
    RAISE NOTICE '  Even if "Trainers can view all profiles" policy exists,';
    RAISE NOTICE '  get_auth_role() returns ''%'' which != ''Trainer'' (case mismatch).', v_stored_role;
  ELSIF v_row_count = v_total_profiles THEN
    RAISE NOTICE 'RESULT: PASS - Trainer can read all % profiles.', v_total_profiles;
  ELSE
    RAISE NOTICE 'RESULT: PARTIAL - Trainer can read %/% profiles.', v_row_count, v_total_profiles;
  END IF;

  -- Reset role
  PERFORM set_config('role', 'postgres', true);
  RESET role;
END $$;

-- =============================================================================
-- TEST 4: get_auth_role() Case-Sensitivity Verification
-- =============================================================================
-- Demonstrates that get_auth_role() returns lowercase role but policies compare
-- against capitalized values.
-- Expected on UNFIXED DB: get_auth_role() returns 'trainer' (lowercase),
--   but policy checks against 'Trainer' (capitalized) → never matches
-- Expected on FIXED DB: get_auth_role() returns 'trainer' (lowercase via lower()),
--   and policies also compare against 'trainer' (lowercase) → matches correctly
-- Validates: Requirement 1.2, 2.5

DO $$
DECLARE
  v_test_user_id uuid;
  v_stored_role text;
  v_auth_role_result text;
  v_can_execute boolean;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== TEST 4: get_auth_role() Case-Sensitivity Verification ===';

  -- Find a user with a known role
  SELECT id, role INTO v_test_user_id, v_stored_role
  FROM public.profiles
  WHERE role IS NOT NULL AND role != ''
  LIMIT 1;

  IF v_test_user_id IS NULL THEN
    RAISE NOTICE 'SKIP: No user with role found in profiles.';
    RETURN;
  END IF;

  RAISE NOTICE 'Test user ID: %', v_test_user_id;
  RAISE NOTICE 'Stored role in DB: "%"', v_stored_role;

  -- Simulate authenticated session
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', v_test_user_id::text,
    'role', 'authenticated',
    'aud', 'authenticated'
  )::text, true);

  PERFORM set_config('role', 'authenticated', true);

  -- Check if authenticated can even EXECUTE get_auth_role()
  -- Migration 20260514000000 revokes EXECUTE on ALL public functions from authenticated
  BEGIN
    EXECUTE 'SELECT public.get_auth_role()' INTO v_auth_role_result;
    v_can_execute := true;
  EXCEPTION WHEN insufficient_privilege THEN
    v_can_execute := false;
    v_auth_role_result := NULL;
  END;

  IF NOT v_can_execute THEN
    RAISE NOTICE 'RESULT: FAIL (BUG CONFIRMED) - Cannot execute get_auth_role().';
    RAISE NOTICE 'COUNTEREXAMPLE: EXECUTE privilege on get_auth_role() was revoked by';
    RAISE NOTICE '  migration 20260514000000 and never re-granted.';
    RAISE NOTICE '  This means ALL role-based SELECT policies that use get_auth_role() are broken.';
  ELSE
    RAISE NOTICE 'get_auth_role() returned: "%"', v_auth_role_result;
    RAISE NOTICE '';
    RAISE NOTICE 'Policy comparison analysis:';
    RAISE NOTICE '  get_auth_role() result: ''%''', v_auth_role_result;
    RAISE NOTICE '  Setup script policy checks against: ''Trainer'', ''Leader''';
    RAISE NOTICE '  Match "Trainer": %', (v_auth_role_result = 'Trainer');
    RAISE NOTICE '  Match "Leader": %', (v_auth_role_result = 'Leader');
    RAISE NOTICE '  Match "trainer" (lowercase): %', (v_auth_role_result = 'trainer');
    RAISE NOTICE '  Match "leader" (lowercase): %', (v_auth_role_result = 'leader');

    IF v_auth_role_result = lower(v_auth_role_result) AND v_stored_role = lower(v_stored_role) THEN
      RAISE NOTICE '';
      RAISE NOTICE 'RESULT: Roles are stored lowercase. Policies using capitalized comparisons';
      RAISE NOTICE '  (e.g., = ''Trainer'') will NEVER match. This confirms the case-sensitivity bug.';
    END IF;
  END IF;

  -- Reset role
  PERFORM set_config('role', 'postgres', true);
  RESET role;
END $$;

-- =============================================================================
-- TEST 5: Leader All-Profiles Read (Case-Sensitivity Bug)
-- =============================================================================
-- Simulates: A leader user tries to read all profiles.
-- Expected on UNFIXED DB: 0 rows returned (same case-sensitivity issue as trainer)
-- Expected on FIXED DB: all profile rows returned
-- Validates: Requirement 2.4

DO $$
DECLARE
  v_leader_user_id uuid;
  v_stored_role text;
  v_total_profiles integer;
  v_row_count integer;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== TEST 5: Leader All-Profiles Read ===';

  -- Find a leader user
  SELECT id, role INTO v_leader_user_id, v_stored_role
  FROM public.profiles
  WHERE lower(role) = 'leader'
  LIMIT 1;

  IF v_leader_user_id IS NULL THEN
    RAISE NOTICE 'SKIP: No leader user found in profiles. Cannot test leader SELECT.';
    RETURN;
  END IF;

  SELECT count(*) INTO v_total_profiles FROM public.profiles;
  RAISE NOTICE 'Leader user ID: %', v_leader_user_id;
  RAISE NOTICE 'Stored role value: "%"', v_stored_role;
  RAISE NOTICE 'Total profiles in table: %', v_total_profiles;

  -- Simulate leader authenticated session
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', v_leader_user_id::text,
    'role', 'authenticated',
    'aud', 'authenticated'
  )::text, true);

  PERFORM set_config('role', 'authenticated', true);

  -- Attempt to SELECT all profiles as leader
  EXECUTE 'SELECT count(*) FROM public.profiles' INTO v_row_count;

  RAISE NOTICE 'Rows returned for leader SELECT all profiles: %', v_row_count;

  IF v_row_count = 0 THEN
    RAISE NOTICE 'RESULT: FAIL (BUG CONFIRMED) - Leader cannot read any profiles.';
    RAISE NOTICE 'COUNTEREXAMPLE: Leader SELECT from profiles returns 0 rows.';
    RAISE NOTICE '  get_auth_role() returns ''%'' which != ''Leader'' (case mismatch).', v_stored_role;
  ELSIF v_row_count = v_total_profiles THEN
    RAISE NOTICE 'RESULT: PASS - Leader can read all % profiles.', v_total_profiles;
  ELSE
    RAISE NOTICE 'RESULT: PARTIAL - Leader can read %/% profiles.', v_row_count, v_total_profiles;
  END IF;

  -- Reset role
  PERFORM set_config('role', 'postgres', true);
  RESET role;
END $$;

-- =============================================================================
-- SUMMARY
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE 'BUG CONDITION EXPLORATION TEST SUMMARY';
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Bug: After migration 20260514000000_explicit_public_data_api_grants.sql:';
  RAISE NOTICE '  1. RLS is enabled on profiles table';
  RAISE NOTICE '  2. SELECT grant is given to authenticated role';
  RAISE NOTICE '  3. BUT no SELECT RLS policies are created (they only exist in setup script)';
  RAISE NOTICE '  4. EXECUTE on get_auth_role() is revoked from authenticated';
  RAISE NOTICE '  5. Even if policies were manually applied, case-sensitive comparison fails';
  RAISE NOTICE '';
  RAISE NOTICE 'Impact:';
  RAISE NOTICE '  - ALL authenticated users get 0 rows when querying profiles';
  RAISE NOTICE '  - Middleware treats this as "Ghost Profile"';
  RAISE NOTICE '  - Users are redirected to /waiting-approval regardless of actual status';
  RAISE NOTICE '  - Admin, trainer, leader, and agent roles are ALL affected';
  RAISE NOTICE '';
  RAISE NOTICE 'Expected Counterexample (on unfixed DB):';
  RAISE NOTICE '  SELECT id, email, role, status FROM profiles WHERE id = auth.uid()';
  RAISE NOTICE '  → Returns 0 rows (expected 1 row with user''s own profile)';
  RAISE NOTICE '';
  RAISE NOTICE 'Root Causes:';
  RAISE NOTICE '  1. Missing SELECT policies in migration path';
  RAISE NOTICE '  2. get_auth_role() EXECUTE revoked from authenticated';
  RAISE NOTICE '  3. Case-sensitive role comparison (''Trainer'' vs ''trainer'')';
  RAISE NOTICE '  4. No admin-specific SELECT policy ever existed';
  RAISE NOTICE '';
  RAISE NOTICE 'Fix: Migration 20260514230000_fix_profiles_select_rls_policies.sql';
  RAISE NOTICE '  - Recreates get_auth_role() with lower() normalization';
  RAISE NOTICE '  - Grants EXECUTE on get_auth_role() to authenticated';
  RAISE NOTICE '  - Creates SELECT policies for own-profile, admin, trainer, leader';
  RAISE NOTICE '=============================================================================';
END $$;
