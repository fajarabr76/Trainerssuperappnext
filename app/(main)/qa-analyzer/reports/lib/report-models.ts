import { AI_MODELS, type AIProvider } from '@/app/lib/ai-models';

export type ReportAiModelOption = (typeof AI_MODELS)[number];

function envBool(v: string | undefined): boolean {
  return v === '1' || v?.toLowerCase() === 'true';
}

export function getReportMaxPerDay(): number {
  const n = parseInt(process.env.REPORT_MAX_PER_DAY || '10', 10);
  return Number.isFinite(n) && n > 0 ? n : 10;
}

/** Models available for Report Maker, with optional env disable flags. */
export function getReportAiModelOptions(): ReportAiModelOption[] {
  return AI_MODELS.filter((m) => {
    if (m.id === 'gemini-3.1-flash-lite' && envBool(process.env.REPORT_DISABLE_GEMINI_FLASH)) {
      return false;
    }
    return true;
  });
}

export function modelProviderLabel(p: AIProvider): string {
  return p === 'gemini' ? 'Gemini' : 'OpenRouter';
}
