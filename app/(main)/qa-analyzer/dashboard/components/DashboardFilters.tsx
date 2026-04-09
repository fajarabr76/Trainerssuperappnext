import React from 'react';
import { Calendar, Users, Filter, ChevronRight, Headset } from 'lucide-react';
import { QAPeriod, SERVICE_LABELS } from '../../lib/qa-types';
import { YearSelector } from './YearSelector';

const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

import { MonthRangePicker } from '@/app/components/ui/MonthRangePicker';

interface DashboardFiltersProps {
  startMonth: number;
  endMonth: number;
  onRangeChange: (start: number | null, end: number | null) => void;
  folders: { id: string; name: string }[];
  selectedFolderId: string;
  onFolderChange: (id: string) => void;
  serviceType: string;
  onServiceChange: (val: string) => void;
  selectedYear: number;
  availableYears: number[];
  onYearChange: (year: number) => void;
}

export default function DashboardFilters({
  startMonth,
  endMonth,
  onRangeChange,
  folders,
  selectedFolderId,
  onFolderChange,
  serviceType,
  onServiceChange,
  selectedYear,
  availableYears,
  onYearChange
}: DashboardFiltersProps) {

  return (
    <div className="flex flex-col lg:flex-row gap-2.5 items-center bg-card/50 backdrop-blur-xl p-3.5 rounded-[2rem] border border-border/50 shadow-2xl shadow-primary/5 relative overflow-hidden group w-full">
      {/* Decorative background glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
      
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
          <Filter className="w-5 h-5 text-primary" />
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-widest text-primary">Konfigurasi</span>
          <span className="font-bold text-sm">Filter Data</span>
        </div>
      </div>
      
      
        <div className="flex-1 flex flex-col xl:flex-row gap-3 w-full relative z-10">
          <div className="flex flex-col md:flex-row gap-2.5 flex-1 lg:flex-[2]">
            <div className="relative flex-1 min-w-[120px] group/select">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Headset className="h-4 w-4 text-foreground/40 group-focus-within/select:text-primary transition-colors" />
              </div>
              <select
                value={serviceType}
                onChange={(e) => onServiceChange(e.target.value)}
                className="block w-full pl-10 pr-8 py-3 text-sm bg-background/50 border-border/50 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all appearance-none border hover:border-primary/30 font-semibold text-primary"
              >
                {Object.entries(SERVICE_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-foreground/20">
                <ChevronRight className="w-4 h-4 rotate-90" />
              </div>
            </div>

            <div className="relative flex-[1.2] min-w-[140px] group/select">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Users className="h-4 w-4 text-foreground/40 group-focus-within/select:text-primary transition-colors" />
              </div>
              <select
                value={selectedFolderId}
                onChange={(e) => onFolderChange(e.target.value)}
                className="block w-full pl-10 pr-8 py-3 text-sm bg-background/50 border-border/50 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all appearance-none border hover:border-primary/30"
              >
              <option value="ALL">Semua Tim</option>
              {folders.map(f => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
              </select>
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-foreground/20">
                <ChevronRight className="w-4 h-4 rotate-90" />
              </div>
            </div>

            <div className="relative flex-1 min-w-[160px] group/select">
              <YearSelector 
                years={availableYears} 
                selectedYear={selectedYear} 
                onYearChange={onYearChange} 
              />
            </div>
          </div>

          <div className="h-8 w-px bg-border mx-1 hidden xl:block self-center" />

          <div className="flex-1 min-w-[360px]">
            <MonthRangePicker 
              selectedYear={selectedYear}
              startMonth={startMonth}
              endMonth={endMonth}
              onRangeChange={onRangeChange}
              variant="compact"
              className="w-full"
            />
          </div>
        </div>
    </div>
  );
}
