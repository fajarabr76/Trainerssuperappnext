export type ModuleThemeKey = 'ketik' | 'pdkt' | 'profiler' | 'qa-analyzer';

export const moduleTheme = {
  ketik: {
    root: 'module-clean-app module-clean-stage',
    accentText: 'text-module-ketik',
    accentBg: 'bg-module-ketik',
    accentSoftBg: 'bg-module-ketik/10',
    accentBorder: 'border-module-ketik/20',
    accentShadow: 'shadow-module-ketik/20',
  },
  pdkt: {
    root: 'module-clean-app module-clean-stage',
    accentText: 'text-module-pdkt',
    accentBg: 'bg-module-pdkt',
    accentSoftBg: 'bg-module-pdkt/10',
    accentBorder: 'border-module-pdkt/20',
    accentShadow: 'shadow-module-pdkt/20',
  },
  profiler: {
    root: 'module-clean-app module-clean-stage',
    accentText: 'text-module-profiler',
    accentBg: 'bg-module-profiler',
    accentSoftBg: 'bg-module-profiler/10',
    accentBorder: 'border-module-profiler/20',
    accentShadow: 'shadow-module-profiler/20',
  },
  'qa-analyzer': {
    root: 'module-clean-app module-clean-stage',
    accentText: 'text-module-sidak',
    accentBg: 'bg-module-sidak',
    accentSoftBg: 'bg-module-sidak/10',
    accentBorder: 'border-module-sidak/20',
    accentShadow: 'shadow-module-sidak/20',
  },
} as const;
