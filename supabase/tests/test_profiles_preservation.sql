-- =============================================================================
-- Preservation Property Tests: INSERT/UPDATE Behavior on profiles Table
-- =============================================================================
--
-- SPEC: admin-login-fix-after-migration
-- PROPERTY: Property 2 - Preservation - INSERT/UPDATE Policies and Trigger Unchanged
-- VALIDATES: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
--
-- PURPOSE:
--   These tests document the CURRENT behavior of INSERT, UPDATE, DELETE, and
--   anon access on the profiles table. This behavior must be PRESERVED after
--   the fix migration (20260514230000) is applied.
--
--   The fix only adds SELECT policies and updates get_auth_role(). It must NOT
--   alter any existing INSERT/UPDATE policies, triggers, or grant restrictions.
--
-- OBSERVATION-FIRST METHODOLOGY:
--   These tests were written by observing behavior on the UNFIXED database
--   (after 20260514000000 but before the fix). They capture the baseline that
--   must remain unchanged.
--
-- EXPECTED OUTCOME:
--   ALL tests PASS on both unfixed and fixed databases.
--   If any test fails after the fix, it indicates a regression.
--
-- HOW TO RUN:
--   Execute this script against the Supabase database. The script simulates
--   authenticated/anon sessions using set_config() and SET ROLE.
--
-- POLICIES IN EFFECT (from migration 20260513000000):
--   - "Users can insert own pending profile" (INSERT, WITH CHECK):
--       auth.uid() = id
--       AND lower(coalesce(status, 'pending')) = 'pending'
--       AND lower(coalesce(role, 'agent')) IN ('agent', 'leader', 'trainer', 'agents', 'trainers')
--       AND lower(coalesce(role, 'agent')) <> 'admin'
--       AND coalesce(is_deleted, false) = false
--   - "Users can update own display name" (UPDATE, USING + WITH CHECK):
--       auth.uid() = id
--   - Trigger: prevent_self_role_status_change (reverts role/status/is_deleted on self-update)
--   - Column grant: GRANT UPDATE (full_name) ON profiles TO authenticated
--   - No DELETE grant or policy for authenticated
--   - No grants for anon on profiles
--
-- =============================================================================

-- =============================================================================
-- SETUP: Create a test user for preservation tests
-- =============================================================================

DO $$
DECLARE
  v_test_user_id uuid := gen_random_uuid();
  v_test_email text;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE 'PRESERVATION PROPERTY TESTS - Setup';
  RAISE NOTICE '=============================================================================';

  v_test_email := 'preservation_test_' || v_test_user_id::text || '@test.local';

  -- Insert a test user into auth.users (required for foreign key)
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, role, aud, instance_id)
  VALUES (
    v_test_user_id,
    v_test_email,
    crypt('testpassword123', gen_salt('bf')),
    now(),
    'authenticated',
    'authenticated',
    '00000000-0000-0000-0000-000000000000'
  );

  -- Insert a profile for this user (as service_role/postgres, bypassing RLS)
  INSERT INTO public.profiles (id, email, role, status, full_name, is_deleted)
  VALUES (v_test_user_id, v_test_email, 'agent', 'approved', 'Preservation Test User', false);

  RAISE NOTICE 'Created test user: %', v_test_user_id;
  RAISE NOTICE 'Email: %', v_test_email;

  -- Store the test user ID for subsequent blocks
  PERFORM set_config('test.preservation_user_id', v_test_user_id::text, false);
  PERFORM set_config('test.preservation_user_email', v_test_email, false);
END $$;

-- =============================================================================
-- TEST 1: INSERT own profile with status='pending', role='agent' → SUCCEEDS
-- =============================================================================
-- Validates: Requirement 3.1
-- The "Users can insert own pending profile" policy allows self-registration
-- with pending status and non-admin role.
--
-- EXPECTED: INSERT succeeds (policy WITH CHECK passes)

