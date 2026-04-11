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

export async function consumeRateLimit({
  key,
  limit,
  windowMs,
}: ConsumeRateLimitOptions): Promise<RateLimitResult> {
  const admin = createAdminClient();
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMs);

  const { data: existing, error: selectError } = await admin
    .from('security_rate_limits')
    .select('key, count, window_start')
    .eq('key', key)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  const activeWindowStart = existing?.window_start ? new Date(existing.window_start) : null;
  const isWindowActive = activeWindowStart ? activeWindowStart > windowStart : false;

  if (!existing || !isWindowActive) {
    const resetWindowStart = now.toISOString();
    const { error: upsertError } = await admin
      .from('security_rate_limits')
      .upsert({
        key,
        count: 1,
        window_start: resetWindowStart,
        updated_at: now.toISOString(),
      });

    if (upsertError) {
      throw upsertError;
    }

    return {
      allowed: true,
      remaining: Math.max(0, limit - 1),
      retryAfterSeconds: Math.ceil(windowMs / 1000),
    };
  }

  if ((existing.count ?? 0) >= limit) {
    const retryAfterMs = windowMs - (now.getTime() - activeWindowStart.getTime());
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  const nextCount = (existing.count ?? 0) + 1;
  const { error: updateError } = await admin
    .from('security_rate_limits')
    .update({
      count: nextCount,
      updated_at: now.toISOString(),
    })
    .eq('key', key);

  if (updateError) {
    throw updateError;
  }

  return {
    allowed: true,
    remaining: Math.max(0, limit - nextCount),
    retryAfterSeconds: Math.ceil(windowMs / 1000),
  };
}
