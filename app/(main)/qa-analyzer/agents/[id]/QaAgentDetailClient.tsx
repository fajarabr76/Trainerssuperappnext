'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Sun, Moon, Download, Plus, ShieldCheck, Zap, BarChart2, ArrowLeft, Activity,
  Users, Calendar, Briefcase, Clock, TrendingUp, TrendingDown, Ticket, AlertCircle, ChevronDown
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
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [agent.foto_url]);
  
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
    selectedMonth,
    setSelectedMonth,
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
    topTickets,
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

  // Derived Summary Data for Detail Panel
  const { activeSummary, delta } = useMemo(() => {
    const activeIdx = monthlySummaries.findIndex(s => s.month === selectedMonth);
    const active = activeIdx !== -1 ? monthlySummaries[activeIdx] : null;
    let d = 0;
    
    if (active && activeIdx > 0) {
      const prev = monthlySummaries[activeIdx - 1];
      d = active.finalScore - prev.finalScore;
    }
    
    return { activeSummary: active, delta: d };
  }, [monthlySummaries, selectedMonth]);

  const masaKerja = useMemo(() => {
    if (!agent.bergabung_date) return '-';
    try {
      const start = new Date(agent.bergabung_date);
      const now = new Date();
      let years = now.getFullYear() - start.getFullYear();
      let months = now.getMonth() - start.getMonth();
      if (months < 0) {
        years--;
        months += 12;
      }
      return years > 0 ? `${years} thn ${months} bln` : `${months} bln`;
    } catch (_e) {
      return '-';
    }
  }, [agent.bergabung_date]);

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
          </div>
        </header>

        <div className="flex-1 overflow-y-auto" ref={scrollContainerRef}>
          <div className="animate-in fade-in duration-500">
            {/* AGENT PROFILE BAR */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-8 sm:px-6 lg:px-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />
              
              <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center md:items-end justify-between gap-6 relative z-10">
                <div className="flex flex-col md:flex-row items-center md:items-end gap-6 text-center md:text-left">
                  <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary to-primary-focus p-1 shadow-xl shadow-primary/20 flex-shrink-0">
                    <div className="w-full h-full rounded-[calc(1rem-4px)] bg-white dark:bg-slate-800 flex items-center justify-center overflow-hidden relative">
                      {agent.foto_url && !avatarLoadFailed ? (
                        <Image
                          src={agent.foto_url}
                          alt={agent.nama}
                          fill
                          unoptimized
                          sizes="96px"
                          className="object-cover"
                          onError={() => setAvatarLoadFailed(true)}
                        />
                      ) : (
                        <div className="text-4xl font-black text-primary opacity-20 uppercase">{agent.nama.charAt(0)}</div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-3 pb-1 min-w-0">
                    <div className="overflow-hidden">
                      <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white leading-tight truncate">
                        {agent.nama}
                      </h2>
                    </div>
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-[10px] font-bold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                        <Users className="w-3 h-3" /> {agent.tim}
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-[10px] font-bold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                        <Calendar className="w-3 h-3" /> {agent.batch}
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-[10px] font-bold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                        <Briefcase className="w-3 h-3" /> {agent.jabatan || 'Agent'}
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-[10px] font-bold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                        <Clock className="w-3 h-3" /> {masaKerja}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto mt-4 md:mt-0">
                  <button
                    onClick={handleExport}
                    disabled={exporting}
                    className="w-full sm:w-auto h-10 px-4 flex items-center justify-center gap-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95 transition-all shadow-sm disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    {exporting ? 'MENYIAPKAN...' : 'UNDUH LAPORAN'}
                  </button>
                  {role !== 'agent' && (
                    <button
                      onClick={handleTambahTemuan}
                      className="w-full sm:w-auto h-10 px-5 flex items-center justify-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-[11px] font-black uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all shadow-lg"
                    >
                      <Plus className="w-4 h-4" /> INPUT AUDIT
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Context Control Bar */}
            <div className="bg-white/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 px-4 py-3 sm:px-6 lg:px-8 shadow-sm relative z-40 backdrop-blur-md">
              <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto justify-center lg:justify-start">
                  <div className="flex items-center gap-3">
                    {/* Redesigned Year Selector */}
                    <div className="relative group/year">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 group-focus-within/year:text-primary transition-colors" />
                      </div>
                      <select 
                        value={selectedYear}
                        onChange={(e) => handleYearChange(Number(e.target.value))}
                        className="h-9 pl-9 pr-8 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-black focus:ring-1 focus:ring-primary outline-none text-slate-700 dark:text-slate-300 appearance-none cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                      >
                        {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                      <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none">
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                      </div>
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

                {isStaff && (
                  <div className="flex items-center gap-2 w-full lg:w-auto justify-center">
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
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="bg-white/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 sticky top-14 z-30 backdrop-blur-sm">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex gap-4 sm:gap-8 overflow-x-auto no-scrollbar">
                  {[
                    { id: 'section-summary', key: 'summary', label: 'Ringkasan Skor' },
                    { id: 'section-trend', key: 'trend', label: 'Grafik Tren' },
                    { id: 'section-temuan', key: 'temuan', label: 'Daftar Temuan' }
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => scrollToSection(tab.id)}
                      className={`py-3 text-[11px] font-black uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${
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
              <div id="section-summary" className="scroll-mt-28 space-y-8">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary flex-shrink-0"><ShieldCheck className="w-5 h-5" /></div>
                  <div>
                    <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white uppercase leading-tight">Analisis Performa Bulanan</h3>
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
                  <div className="space-y-6">
                    {/* MONTH RAIL */}
                    <div className="overflow-x-auto no-scrollbar">
                      <div className="flex min-w-max items-end gap-1.5 border-b border-slate-200 dark:border-slate-700 pb-1">
                        {monthlySummaries.map((p) => (
                          <button
                            key={`${p.month}-${p.year}`}
                            onClick={() => setSelectedMonth(p.month)}
                            className={`group relative min-w-[112px] px-2.5 pt-2 pb-3 text-left transition-colors ${
                              selectedMonth === p.month
                                ? 'text-slate-900 dark:text-white'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                            }`}
                          >
                            <div className={`text-[10px] font-black uppercase tracking-[0.18em] mb-1 ${
                              selectedMonth === p.month ? 'text-primary' : 'text-slate-500'
                            }`}>
                              {monthsFull[p.month-1].slice(0, 3)}
                            </div>

                            <div className="flex items-end gap-0.5 leading-none">
                              <span className={`text-[2rem] font-black tracking-tight ${
                                selectedMonth === p.month ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'
                              }`}>
                                {p.finalScore.toFixed(1)}
                              </span>
                              <span className="text-sm font-black text-slate-400 pb-0.5">%</span>
                            </div>

                            {p.finalScore < 95 && (
                              <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-rose-500" />
                            )}

                            {selectedMonth === p.month && (
                              <div className="absolute inset-0 -z-10 rounded-lg bg-slate-100/75 dark:bg-slate-800/70" />
                            )}

                            <div className="absolute bottom-0 left-2.5 right-2.5 h-[3px] rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${scoreBg(p.finalScore)} transition-opacity ${
                                  selectedMonth === p.month ? 'opacity-100' : 'opacity-55 group-hover:opacity-80'
                                }`}
                                style={{ width: `${Math.max(20, Math.min(100, p.finalScore))}%` }}
                              />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* ACTIVE DETAIL PANEL */}
                    {activeSummary && (
                      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 xl:gap-6 items-start animate-in slide-in-from-bottom-4 duration-500">
                        {/* Main Score Display */}
                        <div className="xl:col-span-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 lg:p-7 shadow-sm relative overflow-hidden group">
                          <div className="absolute top-0 right-0 p-6 text-primary opacity-5 group-hover:opacity-10 transition-opacity">
                            <ShieldCheck className="w-40 h-40 -rotate-12 translate-x-10 -translate-y-10" />
                          </div>

                          <div className="relative z-10 space-y-6">
                            <div className="flex flex-wrap items-center gap-2.5">
                              <span className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">
                                {monthsFull[activeSummary.month-1]} {activeSummary.year}
                              </span>
                              {activeSummary.finalScore < 95 ? (
                                <div className="flex items-center gap-1.5 px-3 py-1 bg-rose-500/10 border border-rose-500/20 rounded-lg">
                                  <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                                  <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest">Butuh Perhatian</span>
                                </div>
                              ) : (
                                <div className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${scoreBg(activeSummary.finalScore)} text-white shadow-sm`}>
                                  {scoreLabel(activeSummary.finalScore)}
                                </div>
                              )}
                            </div>

                            <div className="space-y-3">
                              <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Final Audit Score</div>
                              <div className="flex items-end gap-2">
                                <span className={`text-6xl sm:text-7xl font-black tracking-tighter leading-none ${
                                  scoreColor(activeSummary.finalScore).includes('green') ? 'text-emerald-500' : 
                                  scoreColor(activeSummary.finalScore).includes('amber') ? 'text-amber-500' : 
                                  'text-rose-500'
                                }`}>{activeSummary.finalScore.toFixed(1)}</span>
                                <span className="text-xl sm:text-2xl font-black text-slate-300 pb-1">%</span>
                              </div>

                              <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                <div
                                  className={`h-full transition-all duration-500 ${
                                    scoreColor(activeSummary.finalScore).includes('green')
                                      ? 'bg-emerald-500'
                                      : scoreColor(activeSummary.finalScore).includes('amber')
                                        ? 'bg-amber-500'
                                        : 'bg-rose-500'
                                  }`}
                                  style={{ width: `${Math.max(0, Math.min(100, activeSummary.finalScore))}%` }}
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4">
                                <div className="flex items-center gap-2 text-primary mb-2">
                                  <Activity className="w-4 h-4" />
                                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Volume Audit</span>
                                </div>
                                <div className="text-xl font-black text-slate-900 dark:text-white leading-none">{activeSummary.sessionCount} Sesi</div>
                              </div>

                              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4">
                                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">vs Audit Terakhir</div>
                                <div className={`flex items-center gap-1 text-xl font-black leading-none ${
                                  delta > 0 ? 'text-emerald-500' : delta < 0 ? 'text-rose-500' : 'text-slate-500'
                                }`}>
                                  {delta > 0 ? <TrendingUp className="w-4 h-4" /> : delta < 0 ? <TrendingDown className="w-4 h-4" /> : null}
                                  {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Operational Analysis: Top 5 Tickets & AI Insight */}
                        <div className="xl:col-span-8 space-y-5">
                          {/* TOP 5 TICKETS BY WEIGHT */}
                          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 lg:p-7 shadow-sm space-y-5">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                <Ticket className="w-4 h-4 text-primary" /> Top 5 Pengurang Skor Terbesar
                              </h4>
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{topTickets.length} Tiket Ditemukan</span>
                            </div>

                            <div className="space-y-2.5">
                              {topTickets.map((ticket, idx) => (
                                <div key={ticket.no_tiket} className="group/ticket grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 hover:border-primary/30 hover:bg-white dark:hover:bg-slate-800 transition-all">
                                  <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center text-xs font-black text-slate-400 shadow-sm group-hover/ticket:text-primary transition-colors">
                                    0{idx + 1}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.18em]">No Tiket</span>
                                      <span className="text-[11px] font-black font-mono text-slate-700 dark:text-slate-300 truncate uppercase">
                                        {ticket.isSamplingQa ? 'Tiket Sampling QA' : ticket.no_tiket.toLowerCase().startsWith('audit-') ? 'Audit Internal' : ticket.no_tiket}
                                      </span>
                                    </div>
                                    <p className="text-[11px] font-medium text-slate-500 truncate italic">
                                      &quot;{ticket.heaviestParam}&quot;
                                    </p>
                                  </div>
                                  <div className="text-right flex flex-col items-end gap-1 pt-0.5">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs font-black text-slate-900 dark:text-white leading-none whitespace-nowrap">-{ticket.scoreDeduction.toFixed(1)} poin</span>
                                      <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                    </div>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{ticket.findingCount} Temuan</span>
                                  </div>
                                </div>
                              ))}
                              {topTickets.length === 0 && (
                                <div className="py-12 text-center">
                                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tidak ada tiket yang menurunkan skor</p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* AI Insight */}
                          {automatedCoaching && (
                            <div className="bg-slate-900 dark:bg-slate-800 text-white rounded-3xl p-6 lg:p-7 relative overflow-hidden shadow-lg border border-slate-800 dark:border-slate-700">
                              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/10 rounded-full translate-x-12 -translate-y-12 blur-2xl pointer-events-none" />
                              
                              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.38fr)_minmax(0,1fr)] gap-6 lg:gap-8 relative z-10">
                                <div className="space-y-4">
                                  <div className="flex items-center gap-2">
                                    <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">Area Perbaikan</span>
                                  </div>
                                  <h4 className="text-xl sm:text-2xl font-black tracking-tight leading-tight uppercase">{automatedCoaching.parameter}</h4>
                                  <div className="flex items-center gap-3">
                                    <div className={`text-[10px] font-black px-3 py-1 rounded-full ${automatedCoaching.isCritical ? 'bg-rose-500 text-white' : 'bg-blue-500 text-white'}`}>
                                      {automatedCoaching.isCritical ? 'CRITICAL' : 'OPPORTUNITY'}
                                    </div>
                                    <div className="text-sm font-black text-slate-400">{automatedCoaching.count} Sesi</div>
                                  </div>
                                </div>

                                <div className="lg:border-l lg:border-slate-700 lg:pl-8 flex flex-col justify-center">
                                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2.5">Rekomendasi Strategis</div>
                                  <blockquote className="text-sm sm:text-base font-medium italic text-slate-200 leading-relaxed max-h-56 overflow-y-auto pr-1">
                                    &quot;{automatedCoaching.recommendation}&quot;
                                  </blockquote>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* SECTION: TREND */}
              <div id="section-trend" className="scroll-mt-28 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary flex-shrink-0"><BarChart2 className="w-5 h-5" /></div>
                  <div>
                    <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white uppercase leading-tight">Tren Pergerakan Skor</h3>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-opacity-80">
                      Rentang Statistik: {monthsFull[trendStartMonth-1].slice(0,3)} - {monthsFull[trendEndMonth-1].slice(0,3)} {selectedYear}
                    </p>
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm overflow-hidden">
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
                  <div className="p-2 bg-primary/10 rounded-lg text-primary flex-shrink-0"><Activity className="w-5 h-5" /></div>
                  <div>
                    <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white uppercase leading-tight">Riwayat Temuan Detil</h3>
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
