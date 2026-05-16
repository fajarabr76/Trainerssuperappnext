-- Repair: make Telefun replay support idempotent for databases that received
-- only a partial 20260516000000 apply due to duplicate timestamps.
--
-- Covers: table creation (IF NOT EXISTS), policy drop/recreate with session
-- ownership check, service_role resolution in RPC, and missing columns.

-- ---------------------------------------------------------------------------
-- 1. Coaching summary: idempotent policy + service_role fix
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS telefun_coaching_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL UNIQUE REFERENCES telefun_history(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recommendations JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE telefun_coaching_summary ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON telefun_coaching_summary FROM anon, public;
GRANT SELECT ON telefun_coaching_summary TO authenticated;

CREATE INDEX IF NOT EXISTS idx_telefun_coaching_summary_user_id
  ON telefun_coaching_summary(user_id);
CREATE INDEX IF NOT EXISTS idx_telefun_coaching_summary_session_id
  ON telefun_coaching_summary(session_id);

DROP POLICY IF EXISTS "Users can view their own coaching summaries"
  ON telefun_coaching_summary;

CREATE POLICY "Users can view their own coaching summaries"
  ON telefun_coaching_summary
  FOR SELECT
  USING (auth.uid() = user_id);

-- Replace RPC with service_role-aware version
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

-- ---------------------------------------------------------------------------
-- 2. Replay annotations: ensure table exists, then idempotent policies
-- ---------------------------------------------------------------------------

-- Table must exist before any DROP POLICY (PostgreSQL requires the table ref)
CREATE TABLE IF NOT EXISTS telefun_replay_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES telefun_history(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  timestamp_ms INTEGER NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('strength', 'improvement_area', 'critical_moment', 'technique_used')),
  moment TEXT NOT NULL,
  text TEXT NOT NULL CHECK (char_length(text) <= 500),
  is_manual BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE telefun_replay_annotations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own replay annotations"
  ON telefun_replay_annotations;

CREATE POLICY "Users can view their own replay annotations"
  ON telefun_replay_annotations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own replay annotations"
  ON telefun_replay_annotations;

CREATE POLICY "Users can insert their own replay annotations"
  ON telefun_replay_annotations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND is_manual = true AND
    EXISTS (
      SELECT 1 FROM telefun_history
      WHERE id = session_id AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete their own replay annotations"
  ON telefun_replay_annotations;

CREATE POLICY "Users can delete their own replay annotations"
  ON telefun_replay_annotations
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

REVOKE ALL ON telefun_replay_annotations FROM anon, public;
GRANT SELECT, INSERT, DELETE ON telefun_replay_annotations TO authenticated;

CREATE INDEX IF NOT EXISTS idx_telefun_replay_annotations_session_id
  ON telefun_replay_annotations(session_id);
CREATE INDEX IF NOT EXISTS idx_telefun_replay_annotations_user_id
  ON telefun_replay_annotations(user_id);

-- ---------------------------------------------------------------------------
-- 3. Missing columns on telefun_history
-- ---------------------------------------------------------------------------

ALTER TABLE telefun_history
  ADD COLUMN IF NOT EXISTS session_duration_ms BIGINT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS voice_dashboard_metrics JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS disruption_config JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS disruption_results JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS persona_config JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS realistic_mode_enabled BOOLEAN NOT NULL DEFAULT FALSE;
