-- =============================================================================
-- Migration: Fix profiles SELECT RLS policies and get_auth_role() normalization
-- =============================================================================
--
-- Bug: After migration 20260514000000 revoked all grants and re-granted SELECT
-- to authenticated, RLS still blocks reads because no SELECT policies exist in
-- the migration path. The SELECT policies were only defined in
-- supabase/scripts/supabase_rbac_setup.sql (a setup script, not a migration),
-- so they may not exist in production deployments.
--
-- Additionally, get_auth_role() returns the role as-is from the database, but
-- RLS policies previously compared against capitalized values ('Trainer',
-- 'Leader'). After migration 20260417110001, roles are stored as lowercase.
-- This fix applies lower() normalization in get_auth_role() and uses lowercase
-- comparisons in all SELECT policies.
--
-- This migration:
--   1. Recreates get_auth_role() with lower() normalization
--   2. Re-grants EXECUTE on get_auth_role() to authenticated (revoked by 20260514000000)
--   3. Creates "Users can view own profile" SELECT policy
--   4. Creates "Admins can view all profiles" SELECT policy
--   5. Creates "Trainers can view all profiles" SELECT policy
--   6. Creates "Leaders can view all profiles" SELECT policy
-- =============================================================================

-- 1. Recreate get_auth_role() with lower() normalization, SECURITY DEFINER, and search_path isolation
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT lower(coalesce(role, '')) FROM public.profiles WHERE id = auth.uid();
$$;

-- 2. Revoke EXECUTE from PUBLIC and anon explicitly, then grant to authenticated and service_role
REVOKE ALL ON FUNCTION public.get_auth_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_auth_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_role() TO service_role;

-- 3. Create "Users can view own profile" SELECT policy
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- 4. Create "Admins can view all profiles" SELECT policy
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.get_auth_role() = 'admin');

-- 5. Create "Trainers can view all profiles" SELECT policy
DROP POLICY IF EXISTS "Trainers can view all profiles" ON public.profiles;
CREATE POLICY "Trainers can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.get_auth_role() IN ('trainer', 'trainers'));

-- 6. Create "Leaders can view all profiles" SELECT policy
DROP POLICY IF EXISTS "Leaders can view all profiles" ON public.profiles;
CREATE POLICY "Leaders can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.get_auth_role() = 'leader');
