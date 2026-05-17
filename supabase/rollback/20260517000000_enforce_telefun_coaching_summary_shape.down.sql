-- Rollback: revert upsert_telefun_coaching_summary to version from 20260516000001_telefun_replay_rls_repair.sql
-- Removes strict object shape validation, keeping only array length (<= 5).

CREATE OR REPLACE FUNCTION public.upsert_telefun_coaching_summary(
  p_session_id UUID,
  p_recommendations JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_session_owner UUID;
  v_summary_id UUID;
BEGIN
  IF auth.role() = 'anon' THEN
    RAISE EXCEPTION 'Access denied: Anonymous users cannot upsert coaching summaries.';
  END IF;

  -- Resolve caller: for service_role, use session owner; otherwise use auth.uid()
  IF auth.role() = 'service_role' THEN
    SELECT user_id INTO v_user_id FROM telefun_history WHERE id = p_session_id;
  ELSE
    v_user_id := auth.uid();
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Cannot resolve user_id for this session.';
  END IF;

  SELECT user_id INTO v_session_owner
  FROM telefun_history
  WHERE id = p_session_id;

  IF v_session_owner IS NULL THEN
    RAISE EXCEPTION 'Session not found: %', p_session_id;
  END IF;

  IF auth.role() <> 'service_role' THEN
    IF v_session_owner <> v_user_id THEN
      RAISE EXCEPTION 'Access denied: You do not own this session.';
    END IF;
  END IF;

  IF p_recommendations IS NULL OR jsonb_typeof(p_recommendations) <> 'array' THEN
    RAISE EXCEPTION 'Invalid input: recommendations must be a non-null JSON array.';
  END IF;

  IF jsonb_array_length(p_recommendations) > 5 THEN
    RAISE EXCEPTION 'Invalid input: recommendations must contain at most 5 items.';
  END IF;

  INSERT INTO telefun_coaching_summary (session_id, user_id, recommendations, generated_at)
  VALUES (p_session_id, v_user_id, p_recommendations, now())
  ON CONFLICT (session_id)
  DO UPDATE SET
    recommendations = EXCLUDED.recommendations,
    generated_at = EXCLUDED.generated_at
  RETURNING id INTO v_summary_id;

  RETURN v_summary_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_telefun_coaching_summary(UUID, JSONB) TO authenticated, service_role;
