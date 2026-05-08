import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const MODEL_ID = 'gemini-3.1-flash-live-preview';
const PROVIDER = 'gemini' as const;

export interface LiveUsageSnapshot {
  promptTokenCount: number;
  responseTokenCount: number;
  totalTokenCount: number;
}

export function parseUsageMetadata(raw: unknown): LiveUsageSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const meta = raw as Record<string, unknown>;

  let prompt = typeof meta.promptTokenCount === 'number' ? meta.promptTokenCount : 0;
  if (prompt === 0 && Array.isArray(meta.promptTokensDetails)) {
    for (const detail of meta.promptTokensDetails as Record<string, unknown>[]) {
      if (typeof detail?.tokenCount === 'number') prompt += detail.tokenCount;
    }
  }

  let response = typeof meta.responseTokenCount === 'number' ? meta.responseTokenCount : 0;
  if (response === 0 && typeof meta.candidatesTokenCount === 'number') {
    response = meta.candidatesTokenCount;
  }
  if (response === 0 && Array.isArray(meta.responseTokensDetails)) {
    for (const detail of meta.responseTokensDetails as Record<string, unknown>[]) {
      if (typeof detail?.tokenCount === 'number') response += detail.tokenCount;
    }
  }

  let total =
    typeof meta.totalTokenCount === 'number' ? meta.totalTokenCount : 0;
  // Fallback: derive total from prompt + response
  if (total === 0 && (prompt > 0 || response > 0)) {
    total = prompt + response;
  }
  // Fallback: derive response from total - prompt if response is still zero
  if (response === 0 && total > 0 && prompt > 0 && total >= prompt) {
    response = total - prompt;
  }

  if (prompt === 0 && response === 0 && total === 0) return null;
  return { promptTokenCount: prompt, responseTokenCount: response, totalTokenCount: total };
}

export function mergeSnapshot(
  prev: LiveUsageSnapshot | null,
  next: LiveUsageSnapshot,
): LiveUsageSnapshot {
  if (!prev) return next;
  return {
    promptTokenCount: Math.max(prev.promptTokenCount, next.promptTokenCount),
    responseTokenCount: Math.max(prev.responseTokenCount, next.responseTokenCount),
    totalTokenCount: Math.max(prev.totalTokenCount, next.totalTokenCount),
  };
}

export async function flushLiveUsage(
  requestId: string,
  userId: string,
  snapshot: LiveUsageSnapshot,
): Promise<void> {
  try {
    const [{ data: pricing }, { data: billing }] = await Promise.all([
      admin
        .from('ai_pricing_settings')
        .select('input_price_usd_per_million, output_price_usd_per_million')
        .eq('model_id', MODEL_ID)
        .single(),
      admin
        .from('ai_billing_settings')
        .select('usd_to_idr_rate')
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
    ]);

    let inputPricePerMillion = 0;
    let outputPricePerMillion = 0;
    const usdToIdrRate = billing?.usd_to_idr_rate ?? 15000;

    const IS_LIVE_MODEL = MODEL_ID.includes('live');
    const DEFAULT_INPUT = IS_LIVE_MODEL ? 3.0 : 0;
    const DEFAULT_OUTPUT = IS_LIVE_MODEL ? 12.0 : 0;

    if (!pricing) {
      console.warn(
        `[Telefun Usage] No pricing found for model "${MODEL_ID}". Using fallback of ${DEFAULT_INPUT}/${DEFAULT_OUTPUT} USD.`,
      );
      inputPricePerMillion = DEFAULT_INPUT;
      outputPricePerMillion = DEFAULT_OUTPUT;
    } else {
      inputPricePerMillion = pricing.input_price_usd_per_million ?? DEFAULT_INPUT;
      outputPricePerMillion = pricing.output_price_usd_per_million ?? DEFAULT_OUTPUT;
    }

    // Also remove the "billing will be 0 IDR" warning if prices are valid now.
    if (inputPricePerMillion === 0 && outputPricePerMillion === 0) {
      console.warn(
        `[Telefun Usage] Pricing for "${MODEL_ID}" is 0/0 USD. Tokens logged but billing will be 0 IDR until admin updates pricing.`,
      );
    }

    // NOTE: Telefun v1 uses an audio-dominant blended rate because live
    // sessions consist primarily of audio input and audio output. Google
    // bills text, image/video, and audio separately, but the current schema
    // stores only one blended rate per direction. Input text instructions,
    // image/video frames, and output text/thinking are not billed separately
    // in v1. Precise per-modality billing would require schema changes.
    const estimatedCostUsd =
      (snapshot.promptTokenCount / 1_000_000) * inputPricePerMillion +
      (snapshot.responseTokenCount / 1_000_000) * outputPricePerMillion;
    const estimatedCostIdr = estimatedCostUsd * usdToIdrRate;

    const { error } = await admin.from('ai_usage_logs').insert({
      request_id: requestId,
      user_id: userId,
      provider: PROVIDER,
      model_id: MODEL_ID,
      module: 'telefun',
      action: 'voice_live',
      input_tokens: snapshot.promptTokenCount,
      output_tokens: snapshot.responseTokenCount,
      total_tokens: snapshot.totalTokenCount,
      input_price_usd_per_million: inputPricePerMillion,
      output_price_usd_per_million: outputPricePerMillion,
      usd_to_idr_rate: usdToIdrRate,
      estimated_cost_usd: Math.round(estimatedCostUsd * 1_000_000) / 1_000_000,
      estimated_cost_idr: Math.round(estimatedCostIdr),
    });

    if (error) {
      if (error.code === '23505') {
        console.warn(
          `[Telefun Usage] Duplicate request_id "${requestId}". Skipping log.`,
        );
        return;
      }
      console.error('[Telefun Usage] Failed to insert usage log:', error);
    } else {
      console.log(
        `[Telefun Usage] Logged voice_live: user=${userId} in=${snapshot.promptTokenCount} out=${snapshot.responseTokenCount} total=${snapshot.totalTokenCount}`,
      );
    }
  } catch (err) {
    console.error('[Telefun Usage] Exception while flushing usage:', err);
  }
}
