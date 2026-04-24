import MonitoringClient from './MonitoringClient';
import { requirePageAccess } from '@/app/lib/authz';
import { getMonitoringHistory } from './monitoringData';
import { getUsageAggregation, getBillingSettings, getCurrentWibMonth, buildFullPricingEditorList } from './usageData';
import type { PricingEditorEntry } from './usageData';

export default async function MonitoringPage() {
  const { role } = await requirePageAccess({
    allowedRoles: ['trainer', 'leader', 'admin']
  });
  const initialResults = await getMonitoringHistory();
  const wibNow = getCurrentWibMonth();
  const initialUsage = await getUsageAggregation({ year: wibNow.year, month: wibNow.month });
  const canEditPricing = role === 'trainer' || role === 'admin';

  const initialPricing: PricingEditorEntry[] = canEditPricing ? await buildFullPricingEditorList() : [];
  const initialBilling = canEditPricing ? await getBillingSettings() : null;

  return (
    <MonitoringClient
      initialResults={initialResults}
      initialUsage={initialUsage}
      initialPricing={initialPricing}
      initialBilling={initialBilling}
      canEditPricing={canEditPricing}
      initialWibYear={wibNow.year}
      initialWibMonth={wibNow.month}
    />
  );
}
