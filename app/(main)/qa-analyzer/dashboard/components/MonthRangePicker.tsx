'use client';

import React from 'react';
import { Calendar, ChevronRight, XCircle } from 'lucide-react';

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

interface MonthRangePickerProps {
  selectedYear: number;
  startMonth: number | null;
  endMonth: number | null;
  onRangeChange: (start: number | null, end: number | null) => void;
}

export function MonthRangePicker({
  selectedYear,
  startMonth,
  endMonth,
  onRangeChange
}: MonthRangePickerProps) {
  const handleStartChange = (val: string) => {
    const start = val === '' ? null : parseInt(val);
    onRangeChange(start, endMonth);
  };

  const handleEndChange = (val: string) => {
    const end = val === '' ? null : parseInt(val);
    onRangeChange(startMonth, end);
  };

  const handleReset = () => {
    onRangeChange(null, null);
  };

  const isInvalidRange = startMonth !== null && endMonth !== null && endMonth < startMonth;

  return (
    <div className="flex flex-col gap-2 mb-6">
      <div className="flex flex-wrap items-center gap-4 p-4 bg-background/30 rounded-2xl border border-border/50">
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground/60 mr-2">
          <Calendar className="w-4 h-4" />
          <span>Rentang Bulan ({selectedYear}):</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Start Month */}
          <div className="relative group/select min-w-[140px]">
            <select
              value={startMonth ?? ''}
              onChange={(e) => handleStartChange(e.target.value)}
              className="block w-full pl-4 pr-10 py-2 text-xs bg-background/50 border-border/50 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all appearance-none border hover:border-primary/30"
            >
              <option value="">Bulan Awal</option>
              {MONTHS.map((name, i) => (
                <option key={name} value={i + 1}>{name}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-foreground/20">
              <ChevronRight className="w-3 h-3 rotate-90" />
            </div>
          </div>

          <span className="text-foreground/20">sampai</span>

          {/* End Month */}
          <div className="relative group/select min-w-[140px]">
            <select
              value={endMonth ?? ''}
              onChange={(e) => handleEndChange(e.target.value)}
              className="block w-full pl-4 pr-10 py-2 text-xs bg-background/50 border-border/50 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all appearance-none border hover:border-primary/30"
            >
              <option value="">Bulan Akhir</option>
              {MONTHS.map((name, i) => (
                <option key={name} value={i + 1}>{name}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-foreground/20">
              <ChevronRight className="w-3 h-3 rotate-90" />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        {(startMonth !== null || endMonth !== null) && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-foreground/40 hover:text-red-500 hover:bg-red-500/5 transition-all"
          >
            <XCircle className="w-3.5 h-3.5" />
            Reset
          </button>
        )}

        {isInvalidRange && (
          <span className="text-[10px] text-red-500 font-medium animate-pulse">
            * Rentang bulan tidak valid
          </span>
        )}
      </div>
      
      <p className="text-[10px] text-foreground/30 font-medium ml-4">
        * Rentang bulan dibatasi dalam tahun {selectedYear}. Ubah tahun di filter global untuk tahun lain.
      </p>
    </div>
  );
}
