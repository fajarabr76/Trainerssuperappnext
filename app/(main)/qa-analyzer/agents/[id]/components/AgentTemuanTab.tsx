'use client';

import { BarChart2, ShieldCheck, Edit2, Trash2, Loader2, ChevronRight, AlertCircle } from 'lucide-react';
import type { QATemuan } from '../../../lib/qa-types';

interface AgentTemuanTabProps {
  groupedTemuan: { urutan: number; no_tiket: string | null; items: QATemuan[] }[];
  selectedPeriod: { month: number; year: number; label: string; serviceType: string; id?: string } | null;
  role: string;
  loadingTemuan: boolean;
  currentPage: number;
  hasMore: boolean;
  deletingId: string | null;
  onStartEdit: (t: QATemuan) => void;
  onDelete: (id: string) => void;
  onPageChange: (page: number) => void;
}

function NilaiBadge({ nilai }: { nilai: number }) {
  const variants: Record<0 | 1 | 2 | 3, { bg: string; text: string; shadow: string; label: string }> = {
    3: { bg: 'bg-emerald-500', text: 'text-emerald-500', shadow: 'shadow-emerald-500/40', label: 'EXCELLENT' },
    2: { bg: 'bg-blue-500',    text: 'text-blue-500',    shadow: 'shadow-blue-500/40',    label: 'GOOD' },
    1: { bg: 'bg-amber-500',   text: 'text-amber-500',   shadow: 'shadow-amber-500/40',   label: 'DEFICIT' },
    0: { bg: 'bg-rose-500',    text: 'text-rose-500',    shadow: 'shadow-rose-500/40',    label: 'CRITICAL' }
  };
  const v = variants[nilai as 0 | 1 | 2 | 3] ?? variants[0];
  
  return (
    <div className="flex flex-col items-center gap-1.5 shrink-0 group/badge">
      <div className={`w-12 h-12 rounded-2xl ${v.bg} ${v.shadow} flex items-center justify-center text-white text-xl font-black shadow-xl transition-transform duration-500 group-hover/badge:scale-110 group-hover/badge:-rotate-6`}>
        {nilai}
      </div>
      <span className={`text-[8px] font-black tracking-[0.2em] ${v.text} opacity-60`}>
        {v.label}
      </span>
    </div>
  );
}

