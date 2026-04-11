CREATE TABLE IF NOT EXISTS public.security_rate_limits (
  key text PRIMARY KEY,
  count integer NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.security_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages security rate limits" ON public.security_rate_limits;
CREATE POLICY "Service role manages security rate limits"
ON public.security_rate_limits
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_security_rate_limits_updated_at
  ON public.security_rate_limits (updated_at);
