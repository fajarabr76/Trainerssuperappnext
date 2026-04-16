'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { 
  Users, Search, ChevronRight, TrendingUp, TrendingDown, 
  Minus
} from 'lucide-react';
import { motion } from 'motion/react';
import { scoreColor } from "../../lib/qa-types";
import type { AgentDirectoryEntry } from "../../lib/qa-types";
import QaStatePanel from '../../components/QaStatePanel';

interface AgentDirectoryClientProps {
  user: any;
  role: string;
  initialAgents: AgentDirectoryEntry[];
  initialBatches: string[];
}

export default function AgentDirectoryClient({ 
  user, 
  role, 
  initialAgents,
  initialBatches
}: AgentDirectoryClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [selectedBatch, setSelectedBatch] = useState<string>('all');
  const [visibleCount, setVisibleCount] = useState(24);

  const filteredAgents = useMemo(() => {
    return initialAgents.filter(a => {
      const matchSearch = a.nama.toLowerCase().includes(search.toLowerCase());
      const matchBatch = selectedBatch === 'all' || a.batch_name === selectedBatch;
      return matchSearch && matchBatch;
    });
  }, [initialAgents, search, selectedBatch]);

  const visibleAgents = useMemo(() => filteredAgents.slice(0, visibleCount), [filteredAgents, visibleCount]);

  useEffect(() => {
    setVisibleCount(24);
  }, [search, selectedBatch]);

  const getSafeNumber = (value: unknown) => {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  };

  return (
    <>
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="px-4 py-4 border-b border-border/50 bg-background/80 backdrop-blur-xl flex flex-col gap-4 sm:h-28 sm:px-6 lg:px-10 sm:py-0 sm:flex-row sm:items-center sm:justify-between shrink-0 relative z-20">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">
              <Users className="w-3 h-3" /> SIDAK
            </div>
            <h1 className="text-3xl font-black tracking-tighter text-foreground">Direktori Agent</h1>
          </div>

          <div className="flex items-center gap-6 w-full sm:w-auto">
             <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-all duration-300" />
              <input 
                type="text" 
                placeholder="Cari nama agent..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full sm:w-72 lg:w-96 h-12 pl-12 pr-4 bg-foreground/5 border border-border/50 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-background transition-all"
              />
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-foreground/[0.02]">
          <div className="flex items-center gap-2 mb-10 overflow-x-auto pb-2 no-scrollbar">
            <button 
              onClick={() => setSelectedBatch('all')}
              className={`px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border shrink-0 ${selectedBatch === 'all' ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' : 'bg-background border-border/50 text-muted-foreground hover:border-primary/40'}`}
            >
              Semua Batch
            </button>
            {initialBatches.map(b => (
              <button 
                key={b}
                onClick={() => setSelectedBatch(b)}
                className={`px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border shrink-0 ${selectedBatch === b ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' : 'bg-background border-border/50 text-muted-foreground hover:border-primary/40'}`}
              >
                {b}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
            {visibleAgents.map((agent, i) => {
              const safeAvgScore = getSafeNumber(agent.avgScore);
              const safeTrendValue = getSafeNumber(agent.trendValue);

              return (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: Math.min(i, 8) * 0.02, duration: 0.28 }}
                onClick={() => router.push(`/qa-analyzer/agents/${agent.id}`)}
                className="group relative bg-card/40 backdrop-blur-sm border border-border/50 rounded-[2rem] p-6 hover:shadow-3xl hover:shadow-primary/10 hover:border-primary/30 transition-all duration-500 cursor-pointer overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-primary/20 transition-all duration-700"/>
                
                <div className="flex items-start justify-between mb-8 relative z-10">
                  <div className="w-16 h-16 rounded-2xl bg-foreground/5 p-0.5 border border-border/50 group-hover:border-primary/30 transition-all duration-500 overflow-hidden shadow-inner flex items-center justify-center">
                      {agent.foto_url ? (
                        <Image
                          src={agent.foto_url}
                          alt={agent.nama}
                          width={64}
                          height={64}
                          className="w-full h-full object-cover rounded-xl"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <Users className="w-8 h-8 text-muted-foreground/30 group-hover:text-primary/20 transition-colors" />
                      )}
                  </div>
                  
                  <div className="flex flex-col items-end gap-2">
                      {agent.atRisk ? (
                        <div className="px-2.5 py-1 bg-rose-500/10 border border-rose-500/20 rounded-full flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                          <span className="text-[9px] font-black uppercase tracking-widest text-rose-500">At Risk</span>
                        </div>
                      ) : safeAvgScore !== null ? (
                        <div className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500">Compliant</span>
                        </div>
                      ) : null}
                      {safeAvgScore !== null ? (
                        <div className={`text-xl font-black tabular-nums tracking-tighter ${scoreColor(safeAvgScore).includes('green') ? 'text-emerald-500' : scoreColor(safeAvgScore).includes('amber') ? 'text-amber-500' : 'text-rose-500'}`}>
                          {safeAvgScore.toFixed(1)}%
                        </div>
                      ) : (
                      <div className="px-3 py-1 bg-foreground/5 border border-border/20 rounded-full text-[9px] font-black text-muted-foreground mt-1 uppercase tracking-widest leading-none">Not Audited</div>
                      )}
                  </div>
                </div>

                <div className="relative z-10 mb-8">
                  <h3 className="text-base font-black text-foreground group-hover:text-primary transition-colors leading-tight line-clamp-1">{agent.nama}</h3>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{agent.batch_name}</span>
                    <div className="w-1 h-1 rounded-full bg-foreground/10"/>
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary/40 truncate">{agent.tim}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-6 border-t border-border/30 relative z-10">
                  <div className="flex items-center gap-1.5">
                    {agent.trend !== 'none' && safeTrendValue !== null && safeAvgScore !== null ? (
                      agent.trend === 'up' ? (
                        <div className="flex items-center gap-1 text-emerald-500">
                          <TrendingUp className="w-3 h-3" />
                          <span className="text-[10px] font-black">+{safeTrendValue.toFixed(1)}%</span>
                        </div>
                      ) : agent.trend === 'down' ? (
                        <div className="flex items-center gap-1 text-rose-500">
                          <TrendingDown className="w-3 h-3" />
                          <span className="text-[10px] font-black">{safeTrendValue.toFixed(1)}%</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Minus className="w-3 h-3" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Steady</span>
                        </div>
                      )
                    ) : (
                        <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">No Trend</div>
                    )}
                  </div>
                  
                  <div className="w-8 h-8 rounded-full bg-foreground/5 flex items-center justify-center text-muted-foreground group-hover:bg-primary group-hover:text-white transition-all duration-500">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </motion.div>
            )})}
          </div>

          {filteredAgents.length === 0 && (
            <QaStatePanel
              type="empty"
              title="Data agen tidak ditemukan"
              description="Coba ubah kata kunci pencarian atau ganti filter batch."
              className="mx-auto my-16 max-w-xl"
              action={
                <button 
                  onClick={() => { setSearch(''); setSelectedBatch('all'); }}
                  className="mt-1 px-4 py-2 bg-primary/10 text-primary rounded-xl text-xs font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all shadow-sm"
                >
                  Reset Filter
                </button>
              }
            />
          )}

          {filteredAgents.length > visibleAgents.length && (
            <div className="mt-10 flex justify-center">
              <button
                onClick={() => setVisibleCount((count) => count + 24)}
                className="px-6 py-3 bg-primary/10 text-primary rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all shadow-sm"
              >
                Muat 24 Agent Lagi
              </button>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
