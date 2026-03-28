'use client';

import React from 'react';

interface YearSelectorProps {
  years: number[];
  selectedYear: number;
  onYearChange: (year: number) => void;
}

export function YearSelector({ years, selectedYear, onYearChange }: YearSelectorProps) {
  return (
    <div className="flex items-center gap-2 p-1 bg-card/30 backdrop-blur-md border border-border/40 rounded-full">
      {years.map((year) => {
        const active = selectedYear === year;
        return (
          <button
            key={year}
            onClick={() => onYearChange(year)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${
              active 
                ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-105' 
                : 'bg-card/50 text-muted-foreground hover:bg-card hover:text-foreground border border-border/50'
            }`}
          >
            {year}
          </button>
        );
      })}
    </div>
  );
}
