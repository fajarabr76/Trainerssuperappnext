export interface UsageSnapshot {
  total_calls: number;
  total_tokens: number;
  total_cost_idr: number;
  periodLabel: string;
}

export interface UsageDelta {
  costIdr: number;
  totalTokens: number;
  totalCalls: number;
}

export function computeUsageDelta(
  before: UsageSnapshot | null | undefined,
  after: UsageSnapshot | null | undefined
): UsageDelta | null {
  if (!before || !after) return null;
  return {
    costIdr: Math.max(0, after.total_cost_idr - before.total_cost_idr),
    totalTokens: Math.max(0, after.total_tokens - before.total_tokens),
    totalCalls: Math.max(0, after.total_calls - before.total_calls),
  };
}

export function formatCompactIdr(value: number): string {
  if (value >= 1_000_000) {
    return `Rp${(value / 1_000_000).toFixed(1)}jt`;
  }
  if (value >= 1_000) {
    return `Rp${(value / 1_000).toFixed(0)}rb`;
  }
  return `Rp${value}`;
}