DO $$
DECLARE
  v_new_user_id uuid := gen_random_uuid();
  v_new_email text;
  v_inserted boolean := false;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== TEST 1: INSERT own profile with status=pending, role=agent → SUCCEEDS ===';

  v_new_email := 'insert_test_' || v_new_user_id::text || '@test.local';

  -- Create auth.users entry first (as postgres)
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, role, aud, instance_id)
  VALUES (
    v_new_user_id,
    v_new_email,
    crypt('testpassword123', gen_salt('bf')),
    now(),
    'authenticated',
    'authenticated',
    '00000000-0000-0000-0000-000000000000'
  );

  -- Simulate authenticated session as the new user
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', v_new_user_id::text,
    'role', 'authenticated',
    'aud', 'authenticated'
  )::text, true);
  PERFORM set_config('role', 'authenticated', true);

  -- Attempt INSERT with valid pending profile
  BEGIN
    INSERT INTO public.profiles (id, email, role, status, full_name, is_deleted)
    VALUES (v_new_user_id, v_new_email, 'agent', 'pending', 'New Agent User', false);
    v_inserted := true;
  EXCEPTION WHEN OTHERS THEN
    v_inserted := false;
    RAISE NOTICE 'INSERT failed with: %', SQLERRM;
  END;

  -- Reset role
  PERFORM set_config('role', 'postgres', true);
  RESET role;

  IF v_inserted THEN
    RAISE NOTICE 'RESULT: PASS - INSERT with status=pending, role=agent succeeded as expected.';
    RAISE NOTICE '  Policy "Users can insert own pending profile" correctly allows self-registration.';
  ELSE
    RAISE NOTICE 'RESULT: FAIL - INSERT should have succeeded but was blocked.';
    RAISE NOTICE '  REGRESSION: The INSERT policy may have been altered.';
  END IF;

  -- Cleanup: remove the test profile and auth user
  DELETE FROM public.profiles WHERE id = v_new_user_id;
  DELETE FROM auth.users WHERE id = v_new_user_id;
END $$;

-- =============================================================================
-- TEST 2: INSERT profile with status='approved' → BLOCKED by policy
-- =============================================================================
-- Validates: Requirement 3.1 (inverse - policy prevents non-pending status)
-- The WITH CHECK clause requires: lower(coalesce(status, 'pending')) = 'pending'
-- Attempting to insert with status='approved' violates this check.
--
-- EXPECTED: INSERT fails (policy WITH CHECK rejects non-pending status)

DO $$
DECLARE
  v_new_user_id uuid := gen_random_uuid();
  v_new_email text;
  v_inserted boolean := false;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== TEST 2: INSERT profile with status=approved → BLOCKED ===';

  v_new_email := 'insert_approved_' || v_new_user_id::text || '@test.local';

  -- Create auth.users entry first (as postgres)
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, role, aud, instance_id)
  VALUES (
    v_new_user_id,
    v_new_email,
    crypt('testpassword123', gen_salt('bf')),
    now(),
    'authenticated',
    'authenticated',
    '00000000-0000-0000-0000-000000000000'
  );

  -- Simulate authenticated session as the new user
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', v_new_user_id::text,
    'role', 'authenticated',
    'aud', 'authenticated'
  )::text, true);
  PERFORM set_config('role', 'authenticated', true);

  -- Attempt INSERT with status='approved' (should be blocked)
  BEGIN
    INSERT INTO public.profiles (id, email, role, status, full_name, is_deleted)
    VALUES (v_new_user_id, v_new_email, 'agent', 'approved', 'Sneaky Approved User', false);
    v_inserted := true;
  EXCEPTION WHEN OTHERS THEN
    v_inserted := false;
    RAISE NOTICE 'INSERT correctly blocked: %', SQLERRM;
  END;

  -- Reset role
  PERFORM set_config('role', 'postgres', true);
  RESET role;

  IF NOT v_inserted THEN
    RAISE NOTICE 'RESULT: PASS - INSERT with status=approved was correctly blocked.';
    RAISE NOTICE '  Policy WITH CHECK prevents self-registration with non-pending status.';
  ELSE
    RAISE NOTICE 'RESULT: FAIL - INSERT with status=approved should have been blocked.';
    RAISE NOTICE '  REGRESSION: The INSERT policy WITH CHECK may have been weakened.';
    -- Cleanup if accidentally inserted
    DELETE FROM public.profiles WHERE id = v_new_user_id;
  END IF;

  -- Cleanup auth user
  DELETE FROM auth.users WHERE id = v_new_user_id;
