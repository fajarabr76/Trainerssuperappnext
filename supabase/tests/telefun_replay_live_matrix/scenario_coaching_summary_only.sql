\set ON_ERROR_STOP on

CREATE TABLE IF NOT EXISTS public.telefun_coaching_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL UNIQUE REFERENCES public.telefun_history(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recommendations JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.telefun_coaching_summary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own coaching summaries"
  ON public.telefun_coaching_summary;

CREATE POLICY "Users can view their own coaching summaries"
  ON public.telefun_coaching_summary
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

REVOKE ALL ON public.telefun_coaching_summary FROM anon, public;
GRANT SELECT ON public.telefun_coaching_summary TO authenticated;

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
  v_summary_id UUID;
BEGIN
  INSERT INTO public.telefun_coaching_summary (session_id, user_id, recommendations, generated_at)
  VALUES (p_session_id, auth.uid(), p_recommendations, now())
  ON CONFLICT (session_id)
  DO UPDATE SET
    recommendations = EXCLUDED.recommendations,
    generated_at = EXCLUDED.generated_at
  RETURNING id INTO v_summary_id;

  RETURN v_summary_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_telefun_coaching_summary(UUID, JSONB)
  TO authenticated, service_role;
