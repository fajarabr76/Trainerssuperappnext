'use client';

import React from 'react';
import { TrendingUp, Zap } from 'lucide-react';
import ParamTrendChart from '../../../dashboard/components/ParamTrendChart';
import type { TrendData, TrendDataset } from '../../../lib/qa-types';
import QaStatePanel from '../../../components/QaStatePanel';

const TREND_COLORS = [
  '#A855F7', // Purple
  '#EC4899', // Pink
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#06B6D4'  // Cyan
];

interface AgentTrendTabProps {
  loadingTrend: boolean;
  personalTrend: TrendData;
  timeframe: '3m' | '6m' | 'all';
  activeTrendFilter: string;
  onTimeframeChange: (tf: '3m' | '6m' | 'all') => void;
  onFilterChange: (filter: string) => void;
}

export default function AgentTrendTab({
  loadingTrend,
  personalTrend,
  timeframe,
  activeTrendFilter,
  onTimeframeChange,
  onFilterChange
}: AgentTrendTabProps) {
  if (loadingTrend) {
    return (
      <div className="bg-card/40 backdrop-blur-sm rounded-[2.5rem] border border-border/50 p-10 h-[550px] flex items-center justify-center">
        <QaStatePanel
          type="loading"
          title="Memuat tren performa agent"
          description="Data histori audit sedang disiapkan."
          className="w-full max-w-lg"
        />
      </div>
    );
  }

  return (
    <div className="bg-card/40 backdrop-blur-sm rounded-[2.5rem] border border-border/50 p-10 shadow-2xl shadow-primary/5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-10 gap-6">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground mb-2">
            <TrendingUp className="w-3.5 h-3.5" /> Performance Analytics
          </div>
          <h3 className="text-3xl font-black tracking-tighter">Personal Scoring Trend</h3>
          <p className="text-[10px] text-muted-foreground font-bold mt-2 uppercase tracking-widest">Aggregate historical data & all audited parameters</p>
        </div>
        <div className="flex p-1.5 bg-foreground/5 dark:bg-foreground/[0.03] border border-border/50 rounded-2xl w-fit shadow-inner">
          {(['3m', '6m', 'all'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => onTimeframeChange(tf)}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
                timeframe === tf 
                  ? 'bg-primary text-white shadow-xl shadow-primary/20' 
                  : 'text-muted-foreground hover:text-muted-foreground hover:bg-foreground/5'
              }`}
            >
              {tf === '3m' ? '3 Months' : tf === '6m' ? '6 Months' : 'All Time'}
            </button>
          ))}
        </div>
      </div>

      {personalTrend && personalTrend.labels.length > 0 ? (
        <>
          <div className="flex flex-wrap gap-2 mb-10">
            <button
              onClick={() => onFilterChange('all')}
              className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all duration-500 border-2 ${
                activeTrendFilter === 'all' 
                  ? 'bg-primary border-primary text-white shadow-xl shadow-primary/20 scale-105' 
                  : 'bg-card/40 border-border/50 text-muted-foreground hover:border-foreground/20 hover:text-muted-foreground'
              }`}
            >
              Overall Trend
            </button>
            {personalTrend.datasets.map((ds: TrendDataset, i: number) => {
              const isActive = activeTrendFilter === ds.label;
              const color = ds.isTotal ? 'hsl(var(--primary))' : TREND_COLORS[i % TREND_COLORS.length];
              
              return (
                <button
                  key={ds.label}
                  onClick={() => onFilterChange(ds.label)}
                  className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all duration-500 border-2 flex items-center gap-2 ${
                    isActive 
                      ? 'bg-primary border-primary text-white shadow-xl shadow-primary/20 scale-105' 
                      : 'bg-card/40 border-border/50 text-muted-foreground hover:border-foreground/20 hover:text-muted-foreground'
                  }`}
                >
                  <div 
                    className="w-1.5 h-1.5 rounded-full" 
                    style={{ backgroundColor: isActive ? 'white' : color }} 
                  />
                  {ds.label}
                </button>
              );
            })}
          </div>

          <div className="h-[400px] w-full relative rounded-[2rem] border border-border/40 bg-background/60 dark:bg-white/[0.04] p-3 shadow-inner">
            <ParamTrendChart 
              data={personalTrend} 
              filterLabel={activeTrendFilter} 
              showParameters={true}
            />
          </div>
          
          <div className="mt-10 pt-10 border-t border-border/50 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-3xl bg-foreground/[0.02] border border-border/30">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">Volume Activity</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black tracking-tight">{personalTrend.labels.length}</span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Active Periods</span>
              </div>
            </div>
            <div className="md:col-span-2 p-6 rounded-3xl bg-primary/5 border border-primary/10 flex items-center gap-6">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <Zap className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-primary/40 mb-1">Trend Insight</p>
                <p className="text-sm font-medium text-foreground/70 leading-relaxed italic">
                  Visualizing scoring progress across different dimensions of service quality.
                </p>
              </div>
            </div>
          </div>
        </>
      ) : (
        <QaStatePanel
          type="empty"
          title="Belum ada histori tren"
          description="Tren akan muncul setelah data audit tersedia pada periode yang dipilih."
        />
      )}
    </div>
  );
}
