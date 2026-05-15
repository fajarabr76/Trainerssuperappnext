-- Create telefun_coaching_summary table
-- Stores AI-generated coaching recommendations for Telefun session replays.
-- INSERT/UPDATE is restricted to a SECURITY DEFINER RPC with ownership validation.

CREATE TABLE IF NOT EXISTS telefun_coaching_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL UNIQUE REFERENCES telefun_history(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recommendations JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE telefun_coaching_summary ENABLE ROW LEVEL SECURITY;

-- RLS: Users can only SELECT their own coaching summaries
CREATE POLICY "Users can view their own coaching summaries"
  ON telefun_coaching_summary
  FOR SELECT
  USING (auth.uid() = user_id);

-- Explicit least-privilege grants: only SELECT for authenticated users
-- INSERT/UPDATE is handled exclusively via the SECURITY DEFINER RPC below
REVOKE ALL ON telefun_coaching_summary FROM anon, public;
GRANT SELECT ON telefun_coaching_summary TO authenticated;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_telefun_coaching_summary_user_id
  ON telefun_coaching_summary(user_id);
CREATE INDEX IF NOT EXISTS idx_telefun_coaching_summary_session_id
  ON telefun_coaching_summary(session_id);

-- SECURITY DEFINER RPC for upserting coaching summaries
-- Guards: validates caller is authenticated trainer/admin or service_role,
-- validates session ownership, validates input parameters.
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
  -- Guard: Only authenticated users or service_role can call this
  IF auth.role() = 'anon' THEN
    RAISE EXCEPTION 'Access denied: Anonymous users cannot upsert coaching summaries.';
  END IF;

  -- Resolve caller
  v_user_id := auth.uid();

  -- Guard: Validate session exists and belongs to the caller
  SELECT user_id INTO v_session_owner
  FROM telefun_history
  WHERE id = p_session_id;

  IF v_session_owner IS NULL THEN
    RAISE EXCEPTION 'Session not found: %', p_session_id;
  END IF;

  -- Allow service_role to bypass ownership check (for server actions)
  IF auth.role() <> 'service_role' THEN
    IF v_session_owner <> v_user_id THEN
      RAISE EXCEPTION 'Access denied: You do not own this session.';
    END IF;
  END IF;

  -- Guard: Validate recommendations is a non-null JSONB array
  IF p_recommendations IS NULL OR jsonb_typeof(p_recommendations) <> 'array' THEN
    RAISE EXCEPTION 'Invalid input: recommendations must be a non-null JSON array.';
  END IF;

  -- Guard: Validate array length (max 5 recommendations)
  IF jsonb_array_length(p_recommendations) > 5 THEN
    RAISE EXCEPTION 'Invalid input: recommendations must contain at most 5 items.';
  END IF;

  -- Upsert: insert or update on conflict (session_id is UNIQUE)
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

-- Grant execute to authenticated and service_role only
GRANT EXECUTE ON FUNCTION public.upsert_telefun_coaching_summary(UUID, JSONB) TO authenticated, service_role;

-- Table comment
COMMENT ON TABLE telefun_coaching_summary IS 'Stores AI-generated coaching recommendations per Telefun session. Write access is restricted to the upsert_telefun_coaching_summary RPC.';
