'use client';

import React from 'react';
import { Calendar, ChevronRight } from 'lucide-react';

interface YearSelectorProps {
  years: number[];
  selectedYear: number;
  onYearChange: (year: number) => void;
}

export function YearSelector({ years, selectedYear, onYearChange }: YearSelectorProps) {
  return (
    <div className="relative flex-1 group/select min-w-[120px]">
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
        <Calendar className="h-4 w-4 text-muted-foreground group-focus-within/select:text-primary transition-colors" />
      </div>
      <select
        value={selectedYear}
        onChange={(e) => onYearChange(Number(e.target.value))}
        className="block w-full pl-12 pr-10 py-3.5 text-sm bg-background/50 border-border/50 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all appearance-none border hover:border-primary/30 font-semibold text-primary"
      >
        {years.map((year) => (
          <option key={year} value={year}>
            Tahun {year}
          </option>
        ))}
      </select>
      <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-muted-foreground">
        <ChevronRight className="w-4 h-4 rotate-90" />
      </div>
    </div>
  );
}