END $$;

-- =============================================================================
-- TEST 3: INSERT profile with role='admin' → BLOCKED by policy
-- =============================================================================
-- Validates: Requirement 3.1 (inverse - policy prevents admin role)
-- The WITH CHECK clause requires:
--   lower(coalesce(role, 'agent')) IN ('agent', 'leader', 'trainer', 'agents', 'trainers')
--   AND lower(coalesce(role, 'agent')) <> 'admin'
-- Attempting to insert with role='admin' violates this check.
--
-- EXPECTED: INSERT fails (policy WITH CHECK rejects admin role)

DO $$
DECLARE
  v_new_user_id uuid := gen_random_uuid();
  v_new_email text;
  v_inserted boolean := false;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== TEST 3: INSERT profile with role=admin → BLOCKED ===';

  v_new_email := 'insert_admin_' || v_new_user_id::text || '@test.local';

  -- Create auth.users entry first (as postgres)
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, role, aud, instance_id)
  VALUES (
    v_new_user_id,
    v_new_email,
    crypt('testpassword123', gen_salt('bf')),
    now(),
    'authenticated',
    'authenticated',
    '00000000-0000-0000-0000-000000000000'
  );

  -- Simulate authenticated session as the new user
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', v_new_user_id::text,
    'role', 'authenticated',
    'aud', 'authenticated'
  )::text, true);
  PERFORM set_config('role', 'authenticated', true);

  -- Attempt INSERT with role='admin' (should be blocked)
  BEGIN
    INSERT INTO public.profiles (id, email, role, status, full_name, is_deleted)
    VALUES (v_new_user_id, v_new_email, 'admin', 'pending', 'Self-Promoted Admin', false);
    v_inserted := true;
  EXCEPTION WHEN OTHERS THEN
    v_inserted := false;
    RAISE NOTICE 'INSERT correctly blocked: %', SQLERRM;
  END;

  -- Reset role
  PERFORM set_config('role', 'postgres', true);
  RESET role;

  IF NOT v_inserted THEN
    RAISE NOTICE 'RESULT: PASS - INSERT with role=admin was correctly blocked.';
    RAISE NOTICE '  Policy WITH CHECK prevents self-registration as admin.';
  ELSE
    RAISE NOTICE 'RESULT: FAIL - INSERT with role=admin should have been blocked.';
    RAISE NOTICE '  REGRESSION: The INSERT policy may have been weakened to allow admin self-registration.';
    -- Cleanup if accidentally inserted
    DELETE FROM public.profiles WHERE id = v_new_user_id;
  END IF;

  -- Cleanup auth user
  DELETE FROM auth.users WHERE id = v_new_user_id;
END $$;

-- =============================================================================
-- TEST 4: UPDATE own full_name → SUCCEEDS
-- =============================================================================
-- Validates: Requirement 3.2
-- The "Users can update own display name" policy allows updating own profile,
-- and the column-level grant (GRANT UPDATE (full_name)) restricts which columns
-- can be modified.
--
-- EXPECTED: UPDATE full_name succeeds

