'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sun, Moon, Download, Plus, ShieldCheck, Zap, BarChart2, ArrowLeft, Activity
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { User } from '@supabase/supabase-js';

// Types & Hooks
import { 
  scoreColor, scoreBg, scoreLabel 
} from '../../lib/qa-types';
import type { Agent, AgentDetailData, ServiceType } from '../../lib/qa-types';
import { useAgentDetail } from './hooks/useAgentDetail';

import nextDynamic from 'next/dynamic';

const AgentTrendTab = nextDynamic(() => import('./components/AgentTrendTab'), {
  loading: () => <TabSkeleton />,
  ssr: false,
});

const AgentTemuanTab = nextDynamic(() => import('./components/AgentTemuanTab'), {
  loading: () => <TabSkeleton />,
  ssr: false,
});

const EditTemuanModal = nextDynamic(() => import('./components/EditTemuanModal'), {
  ssr: false,
});

import { YearSelector } from '../../dashboard/components/YearSelector';
import QaStatePanel from '../../components/QaStatePanel';

function TabSkeleton() {
  return (
    <div className="w-full h-[400px] bg-slate-100 dark:bg-slate-900 animate-pulse rounded-2xl flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );
}

interface QaAgentDetailClientProps {
  agentId: string;
  user: User;
  role: string;
  initialAgent: Agent;
  initialData: AgentDetailData;
}

export default function QaAgentDetailClient({ 
  agentId, 
  user: _user, 
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
    selectedServiceType,
    handleServiceChange,
    activeSection,
    trendMounted,
    temuanMounted,
    activeTrendFilter,
    setActiveTrendFilter,
    agent,
    selectedYear,
    scrollContainerRef,
    editingTemuan,
    editForm,
    setEditForm,
    isSubmitting,
    deletingId,
    availableYears,
    
    // Switcher & Trend Range
    trendStartMonth,
    trendEndMonth,
    handleTrendRangeChange,
    selectedTeam,
    handleTeamChange,
    handleAgentChange,
    teams,
    agentsInTeam,
    loadingAgents,

    // Computed
    personalTrend,
    monthlySummaries,
    groupedFindingsByMonth,
    availableServiceTypes,
    automatedCoaching,
    contextKey,
    
    // Actions
    scrollToSection,
    startEdit,
    handleEditSave,
    handleDelete,
    handleYearChange,

    handleExport,
    handleTambahTemuan,
    setEditingTemuan
  } = useAgentDetail({
    agentId,
    user: _user,
    role,
    initialAgent,
    initialData
  });

  const monthsFull = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const isStaff = ['trainer', 'leader', 'admin'].includes(role);

  return (
    <>
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-[#F1F5F9] dark:bg-[#020617]">
        {/* Compact Header */}
        <header className="h-14 flex items-center justify-between px-4 sm:px-6 lg:px-8 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.push('/qa-analyzer/agents')} 
              className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-primary hover:text-white flex items-center justify-center text-slate-500 transition-all group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            </button>
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
            <div>
              <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500 leading-none mb-0.5">
                SIDAK PERSONAL AUDIT
              </div>
              <h1 className="text-sm font-black tracking-tight text-slate-900 dark:text-white">{agent.nama}</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {mounted && (
              <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 flex items-center justify-center transition-all">
                {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              </button>
            )}
            <button
              onClick={handleExport}
              disabled={exporting}
              className="h-8 px-3 flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-slate-200 transition-all disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              {exporting ? '...' : 'Ekspor'}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto" ref={scrollContainerRef}>
          <div className="animate-in fade-in duration-500">
            {/* Context Control Bar */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 sm:px-6 lg:px-8 shadow-sm relative z-40">
              <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 h-9 px-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Year</span>
                      <YearSelector years={availableYears} selectedYear={selectedYear} onYearChange={handleYearChange} />
                    </div>
                    <div className="flex items-center gap-1 p-1 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg">
                      {availableServiceTypes.map(svc => (
                        <button
                          key={svc}
                          onClick={() => handleServiceChange(svc as ServiceType)}
                          className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${
                            selectedServiceType === svc 
                              ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' 
                              : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          {svc}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 h-9 px-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Trend</span>
                    <div className="flex items-center gap-1">
                      <select 
                        value={trendStartMonth}
                        onChange={(e) => handleTrendRangeChange(Number(e.target.value), trendEndMonth)}
                        className="bg-transparent text-[11px] font-black outline-none cursor-pointer text-slate-700 dark:text-slate-300"
                      >
                        {monthsFull.map((m, i) => (
                          <option key={m} value={i + 1} disabled={i + 1 > trendEndMonth}>{m.slice(0,3)}</option>
                        ))}
                      </select>
                      <span className="text-slate-400 font-bold px-1">→</span>
                      <select 
                        value={trendEndMonth}
                        onChange={(e) => handleTrendRangeChange(trendStartMonth, Number(e.target.value))}
                        className="bg-transparent text-[11px] font-black outline-none cursor-pointer text-slate-700 dark:text-slate-300"
                      >
                        {monthsFull.map((m, i) => (
                          <option key={m} value={i + 1} disabled={i + 1 < trendStartMonth}>{m.slice(0,3)}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full lg:w-auto">
                  {isStaff && (
                    <div className="flex items-center gap-2 flex-1 lg:flex-none">
                      <select 
                        value={selectedTeam}
                        onChange={(e) => handleTeamChange(e.target.value)}
                        className="h-9 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg px-3 text-[11px] font-black focus:ring-1 focus:ring-primary outline-none text-slate-700 dark:text-slate-300 min-w-[120px]"
                      >
                        {teams.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <select 
                        value={agentId}
                        onChange={(e) => handleAgentChange(e.target.value)}
                        disabled={loadingAgents}
                        className="h-9 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg px-3 text-[11px] font-black focus:ring-1 focus:ring-primary outline-none text-slate-700 dark:text-slate-300 disabled:opacity-50 min-w-[160px]"
                      >
                        {loadingAgents ? <option>...</option> : agentsInTeam.map(a => <option key={a.id} value={a.id}>{a.nama}</option>)}
                      </select>
                    </div>
                  )}
                  {role !== 'agent' && (
                    <button
                      onClick={handleTambahTemuan}
                      className="h-9 px-4 flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg text-[10px] font-black uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" /> Input Audit
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="bg-white/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 sticky top-14 z-30 backdrop-blur-sm">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex gap-8">
                  {[
                    { id: 'section-summary', key: 'summary', label: 'Ringkasan Skor' },
                    { id: 'section-trend', key: 'trend', label: 'Grafik Tren' },
                    { id: 'section-temuan', key: 'temuan', label: 'Daftar Temuan' }
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => scrollToSection(tab.id)}
                      className={`py-3 text-[11px] font-black uppercase tracking-widest border-b-2 transition-all ${
                        activeSection === tab.key 
                          ? 'border-primary text-primary' 
                          : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-12 pb-24">
              {/* SECTION: SUMMARY */}
              <div id="section-summary" className="scroll-mt-28 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary"><ShieldCheck className="w-5 h-5" /></div>
                  <div>
                    <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white uppercase">Skor Audit per Bulan</h3>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-opacity-80">Tahun {selectedYear} • Layanan {selectedServiceType.toUpperCase()}</p>
                  </div>
                </div>

                {monthlySummaries.length === 0 ? (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center shadow-sm">
                    <QaStatePanel
                      type="empty"
                      title="Data belum tersedia"
                      description={`Belum ada ringkasan skor untuk layanan ${selectedServiceType.toUpperCase()} di tahun ${selectedYear}.`}
                      className="mx-auto max-w-lg"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {monthlySummaries.map((p) => (
                      <div key={`${p.month}-${p.year}`} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm hover:ring-1 hover:ring-primary/30 transition-all">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">{monthsFull[p.month-1]}</span>
                          <div className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${scoreBg(p.finalScore)} text-white`}>
                            {scoreLabel(p.finalScore)}
                          </div>
                        </div>
                        <div className="flex items-baseline gap-1 mb-4">
                          <span className={`text-4xl font-black tracking-tighter ${
                            scoreColor(p.finalScore).includes('green') ? 'text-emerald-500' : 
                            scoreColor(p.finalScore).includes('amber') ? 'text-amber-500' : 
                            'text-rose-500'
                          }`}>{p.finalScore.toFixed(1)}</span>
                          <span className="text-sm font-bold text-slate-400">%</span>
                        </div>
                        <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-4">
                          <div className="flex items-center justify-between text-[10px] font-black">
                            <span className="text-slate-500 uppercase tracking-widest">Non-Critical</span>
                            <span className="text-slate-700 dark:text-slate-300">{p.nonCriticalScore.toFixed(1)}%</span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] font-black">
                            <span className="text-slate-500 uppercase tracking-widest">Critical</span>
                            <span className="text-slate-700 dark:text-slate-300">{p.criticalScore.toFixed(1)}%</span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] font-black pt-1">
                            <span className="text-slate-500 uppercase tracking-widest">Audit</span>
                            <span className="text-primary">{p.sessionCount} Sesi</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* AI Insight */}
                {automatedCoaching && (
                  <div className="bg-slate-900 dark:bg-slate-800 text-white rounded-2xl p-6 relative overflow-hidden shadow-lg border border-slate-800 dark:border-slate-700">
                    <div className="flex flex-col md:flex-row gap-8 relative z-10">
                      <div className="md:w-1/3 space-y-4">
                        <div className="flex items-center gap-2">
                          <Zap className="w-4 h-4 text-amber-400" />
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">Area Perbaikan</span>
                        </div>
                        <h4 className="text-xl font-black tracking-tight leading-tight">{automatedCoaching.parameter}</h4>
                        <div className="flex gap-4">
                          <div>
                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Status</div>
                            <div className={`text-[10px] font-black px-2 py-0.5 rounded ${automatedCoaching.isCritical ? 'bg-rose-500 text-white' : 'bg-blue-500 text-white'}`}>
                              {automatedCoaching.isCritical ? 'CRITICAL' : 'OPPORTUNITY'}
                            </div>
                          </div>
                          <div>
                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Frekuensi</div>
                            <div className="text-lg font-black">{automatedCoaching.count} Sesi</div>
                          </div>
                        </div>
                      </div>
                      <div className="flex-1 md:border-l md:border-slate-700 md:pl-8 flex flex-col justify-center">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Rekomendasi</div>
                        <blockquote className="text-lg font-medium italic text-slate-100 leading-relaxed">
                          &quot;{automatedCoaching.recommendation}&quot;
                        </blockquote>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION: TREND */}
              <div id="section-trend" className="scroll-mt-28 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary"><BarChart2 className="w-5 h-5" /></div>
                  <div>
                    <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white uppercase">Tren Pergerakan Skor</h3>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-opacity-80">
                      Rentang Statistik: {monthsFull[trendStartMonth-1].slice(0,3)} - {monthsFull[trendEndMonth-1].slice(0,3)} {selectedYear}
                    </p>
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                  {trendMounted ? (
                    <AgentTrendTab
                      loadingTrend={loadingTrend}
                      personalTrend={personalTrend}
                      activeTrendFilter={activeTrendFilter}
                      onFilterChange={setActiveTrendFilter}
                    />
                  ) : <TabSkeleton />}
                </div>
              </div>

              {/* SECTION: FINDINGS */}
              <div id="section-temuan" className="scroll-mt-28 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary"><Activity className="w-5 h-5" /></div>
                  <div>
                    <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white uppercase">Riwayat Temuan Detil</h3>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-opacity-80">Dikelompokkan per bulan audit</p>
                  </div>
                </div>
                {temuanMounted ? (
                  <AgentTemuanTab 
                    groupedFindingsByMonth={groupedFindingsByMonth}
                    role={role}
                    loadingTemuan={loadingTemuan}
                    deletingId={deletingId}
                    onStartEdit={startEdit}
                    onDelete={handleDelete}
                    contextKey={contextKey}
                  />
                ) : <TabSkeleton />}
              </div>
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
