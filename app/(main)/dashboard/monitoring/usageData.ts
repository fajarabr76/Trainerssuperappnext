import 'server-only';

import { unstable_cache } from 'next/cache';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { AI_MODELS } from '@/app/lib/ai-models';

function getWibMonthBounds(year: number, month: number): { start: string; end: string } {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  start.setUTCHours(start.getUTCHours() - 7);

  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  end.setUTCHours(end.getUTCHours() - 7);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

export function getCurrentWibMonth(): { year: number; month: number } {
  const now = new Date();
  const wibTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return {
    year: wibTime.getUTCFullYear(),
    month: wibTime.getUTCMonth() + 1,
  };
}

export interface UsageAggregation {
  user_id: string;
  user_email: string | null;
  user_role: string | null;
  total_calls: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
  total_cost_idr: number;
  models: Array<{
    model_id: string;
    calls: number;
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    cost_idr: number;
  }>;
}

export interface UsageFilters {
  year: number;
  month: number;
  userId?: string;
  module?: string;
}

export const USAGE_CACHE_TAG = 'usage-aggregation';

async function getUsageAggregationInternal(filters: UsageFilters): Promise<UsageAggregation[]> {
  try {
    const admin = createAdminClient();
    const { start, end } = getWibMonthBounds(filters.year, filters.month);

    let query = admin
      .from('ai_usage_logs')
      .select('user_id, model_id, module, input_tokens, output_tokens, total_tokens, estimated_cost_idr')
      .gte('created_at', start)
      .lte('created_at', end);

    if (filters.module) {
      query = query.eq('module', filters.module);
    }

    const { data: logs, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('[Usage] Failed to fetch usage logs:', error);
      return [];
    }

    if (!logs || logs.length === 0) {
      return [];
    }

    const userIds = [...new Set(logs.map((log) => log.user_id))];
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, email, role')
      .in('id', userIds);

    const profileMap: Record<string, { email: string | null; role: string | null }> = {};
    (profiles || []).forEach((p) => {
      profileMap[p.id] = { email: p.email, role: p.role };
    });

    const userAgg: Record<string, Omit<UsageAggregation, 'user_email' | 'user_role' | 'models'> & { models: Record<string, Omit<UsageAggregation['models'][0], 'model_id'>> }> = {};

    for (const log of logs) {
      if (!userAgg[log.user_id]) {
        userAgg[log.user_id] = {
          user_id: log.user_id,
          total_calls: 0,
          total_input_tokens: 0,
          total_output_tokens: 0,
          total_tokens: 0,
          total_cost_idr: 0,
          models: {},
        };
      }

      const agg = userAgg[log.user_id];
      agg.total_calls += 1;
      agg.total_input_tokens += log.input_tokens || 0;
      agg.total_output_tokens += log.output_tokens || 0;
      agg.total_tokens += log.total_tokens || 0;
      agg.total_cost_idr += log.estimated_cost_idr || 0;

      if (!agg.models[log.model_id]) {
        agg.models[log.model_id] = {
          calls: 0,
          input_tokens: 0,
          output_tokens: 0,
          total_tokens: 0,
          cost_idr: 0,
        };
      }

      const modelAgg = agg.models[log.model_id];
      modelAgg.calls += 1;
      modelAgg.input_tokens += log.input_tokens || 0;
      modelAgg.output_tokens += log.output_tokens || 0;
      modelAgg.total_tokens += log.total_tokens || 0;
      modelAgg.cost_idr += log.estimated_cost_idr || 0;
    }

    return Object.values(userAgg).map((agg) => ({
      user_id: agg.user_id,
      user_email: profileMap[agg.user_id]?.email || null,
      user_role: profileMap[agg.user_id]?.role || null,
      total_calls: agg.total_calls,
      total_input_tokens: agg.total_input_tokens,
      total_output_tokens: agg.total_output_tokens,
      total_tokens: agg.total_tokens,
      total_cost_idr: agg.total_cost_idr,
      models: Object.entries(agg.models).map(([model_id, m]) => ({
        model_id,
        calls: m.calls,
        input_tokens: m.input_tokens,
        output_tokens: m.output_tokens,
        total_tokens: m.total_tokens,
        cost_idr: m.cost_idr,
      })),
    }));
  } catch (error) {
    console.error('[Usage] Exception while fetching usage aggregation:', error);
    return [];
  }
}

export async function getUsageAggregation(filters: UsageFilters): Promise<UsageAggregation[]> {
  const cacheKey = `usage-${filters.year}-${filters.month}-${filters.module || 'all'}`;
  const cached = unstable_cache(
    () => getUsageAggregationInternal(filters),
    [cacheKey],
    { revalidate: 600, tags: [USAGE_CACHE_TAG] }
  );
  return cached();
}

export interface UserUsageSummary {
  total_calls: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
  total_cost_idr: number;
  periodLabel: string;
}

export async function getUserUsageSummary(options: {
  userId: string;
  module: 'ketik' | 'pdkt' | 'telefun' | 'qa-analyzer';
}): Promise<UserUsageSummary | null> {
  try {
    const admin = createAdminClient();
    const { year, month } = getCurrentWibMonth();
    const { start, end } = getWibMonthBounds(year, month);

    const { data: logs, error } = await admin
      .from('ai_usage_logs')
      .select('input_tokens, output_tokens, total_tokens, estimated_cost_idr')
      .eq('user_id', options.userId)
      .eq('module', options.module)
      .gte('created_at', start)
      .lte('created_at', end);

    if (error) {
      console.error('[Usage] Failed to fetch user usage summary:', error);
      return null;
    }

    if (!logs || logs.length === 0) {
      return {
        total_calls: 0,
        total_input_tokens: 0,
        total_output_tokens: 0,
        total_tokens: 0,
        total_cost_idr: 0,
        periodLabel: buildPeriodLabel(year, month),
      };
    }

    return {
      total_calls: logs.length,
      total_input_tokens: logs.reduce((sum, log) => sum + (log.input_tokens || 0), 0),
      total_output_tokens: logs.reduce((sum, log) => sum + (log.output_tokens || 0), 0),
      total_tokens: logs.reduce((sum, log) => sum + (log.total_tokens || 0), 0),
      total_cost_idr: logs.reduce((sum, log) => sum + (log.estimated_cost_idr || 0), 0),
      periodLabel: buildPeriodLabel(year, month),
    };
  } catch (error) {
    console.error('[Usage] Exception while fetching user usage summary:', error);
    return null;
  }
}

function buildPeriodLabel(year: number, month: number): string {
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];
  const monthName = monthNames[month - 1] || '';
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `1 ${monthName} ${year} - ${lastDay} ${monthName} ${year} WIB`;
}