DO $$
DECLARE
  v_test_user_id uuid;
  v_original_name text;
  v_new_name text := 'Updated Display Name ' || now()::text;
  v_updated_name text;
  v_success boolean := false;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== TEST 4: UPDATE own full_name → SUCCEEDS ===';

  v_test_user_id := current_setting('test.preservation_user_id')::uuid;

  -- Get original name
  SELECT full_name INTO v_original_name
  FROM public.profiles WHERE id = v_test_user_id;

  RAISE NOTICE 'Test user ID: %', v_test_user_id;
  RAISE NOTICE 'Original full_name: %', v_original_name;

  -- Simulate authenticated session as the test user
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', v_test_user_id::text,
    'role', 'authenticated',
    'aud', 'authenticated'
  )::text, true);
  PERFORM set_config('role', 'authenticated', true);

  -- Attempt UPDATE on full_name
  BEGIN
    UPDATE public.profiles SET full_name = v_new_name WHERE id = v_test_user_id;
    v_success := true;
  EXCEPTION WHEN OTHERS THEN
    v_success := false;
    RAISE NOTICE 'UPDATE failed with: %', SQLERRM;
  END;

  -- Reset role to check result
  PERFORM set_config('role', 'postgres', true);
  RESET role;

  -- Verify the update took effect
  SELECT full_name INTO v_updated_name
  FROM public.profiles WHERE id = v_test_user_id;

  IF v_success AND v_updated_name = v_new_name THEN
    RAISE NOTICE 'RESULT: PASS - UPDATE full_name succeeded as expected.';
    RAISE NOTICE '  full_name changed from "%" to "%"', v_original_name, v_updated_name;
    RAISE NOTICE '  Policy "Users can update own display name" + column grant working correctly.';
  ELSIF v_success AND v_updated_name != v_new_name THEN
    RAISE NOTICE 'RESULT: PARTIAL - UPDATE executed but value not changed (trigger may have reverted).';
  ELSE
    RAISE NOTICE 'RESULT: FAIL - UPDATE full_name should have succeeded.';
    RAISE NOTICE '  REGRESSION: UPDATE policy or column grant may have been altered.';
  END IF;

  -- Restore original name
  UPDATE public.profiles SET full_name = v_original_name WHERE id = v_test_user_id;
END $$;

-- =============================================================================
-- TEST 5: UPDATE own role → TRIGGER REVERTS change
-- =============================================================================
-- Validates: Requirement 3.6
-- The prevent_self_role_status_change trigger fires on UPDATE and reverts
-- changes to role, status, and is_deleted when the user is updating their own row.
--
-- NOTE: The column-level grant (GRANT UPDATE (full_name)) means that attempting
-- to UPDATE role directly will fail with a permission error. However, the trigger
-- provides defense-in-depth: even if the grant were broader, the trigger would
-- still revert the change.
--
-- EXPECTED: Either permission denied (column grant blocks it) OR trigger reverts
-- the role change. Either way, role remains unchanged.

DO $$
DECLARE
  v_test_user_id uuid;
  v_original_role text;
  v_role_after_attempt text;
  v_update_blocked boolean := false;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== TEST 5: UPDATE own role → TRIGGER REVERTS / GRANT BLOCKS ===';

  v_test_user_id := current_setting('test.preservation_user_id')::uuid;

  -- Get original role
  SELECT role INTO v_original_role
  FROM public.profiles WHERE id = v_test_user_id;

  RAISE NOTICE 'Test user ID: %', v_test_user_id;
  RAISE NOTICE 'Original role: %', v_original_role;

  -- Simulate authenticated session as the test user
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', v_test_user_id::text,
    'role', 'authenticated',
    'aud', 'authenticated'
  )::text, true);
  PERFORM set_config('role', 'authenticated', true);

  -- Attempt UPDATE on role (should be blocked by column grant or reverted by trigger)
  BEGIN
    UPDATE public.profiles SET role = 'admin' WHERE id = v_test_user_id;
  EXCEPTION WHEN OTHERS THEN
    v_update_blocked := true;
    RAISE NOTICE 'UPDATE role blocked: %', SQLERRM;
  END;

  -- Reset role to check result
  PERFORM set_config('role', 'postgres', true);
  RESET role;

  -- Verify role is unchanged
  SELECT role INTO v_role_after_attempt
  FROM public.profiles WHERE id = v_test_user_id;

  IF v_update_blocked THEN
    RAISE NOTICE 'RESULT: PASS - UPDATE role was blocked by column-level grant.';
    RAISE NOTICE '  GRANT UPDATE (full_name) prevents modifying role column directly.';
    RAISE NOTICE '  Role remains: "%"', v_role_after_attempt;
  ELSIF v_role_after_attempt = v_original_role THEN
    RAISE NOTICE 'RESULT: PASS - Trigger reverted role change (defense-in-depth).';
    RAISE NOTICE '  prevent_self_role_status_change trigger kept role as: "%"', v_role_after_attempt;
  ELSE
    RAISE NOTICE 'RESULT: FAIL - Role was changed from "%" to "%"!', v_original_role, v_role_after_attempt;
    RAISE NOTICE '  REGRESSION: Column grant AND trigger both failed to prevent role escalation.';
    -- Restore original role
    UPDATE public.profiles SET role = v_original_role WHERE id = v_test_user_id;
  END IF;
