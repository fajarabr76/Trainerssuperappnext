'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity, ArrowLeft, Sun, Moon, ExternalLink,
  Download, Plus, ShieldCheck, TrendingUp, TrendingDown, Minus, Zap,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { User } from '@supabase/supabase-js';

// Types & Hooks
import { 
  scoreColor, scoreBg, scoreLabel 
} from '../../lib/qa-types';
import type { Agent, AgentDetailData } from '../../lib/qa-types';
import { useAgentDetail } from './hooks/useAgentDetail';

// Components
import { YearSelector } from '../../dashboard/components/YearSelector';
import AgentTrendTab from './components/AgentTrendTab';
import AgentTemuanTab from './components/AgentTemuanTab';
import { EditTemuanModal } from './components/EditTemuanModal';
import QaStatePanel from '../../components/QaStatePanel';

function TabSkeleton() {
  return (
    <div className="w-full h-[400px] bg-card/20 animate-pulse rounded-[2.5rem] flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );
}

const hitungMasaDinas = (bergabungDate: string): string => {
  if (!bergabungDate) return '-';
  const bergabung = new Date(bergabungDate);
  const now = new Date();
  let years = now.getFullYear() - bergabung.getFullYear();
  let months = now.getMonth() - bergabung.getMonth();
  if (months < 0) { years--; months += 12; }
  return `${years} thn ${months} bln`;
};

const getPeriodKey = (month: number, year: number) => `${month}-${year}`;

interface QaAgentDetailClientProps {
  agentId: string;
  user: User;
  role: string;
  initialAgent: Agent;
  initialData: AgentDetailData;
}

export default function QaAgentDetailClient({ 
  agentId, 
  user, 
  role, 
  initialAgent, 
  initialData 
}: QaAgentDetailClientProps) {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  const {
    // State
    loadingTemuan,
    loadingTrend,
    exporting,
    selectedPeriod,
    setSelectedPeriod,
    timeframe,
    activeSection,
    trendMounted,
    temuanMounted,
    activeTrendFilter,
    setActiveTrendFilter,
    agent,
    selectedYear,
    currentPage,
    hasMore,
    scrollContainerRef,
    editingTemuan,
    editForm,
    setEditForm,
    isSubmitting,
    deletingId,
    availableYears,
    
    // Computed
    temuan,
    personalTrend,
    sortedPeriods,
    selectedScore,
    prevScore,
    trendDir,
    automatedCoaching,
    groupedTemuan,
    
    // Actions
    scrollToSection,
    startEdit,
    handleEditSave,
    handleDelete,
    handleYearChange,
    handlePageChange,
    handleTimeframeChange,
    handleExport,
    handleTambahTemuan,
    setEditingTemuan
  } = useAgentDetail({
    agentId,
    user,
    role,
    initialAgent,
    initialData
  });

  return (
    <>
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="h-20 flex items-center justify-between px-8 bg-background/80 backdrop-blur-xl border-b border-border/50 sticky top-0 z-40">
          <button 
            onClick={() => router.push('/qa-analyzer/agents')} 
            className="w-10 h-10 rounded-xl bg-foreground/5 hover:bg-primary hover:text-white flex items-center justify-center text-muted-foreground transition-all duration-300 shadow-sm group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          </button>
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground leading-none mb-1">
              <Activity className="w-3 h-3" /> SIDAK
            </div>
            <h1 className="text-lg font-black tracking-tight">Detail Kinerja Agen</h1>
          </div>
          <div className="flex items-center gap-4">
            {mounted && (
              <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="w-10 h-10 rounded-xl hover:bg-foreground/5 text-muted-foreground border border-border/50 flex items-center justify-center transition-all bg-card/50">
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto" ref={scrollContainerRef}>
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Profile Bar */}
            <div className="bg-card/40 border-b border-border/50 px-10 py-6 backdrop-blur-xl relative z-30">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                <div className="flex items-center gap-6">
                  <div className="h-12 w-4 flex-shrink-0" />
                  
                  <div className="relative">
                    {agent.foto_url ? (
                      <div className="h-20 w-20 rounded-[1.5rem] p-1 border-2 border-primary/20 bg-background overflow-hidden shadow-2xl shadow-primary/10">
                        <img src={agent.foto_url} alt={agent.nama} className="h-full w-full rounded-xl object-cover" />
                      </div>
                    ) : (
                      <div className="h-20 w-20 rounded-[1.5rem] bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center text-white text-2xl font-black shadow-2xl shadow-primary/20">
                        {agent.nama.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-emerald-500 border-4 border-card flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-3xl font-black tracking-tighter text-foreground leading-none">
                        {agent.nama}
                      </h2>
                      <Link 
                        href={`/profiler/table?batch=${agent.batch}`}
                        className="w-8 h-8 rounded-full bg-foreground/5 hover:bg-primary/10 flex items-center justify-center text-muted-foreground hover:text-primary transition-all duration-300"
                        title="Lihat Profil Lengkap"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <div className="px-3 py-1 bg-foreground/5 border border-border/50 rounded-full text-[10px] font-black uppercase tracking-widest text-muted-foreground leading-none">
                        {agent.tim}
                      </div>
                      <div className="px-3 py-1 bg-foreground/5 border border-border/50 rounded-full text-[10px] font-black uppercase tracking-widest text-muted-foreground leading-none">
                        {agent.batch}
                      </div>
                      {agent.jabatan && (
                        <div className="px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-[10px] font-black uppercase tracking-widest text-primary leading-none">
                          {agent.jabatan.replace('_',' ')}
                        </div>
                      )}
                      {agent.bergabung_date && (
                        <div className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-[10px] font-black uppercase tracking-widest text-amber-600 leading-none">
                          Masa Kerja: {hitungMasaDinas(agent.bergabung_date)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleExport}
                    disabled={exporting}
                    className="h-11 px-5 flex items-center gap-2 bg-primary/10 text-primary border border-primary/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all duration-300 disabled:opacity-50 shadow-sm"
                  >
                    {exporting ? <Activity className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                    {exporting ? 'Mengekspor...' : 'Ekspor'}
                  </button>

                  {role === 'admin' && (
                    <button
                      onClick={handleTambahTemuan}
                      className="h-11 px-5 flex items-center gap-2 bg-foreground text-background rounded-xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all shadow-md shadow-foreground/10"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Tambah Temuan
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Unified Sticky Control Bar */}
            <div className="sticky top-20 z-40 bg-background/60 backdrop-blur-md px-10 py-4 border-b border-border/40">
              <div className="flex flex-col md:flex-row md:items-center justify-center gap-6 max-w-4xl mx-auto">
                {/* Navigation Tabs */}
                <div className="flex items-center gap-1.5 p-1 bg-foreground/[0.03] border border-border/40 rounded-2xl shadow-inner-sm">
                  {[
                    { id: 'section-summary', label: 'Summary', key: 'summary' },
                    { id: 'section-trend', label: 'Trend', key: 'trend' },
                    { id: 'section-temuan', label: 'Findings', key: 'temuan' }
                  ].map((tab) => {
                    const isActive = activeSection === tab.key;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => scrollToSection(tab.id)}
                        className={`relative px-6 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors duration-300 ${
                          isActive ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <span className="relative z-10">{tab.label}</span>
                        {isActive && (
                          <motion.div
                            layoutId="active-tab-pill"
                            className="absolute inset-0 bg-primary rounded-xl shadow-md z-0"
                            transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Vertical Divider for Desktop */}
                <div className="hidden md:block w-px h-8 bg-border/40" />

                {/* Context & Filters */}
                {selectedPeriod && (
                  <div className="flex items-center gap-2 bg-card/40 border border-border/40 rounded-2xl p-1 shadow-sm">
                    {/* Year Selection Group */}
                    <div className="flex items-center gap-2 px-3 py-1.5 border-r border-border/40">
                      <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Year</span>
                      <YearSelector 
                        years={availableYears} 
                        selectedYear={selectedYear} 
                        onYearChange={handleYearChange}
                      />
                    </div>
                    
                    {/* Period Context Group */}
                    <div className="flex items-center gap-3 px-3 py-1.5">
                      <div className="px-2 py-1 bg-primary/10 border border-primary/20 rounded-lg text-[9px] font-black text-primary uppercase tracking-widest">
                        {selectedPeriod.serviceType}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground leading-none mb-0.5">Period</span>
                        <span className="text-[12px] font-black tracking-tight text-foreground/80">{selectedPeriod.label}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
              {temuan.length === 0 ? (
                <div className="bg-card rounded-3xl border border-border p-12 text-center">
                  <QaStatePanel
                    type="empty"
                    title="Belum ada data evaluasi"
                    description="Agent ini belum memiliki histori audit pada periode yang tersedia."
                    className="mx-auto max-w-lg"
                    action={
                      <button 
                        onClick={handleTambahTemuan} 
                        className="mt-1 px-6 py-2.5 bg-primary text-primary-foreground rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-primary/20 transition-all hover:opacity-95"
                      >
                        Mulai Evaluasi
                      </button>
                    }
                  />
                </div>
              ) : (
                <div className="space-y-12">
                  {/* Summary Section */}
                  <div id="section-summary">
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      className="space-y-8"
                    >
                      {sortedPeriods.length > 0 && (
                        <div className="flex flex-wrap gap-2 bg-card/40 backdrop-blur-md rounded-2xl border border-border/50 p-2 shadow-sm">
                          {sortedPeriods.map(p => {
                            const isActive = getPeriodKey(p.month, p.year) === getPeriodKey(selectedPeriod?.month || 0, selectedPeriod?.year || 0) && p.serviceType === selectedPeriod?.serviceType;
                            return (
                              <button 
                                key={`${getPeriodKey(p.month, p.year)}_${p.serviceType}`} 
                                onClick={() => setSelectedPeriod(p)} 
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all duration-300 ${
                                  isActive 
                                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-105' 
                                    : 'hover:bg-foreground/5 text-muted-foreground'
                                }`}
                              >
                                {p.label}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {selectedScore && selectedPeriod && (
                        <div className="space-y-8">
                          {/* Score Card */}
                          <div className="bg-card/40 backdrop-blur-sm rounded-[2.5rem] border border-border/50 p-10 relative overflow-hidden group shadow-2xl shadow-primary/5">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full -mr-32 -mt-32 blur-[100px] group-hover:bg-primary/20 transition-all duration-1000" />
                            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-10 relative z-10">
                              <div>
                                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground mb-4">
                                  <ShieldCheck className="w-3.5 h-3.5" /> Quality Assurance Score
                                </div>
                                <div className="flex items-baseline gap-4">
                                  <h1 className={`text-9xl font-black tracking-tighter leading-none ${
                                    scoreColor(selectedScore.finalScore).includes('green') ? 'text-emerald-500' : 
                                    scoreColor(selectedScore.finalScore).includes('amber') ? 'text-amber-500' : 
                                    'text-rose-500'
                                  }`}>
                                    {selectedScore.finalScore.toFixed(1)}
                                    <span className="text-4xl ml-1">%</span>
                                  </h1>
                                  <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${scoreBg(selectedScore.finalScore)} text-white shadow-2xl shadow-current/30`}>
                                    {scoreLabel(selectedScore.finalScore)}
                                  </div>
                                </div>
                              </div>
                              <div className="text-left lg:text-right space-y-6">
                                <div className="flex flex-col lg:items-end">
                                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-1">Audit Samples</span>
                                  <span className="text-4xl font-black tracking-tighter tabular-nums text-foreground/80">
                                    {selectedScore.sessionCount} <span className="text-sm font-bold text-muted-foreground ml-1 tracking-normal">Tickets</span>
                                  </span>
                                </div>
                                {trendDir !== 'none' && (
                                  <div className={`flex items-center lg:justify-end gap-2 font-black text-sm p-3 rounded-2xl bg-foreground/[0.03] border border-border/30 ${
                                    trendDir === 'up' ? 'text-emerald-500' : 
                                    trendDir === 'down' ? 'text-rose-500' : 
                                    'text-muted-foreground'
                                  }`}>
                                    {trendDir === 'up' ? <TrendingUp className="w-5 h-5" /> : 
                                     trendDir === 'down' ? <TrendingDown className="w-5 h-5" /> : 
                                     <Minus className="w-5 h-5" />}
                                    <span className="tracking-tight">
                                      {trendDir === 'up' ? '+' : ''}{(selectedScore.finalScore - (prevScore?.finalScore || 0)).toFixed(1)}% performance drift
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="mt-12 space-y-6">
                              <div className="h-2.5 bg-foreground/5 rounded-full overflow-hidden border border-border/50 p-0.5">
                                <motion.div 
                                  initial={{ width: 0 }} 
                                  animate={{ width: `${selectedScore.finalScore}%` }} 
                                  className={`h-full rounded-full ${scoreBg(selectedScore.finalScore)} shadow-lg shadow-current/40`} 
                                />
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="bg-background/40 backdrop-blur-sm border border-border/50 rounded-[1.5rem] p-6 transition-all duration-500 hover:border-blue-500/30 group/nc">
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className="w-2 h-2 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50" />
                                    <p className="text-[9px] font-black uppercase tracking-widest text-blue-500/60">Non-Critical Achievement</p>
                                  </div>
                                  <p className="text-4xl font-black tracking-tighter text-foreground/80">{selectedScore.nonCriticalScore.toFixed(1)}%</p>
                                </div>
                                <div className="bg-background/40 backdrop-blur-sm border border-border/50 rounded-[1.5rem] p-6 transition-all duration-500 hover:border-rose-500/30 group/cr">
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className="w-2 h-2 rounded-full bg-rose-500 shadow-lg shadow-rose-500/50" />
                                    <p className="text-[9px] font-black uppercase tracking-widest text-rose-500/60">Critical Compliance</p>
                                  </div>
                                  <p className="text-4xl font-black tracking-tighter text-foreground/80">{selectedScore.criticalScore.toFixed(1)}%</p>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Insights Section */}
                          <AnimatePresence mode="wait">
                            {automatedCoaching && (
                              <motion.div 
                                initial={{ opacity: 0, y: 30 }} 
                                animate={{ opacity: 1, y: 0 }} 
                                exit={{ opacity: 0, y: -30 }}
                                className="group relative bg-indigo-600 rounded-[2.5rem] p-10 text-white overflow-hidden shadow-2xl shadow-indigo-600/30"
                              >
                                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-[100px]" />
                                <div className="absolute -right-8 -bottom-8 opacity-[0.05] rotate-12"><Zap className="w-64 h-64" /></div>
                                
                                <div className="flex items-center gap-4 mb-8">
                                  <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-xl">
                                    <Zap className="w-6 h-6 text-white" />
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/80 leading-none mb-2">Automated Smart Insight</p>
                                    <h4 className="text-2xl font-black tracking-tighter leading-none">Focus Area: {automatedCoaching.parameter}</h4>
                                  </div>
                                </div>
                                
                                <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-[1.5rem] p-8 mb-8">
                                  <p className="text-lg font-medium leading-relaxed italic text-white/90">
                                    &quot;{automatedCoaching.recommendation}&quot;
                                  </p>
                                </div>

                                <div className="flex flex-wrap gap-8">
                                  <div className="space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Priority Level</p>
                                    <div className={`text-xs font-black px-3 py-1 rounded-full border ${
                                      automatedCoaching.isCritical 
                                        ? 'bg-white text-rose-600 border-white' 
                                        : 'bg-indigo-500/50 text-white border-white/30'
                                    }`}>
                                      {automatedCoaching.isCritical ? 'CRITICAL RISK' : 'OPPORTUNITY'}
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Recurrence</p>
                                    <div className="text-sm font-black tracking-tight">{automatedCoaching.count} Incident(s) found</div>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}
                    </motion.div>
                  </div>

                  {/* Trend Section */}
                  <div id="section-trend">
                    {trendMounted ? (
                      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                        <AgentTrendTab 
                          loadingTrend={loadingTrend}
                          personalTrend={personalTrend}
                          timeframe={timeframe}
                          activeTrendFilter={activeTrendFilter}
                          onTimeframeChange={handleTimeframeChange}
                          onFilterChange={setActiveTrendFilter}
                        />
                      </motion.div>
                    ) : (
                      <TabSkeleton />
                    )}
                  </div>

                  {/* Temuan Section */}
                  <div id="section-temuan">
                    {temuanMounted ? (
                      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                        <AgentTemuanTab 
                          groupedTemuan={groupedTemuan}
                          selectedPeriod={selectedPeriod}
                          role={role}
                          loadingTemuan={loadingTemuan}
                          currentPage={currentPage}
                          hasMore={hasMore}
                          deletingId={deletingId}
                          onStartEdit={startEdit}
                          onDelete={handleDelete}
                          onPageChange={handlePageChange}
                        />
                      </motion.div>
                    ) : (
                      <TabSkeleton />
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <EditTemuanModal
        isOpen={!!editingTemuan}
        editingTemuan={editingTemuan}
        editForm={editForm}
        setEditForm={setEditForm}
        isSubmitting={isSubmitting}
        onClose={() => setEditingTemuan(null)}
        onSave={handleEditSave}
      />
    </>
  );
}
