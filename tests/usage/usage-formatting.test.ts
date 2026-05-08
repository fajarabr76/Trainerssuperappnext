import { describe, it, expect } from 'vitest';
import { formatUsageDeltaLabel, formatCompactIdr } from '@/app/lib/usage-snapshot';

describe('Usage Formatting Helpers', () => {
  describe('formatCompactIdr', () => {
    it('formats thousands correctly', () => {
      expect(formatCompactIdr(1000)).toBe('Rp1rb');
      expect(formatCompactIdr(1500)).toBe('Rp2rb'); // toFixed(0) rounds up
      expect(formatCompactIdr(9999)).toBe('Rp10rb');
    });

    it('formats millions correctly', () => {
      expect(formatCompactIdr(1000000)).toBe('Rp1.0jt');
      expect(formatCompactIdr(1500000)).toBe('Rp1.5jt');
    });

    it('formats small values correctly', () => {
      expect(formatCompactIdr(500)).toBe('Rp500');
      expect(formatCompactIdr(0)).toBe('Rp0');
    });
  });

  describe('formatUsageDeltaLabel', () => {
    it('prioritizes Rupiah even if 0', () => {
      const delta = { costIdr: 0, totalTokens: 100, totalCalls: 1 };
      expect(formatUsageDeltaLabel(delta)).toBe('+Rp0');
    });

    it('formats positive costs correctly', () => {
      const delta = { costIdr: 1250, totalTokens: 5000, totalCalls: 2 };
      expect(formatUsageDeltaLabel(delta)).toBe('+Rp1rb');
    });

    it('formats large costs correctly', () => {
      const delta = { costIdr: 2500000, totalTokens: 10000000, totalCalls: 50 };
      expect(formatUsageDeltaLabel(delta)).toBe('+Rp2.5jt');
    });
  });
});