END $$;

-- =============================================================================
-- TEST 6: SELECT as anon → BLOCKED (0 rows, no grant)
-- =============================================================================
-- Validates: Requirement 3.5
-- The anon role has NO grants on profiles table. Migration 20260514000000
-- explicitly revokes all from anon. Even without RLS policies, the lack of
-- SELECT grant means anon cannot read anything.
--
-- EXPECTED: SELECT returns 0 rows or raises permission error

DO $$
DECLARE
  v_row_count integer;
  v_access_blocked boolean := false;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== TEST 6: SELECT as anon → BLOCKED ===';

  -- Simulate anon session
  PERFORM set_config('request.jwt.claims', '{}'::text, true);
  PERFORM set_config('role', 'anon', true);

  -- Attempt SELECT as anon
  BEGIN
    EXECUTE 'SELECT count(*) FROM public.profiles' INTO v_row_count;
  EXCEPTION WHEN insufficient_privilege THEN
    v_access_blocked := true;
    RAISE NOTICE 'SELECT correctly blocked with insufficient_privilege.';
  WHEN OTHERS THEN
    v_access_blocked := true;
    RAISE NOTICE 'SELECT blocked with: %', SQLERRM;
  END;

  -- Reset role
  PERFORM set_config('role', 'postgres', true);
  RESET role;

  IF v_access_blocked THEN
    RAISE NOTICE 'RESULT: PASS - Anon SELECT was blocked (no grant).';
    RAISE NOTICE '  No SELECT grant exists for anon role on profiles table.';
  ELSIF v_row_count = 0 THEN
    RAISE NOTICE 'RESULT: PASS - Anon SELECT returned 0 rows (RLS blocked).';
    RAISE NOTICE '  Even if grant existed, no RLS policy allows anon access.';
  ELSE
    RAISE NOTICE 'RESULT: FAIL - Anon was able to read % rows from profiles!', v_row_count;
    RAISE NOTICE '  REGRESSION: Anon should have zero access to profiles table.';
  END IF;
END $$;

-- =============================================================================
-- TEST 7: DELETE as authenticated → BLOCKED (no DELETE grant)
-- =============================================================================
-- Validates: Requirement 3.6 (no DELETE capability)
-- Migration 20260514000000 grants only SELECT and INSERT on profiles to
-- authenticated. There is no DELETE grant and no DELETE policy.
--
-- EXPECTED: DELETE fails with permission error

DO $$
DECLARE
  v_test_user_id uuid;
  v_delete_blocked boolean := false;
  v_profile_exists boolean;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== TEST 7: DELETE as authenticated → BLOCKED ===';

  v_test_user_id := current_setting('test.preservation_user_id')::uuid;

  RAISE NOTICE 'Test user ID: %', v_test_user_id;

  -- Simulate authenticated session
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', v_test_user_id::text,
    'role', 'authenticated',
    'aud', 'authenticated'
  )::text, true);
  PERFORM set_config('role', 'authenticated', true);

  -- Attempt DELETE on own profile (should be blocked)
  BEGIN
    DELETE FROM public.profiles WHERE id = v_test_user_id;
  EXCEPTION WHEN insufficient_privilege THEN
    v_delete_blocked := true;
    RAISE NOTICE 'DELETE correctly blocked with insufficient_privilege.';
  WHEN OTHERS THEN
    v_delete_blocked := true;
    RAISE NOTICE 'DELETE blocked with: %', SQLERRM;
  END;

  -- Reset role
  PERFORM set_config('role', 'postgres', true);
  RESET role;

  -- Verify profile still exists
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = v_test_user_id) INTO v_profile_exists;

  IF v_delete_blocked AND v_profile_exists THEN
    RAISE NOTICE 'RESULT: PASS - DELETE was blocked and profile still exists.';
    RAISE NOTICE '  No DELETE grant exists for authenticated role on profiles table.';
  ELSIF NOT v_profile_exists THEN
    RAISE NOTICE 'RESULT: FAIL - Profile was deleted! DELETE should have been blocked.';
    RAISE NOTICE '  REGRESSION: A DELETE grant or policy may have been added.';
  ELSE
    RAISE NOTICE 'RESULT: PASS - DELETE had no effect (no rows matched or RLS blocked).';
  END IF;
