-- =============================================================================
-- Migration: Drop stale legacy helper policies after explicit grants hardening
-- =============================================================================
-- Context:
-- - Explicit grants migration revoked EXECUTE on many legacy helper functions.
-- - Some old RLS policies still referenced is_approved_trainer()/is_super_admin().
-- - PostgreSQL evaluates policies during query checks; stale policy references can
--   raise runtime permission errors and break authenticated reads.
--
-- This migration removes stale legacy policies and adds a guard that fails fast
-- if any policy still references legacy helpers after cleanup.
-- =============================================================================

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        coalesce(qual, '') ILIKE '%is_approved_trainer%'
        OR coalesce(with_check, '') ILIKE '%is_approved_trainer%'
        OR coalesce(qual, '') ILIKE '%is_super_admin%'
        OR coalesce(with_check, '') ILIKE '%is_super_admin%'
        OR coalesce(qual, '') ILIKE '%get_my_role%'
        OR coalesce(with_check, '') ILIKE '%get_my_role%'
        OR coalesce(qual, '') ILIKE '%get_my_status%'
        OR coalesce(with_check, '') ILIKE '%get_my_status%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    RAISE NOTICE 'Dropped stale legacy helper policy %.%: %', pol.schemaname, pol.tablename, pol.policyname;
  END LOOP;
END $$;

-- Guardrail: fail migration if any legacy helper references remain in RLS policies.
DO $$
DECLARE
  v_remaining integer;
BEGIN
  SELECT count(*) INTO v_remaining
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (
      coalesce(qual, '') ILIKE '%is_approved_trainer%'
      OR coalesce(with_check, '') ILIKE '%is_approved_trainer%'
      OR coalesce(qual, '') ILIKE '%is_super_admin%'
      OR coalesce(with_check, '') ILIKE '%is_super_admin%'
      OR coalesce(qual, '') ILIKE '%get_my_role%'
      OR coalesce(with_check, '') ILIKE '%get_my_role%'
      OR coalesce(qual, '') ILIKE '%get_my_status%'
      OR coalesce(with_check, '') ILIKE '%get_my_status%'
    );

  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'CRITICAL: stale legacy-helper policy references still exist (%).', v_remaining;
  END IF;

  RAISE NOTICE 'Legacy helper policy reference guard passed (0 remaining).';
END $$;
