-- =============================================================================
-- Rollback: Drop stale legacy helper policies after explicit grants hardening
-- =============================================================================
-- This rollback intentionally does not recreate dropped stale policies.
-- Reintroducing those policies can restore runtime failures:
-- "permission denied for function is_approved_trainer/is_super_admin".
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE 'No-op rollback for 20260515020000: stale legacy policies are intentionally not recreated.';
END $$;
