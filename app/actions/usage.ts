'use server';

import { createClient } from '@/app/lib/supabase/server';
import { getUserUsageSummary, getUsageAggregation, updatePricingSetting, updateBillingRate, getBillingSettings, buildFullPricingEditorList } from '@/app/(main)/dashboard/monitoring/usageData';
import { getCurrentUserContext } from '@/app/lib/authz';

export async function getMyModuleUsage(module: 'ketik' | 'pdkt' | 'telefun' | 'qa-analyzer') {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  return getUserUsageSummary({ userId: user.id, module });
}

export async function getFilteredUsage(options: {
  year: number;
  month: number;
  module?: string;
  search?: string;
}) {
  const { role } = await getCurrentUserContext();
  if (!role || (role !== 'trainer' && role !== 'leader' && role !== 'admin')) {
    return [];
  }

  const filters: { year: number; month: number; module?: string } = {
    year: options.year,
    month: options.month,
  };

  if (options.module && options.module !== 'all') {
    filters.module = options.module;
  }

  const data = await getUsageAggregation(filters);

  if (options.search) {
    const q = options.search.toLowerCase();
    return data.filter((u) => {
      const email = (u.user_email || '').toLowerCase();
      const name = (u.user_name || '').toLowerCase();
      return email.includes(q) || name.includes(q);
    });
  }

  return data;
}

export async function savePricingSetting(options: {
  model_id: string;
  input_price_usd_per_million: number;
  output_price_usd_per_million: number;
}) {
  const { role } = await getCurrentUserContext();
  if (role !== 'trainer' && role !== 'admin') {
    return { success: false, error: 'Anda tidak memiliki izin untuk mengubah pricing.' };
  }

  return updatePricingSetting(options);
}

export async function saveBillingRate(options: {
  usd_to_idr_rate: number;
}) {
  const { role } = await getCurrentUserContext();
  if (role !== 'trainer' && role !== 'admin') {
    return { success: false, error: 'Anda tidak memiliki izin untuk mengubah kurs.' };
  }

  return updateBillingRate(options);
}

export async function refreshPricingBilling() {
  const { role } = await getCurrentUserContext();
  if (role !== 'trainer' && role !== 'admin') {
    return { pricing: [], billing: null };
  }

  const [pricing, billing] = await Promise.all([
    buildFullPricingEditorList(),
    getBillingSettings(),
  ]);

  return { pricing, billing };
}