END $$;

-- =============================================================================
-- CLEANUP: Remove test user
-- =============================================================================

DO $$
DECLARE
  v_test_user_id uuid;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== CLEANUP ===';

  v_test_user_id := current_setting('test.preservation_user_id')::uuid;

  -- Remove test profile and auth user
  DELETE FROM public.profiles WHERE id = v_test_user_id;
  DELETE FROM auth.users WHERE id = v_test_user_id;

  RAISE NOTICE 'Removed test user: %', v_test_user_id;
END $$;

-- =============================================================================
-- SUMMARY
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE 'PRESERVATION PROPERTY TEST SUMMARY';
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Property 2: Preservation - INSERT/UPDATE Policies and Trigger Unchanged';
  RAISE NOTICE 'Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6';
  RAISE NOTICE '';
  RAISE NOTICE 'Tests verify that the following behaviors are PRESERVED:';
  RAISE NOTICE '';
  RAISE NOTICE '  TEST 1: INSERT own profile (pending/agent) → SUCCEEDS';
  RAISE NOTICE '    Policy: "Users can insert own pending profile"';
  RAISE NOTICE '    Requirement 3.1';
  RAISE NOTICE '';
  RAISE NOTICE '  TEST 2: INSERT with status=approved → BLOCKED';
  RAISE NOTICE '    Policy WITH CHECK: lower(coalesce(status,pending)) = pending';
  RAISE NOTICE '    Requirement 3.1 (inverse)';
  RAISE NOTICE '';
  RAISE NOTICE '  TEST 3: INSERT with role=admin → BLOCKED';
  RAISE NOTICE '    Policy WITH CHECK: role <> admin';
  RAISE NOTICE '    Requirement 3.1 (inverse)';
  RAISE NOTICE '';
  RAISE NOTICE '  TEST 4: UPDATE own full_name → SUCCEEDS';
  RAISE NOTICE '    Policy: "Users can update own display name"';
  RAISE NOTICE '    Grant: UPDATE (full_name) ON profiles TO authenticated';
  RAISE NOTICE '    Requirement 3.2';
  RAISE NOTICE '';
  RAISE NOTICE '  TEST 5: UPDATE own role → BLOCKED/REVERTED';
  RAISE NOTICE '    Grant: Only full_name column is updatable';
  RAISE NOTICE '    Trigger: prevent_self_role_status_change (defense-in-depth)';
  RAISE NOTICE '    Requirement 3.6';
  RAISE NOTICE '';
  RAISE NOTICE '  TEST 6: SELECT as anon → BLOCKED';
  RAISE NOTICE '    No SELECT grant for anon role';
  RAISE NOTICE '    Requirement 3.5';
  RAISE NOTICE '';
  RAISE NOTICE '  TEST 7: DELETE as authenticated → BLOCKED';
  RAISE NOTICE '    No DELETE grant for authenticated role';
  RAISE NOTICE '    Requirement 3.6';
  RAISE NOTICE '';
  RAISE NOTICE 'These tests should PASS on BOTH unfixed and fixed databases.';
  RAISE NOTICE 'If any test fails after applying the fix migration, it indicates';
  RAISE NOTICE 'a regression in the existing security model.';
  RAISE NOTICE '=============================================================================';
END $$;