export interface PricingSetting {
  model_id: string;
  input_price_usd_per_million: number;
  output_price_usd_per_million: number;
}

export interface PricingEditorEntry extends PricingSetting {
  model_name: string;
  provider: string;
}

export async function buildFullPricingEditorList(): Promise<PricingEditorEntry[]> {
  const dbPricing = await getPricingSettings();
  const pricingMap = new Map<string, PricingSetting>();
  for (const p of dbPricing) {
    pricingMap.set(p.model_id, p);
  }

  const result: PricingEditorEntry[] = AI_MODELS.map((model) => {
    const existing = pricingMap.get(model.id);
    return {
      model_id: model.id,
      model_name: model.name,
      provider: model.provider,
      input_price_usd_per_million: existing?.input_price_usd_per_million ?? 0,
      output_price_usd_per_million: existing?.output_price_usd_per_million ?? 0,
    };
  });

  for (const p of dbPricing) {
    if (!result.some((r) => r.model_id === p.model_id)) {
      result.push({
        model_id: p.model_id,
        model_name: p.model_id,
        provider: 'unknown',
        input_price_usd_per_million: p.input_price_usd_per_million,
        output_price_usd_per_million: p.output_price_usd_per_million,
      });
    }
  }

  return result;
}

export async function getPricingSettings(): Promise<PricingSetting[]> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('ai_pricing_settings')
      .select('model_id, input_price_usd_per_million, output_price_usd_per_million')
      .order('model_id', { ascending: true });

    if (error) {
      console.error('[Usage] Failed to fetch pricing settings:', error);
      return [];
    }

    return (data || []).map((row) => ({
      model_id: row.model_id,
      input_price_usd_per_million: row.input_price_usd_per_million ?? 0,
      output_price_usd_per_million: row.output_price_usd_per_million ?? 0,
    }));
  } catch (error) {
    console.error('[Usage] Exception while fetching pricing settings:', error);
    return [];
  }
}

export async function getBillingSettings(): Promise<{ usd_to_idr_rate: number } | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('ai_billing_settings')
      .select('usd_to_idr_rate')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error('[Usage] Failed to fetch billing settings:', error);
      return null;
    }

    return { usd_to_idr_rate: data?.usd_to_idr_rate ?? 15000 };
  } catch (error) {
    console.error('[Usage] Exception while fetching billing settings:', error);
    return null;
  }
}

export async function updatePricingSetting(options: {
  model_id: string;
  input_price_usd_per_million: number;
  output_price_usd_per_million: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from('ai_pricing_settings')
      .upsert({
        model_id: options.model_id,
        input_price_usd_per_million: options.input_price_usd_per_million,
        output_price_usd_per_million: options.output_price_usd_per_million,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'model_id' });

    if (error) {
      console.error('[Usage] Failed to update pricing setting:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('[Usage] Exception while updating pricing setting:', error);
    return { success: false, error: 'Terjadi kesalahan saat menyimpan pricing.' };
  }
}

export async function updateBillingRate(options: {
  usd_to_idr_rate: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from('ai_billing_settings')
      .insert({
        usd_to_idr_rate: options.usd_to_idr_rate,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.error('[Usage] Failed to update billing rate:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('[Usage] Exception while updating billing rate:', error);
    return { success: false, error: 'Terjadi kesalahan saat menyimpan kurs.' };
  }
}
