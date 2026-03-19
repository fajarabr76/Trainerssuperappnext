import React from 'react';
import { Calendar, Users, Filter } from 'lucide-react';
import { QAPeriod } from '../../lib/qa-types';

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
}

export default function DashboardFilters({
  periods,
  selectedPeriodId,
  onPeriodChange,
  folders,
  selectedFolderId,
  onFolderChange,
  timeframe,
  onTimeframeChange
}: DashboardFiltersProps) {

  return (
    <div className="flex flex-col sm:flex-row gap-4 items-center bg-card p-4 rounded-2xl border border-border">
      <div className="flex items-center gap-2 text-foreground/60">
        <Filter className="w-5 h-5" />
        <span className="font-medium text-sm">Filter:</span>
      </div>
      
      <div className="flex-1 flex flex-col sm:flex-row gap-3 w-full">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Calendar className="h-4 w-4 text-foreground/40" />
          </div>
          <select
            value={selectedPeriodId}
            onChange={(e) => onPeriodChange(e.target.value)}
            className="block w-full pl-10 pr-10 py-2 text-sm border-border rounded-xl focus:ring-primary/20 focus:border-primary bg-background text-foreground appearance-none border"
          >
            <option value="ytd">YTD (Tahun Ini)</option>
            {periods.map(p => (
              <option key={p.id} value={p.id}>
                {MONTHS[p.month - 1]} {p.year}
              </option>
            ))}
            {periods.length === 0 && <option value="" disabled>Tidak ada periode</option>}
          </select>
        </div>

        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Users className="h-4 w-4 text-foreground/40" />
          </div>
          <select
            value={selectedFolderId}
            onChange={(e) => onFolderChange(e.target.value)}
            className="block w-full pl-10 pr-10 py-2 text-sm border-border rounded-xl focus:ring-primary/20 focus:border-primary bg-background text-foreground appearance-none border"
          >
            <option value="ALL">Semua Tim</option>
            {folders.map(f => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center bg-background border border-border rounded-xl p-1 gap-1">
          {(['3m', '6m', 'all'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => onTimeframeChange(tf)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                timeframe === tf 
                  ? 'bg-primary text-primary-foreground shadow-sm' 
                  : 'hover:bg-foreground/5 text-foreground/40'
              }`}
            >
              {tf === '3m' ? '3 Bln' : tf === '6m' ? '6 Bln' : 'Semua'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
