-- =============================================================================
-- Rollback: Drop stale RLS policies and legacy functions
-- =============================================================================
--
-- Rollback strategy:
--   - Recreate legacy functions get_my_role() and get_my_status() WITHOUT
--     granting EXECUTE to authenticated (preventing re-triggering the bug).
--   - Stale policies are NOT recreated because they are the root cause of the bug.
--   - This is a SAFETY rollback — it restores functions but keeps fix intact.
-- =============================================================================

-- Recreate get_my_role() function (no EXECUTE grant — prevents re-triggering bug)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Recreate get_my_status() function (no EXECUTE grant — prevents re-triggering bug)
CREATE OR REPLACE FUNCTION public.get_my_status()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT status FROM public.profiles WHERE id = auth.uid();
$$;