export default function AgentTemuanTab({
  groupedTemuan,
  selectedPeriod,
  role,
  loadingTemuan,
  currentPage,
  hasMore,
  deletingId,
  onStartEdit,
  onDelete,
  onPageChange
}: AgentTemuanTabProps) {
  return (
    <div className={`relative bg-card/40 backdrop-blur-sm rounded-[3rem] border border-border/50 overflow-hidden shadow-2xl shadow-black/5 transition-opacity duration-300 ${loadingTemuan ? 'opacity-60 pointer-events-none' : ''}`}>
      {loadingTemuan && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/5">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin shadow-2xl" />
        </div>
      )}

      <div className="px-10 py-10 border-b border-border/50 flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-foreground/[0.01]">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground mb-2">
            <BarChart2 className="w-3.5 h-3.5" /> Itemized Observations
          </div>
          <h3 className="text-3xl font-black tracking-tighter">Audit Discovery Detail</h3>
        </div>
        {selectedPeriod && (
          <div className="px-6 py-2.5 bg-background/50 border border-border/50 rounded-2xl text-[10px] font-black uppercase tracking-widest text-muted-foreground shadow-inner">
            Active Filter: <span className="text-foreground font-black ml-1 uppercase">{selectedPeriod.label}</span>
          </div>
        )}
      </div>

      <div className="divide-y divide-border/50">
        {groupedTemuan.length === 0 ? (
          <div className="px-10 py-24 text-center">
            <div className="w-20 h-20 rounded-[2.5rem] bg-foreground/5 flex items-center justify-center mx-auto mb-6">
              <ShieldCheck className="w-10 h-10 text-foreground/10" />
            </div>
            <h4 className="text-xl font-black text-muted-foreground uppercase tracking-tighter">No issues found in this period</h4>
            <p className="text-[10px] text-muted-foreground mt-3 font-black uppercase tracking-widest leading-loose">Excellent record of service quality maintained</p>
          </div>
        ) : (
          groupedTemuan.map((group) => (
            <div key={group.no_tiket || `audit-${group.urutan}`} className="group/audit overflow-hidden">
              <div className="flex items-center justify-between px-10 py-6 bg-foreground/[0.03] border-b border-border/10 group-hover/audit:bg-foreground/[0.05] transition-colors relative">
                <div className="flex items-center gap-5">
                  <div className="w-10 h-10 rounded-2xl bg-primary text-white flex items-center justify-center text-sm font-black shadow-lg shadow-primary/30">
                    {group.urutan}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground leading-none mb-1.5">Reference / Ticket ID</span>
                    <span className="text-sm font-black font-mono tracking-tight text-foreground/70">{group.no_tiket || 'INTERNAL PERFORMANCE AUDIT'}</span>
                  </div>
                </div>
                <div className="px-5 py-2 rounded-2xl bg-background/80 border border-border/50 text-[10px] font-black uppercase tracking-widest text-muted-foreground shadow-sm flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                  {group.items.length} Evaluated Parameter{group.items.length > 1 ? 's' : ''}
                </div>
              </div>

              <div className="divide-y divide-border/20 bg-card/10">
                {group.items.map((t: QATemuan) => {
                  const isCritical = t.qa_indicators?.category === 'critical';
                  const isDeficit = t.nilai < 3;
                  const hasRekomendasi = !!t.sebaiknya && t.sebaiknya.trim().length > 0;
                  
                  return (
                    <div key={t.id} className="px-10 py-10 flex flex-col md:flex-row items-start gap-10 hover:bg-foreground/[0.01] transition-all duration-300 group/item">
                      <NilaiBadge nilai={t.nilai} />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-6 mb-6">
                          <div>
                            <div className="flex items-center gap-3 mb-2">
                              <div className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${isCritical ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'}`}>
                                {isCritical ? 'Critical Compliance' : 'General Quality'}
                              </div>
                              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                                Indicator Name
                              </span>
                            </div>
                            <h4 className="text-xl font-black tracking-tighter text-foreground leading-none">{t.qa_indicators?.name}</h4>
                          </div>
                          
                          {role !== 'leader' && (
                            <div className="flex gap-2 opacity-0 group-hover/item:opacity-100 transition-opacity">
                              <button 
                                onClick={() => onStartEdit(t)} 
                                className="w-10 h-10 bg-blue-500/5 hover:bg-blue-500 hover:text-white border border-blue-500/20 rounded-xl text-blue-500 flex items-center justify-center transition-all duration-300 shadow-sm"
                                title="Edit Observation"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => onDelete(t.id)} 
                                disabled={deletingId === t.id}
                                className="w-10 h-10 bg-rose-500/5 hover:bg-rose-500 hover:text-white border border-rose-500/20 rounded-xl text-rose-500 flex items-center justify-center transition-all duration-300 shadow-sm disabled:opacity-50"
                                title="Delete Record"
                              >
                                {deletingId === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <div className={`space-y-3 p-6 rounded-3xl bg-foreground/[0.02] border border-border/30 transition-all duration-500 ${isDeficit ? 'hover:border-amber-500/30' : 'hover:border-foreground/20'}`}>
                            <div className="flex items-center gap-2 mb-1">
                              <AlertCircle className="w-3 h-3 text-muted-foreground" />
                              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">Observation / Gap Analysis</p>
                            </div>
                            <p className="text-sm text-foreground/70 leading-relaxed font-medium">
                              {t.ketidaksesuaian || 'No specific discrepancy noted for this parameter.'}
                            </p>
                          </div>
                          <div className={`space-y-3 p-6 rounded-3xl transition-all duration-500 ${hasRekomendasi ? 'bg-primary/5 border border-primary/20 hover:border-primary/40' : 'bg-foreground/[0.01] border border-border/20 blur-[0.5px] grayscale opacity-50'}`}>
                            <div className="flex items-center gap-2 mb-1">
                              <ShieldCheck className="w-3 h-3 text-primary/40" />
                              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-primary/40">Strategic Recommendation</p>
                            </div>
                            <p className="text-sm text-foreground/80 leading-relaxed font-bold italic">
                              {t.sebaiknya || 'Maintain current standards and consistency.'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="px-10 py-10 bg-card/60 backdrop-blur-xl border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex flex-col">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground mb-1">Observation History</p>
          <div className="flex items-center gap-3">
            <span className="text-2xl font-black tabular-nums">{groupedTemuan.reduce((acc, g) => acc + g.items.length, 0)}</span>
            <div className="h-4 w-[1px] bg-border/50" />
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{hasMore ? 'Incremental loading enabled' : 'All records loaded'}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={!hasMore || loadingTemuan}
            className="h-12 px-8 flex items-center gap-2 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 disabled:opacity-30 disabled:scale-100 transition-all font-black"
          >
            {loadingTemuan ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>Load More Findings <ChevronRight className="w-4 h-4" /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
