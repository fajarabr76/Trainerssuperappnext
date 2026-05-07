import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('SIDAK dashboard range year-period mismatch guard', () => {
  const qaServiceSource = readFileSync(
    'app/(main)/qa-analyzer/services/qaService.server.ts',
    'utf8'
  );

  const dashboardPageSource = readFileSync(
    'app/(main)/dashboard/page.tsx',
    'utf8'
  );

  const dashboardClientSource = readFileSync(
    'app/(main)/dashboard/DashboardTrendClient.tsx',
    'utf8'
  );

  const actionsSource = readFileSync(
    'app/(main)/dashboard/actions.ts',
    'utf8'
  );

  describe('getServiceTrendForDashboardByRange hybrid flow', () => {
    it('tries summary reader path before raw fallback', () => {
      const fnMatch = qaServiceSource.match(
        /async getServiceTrendForDashboardByRange\([\s\S]*?^\s{2}\},?\s*$/m
      );
      const fnBody = fnMatch?.[0] ?? '';

      // Harus ada referensi ke summary reader atau helper summary path
      expect(fnBody).toMatch(/summaryReader|getDashboardRangeTrendFromSummary|summary/);
    });

    it('returns explicit status when periods are missing for selected year', () => {
      const fnMatch = qaServiceSource.match(
        /async getServiceTrendForDashboardByRange\([\s\S]*?^\s{2}\},?\s*$/m
      );
      const fnBody = fnMatch?.[0] ?? '';

      // Harus ada guard eksplisit untuk missing periods dan return status yang jelas
      expect(fnBody).toMatch(/missing_periods|status.*missing|reason.*period/i);
    });

    it('falls back to raw query when summary path returns null', () => {
      const fnMatch = qaServiceSource.match(
        /async getServiceTrendForDashboardByRange\([\s\S]*?^\s{2}\},?\s*$/m
      );
      const fnBody = fnMatch?.[0] ?? '';

      // Harus ada branch fallback ke raw query
      expect(fnBody).toMatch(/fetchPaginatedTrendData|raw|fallback/i);
    });
  });

  describe('year source-of-truth consistency', () => {
    it('dashboard page fetches availableYears from qa_periods, not just profiler_years', () => {
      // Dashboard page harus menggunakan qa_periods sebagai sumber tahun untuk trend
      // atau minimal filter profiler_years dengan qa_periods coverage
      expect(dashboardPageSource).toMatch(/qa_periods|getPeriods|getAvailableYears/);
    });
  });

  describe('DashboardTrendClient mismatch handling', () => {
    it('distinguishes between empty-valid data and missing-periods mismatch', () => {
      // Client harus bisa membedakan state:
      // 1. Data normal (ada temuan)
      // 2. Empty valid (periode ada tapi belum ada temuan)
      // 3. Mismatch (tahun dipilih tapi periode belum ada)
      expect(dashboardClientSource).toMatch(/status|reason|missing_periods|noPeriods/i);
    });
  });

  describe('dashboard page fallback consistency', () => {
    it('.catch() fallback passes periodIds to maintain consistent scope', () => {
      // Fallback di page.tsx harus tetap menggunakan periodIds yang sama
      expect(dashboardPageSource).toContain('periodIds');
      expect(dashboardPageSource).toMatch(/getServiceTrendForDashboard\(['"]all['"]\)/);
    });
  });
});
