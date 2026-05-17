\set ON_ERROR_STOP on

CREATE TABLE IF NOT EXISTS public.telefun_replay_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.telefun_history(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  timestamp_ms INTEGER NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('strength', 'improvement_area', 'critical_moment', 'technique_used')),
  moment TEXT NOT NULL,
  text TEXT NOT NULL CHECK (char_length(text) <= 500),
  is_manual BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.telefun_replay_annotations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own replay annotations"
  ON public.telefun_replay_annotations;
DROP POLICY IF EXISTS "Users can insert their own replay annotations"
  ON public.telefun_replay_annotations;
DROP POLICY IF EXISTS "Users can delete their own replay annotations"
  ON public.telefun_replay_annotations;

CREATE POLICY "Users can view their own replay annotations"
  ON public.telefun_replay_annotations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own replay annotations"
  ON public.telefun_replay_annotations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own replay annotations"
  ON public.telefun_replay_annotations
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

REVOKE ALL ON public.telefun_replay_annotations FROM anon, public;
GRANT SELECT, INSERT, DELETE ON public.telefun_replay_annotations TO authenticated;
