-- Migration: Create telefun_replay_annotations table
-- Description: Stores AI-generated and manual annotations for Telefun session replays.
-- Supports the Replay Annotator feature (P2) with RLS scoped to annotation owner.

-- Create telefun_replay_annotations table
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

-- Enable Row Level Security
ALTER TABLE telefun_replay_annotations ENABLE ROW LEVEL SECURITY;

-- RLS Policies: SELECT/INSERT/DELETE scoped to auth.uid() = user_id

CREATE POLICY "Users can view their own replay annotations"
  ON telefun_replay_annotations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own replay annotations"
  ON telefun_replay_annotations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own replay annotations"
  ON telefun_replay_annotations
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Explicit least-privilege grants: only SELECT, INSERT, DELETE for authenticated
REVOKE ALL ON telefun_replay_annotations FROM anon, public;
GRANT SELECT, INSERT, DELETE ON telefun_replay_annotations TO authenticated;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_telefun_replay_annotations_session_id
  ON telefun_replay_annotations(session_id);
CREATE INDEX IF NOT EXISTS idx_telefun_replay_annotations_user_id
  ON telefun_replay_annotations(user_id);

-- Table comment
COMMENT ON TABLE telefun_replay_annotations IS 'AI-generated and manual annotations for Telefun session replay. Each annotation marks a specific moment in the recording with category, description, and timestamp.';
