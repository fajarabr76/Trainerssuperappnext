-- Add durable completion metadata for Telefun replay AI annotations.
-- Existing rows remain NULL so legacy or repaired partial sets must regenerate
-- before they are treated as a complete AI cache.

ALTER TABLE telefun_coaching_summary
  ADD COLUMN IF NOT EXISTS ai_annotation_count INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ai_annotation_checksum TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ai_annotation_completed_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE telefun_coaching_summary
  DROP CONSTRAINT IF EXISTS telefun_coaching_summary_ai_annotation_count_check,
  DROP CONSTRAINT IF EXISTS telefun_coaching_summary_ai_annotation_checksum_check;

ALTER TABLE telefun_coaching_summary
  ADD CONSTRAINT telefun_coaching_summary_ai_annotation_count_check
    CHECK (ai_annotation_count IS NULL OR ai_annotation_count >= 0),
  ADD CONSTRAINT telefun_coaching_summary_ai_annotation_checksum_check
    CHECK (ai_annotation_checksum IS NULL OR ai_annotation_checksum ~ '^[a-f0-9]{64}$');

DROP FUNCTION IF EXISTS public.upsert_telefun_coaching_summary(UUID, JSONB);

CREATE OR REPLACE FUNCTION public.upsert_telefun_coaching_summary(
  p_session_id UUID,
  p_recommendations JSONB,
  p_ai_annotation_count INTEGER DEFAULT NULL,
  p_ai_annotation_checksum TEXT DEFAULT NULL
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

  FOR v_rec IN SELECT value FROM jsonb_array_elements(p_recommendations) LOOP
    IF jsonb_typeof(v_rec) <> 'object' THEN
      RAISE EXCEPTION 'Invalid recommendation: each item must be a JSON object.';
    END IF;

    IF (SELECT count(*) FROM jsonb_object_keys(v_rec) k WHERE k NOT IN ('text', 'priority')) > 0 THEN
      RAISE EXCEPTION 'Invalid recommendation: object keys must only be "text" and "priority".';
    END IF;

    IF NOT (v_rec ? 'text') OR jsonb_typeof(v_rec->'text') <> 'string' THEN
      RAISE EXCEPTION 'Invalid recommendation: "text" field is required and must be a string.';
    END IF;

    IF btrim(v_rec->>'text') = '' THEN
      RAISE EXCEPTION 'Invalid recommendation: "text" field cannot be empty or whitespace only.';
    END IF;

    IF length(v_rec->>'text') > 200 THEN
      RAISE EXCEPTION 'Invalid recommendation: "text" field must not exceed 200 characters.';
    END IF;

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

  IF (p_ai_annotation_count IS NULL) <> (p_ai_annotation_checksum IS NULL) THEN
    RAISE EXCEPTION 'Invalid input: annotation count and checksum must be provided together.';
  END IF;

  IF p_ai_annotation_count IS NOT NULL AND p_ai_annotation_count < 0 THEN
    RAISE EXCEPTION 'Invalid input: annotation count must not be negative.';
  END IF;

  IF p_ai_annotation_checksum IS NOT NULL AND p_ai_annotation_checksum !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid input: annotation checksum must be a lowercase SHA-256 hex digest.';
  END IF;

  INSERT INTO telefun_coaching_summary (
    session_id,
    user_id,
    recommendations,
    generated_at,
    ai_annotation_count,
    ai_annotation_checksum,
    ai_annotation_completed_at
  )
  VALUES (
    p_session_id,
    v_user_id,
    p_recommendations,
    now(),
    p_ai_annotation_count,
    p_ai_annotation_checksum,
    CASE WHEN p_ai_annotation_count IS NULL THEN NULL ELSE now() END
  )
  ON CONFLICT (session_id)
  DO UPDATE SET
    recommendations = EXCLUDED.recommendations,
    generated_at = EXCLUDED.generated_at,
    ai_annotation_count = EXCLUDED.ai_annotation_count,
    ai_annotation_checksum = EXCLUDED.ai_annotation_checksum,
    ai_annotation_completed_at = EXCLUDED.ai_annotation_completed_at
  RETURNING id INTO v_summary_id;

  RETURN v_summary_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_telefun_coaching_summary(UUID, JSONB, INTEGER, TEXT) TO authenticated, service_role;

COMMENT ON COLUMN telefun_coaching_summary.ai_annotation_count IS 'Number of non-manual Telefun replay annotations persisted for the completed AI generation batch.';
COMMENT ON COLUMN telefun_coaching_summary.ai_annotation_checksum IS 'SHA-256 checksum of sorted non-manual Telefun replay annotation content for cache completeness checks.';
COMMENT ON COLUMN telefun_coaching_summary.ai_annotation_completed_at IS 'Timestamp when the AI replay annotation set was durably paired with this coaching summary.';
