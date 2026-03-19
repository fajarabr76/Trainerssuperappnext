'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, ChevronRight, TrendingUp, TrendingDown, Minus, X,
  AlertTriangle, BarChart2, Download, Star, Plus,
  Menu, Sun, Moon, Activity, ExternalLink
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useTheme } from 'next-themes';
import { createClient } from '@/app/lib/supabase/client';
import { qaService } from '../../services/qaService';
import { scoreColor, scoreBg, scoreLabel, NILAI_LABELS, calculateQAScoreFromTemuan } from '../../lib/qa-types';
import Sidebar from "../../../components/Sidebar";
import type { QAIndicator } from '../../lib/qa-types';
import ParamTrendChart from '../../dashboard/components/ParamTrendChart';

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'];
const MONTHS_FULL  = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

function periodKey(month: number, year: number) { return `${year}-${String(month).padStart(2,'0')}`; }
function pLabel(month: number, year: number) { return `${MONTHS_SHORT[month-1]} ${year}`; }

async function exportToExcel(peserta_id: string) {
  const { agent, periods } = await qaService.getAgentExportData(peserta_id);
  const wb = XLSX.utils.book_new();

  const summaryRows: any[][] = [
    ['Laporan QA Analyzer'], [''],
    ['Nama Agent', agent.nama], ['Tim', agent.tim], ['Folder', agent.batch],
    ['Tanggal Export', new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})],
    [''], ['RINGKASAN SKOR PER PERIODE'],
    ['Periode', 'Skor Akhir', 'Non-Critical', 'Critical'],
  ];
  periods.forEach(p => {
    summaryRows.push([`${MONTHS_FULL[p.month-1]} ${p.year}`, p.score.toFixed(2), p.ncScore.toFixed(2), p.crScore.toFixed(2)]);
  });
  const ws1 = XLSX.utils.aoa_to_sheet(summaryRows);
  ws1['!cols'] = [{wch:28},{wch:14},{wch:14},{wch:14}];
  XLSX.utils.book_append_sheet(wb, ws1, 'Ringkasan');

  periods.forEach(p => {
    const sheetName = `${MONTHS_SHORT[p.month-1]} ${p.year}`.slice(0,31);
    const rows: any[][] = [
      [`${MONTHS_FULL[p.month-1]} ${p.year}`], [''],
      [`Skor Akhir: ${p.score.toFixed(2)}`], [`Non-Critical: ${p.ncScore.toFixed(2)}`], [`Critical: ${p.crScore.toFixed(2)}`],
      [''], ['No. Tiket', 'Kategori', 'Parameter', 'Nilai', 'Keterangan', 'Ketidaksesuaian', 'Sebaiknya'],
    ];
    p.temuan.forEach((t: any) => {
      rows.push([
        t.no_tiket ?? '-',
        t.qa_indicators?.category === 'critical' ? 'Critical' : 'Non-Critical',
        t.qa_indicators?.name ?? '-',
        t.nilai,
        NILAI_LABELS[t.nilai] ?? '-',
        t.ketidaksesuaian ?? '-',
        t.sebaiknya ?? '-',
      ]);
    });
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{wch:14},{wch:14},{wch:32},{wch:8},{wch:14},{wch:30},{wch:30}];
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  XLSX.writeFile(wb, `QA_${agent.nama.replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.xlsx`);
}

