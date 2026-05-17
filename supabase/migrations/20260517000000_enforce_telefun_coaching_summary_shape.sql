-- Enforce strict JSON shape validation for telefun_coaching_summary recommendations.
-- Basis: migration 20260516000001_telefun_replay_rls_repair.sql
-- 
-- Requirements:
-- 1. recommendations must be a non-null JSON array.
-- 2. Maximum 5 items.
-- 3. Each item must be an object with exactly { "text", "priority" }.
-- 4. "text" must be a non-empty string (after trim), max 200 chars.
-- 5. "priority" must be an integer between 1 and 5.

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
  v_rec JSONB;
  v_priority NUMERIC;
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

  -- ---------------------------------------------------------------------------
  -- Shape Validation
  -- ---------------------------------------------------------------------------
  IF p_recommendations IS NULL OR jsonb_typeof(p_recommendations) <> 'array' THEN
    RAISE EXCEPTION 'Invalid input: recommendations must be a non-null JSON array.';
  END IF;

  IF jsonb_array_length(p_recommendations) > 5 THEN
    RAISE EXCEPTION 'Invalid input: recommendations must contain at most 5 items.';
  END IF;

  FOR v_rec IN SELECT value FROM jsonb_array_elements(p_recommendations) LOOP
    -- 1. Must be an object
    IF jsonb_typeof(v_rec) <> 'object' THEN
      RAISE EXCEPTION 'Invalid recommendation: each item must be a JSON object.';
    END IF;

    -- 2. Only allow 'text' and 'priority' keys
    IF (SELECT count(*) FROM jsonb_object_keys(v_rec) k WHERE k NOT IN ('text', 'priority')) > 0 THEN
      RAISE EXCEPTION 'Invalid recommendation: object keys must only be "text" and "priority".';
    END IF;

    -- 3. 'text' validation: exists, string, not empty (after trim), <= 200 chars
    IF NOT (v_rec ? 'text') OR jsonb_typeof(v_rec->'text') <> 'string' THEN
      RAISE EXCEPTION 'Invalid recommendation: "text" field is required and must be a string.';
    END IF;

    IF btrim(v_rec->>'text') = '' THEN
      RAISE EXCEPTION 'Invalid recommendation: "text" field cannot be empty or whitespace only.';
    END IF;

    IF length(v_rec->>'text') > 200 THEN
      RAISE EXCEPTION 'Invalid recommendation: "text" field must not exceed 200 characters.';
    END IF;

    -- 4. 'priority' validation: exists, number, integer, 1-5
    IF NOT (v_rec ? 'priority') OR jsonb_typeof(v_rec->'priority') <> 'number' THEN
      RAISE EXCEPTION 'Invalid recommendation: "priority" field is required and must be a number.';
    END IF;

    v_priority := (v_rec->>'priority')::numeric;
    IF v_priority <> floor(v_priority) THEN
      RAISE EXCEPTION 'Invalid recommendation: "priority" must be an integer.';
    END IF;

    IF v_priority < 1 OR v_priority > 5 THEN
      RAISE EXCEPTION 'Invalid recommendation: "priority" must be between 1 and 5.';
    END IF;
  END LOOP;

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
