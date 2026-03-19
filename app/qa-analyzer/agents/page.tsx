'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Users, Search, Filter, ChevronRight, TrendingUp, TrendingDown, 
  Minus, AlertTriangle, Star, ArrowLeft, LayoutDashboard,
  CalendarDays, Settings, LogOut, Menu, Sun, Moon,
  MessageSquare, Mail, Phone, BarChart3, Activity, FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import { useAuth } from '@/app/lib/hooks/useAuth';
import { createClient } from '@/app/lib/supabase/client';
import Sidebar from "../../components/Sidebar";
import { qaService } from '../services/qaService';
import { scoreColor, scoreBg, scoreLabel } from '../lib/qa-types';

export default function AgentDirectoryPage() {
  const { user, profile, role, loading: authLoading } = useAuth(['trainer', 'trainers', 'leader']);
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const supabase = createClient();

  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedBatch, setSelectedBatch] = useState<string>('all');
  const [batches, setBatches] = useState<string[]>([]);

  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  useEffect(() => {
    async function init() {
      try {
        const { data: folderData } = await supabase.from('profiler_folders').select('name').order('created_at', { ascending: true });
        const batchList = (folderData ?? []).map(f => f.name);
        setBatches(batchList);

        // Fetch real agent scores instead of Math.random() placeholders
        const agentsWithScores = await qaService.getAgentListWithScores();
        setAgents(agentsWithScores);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    if (user) init();
  }, [user]);

  const filteredAgents = useMemo(() => {
    return agents.filter(a => {
      const matchSearch = a.nama.toLowerCase().includes(search.toLowerCase());
      const matchBatch = selectedBatch === 'all' || a.batch_name === selectedBatch;
      return matchSearch && matchBatch;
    });
  }, [agents, search, selectedBatch]);

  if (authLoading || !mounted) return null;

  return (
    <div className="min-h-screen bg-background text-foreground flex overflow-hidden">
      {/* Sidebar */}
      <Sidebar user={user} role={role} />

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-24 px-8 border-b border-border bg-card/30 backdrop-blur-xl flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-foreground">Direktori Agent</h1>
            <p className="text-sm font-medium text-foreground/40 uppercase tracking-widest mt-1">Analisis Performa Individu QA</p>
          </div>

          <div className="flex items-center gap-4">
             <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30 group-focus-within:text-primary transition-colors" />
              <input 
                type="text" 
                placeholder="Cari nama agent..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-80 h-12 pl-12 pr-4 bg-card border border-border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-8 bg-foreground/[0.02]">
          
          {/* Filters Row */}
          <div className="flex items-center gap-3 mb-8">
            <button 
              onClick={() => setSelectedBatch('all')}
              className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all border ${selectedBatch === 'all' ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20' : 'bg-card border-border text-foreground/60 hover:border-primary/40'}`}
            >
              Semua Batch
            </button>
            {batches.map(b => (
              <button 
                key={b}
                onClick={() => setSelectedBatch(b)}
                className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all border ${selectedBatch === b ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20' : 'bg-card border-border text-foreground/60 hover:border-primary/40'}`}
              >
                {b}
              </button>
            ))}
          </div>

          {loading ? (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
               {[...Array(8)].map((_, i) => (
                 <div key={i} className="bg-card border border-border rounded-[2.5rem] p-6 h-48 animate-pulse flex flex-col justify-between">
                   <div className="flex justify-between">
                     <div className="w-16 h-16 rounded-2xl bg-foreground/5" />
                     <div className="w-16 h-6 bg-foreground/5 rounded-lg" />
                   </div>
                   <div>
                     <div className="w-2/3 h-5 bg-foreground/5 rounded-full mb-2" />
                     <div className="w-1/3 h-3 bg-foreground/5 rounded-full" />
                   </div>
                   <div className="w-full border-t border-border mt-4 pt-4 flex justify-between">
                      <div className="w-12 h-4 bg-foreground/5 rounded-full" />
                      <div className="w-8 h-8 bg-foreground/5 rounded-xl" />
                   </div>
                 </div>
               ))}
             </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredAgents.map((agent, i) => (
                <motion.div
                  key={agent.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => router.push(`/qa-analyzer/agents/${agent.id}`)}
                  className="group relative bg-card border border-border rounded-[2.5rem] p-6 hover:shadow-2xl hover:shadow-primary/5 hover:border-primary/20 transition-all cursor-pointer overflow-hidden"
                >
                  {/* Background Glow */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-primary/10 transition-colors"/>
                  
                  <div className="flex items-start justify-between mb-6 relative z-10">
                    <div className="w-16 h-16 rounded-2xl bg-foreground/5 flex items-center justify-center border border-border group-hover:bg-primary/5 group-hover:border-primary/20 transition-all overflow-hidden shadow-inner relative">
                       {agent.foto_url ? (
                         <img src={agent.foto_url} alt={agent.nama} className="w-full h-full object-cover" />
                       ) : (
                         <Users className="w-8 h-8 text-foreground/20 group-hover:text-primary/40 transition-colors" />
                       )}
                    </div>
                    
                    <div className="flex flex-col items-end gap-2">
                       {agent.atRisk && (
                         <div className="px-2.5 py-1 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-1.5 shadow-sm">
                           <AlertTriangle className="w-3 h-3 text-red-500" />
                           <span className="text-[9px] font-black uppercase tracking-widest text-red-500">At Risk</span>
                         </div>
                       )}
                       {agent.avgScore !== null ? (
                         <div className={`text-lg font-black ${scoreColor(agent.avgScore)} tabular-nums flex items-center gap-1`}>
                           {agent.avgScore.toFixed(1)}
                           <span className="text-[10px] font-bold opacity-30">avg</span>
                         </div>
                       ) : (
                         <div className="px-3 py-1 bg-foreground/5 border border-border/50 rounded-xl text-[10px] font-bold text-foreground/40 mt-1 uppercase tracking-widest">Belum Audit</div>
                       )}
                    </div>
                  </div>

                  <div className="relative z-10 mb-6">
                    <h3 className="text-base font-bold text-foreground leading-tight group-hover:text-primary transition-colors">{agent.nama}</h3>
                    <div className="flex items-center gap-3 mt-1.5">
                      <p className="text-[10px] font-black uppercase tracking-widest text-foreground/30">{agent.batch_name}</p>
                      <div className="w-1 h-1 rounded-full bg-foreground/10"/>
                      <p className="text-[10px] font-black uppercase tracking-widest text-primary/60">{agent.tim}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-6 border-t border-border relative z-10">
                    <div className="flex items-center gap-1.5 min-h-[24px]">
                      {agent.trend !== 'none' && agent.trendValue !== null && agent.avgScore !== null ? (
                        agent.trend === 'up' ? (
                          <div className="p-1 px-2 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center gap-1">
                            <TrendingUp className="w-3 h-3 text-green-500" />
                            <span className="text-[10px] font-black text-green-500">+{agent.trendValue.toFixed(1)}%</span>
                          </div>
                        ) : agent.trend === 'down' ? (
                          <div className="p-1 px-2 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-1">
                            <TrendingDown className="w-3 h-3 text-red-500" />
                            <span className="text-[10px] font-black text-red-500">{agent.trendValue.toFixed(1)}%</span>
                          </div>
                        ) : (
                          <div className="p-1 px-2 rounded-lg bg-foreground/5 border border-foreground/10 flex items-center gap-1">
                            <Minus className="w-3 h-3 text-foreground/40" />
                            <span className="text-[10px] font-black text-foreground/40">Tetap</span>
                          </div>
                        )
                      ) : (
                         <div className="text-[10px] font-bold text-foreground/30 uppercase tracking-widest pl-1">-</div>
                      )}
                    </div>
                    
                    <button className="w-10 h-10 rounded-xl bg-foreground/5 flex items-center justify-center text-foreground/20 group-hover:bg-primary group-hover:text-primary-foreground transition-all shadow-sm">
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {!loading && filteredAgents.length === 0 && (
            <div className="text-center py-20 flex flex-col items-center justify-center">
              <div className="w-20 h-20 rounded-3xl bg-foreground/5 flex items-center justify-center mb-6">
                <Users className="w-10 h-10 text-foreground/10" />
              </div>
              <h4 className="text-xl font-bold text-foreground/40">Agent tidak ditemukan</h4>
              <p className="text-sm text-foreground/30 mt-2">Coba gunakan kata kunci pencarian atau filter batch yang berbeda</p>
              <button 
                onClick={() => { setSearch(''); setSelectedBatch('all'); }}
                className="mt-6 px-6 py-3 bg-primary/10 text-primary rounded-xl text-xs font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all shadow-sm"
              >
                Reset Filter
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
