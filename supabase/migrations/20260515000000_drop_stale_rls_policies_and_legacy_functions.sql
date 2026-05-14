-- =============================================================================
-- Migration: Drop stale RLS policies referencing get_my_role() and legacy functions
-- =============================================================================
--
-- BUG: After migration 20260514000000 revoked EXECUTE on ALL public functions
-- from `authenticated`, legacy function `get_my_role()` lost its EXECUTE
-- permission. However, stale RLS policies on `profiles` still reference this
-- function in their USING clause.
--
-- PostgreSQL evaluates ALL RLS policies with OR logic. When the stale policy
-- referencing `get_my_role()` is evaluated, it raises "permission denied for
-- function get_my_role" — a runtime error that propagates to the caller and
-- causes the ENTIRE query to fail.
--
-- Fix 20260514230000 only re-granted EXECUTE on `get_auth_role()` and created
-- new policies based on `get_auth_role()`. It did NOT drop stale policies
-- referencing `get_my_role()`.
--
-- This migration:
--   1. Drops ALL stale RLS policies on `profiles` referencing `get_my_role()`
--   2. Safety sweep: drops stale policies on ANY table referencing `get_my_role()`
--   3. Drops legacy function `get_my_role()` (unused in codebase)
--   4. Drops legacy function `get_my_status()` (unused in codebase)
--   5. Verifies valid policies from fix 20260514230000 are still present
--   6. Verifies `get_auth_role()` still has EXECUTE permission for authenticated
-- =============================================================================

-- 1. Drop any policy on profiles that references get_my_role
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND (qual ILIKE '%get_my_role%' OR with_check ILIKE '%get_my_role%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
    RAISE NOTICE 'Dropped stale policy on profiles: %', pol.policyname;
  END LOOP;
END $$;

-- 2. Safety sweep: drop any stale policy on ANY table referencing get_my_role
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE (qual ILIKE '%get_my_role%' OR with_check ILIKE '%get_my_role%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    RAISE NOTICE 'Dropped stale policy % on %.%', pol.policyname, pol.schemaname, pol.tablename;
  END LOOP;
END $$;

-- 3. Drop legacy function get_my_role()
DROP FUNCTION IF EXISTS public.get_my_role();

-- 4. Drop legacy function get_my_status()
DROP FUNCTION IF EXISTS public.get_my_status();

-- 5. Verify valid policies still exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
    AND policyname = 'Users can view own profile'
  ) THEN
    RAISE EXCEPTION 'CRITICAL: Valid policy "Users can view own profile" is missing!';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
    AND policyname = 'Admins can view all profiles'
  ) THEN
    RAISE EXCEPTION 'CRITICAL: Valid policy "Admins can view all profiles" is missing!';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
    AND policyname = 'Trainers can view all profiles'
  ) THEN
    RAISE EXCEPTION 'CRITICAL: Valid policy "Trainers can view all profiles" is missing!';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
    AND policyname = 'Leaders can view all profiles'
  ) THEN
    RAISE EXCEPTION 'CRITICAL: Valid policy "Leaders can view all profiles" is missing!';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
    AND policyname = 'Users can insert own pending profile'
  ) THEN
    RAISE EXCEPTION 'CRITICAL: Valid policy "Users can insert own pending profile" is missing!';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
    AND policyname = 'Users can update own display name'
  ) THEN
    RAISE EXCEPTION 'CRITICAL: Valid policy "Users can update own display name" is missing!';
  END IF;

  RAISE NOTICE 'All 6 valid policies confirmed present on profiles.';
END $$;

-- 6. Verify get_auth_role() still has EXECUTE permission for authenticated
DO $$
BEGIN
  IF NOT has_function_privilege('authenticated', 'get_auth_role()', 'execute') THEN
    RAISE EXCEPTION 'CRITICAL: get_auth_role() lacks EXECUTE permission for authenticated!';
  END IF;

  RAISE NOTICE 'get_auth_role() EXECUTE permission for authenticated: confirmed.';
END $$;
