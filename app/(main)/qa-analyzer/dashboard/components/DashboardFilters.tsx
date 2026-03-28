import React from 'react';
import { Calendar, Users, Filter, ChevronRight, Headset } from 'lucide-react';
import { QAPeriod, SERVICE_LABELS } from '../../lib/qa-types';
import { YearSelector } from './YearSelector';

const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

interface DashboardFiltersProps {
  periods: QAPeriod[];
  selectedPeriodId: string;
  onPeriodChange: (id: string) => void;
  folders: { id: string; name: string }[];
  selectedFolderId: string;
  onFolderChange: (id: string) => void;
  timeframe: '3m' | '6m' | 'all';
  onTimeframeChange: (tf: '3m' | '6m' | 'all') => void;
  serviceType: string;
  onServiceChange: (val: string) => void;
  selectedYear: number;
  availableYears: number[];
  onYearChange: (year: number) => void;
}

export default function DashboardFilters({
  periods,
  selectedPeriodId,
  onPeriodChange,
  folders,
  selectedFolderId,
  onFolderChange,
  timeframe,
  onTimeframeChange,
  serviceType,
  onServiceChange,
  selectedYear,
  availableYears,
  onYearChange
}: DashboardFiltersProps) {

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-center bg-card/50 backdrop-blur-xl p-6 rounded-[2rem] border border-border/50 shadow-2xl shadow-primary/5 relative overflow-hidden group">
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
      
      <div className="h-8 w-px bg-border mx-2 hidden lg:block" />
      
      <div className="flex-1 flex flex-col md:flex-row gap-4 w-full relative z-10">
        <div className="relative flex-1 group/select">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Headset className="h-4 w-4 text-foreground/40 group-focus-within/select:text-primary transition-colors" />
          </div>
          <select
            value={serviceType}
            onChange={(e) => onServiceChange(e.target.value)}
            className="block w-full pl-12 pr-10 py-3.5 text-sm bg-background/50 border-border/50 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all appearance-none border hover:border-primary/30 font-semibold text-primary"
          >
            {Object.entries(SERVICE_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-foreground/20">
            <ChevronRight className="w-4 h-4 rotate-90" />
          </div>
        </div>

        <div className="relative flex-1 group/select">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Calendar className="h-4 w-4 text-foreground/40 group-focus-within/select:text-primary transition-colors" />
          </div>
          <select
            value={selectedPeriodId}
            onChange={(e) => onPeriodChange(e.target.value)}
            className="block w-full pl-12 pr-10 py-3.5 text-sm bg-background/50 border-border/50 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all appearance-none border hover:border-primary/30"
          >
            <option value="ytd">Semua (YTD {selectedYear})</option>
            {periods.map(p => (
              <option key={p.id} value={p.id}>
                {MONTHS[p.month - 1]} {p.year}
              </option>
            ))}
            {periods.length === 0 && <option value="" disabled>Tidak ada periode</option>}
          </select>
          <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-foreground/20">
            <ChevronRight className="w-4 h-4 rotate-90" />
          </div>
        </div>

        <div className="relative flex-1 group/select">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Users className="h-4 w-4 text-foreground/40 group-focus-within/select:text-primary transition-colors" />
          </div>
          <select
            value={selectedFolderId}
            onChange={(e) => onFolderChange(e.target.value)}
            className="block w-full pl-12 pr-10 py-3.5 text-sm bg-background/50 border-border/50 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all appearance-none border hover:border-primary/30"
          >
            <option value="ALL">Semua Tim (Opsional)</option>
            {folders.map(f => (
              <option key={f.id} value={f.id}>
                Team {f.name}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-foreground/20">
            <ChevronRight className="w-4 h-4 rotate-90" />
          </div>
        </div>

        <div className="flex items-center bg-background/50 border border-border/50 rounded-2xl p-1.5 gap-1.5 shadow-inner">
          {(['3m', '6m', 'all'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => onTimeframeChange(tf)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                timeframe === tf 
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]' 
                  : 'hover:bg-foreground/5 text-foreground/40'
              }`}
            >
              {tf === '3m' ? '3 Bln' : tf === '6m' ? '6 Bln' : 'Semua'}
            </button>
          ))}
        </div>

        <div className="h-8 w-px bg-border mx-2 hidden md:block self-center" />
        
        <div className="shrink-0 w-[150px]">
          <YearSelector 
            years={availableYears} 
            selectedYear={selectedYear} 
            onYearChange={onYearChange} 
          />
        </div>
      </div>
    </div>
  );
}
