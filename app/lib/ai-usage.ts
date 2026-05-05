import 'server-only';

import { createAdminClient } from '@/app/lib/supabase/admin';
import { normalizeModelId } from '@/app/lib/ai-models';

export interface UsageContext {
  module: 'ketik' | 'pdkt' | 'telefun' | 'qa-analyzer';
  action: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export async function logAiUsage(options: {
  requestId: string;
  userId: string;
  provider: 'gemini' | 'openrouter';
  modelId: string;
  usageContext: UsageContext;
  tokens: TokenUsage;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const normalizedModelId = normalizeModelId(options.modelId);

    const [{ data: pricing }, { data: billing }] = await Promise.all([
      admin
        .from('ai_pricing_settings')
        .select('input_price_usd_per_million, output_price_usd_per_million')
        .eq('model_id', normalizedModelId)
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

    if (!pricing) {
      console.warn(
        `[AI Usage] No pricing found for model "${normalizedModelId}". Token count logged but billing will be 0 IDR until admin configures pricing in the editor.`
      );
    } else {
      inputPricePerMillion = pricing.input_price_usd_per_million ?? 0;
      outputPricePerMillion = pricing.output_price_usd_per_million ?? 0;
    }

    const estimatedCostUsd =
      (options.tokens.inputTokens / 1_000_000) * inputPricePerMillion +
      (options.tokens.outputTokens / 1_000_000) * outputPricePerMillion;

    const estimatedCostIdr = estimatedCostUsd * usdToIdrRate;

    const { error } = await admin.from('ai_usage_logs').insert({
      request_id: options.requestId,
      user_id: options.userId,
      provider: options.provider,
      model_id: normalizedModelId,
      module: options.usageContext.module,
      action: options.usageContext.action,
      input_tokens: options.tokens.inputTokens,
      output_tokens: options.tokens.outputTokens,
      total_tokens: options.tokens.totalTokens,
      input_price_usd_per_million: inputPricePerMillion,
      output_price_usd_per_million: outputPricePerMillion,
      usd_to_idr_rate: usdToIdrRate,
      estimated_cost_usd: Math.round(estimatedCostUsd * 1_000_000) / 1_000_000,
      estimated_cost_idr: Math.round(estimatedCostIdr),
    });

    if (error) {
      if (error.code === '23505') {
        console.warn(`[AI Usage] Duplicate request_id "${options.requestId}". Skipping log.`);
        return;
      }
      console.error('[AI Usage] Failed to insert usage log:', error);
    }
  } catch (error) {
    console.error('[AI Usage] Exception while logging usage:', error);
  }
}
