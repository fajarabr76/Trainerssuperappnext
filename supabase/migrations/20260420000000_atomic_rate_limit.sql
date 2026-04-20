-- Hardened atomic rate limiting function
-- 1. Use SET search_path = '' to prevent hijacking
-- 2. Restrict EXECUTE to service_role only
CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_key text,
  p_limit integer,
  p_window_ms integer
)
RETURNS TABLE (
  allowed boolean,
  remaining integer,
  retry_after_seconds integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now timestamptz := now();
  v_window_interval interval := (p_window_ms || ' milliseconds')::interval;
  v_record record;
BEGIN
  -- Use explicit schema prefix since search_path is empty
  INSERT INTO public.security_rate_limits (key, count, window_start, updated_at)
  VALUES (p_key, 1, v_now, v_now)
  ON CONFLICT (key) DO UPDATE
  SET 
    count = CASE 
      WHEN public.security_rate_limits.window_start < (v_now - v_window_interval) THEN 1
      ELSE public.security_rate_limits.count + 1
    END,
    window_start = CASE
      WHEN public.security_rate_limits.window_start < (v_now - v_window_interval) THEN v_now
      ELSE public.security_rate_limits.window_start
    END,
    updated_at = v_now
  RETURNING * INTO v_record;

  IF v_record.count > p_limit THEN
    RETURN QUERY SELECT
      false,
      0,
      ceil(extract(epoch from (v_record.window_start + v_window_interval - v_now)))::integer;
  ELSE
    RETURN QUERY SELECT
      true,
      p_limit - v_record.count,
      ceil(extract(epoch from (v_record.window_start + v_window_interval - v_now)))::integer;
  END IF;
END;
$$;

-- Revoke all permissions from public/anon/authenticated
REVOKE EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, integer) FROM authenticated;

-- Grant to service_role (used by createAdminClient)
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, integer) TO service_role;