function NilaiBadge({ nilai }: { nilai: number }) {
  const bg =
    nilai === 3 ? 'bg-green-500' :
    nilai === 2 ? 'bg-blue-500'  :
    nilai === 1 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg ${bg} text-white text-xs font-black flex-shrink-0 shadow-sm`}>
      {nilai}
    </span>
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

export default function QaAgentDetailClient({ agentId, user, role, profile }: { agentId: string, user: any, role: any, profile: any }) {
  const supabase = createClient();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingData, setLoadingData] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<{ month: number; year: number; label: string; id?: string } | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [timeframe, setTimeframe] = useState<'3m' | '6m' | 'all'>('3m');
  
  const [agent, setAgent] = useState<any>(null);
  const [data, setData] = useState<{
    temuan: any[];
    indicators: QAIndicator[];
    personalTrend: any;
  } | null>(null);

  useEffect(() => { setMounted(true); }, []);

  // 1. Load Profile First (FAST)
  useEffect(() => {
    async function loadProfile() {
      if (!agentId) return;
      try {
        const profile = await qaService.getAgentMiniProfile(agentId);
        setAgent(profile);
      } catch (err: any) {
        console.error('Error loading profile:', err);
        setErrorMsg(err.message);
      } finally {
        setLoadingProfile(false);
      }
    }
    loadProfile();
  }, [agentId]);

  // 2. Load Evaluation Data (HEAVY) — NO dependency on `agent` object to prevent loop
  const loadEvaluationData = useCallback(async () => {
    if (!agentId) return;
    setLoadingData(true);
    try {
      const [result, trend] = await Promise.all([
        qaService.getAgentWithTemuan(agentId),
        qaService.getPersonalTrendWithParameters(agentId, timeframe)
      ]);
      
      const inds = await qaService.getIndicators(result.agent.tim as any);
      
      // ATOMIC UPDATE for evaluation data only
      setData({
        temuan: result.temuan,
        indicators: inds,
        personalTrend: trend
      });
    } catch (err: any) { 
      console.error('Error loading evaluation data:', err);
    } finally { 
      setLoadingData(false); 
    }
  }, [agentId, timeframe]);

  useEffect(() => { 
    loadEvaluationData(); 
  }, [loadEvaluationData]);

  const temuan = useMemo(() => data?.temuan || [], [data]);
  const allIndicators = useMemo(() => data?.indicators || [], [data]);
  const personalTrend = data?.personalTrend;

  const handleExport = async () => {
    if (!agentId || !agent) return;
    setExporting(true);
    try { await exportToExcel(agentId); }
    catch (err: any) { setErrorMsg('Gagal export: ' + err.message); }
    finally { setExporting(false); }
  };

  const handleTambahTemuan = () => {
    if (!agent || !agentId) return;
    const params = new URLSearchParams({
      folderID: agent.batch,
      agentID: agentId,
      ...(selectedPeriod?.id ? { periodID: selectedPeriod.id } : {}),
    });
    router.push(`/qa-analyzer/input?${params.toString()}`);
  };

  const indicators = useMemo(() => allIndicators, [allIndicators]);

  const sortedPeriods = useMemo(() => {
    const map = new Map<string, { month: number; year: number; label: string; id?: string }>();
    temuan.forEach(t => {
      if (!t.qa_periods) return;
      const key = periodKey(t.qa_periods.month, t.qa_periods.year);
      if (!map.has(key)) map.set(key, {
        month: t.qa_periods.month,
        year: t.qa_periods.year,
        label: pLabel(t.qa_periods.month, t.qa_periods.year),
        id: t.qa_periods.id,
      });
    });
    return [...map.entries()].sort(([a],[b]) => a.localeCompare(b)).map(([,v]) => v);
  }, [temuan]);

  useEffect(() => {
    if (sortedPeriods.length === 0) return;
    const latest = sortedPeriods[sortedPeriods.length - 1];
    setSelectedPeriod(prev => {
      if (prev && sortedPeriods.some(p => periodKey(p.month, p.year) === periodKey(prev.month, prev.year))) return prev;
      return latest;
    });
  }, [sortedPeriods]);

  const getScore = useCallback((month: number, year: number) => {
    const key = periodKey(month, year);
    const pt = temuan.filter(t => t.qa_periods && periodKey(t.qa_periods.month, t.qa_periods.year) === key);
    return calculateQAScoreFromTemuan(indicators, pt.map(t => ({ indicator_id: t.indicator_id, nilai: t.nilai, no_tiket: t.no_tiket })));
  }, [temuan, indicators]);

  const selectedScore = useMemo(() => selectedPeriod ? getScore(selectedPeriod.month, selectedPeriod.year) : null, [selectedPeriod, getScore]);

  const prevPeriod = useMemo(() => {
    if (!selectedPeriod || sortedPeriods.length < 2) return null;
    const idx = sortedPeriods.findIndex(p => periodKey(p.month, p.year) === periodKey(selectedPeriod.month, selectedPeriod.year));
    return idx > 0 ? sortedPeriods[idx - 1] : null;
  }, [selectedPeriod, sortedPeriods]);

  const prevScore = useMemo(() => prevPeriod ? getScore(prevPeriod.month, prevPeriod.year) : null, [prevPeriod, getScore]);

  const trendDir = useMemo(() => selectedScore && prevScore
    ? (selectedScore.finalScore > prevScore.finalScore ? 'up' : selectedScore.finalScore < prevScore.finalScore ? 'down' : 'same')
    : 'none', [selectedScore, prevScore]);

  const selectedTemuan = useMemo(() => {
    if (!selectedPeriod) return [];
    const key = periodKey(selectedPeriod.month, selectedPeriod.year);
    return temuan.filter(t => t.qa_periods && periodKey(t.qa_periods.month, t.qa_periods.year) === key);
  }, [selectedPeriod, temuan]);

  const automatedCoaching = useMemo(() => {
    if (!selectedScore || selectedTemuan.length === 0) return null;
    const counts: Record<string, { name: string, count: number, better: string[] }> = {};
    selectedTemuan.forEach(t => {
      if (t.nilai < 3 && t.qa_indicators) {
        if (!counts[t.indicator_id]) counts[t.indicator_id] = { name: t.qa_indicators.name, count: 0, better: [] };
        counts[t.indicator_id].count++;
        if (t.sebaiknya) counts[t.indicator_id].better.push(t.sebaiknya);
      }
    });
    const topIssue = Object.values(counts).sort((a, b) => b.count - a.count)[0];
    if (!topIssue) return null;
    return {
      parameter: topIssue.name,
      count: topIssue.count,
      recommendation: topIssue.better.length > 0 ? topIssue.better[0] : `Fokus pada peningkatan kualitas di parameter ${topIssue.name}.`,
      isCritical: selectedScore.criticalDetail.some(d => d.indicatorId === Object.keys(counts).find(k => counts[k].name === topIssue.name) && d.nilai < 3)
    };
  }, [selectedScore, selectedTemuan]);

  const isAtRisk = useMemo(() => {
    if (!selectedScore) return false;
    return selectedScore.finalScore < 75 || selectedScore.criticalDetail.some(d => d.nilai < 3);
  }, [selectedScore]);

  const groupedTemuan = useMemo(() => {
    const map = new Map<string, any[]>();
    selectedTemuan.forEach(t => {
      const key = t.no_tiket ?? '__tanpa_tiket';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });
    return [...map.entries()].map(([tiket, items], idx) => ({
      urutan: idx + 1,
      no_tiket: tiket === '__tanpa_tiket' ? null : tiket,
      items,
    }));
  }, [selectedTemuan]);

  const PARAM_COLORS = ['#EF4444', '#F97316', '#F59E0B', '#10B981', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899'];

  if (loadingProfile && !agent) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex overflow-hidden">
      <Sidebar user={user} role={role} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />

      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="h-16 flex items-center justify-between px-4 lg:px-8 bg-card/30 backdrop-blur-xl border-b border-border sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-foreground/5 text-foreground/60"><Menu className="w-5 h-5" /></button>
            <h1 className="text-lg font-bold">QA Analyzer</h1>
          </div>
          <div className="flex items-center gap-3">
            {mounted && (
              <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="p-2 rounded-full hover:bg-foreground/5 text-foreground/60 transition-colors">
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          {errorMsg && !agent ? (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center">
              <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mb-4"><AlertTriangle className="w-10 h-10 text-red-500" /></div>
              <p className="text-sm text-red-500 font-medium mb-4 max-w-xs">{errorMsg ?? 'Agent data could not be loaded.'}</p>
              <button onClick={() => router.push('/qa-analyzer/dashboard')} className="px-6 py-2 bg-primary text-primary-foreground rounded-full text-sm font-bold shadow-lg shadow-primary/20 transition-transform active:scale-95">Kembali ke Dashboard</button>
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              {/* Profile Bar - ALWAYS VISIBLE if agent exists */}
              {agent && (
                <div className="bg-card/50 border-b border-border px-6 py-4 backdrop-blur-md sticky top-0 z-20">
                  <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <button onClick={() => router.push('/qa-analyzer/agents')} className="p-2 rounded-full hover:bg-foreground/5 text-foreground/40 transition-colors"><ArrowLeft className="w-5 h-5" /></button>
                      {agent.foto_url ? (
                        <img src={agent.foto_url} alt={agent.nama} className="h-14 w-14 rounded-2xl object-cover shadow-lg shadow-primary/20" />
                      ) : (
                        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white text-xl font-black shadow-lg shadow-primary/20">
                          {agent.nama.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <h2 className="text-xl font-black flex items-center gap-2">
                          {agent.nama}
                          <button 
                            onClick={() => router.push(`/profiler/table?batch=${agent.batch}`)}
                            className="p-1 rounded-full hover:bg-foreground/10 text-foreground/30 transition-colors"
                            title="Lihat Profil Lengkap"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        </h2>
                        <div className="flex flex-wrap gap-2 mt-1">
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-foreground/5 rounded-full text-foreground/60">{agent.tim}</span>
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-foreground/5 rounded-full text-foreground/60">{agent.batch}</span>
                          {agent.jabatan && <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-primary/10 rounded-full text-primary">{agent.jabatan.replace('_',' ')}</span>}
                          {agent.bergabung_date && <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-amber-500/10 rounded-full text-amber-600">Dinas: {hitungMasaDinas(agent.bergabung_date)}</span>}
                        </div>
                      </div>

                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={handleTambahTemuan} disabled={loadingData} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:brightness-110 transition-all active:scale-95 disabled:opacity-50">
                        <Plus className="w-4 h-4" /> Tambah Temuan
                      </button>
                      <button onClick={handleExport} disabled={exporting || loadingData || temuan.length === 0} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-green-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-green-500/20 hover:brightness-110 transition-all active:scale-95 disabled:opacity-50">
                        {exporting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Download className="w-4 h-4" />}
                        {exporting ? 'Exporting...' : 'Export PDF/Excel'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
                {loadingData && !data ? (
                  <div className="space-y-8">
                    {/* Skeleton Score Card */}
                    <div className="bg-card rounded-3xl border border-border p-8 h-64 animate-pulse flex flex-col justify-center gap-4">
                      <div className="h-4 w-32 bg-foreground/5 rounded-full" />
                      <div className="flex items-end gap-4">
                        <div className="h-20 w-32 bg-foreground/5 rounded-2xl" />
                        <div className="h-8 w-24 bg-foreground/5 rounded-full" />
                      </div>
                      <div className="h-4 w-full bg-foreground/5 rounded-full mt-4" />
                      <div className="grid grid-cols-2 gap-4 mt-2">
                        <div className="h-16 bg-foreground/5 rounded-2xl" />
                        <div className="h-16 bg-foreground/5 rounded-2xl" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <div className="lg:col-span-2 h-80 bg-card rounded-3xl border border-border animate-pulse" />
                      <div className="h-80 bg-card rounded-3xl border border-border animate-pulse" />
                    </div>
                  </div>
                ) : temuan.length === 0 ? (
                  <div className="bg-card rounded-3xl border border-border p-12 text-center">
                    <div className="w-20 h-20 rounded-3xl bg-foreground/5 flex items-center justify-center mx-auto mb-6"><BarChart2 className="w-10 h-10 text-foreground/20" /></div>
                    <h3 className="text-xl font-black mb-2">No Evaluation Data</h3>
                    <p className="text-foreground/40 mb-8 max-w-sm mx-auto">This agent hasn't been audited yet. Click the button below to start an evaluation.</p>
                    <button onClick={handleTambahTemuan} className="px-8 py-3 bg-primary text-primary-foreground rounded-2xl font-black shadow-xl shadow-primary/20 transition-all hover:scale-105">Start Evaluation</button>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <div className="lg:col-span-2 space-y-6">
                        {/* Period Selector */}
                        {sortedPeriods.length > 1 && (
                          <div className="bg-card rounded-2xl border border-border p-3 flex gap-2 overflow-x-auto no-scrollbar">
                            {sortedPeriods.map(p => {
                              const isActive = periodKey(p.month, p.year) === periodKey(selectedPeriod?.month || 0, selectedPeriod?.year || 0);
                              return (
                                <button key={periodKey(p.month, p.year)} onClick={() => setSelectedPeriod(p)} className={`px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all ${isActive ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'hover:bg-foreground/5 text-foreground/60'}`}>
                                  {p.label}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {selectedScore && selectedPeriod && (
                          <>
                            {/* Score Card */}
                            <div className="bg-card rounded-3xl border border-border p-8 relative overflow-hidden group">
                              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl" />
                              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 relative">
                                <div>
                                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/40 mb-2">Final QA Score</p>
                                  <div className="flex items-baseline gap-2">
                                    <h1 className={`text-8xl font-black tracking-tighter ${scoreColor(selectedScore.finalScore)}`}>{selectedScore.finalScore.toFixed(1)}</h1>
                                    <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${scoreBg(selectedScore.finalScore)} text-white shadow-xl shadow-current/20`}>{scoreLabel(selectedScore.finalScore)}</div>
                                  </div>
                                </div>
                                <div className="text-left sm:text-right space-y-3">
                                  <div className="flex flex-col sm:items-end">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-foreground/40">Sesi Audit</span>
                                    <span className="text-2xl font-black">{selectedScore.sessionCount} <span className="text-xs font-bold text-foreground/40 ml-1">Tiket</span></span>
                                  </div>
                                  {trendDir !== 'none' && (
                                    <div className={`flex items-center sm:justify-end gap-1.5 font-black text-sm ${trendDir === 'up' ? 'text-green-500' : trendDir === 'down' ? 'text-red-500' : 'text-foreground/40'}`}>
                                      {trendDir === 'up' ? <TrendingUp className="w-4 h-4" /> : trendDir === 'down' ? <TrendingDown className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                                      <span>{trendDir === 'up' ? '+' : ''}{(selectedScore.finalScore - (prevScore?.finalScore || 0)).toFixed(1)}% vs prev</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="mt-8 space-y-4">
                                <div className="h-4 bg-foreground/5 rounded-full overflow-hidden border border-border/50">
                                  <motion.div initial={{ width: 0 }} animate={{ width: `${selectedScore.finalScore}%` }} className={`h-full rounded-full ${scoreBg(selectedScore.finalScore)} shadow-lg shadow-current/20`} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="bg-foreground/[0.02] border border-border rounded-2xl p-4 transition-colors hover:bg-foreground/[0.04]">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-1">Non-Critical Score</p>
                                    <p className="text-3xl font-black">{selectedScore.nonCriticalScore.toFixed(1)}</p>
                                  </div>
                                  <div className="bg-foreground/[0.02] border border-border rounded-2xl p-4 transition-colors hover:bg-foreground/[0.04]">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-red-500 mb-1">Critical Score</p>
                                    <p className="text-3xl font-black">{selectedScore.criticalScore.toFixed(1)}</p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Automated Coaching */}
                            <AnimatePresence>
                              {automatedCoaching && (
                                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-primary/5 border border-primary/20 rounded-3xl p-8 relative overflow-hidden">
                                  <div className="absolute -right-8 -bottom-8 opacity-[0.03] rotate-12"><Star className="w-48 h-48" /></div>
                                  <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center"><Activity className="w-5 h-5 text-primary" /></div>
                                    <div>
                                      <p className="text-[10px] font-black uppercase tracking-widest text-primary">Insight AI & Rekomendasi Coaching</p>
                                      <h4 className="text-xl font-black leading-tight">Perbaikan {automatedCoaching.parameter}</h4>
                                    </div>
                                  </div>
                                  <div className="bg-card/50 border border-border rounded-2xl p-6 mb-6">
                                    <p className="text-sm italic leading-relaxed text-foreground/70">"{automatedCoaching.recommendation}"</p>
                                  </div>
                                  <div className="flex flex-wrap gap-6">
                                    <div className="space-y-1">
                                      <p className="text-[10px] font-black uppercase tracking-wider text-foreground/40">Prioritas</p>
                                      <div className={`text-xs font-black ${automatedCoaching.isCritical ? 'text-red-500' : 'text-primary'}`}>{automatedCoaching.isCritical ? 'FATAL ERROR' : 'HIGH PRIORITY'}</div>
                                    </div>
                                    <div className="space-y-1">
                                      <p className="text-[10px] font-black uppercase tracking-wider text-foreground/40">Total Temuan</p>
                                      <div className="text-xs font-black">{automatedCoaching.count} Kasus</div>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>

                            {/* NEW: Personal Dynamic Trend */}
                            <div className="bg-card rounded-3xl border border-border p-8">
                              <div className="flex items-center justify-between mb-8">
                                <div>
                                  <h4 className="text-sm font-black uppercase tracking-widest text-foreground/40">Historical Performance Trend</h4>
                                  <p className="text-[10px] text-foreground/30 mt-1">Total temuan & top 3 parameter bermasalah</p>
                                </div>
                                <div className="flex items-center bg-foreground/5 border border-border/50 rounded-xl p-1 gap-1">
                                  {(['3m', '6m', 'all'] as const).map((tf) => (
                                    <button
                                      key={tf}
                                      onClick={() => setTimeframe(tf)}
                                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
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
                              {personalTrend && <ParamTrendChart data={personalTrend} />}
                            </div>
                          </>
                        )}
                      </div>

                      <div className="space-y-6">
                        {/* Risk Indicator */}
                        {isAtRisk && (
                          <div className="bg-red-500 rounded-3xl p-8 text-white shadow-2xl shadow-red-500/30 overflow-hidden relative">
                            <div className="absolute top-0 right-0 p-4 opacity-20"><AlertTriangle className="w-16 h-16" /></div>
                            <h3 className="text-2xl font-black mb-2">High Risk Agent</h3>
                            <p className="text-white/80 text-sm leading-relaxed mb-6">Agent ini memiliki skor di bawah standar atau rekaman fatal error yang harus segera di-coaching.</p>
                            <button className="w-full py-4 bg-white text-red-500 rounded-2xl font-black text-sm shadow-xl active:scale-95 transition-transform">Jadwalkan Coaching</button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Findings Table */}
                    <div className="bg-card rounded-3xl border border-border overflow-hidden">
                      <div className="p-8 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <h3 className="text-2xl font-black">Audit Detail</h3>
                          <p className="text-sm text-foreground/40 mt-1">Daftar temuan berdasarkan sesi audit per tiket.</p>
                        </div>
                        {selectedPeriod && (
                          <div className="px-5 py-2.5 bg-foreground/5 rounded-2xl border border-border/50 text-xs font-black uppercase tracking-widest">{selectedPeriod.label}</div>
                        )}
                      </div>
                      <div className="divide-y divide-border">
                        {groupedTemuan.length === 0 ? (
                          <div className="p-12 text-center text-foreground/40 italic">Tidak ada temuan di periode ini.</div>
                        ) : (
                          groupedTemuan.map(group => (
                            <div key={group.no_tiket ?? `audit-${group.urutan}`}>
                              <div className="flex items-center justify-between px-8 py-4 bg-foreground/[0.02]">
                                <div className="flex items-center gap-3">
                                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary">#{group.urutan}</div>
                                  <div className="flex flex-col">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-foreground/40">No. Tiket</span>
                                    <span className="text-xs font-black font-mono">{group.no_tiket || 'PERSONAL AUDIT'}</span>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="text-[10px] font-black uppercase tracking-widest text-foreground/40">{group.items.length} Temuan</span>
                                </div>
                              </div>
                              <div className="divide-y divide-border/30">
                                {group.items.map((t: any) => {
                                  const isCritical = t.qa_indicators?.category === 'critical';
                                  return (
                                    <div key={t.id} className="p-8 flex items-start gap-6 transition-colors hover:bg-foreground/[0.01]">
                                      <NilaiBadge nilai={t.nilai} />
                                      <div className="flex-1 min-w-0 space-y-4">
                                        <div className="flex items-start justify-between gap-4">
                                          <div>
                                            <div className="flex items-center gap-2 mb-1">
                                              <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${isCritical ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'}`}>
                                                {isCritical ? 'Critical Error' : 'Non-Critical'}
                                              </span>
                                            </div>
                                            <h4 className="text-lg font-black">{t.qa_indicators?.name}</h4>
                                          </div>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                          <div className="space-y-2">
                                            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-foreground/30">Ketidaksesuaian</p>
                                            <p className="text-sm text-foreground/80 leading-relaxed font-medium">{t.ketidaksesuaian || '-'}</p>
                                          </div>
                                          <div className="space-y-2">
                                            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-primary/40">Saran Perbaikan / Sebaiknya</p>
                                            <p className="text-sm text-foreground/80 leading-relaxed font-medium italic">{t.sebaiknya || '-'}</p>
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
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
