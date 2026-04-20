import { createAdminClient } from '@/app/lib/supabase/admin';

type ConsumeRateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

/**
 * Consumes a rate limit token for a given key.
 * This implementation uses a single atomic Postgres operation via RPC to ensure thread-safety.
 */
export async function consumeRateLimit({
  key,
  limit,
  windowMs,
}: ConsumeRateLimitOptions): Promise<RateLimitResult> {
  const admin = createAdminClient();

  const { data, error } = await admin.rpc('consume_rate_limit', {
    p_key: key,
    p_limit: limit,
    p_window_ms: windowMs,
  });

  if (error) {
    console.error('[RateLimit] RPC Critical Error:', error);
    // FAIL-CLOSED: If rate limiting infra fails, we block to protect the system.
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil(windowMs / 1000),
    };
  }

  const result = Array.isArray(data) ? data[0] : data;

  if (!result) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil(windowMs / 1000),
    };
  }

  return {
    allowed: result.allowed,
    remaining: result.remaining,
    retryAfterSeconds: result.retry_after_seconds,
  };
}
