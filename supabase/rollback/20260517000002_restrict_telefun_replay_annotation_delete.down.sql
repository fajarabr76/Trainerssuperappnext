-- Rollback: restore the previous owner-only direct DELETE contract for Telefun
-- replay annotations. Use only when rolling back migration
-- 20260517000002_restrict_telefun_replay_annotation_delete.sql.

GRANT DELETE ON public.telefun_replay_annotations TO authenticated;

DROP POLICY IF EXISTS "Users can delete their own replay annotations"
  ON public.telefun_replay_annotations;

CREATE POLICY "Users can delete their own replay annotations"
  ON public.telefun_replay_annotations
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.telefun_replay_annotations IS
  'AI-generated and manual annotations for Telefun session replay. Each annotation marks a specific moment in the recording with category, description, and timestamp.';
