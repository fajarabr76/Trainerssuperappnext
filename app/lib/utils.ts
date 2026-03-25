/**
 * Normalize module names and action text to ensure consistent branding.
 * Unifies "QA Analyzer" / "Sidak" -> "SIDAK"
 * Unifies "Profiler" / "KTP" -> "KTP"
 */
export function normalizeModuleName(module: string | null | undefined): string {
  if (!module) return 'System';
  const m = module.toUpperCase();
  if (m === 'SIDAK' || m === 'QA ANALYZER') return 'SIDAK';
  if (m === 'KTP' || m === 'PROFILER') return 'KTP';
  return module;
}

export function normalizeActionText(action: string | null | undefined): string {
  if (!action) return '';
  return action
    .replace(/QA Analyzer/gi, 'SIDAK')
    .replace(/Sidak/gi, 'SIDAK')
    .replace(/Profiler/gi, 'KTP');
}
