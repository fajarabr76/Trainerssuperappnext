export type ModuleThemeKey = 'ketik' | 'pdkt';

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
} as const;
