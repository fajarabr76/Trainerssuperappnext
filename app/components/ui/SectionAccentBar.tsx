import React from 'react';

interface SectionAccentBarProps {
  label: string;
  color?: 'primary' | 'chart-blue' | 'module-ketik' | 'module-pdkt' | 'module-telefun' | 'module-profiler' | 'module-sidak' | 'chart-orange' | 'chart-red' | 'chart-green' | 'chart-amber' | 'chart-violet' | 'chart-cyan';
  className?: string;
}

export function SectionAccentBar({
  label,
  color = 'primary',
  className = ''
}: SectionAccentBarProps) {
  // Explicit mapping to avoid dynamic class name issues with Tailwind
  const colorMap = {
    'primary': 'bg-primary',
    'module-ketik': 'bg-module-ketik',
    'module-pdkt': 'bg-module-pdkt',
    'module-telefun': 'bg-module-telefun',
    'module-profiler': 'bg-module-profiler',
    'module-sidak': 'bg-module-sidak',
    'chart-blue': 'bg-chart-blue',
    'chart-orange': 'bg-chart-orange',
    'chart-red': 'bg-chart-red',
    'chart-green': 'bg-chart-green',
    'chart-amber': 'bg-chart-amber',
    'chart-violet': 'bg-chart-violet',
    'chart-cyan': 'bg-chart-cyan',
  };

  const bgClass = colorMap[color] || 'bg-primary';

  return (
    <div className={`flex items-center gap-3 mb-4 px-1 ${className}`}>
      <div className={`w-1 h-3 rounded-full ${bgClass}`} />
      <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">
        {label}
      </p>
    </div>
  );
}
