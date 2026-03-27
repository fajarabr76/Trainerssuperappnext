'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users, BarChart2, TrendingUp, AlertCircle, CheckCircle2, 
  CalendarDays, ChevronDown, Plus, Download, ArrowLeft, Sun, Moon,
  ExternalLink, Activity, ShieldCheck, TrendingDown, Minus, Zap, AlertTriangle,
  Edit2, Trash2, X, Save, Loader2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { scoreColor, scoreBg, scoreLabel, NILAI_LABELS, calculateQAScoreFromTemuan, SERVICE_LABELS, ServiceType } from '../../lib/qa-types';
import type { QAIndicator, QATemuan } from '../../lib/qa-types';
import ParamTrendChart from '../../dashboard/components/ParamTrendChart';
import { getAgentExportDataAction, getPersonalTrendAction, updateTemuanAction, deleteTemuanAction } from '../../actions';

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'];
const MONTHS_FULL  = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

function periodKey(month: number, year: number) { return `${year}-${String(month).padStart(2,'0')}`; }
function pLabel(month: number, year: number) { return `${MONTHS_SHORT[month-1]} ${year}`; }

async function exportToExcel(agentId: string) {
  const { agent, periods } = await getAgentExportDataAction(agentId);
  const wb = XLSX.utils.book_new();

  const summaryRows: any[][] = [
    ['Laporan SIDAK'], [''],
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
  const variants = {
    3: { bg: 'bg-emerald-500', shadow: 'shadow-emerald-500/40', label: 'EXCELLENT' },
    2: { bg: 'bg-blue-500', shadow: 'shadow-blue-500/40', label: 'GOOD' },
    1: { bg: 'bg-amber-500', shadow: 'shadow-amber-500/40', label: 'DEFICIT' },
    0: { bg: 'bg-rose-500', shadow: 'shadow-rose-500/40', label: 'CRITICAL' }
  };
  const v = variants[nilai as keyof typeof variants] || variants[0];
  return (
    <div className="flex flex-col items-center gap-1.5 shrink-0 group/badge">
      <div className={`w-12 h-12 rounded-2xl ${v.bg} ${v.shadow} flex items-center justify-center text-white text-xl font-black shadow-xl transition-transform duration-500 group-hover/badge:scale-110 group-hover/badge:-rotate-6`}>
        {nilai}
      </div>
      <span className={`text-[8px] font-black tracking-[0.2em] ${v.bg.replace('bg-', 'text-')} opacity-60`}>
        {v.label}
      </span>
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

interface QaAgentDetailClientProps {
  agentId: string;
  user: any;
  role: string;
  initialAgent: any;
  initialData: {
    temuan: QATemuan[];
    indicators: QAIndicator[];
    personalTrend: any;
  };
}

const TREND_COLORS = [
  '#A855F7', // Purple
  '#EC4899', // Pink
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#06B6D4'  // Cyan
];

export default function QaAgentDetailClient({ agentId, user, role, initialAgent, initialData }: QaAgentDetailClientProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const [loadingData, setLoadingData] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<{ month: number; year: number; label: string; serviceType: string; id?: string } | null>(null);
  const [timeframe, setTimeframe] = useState<'3m' | '6m' | 'all'>('3m');
  const [activeTrendFilter, setActiveTrendFilter] = useState<string>('all');
  
  const [agent, setAgent] = useState(initialAgent);
  const [data, setData] = useState(initialData);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const [editingTemuan, setEditingTemuan] = useState<any>(null);
  const [editForm, setEditForm] = useState({ nilai: 3, ketidaksesuaian: '', sebaiknya: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const startEdit = (t: any) => {
    setEditingTemuan(t);
    setEditForm({
      nilai: t.nilai,
      ketidaksesuaian: t.ketidaksesuaian || '',
      sebaiknya: t.sebaiknya || ''
    });
  };

  const handleEditSave = async () => {
    if (!editingTemuan) return;
    setIsSubmitting(true);
    try {
      const updated = await updateTemuanAction(editingTemuan.id, editForm);
      setData(prev => ({
        ...prev,
        temuan: prev.temuan.map(t => t.id === updated.id ? updated : t)
      }));
      setEditingTemuan(null);
    } catch (err: any) {
      alert('Gagal menyimpan: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin ingin menghapus temuan ini?')) return;
    setDeletingId(id);
    try {
      await deleteTemuanAction(id);
      setData(prev => ({
        ...prev,
        temuan: prev.temuan.filter(t => t.id !== id)
      }));
    } catch (err: any) {
      alert('Gagal menghapus: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const temuan = data.temuan;
  const indicators = data.indicators;
  const personalTrend = data.personalTrend;

  const sortedPeriods = useMemo(() => {
    const map = new Map<string, { month: number; year: number; label: string; serviceType: string; id?: string }>();
    temuan.forEach(t => {
      if (!t.qa_periods) return;
      const key = `${periodKey(t.qa_periods.month, t.qa_periods.year)}_${t.service_type}`;
      if (!map.has(key)) map.set(key, {
        month: t.qa_periods.month,
        year: t.qa_periods.year,
        serviceType: t.service_type,
        label: `${pLabel(t.qa_periods.month, t.qa_periods.year)} - ${SERVICE_LABELS[t.service_type as keyof typeof SERVICE_LABELS] || t.service_type}`,
        id: t.qa_periods.id,
      });
    });
    return [...map.entries()].sort(([a],[b]) => b.localeCompare(a)).map(([,v]) => v); // Reverse chronological
  }, [temuan]);

  useEffect(() => {
    if (sortedPeriods.length === 0) return;
    const latest = sortedPeriods[0];
    setSelectedPeriod(prev => {
      if (prev && sortedPeriods.some(p => periodKey(p.month, p.year) === periodKey(prev.month, prev.year) && p.serviceType === prev.serviceType)) return prev;
      return latest;
    });
  }, [sortedPeriods]);

  const getScore = useCallback((month: number, year: number, serviceType: string) => {
    const key = periodKey(month, year);
    const pt = temuan.filter(t => t.qa_periods && periodKey(t.qa_periods.month, t.qa_periods.year) === key && t.service_type === serviceType);
    const serviceInds = indicators.filter(i => i.service_type === serviceType);
    return calculateQAScoreFromTemuan(serviceInds, pt.map(t => ({ indicator_id: t.indicator_id, nilai: t.nilai, no_tiket: t.no_tiket })));
  }, [temuan, indicators]);

  const selectedScore = useMemo(() => selectedPeriod ? getScore(selectedPeriod.month, selectedPeriod.year, selectedPeriod.serviceType) : null, [selectedPeriod, getScore]);

  const prevPeriod = useMemo(() => {
    if (!selectedPeriod || sortedPeriods.length < 2) return null;
    // Find the previous period with the SAME service type
    const sameServicePeriods = sortedPeriods.filter(p => p.serviceType === selectedPeriod.serviceType);
    const idx = sameServicePeriods.findIndex(p => periodKey(p.month, p.year) === periodKey(selectedPeriod.month, selectedPeriod.year));
    return idx < sameServicePeriods.length - 1 ? sameServicePeriods[idx + 1] : null;
  }, [selectedPeriod, sortedPeriods]);

  const prevScore = useMemo(() => prevPeriod ? getScore(prevPeriod.month, prevPeriod.year, prevPeriod.serviceType) : null, [prevPeriod, getScore]);

  const trendDir = useMemo(() => selectedScore && prevScore
    ? (selectedScore.finalScore > prevScore.finalScore ? 'up' : selectedScore.finalScore < prevScore.finalScore ? 'down' : 'same')
    : 'none', [selectedScore, prevScore]);

  const selectedTemuan = useMemo(() => {
    if (!selectedPeriod) return [];
    const key = periodKey(selectedPeriod.month, selectedPeriod.year);
    return temuan.filter(t => t.qa_periods && periodKey(t.qa_periods.month, t.qa_periods.year) === key && t.service_type === selectedPeriod.serviceType);
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

  const handleTimeframeChange = async (tf: '3m' | '6m' | 'all') => {
    setTimeframe(tf);
    setLoadingData(true);
    try {
      const trend = await getPersonalTrendAction(agentId, tf, selectedPeriod?.serviceType);
      setData(prev => ({ ...prev, personalTrend: trend }));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (!selectedPeriod) return;
    
    const refreshTrend = async () => {
      setLoadingData(true);
      try {
        const trend = await getPersonalTrendAction(agentId, timeframe, selectedPeriod.serviceType);
        setData(prev => ({ ...prev, personalTrend: trend }));
      } catch (err) {
        console.error("Error refreshing trend:", err);
      } finally {
        setLoadingData(false);
      }
    };
    
    refreshTrend();
  }, [selectedPeriod?.serviceType, agentId, timeframe]);

  const handleExport = async () => {
    setExporting(true);
    try { await exportToExcel(agentId); }
    catch (err: any) { setErrorMsg('Gagal export: ' + err.message); }
    finally { setExporting(false); }
  };

  const handleTambahTemuan = () => {
    const params = new URLSearchParams({
      folder: agent.batch,
      agentId: agentId,
    });
    router.push(`/qa-analyzer/input?${params.toString()}`);
  };

  return (
    <>
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="h-20 flex items-center justify-between px-8 bg-background/80 backdrop-blur-xl border-b border-border/50 sticky top-0 z-40">
          <button 
            onClick={() => router.push('/qa-analyzer/agents')} 
            className="w-10 h-10 rounded-xl bg-foreground/5 hover:bg-primary hover:text-white flex items-center justify-center text-foreground/40 transition-all duration-300 shadow-sm group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          </button>
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-foreground/30 leading-none mb-1">
              <Activity className="w-3 h-3" /> SIDAK
            </div>
            <h1 className="text-lg font-black tracking-tight">Agent Performance Detail</h1>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="w-10 h-10 rounded-xl hover:bg-foreground/5 text-foreground/40 border border-border/50 flex items-center justify-center transition-all bg-card/50">
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
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
                        className="w-8 h-8 rounded-full bg-foreground/5 hover:bg-primary/10 flex items-center justify-center text-foreground/20 hover:text-primary transition-all duration-300"
                        title="Lihat Profil Lengkap"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <div className="px-3 py-1 bg-foreground/5 border border-border/50 rounded-full text-[10px] font-black uppercase tracking-widest text-foreground/40 leading-none">
                        {agent.tim}
                      </div>
                      <div className="px-3 py-1 bg-foreground/5 border border-border/50 rounded-full text-[10px] font-black uppercase tracking-widest text-foreground/40 leading-none">
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
                    onClick={handleTambahTemuan} 
                    className="flex-1 lg:flex-none h-12 px-8 bg-primary text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-primary/30 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Tambah Temuan
                  </button>
                  <button 
                    onClick={handleExport} 
                    disabled={exporting || temuan.length === 0} 
                    className="flex-1 lg:flex-none h-12 px-8 bg-white dark:bg-card border border-border/50 text-foreground rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl hover:bg-foreground/5 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {exporting ? <div className="w-4 h-4 border-2 border-primary/20 border-t-primary rounded-full animate-spin" /> : <Download className="w-4 h-4 text-primary" />}
                    {exporting ? 'Generating...' : 'Export Report'}
                  </button>
                </div>
              </div>
            </div>

            <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
              {temuan.length === 0 ? (
                <div className="bg-card rounded-3xl border border-border p-12 text-center">
                  <div className="w-20 h-20 rounded-3xl bg-foreground/5 flex items-center justify-center mx-auto mb-6"><BarChart2 className="w-10 h-10 text-foreground/20" /></div>
                  <h3 className="text-xl font-black mb-2">No Evaluation Data</h3>
                  <p className="text-foreground/40 mb-8 max-w-sm mx-auto">This agent hasn't been audited yet. Click the button below to start an evaluation.</p>
                  <button onClick={handleTambahTemuan} className="px-8 py-3 bg-primary text-primary-foreground rounded-2xl font-black shadow-xl shadow-primary/20 transition-all hover:scale-105">Start Evaluation</button>
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-8">
                    <div className="w-full space-y-8">
                      {sortedPeriods.length > 0 && (
                        <div className="flex flex-wrap gap-2 bg-card/40 backdrop-blur-md rounded-2xl border border-border/50 p-3 shadow-inner">
                          {sortedPeriods.map(p => {
                            const isActive = periodKey(p.month, p.year) === periodKey(selectedPeriod?.month || 0, selectedPeriod?.year || 0) && p.serviceType === selectedPeriod?.serviceType;
                            return (
                              <button 
                                key={`${periodKey(p.month, p.year)}_${p.serviceType}`} 
                                onClick={() => setSelectedPeriod(p)} 
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all duration-300 ${isActive ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-105' : 'hover:bg-foreground/5 text-foreground/40'}`}
                              >
                                {p.label}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {selectedScore && selectedPeriod && (
                        <>
                          <div className="bg-card/40 backdrop-blur-sm rounded-[2.5rem] border border-border/50 p-10 relative overflow-hidden group shadow-2xl shadow-primary/5">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full -mr-32 -mt-32 blur-[100px] group-hover:bg-primary/20 transition-all duration-1000" />
                            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-10 relative z-10">
                              <div>
                                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-foreground/30 mb-4">
                                  <ShieldCheck className="w-3.5 h-3.5" /> Quality Assurance Score
                                </div>
                                <div className="flex items-baseline gap-4">
                                  <h1 className={`text-9xl font-black tracking-tighter leading-none ${scoreColor(selectedScore.finalScore).includes('green') ? 'text-emerald-500' : scoreColor(selectedScore.finalScore).includes('amber') ? 'text-amber-500' : 'text-rose-500'}`}>
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
                                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/20 mb-1">Audit Samples</span>
                                  <span className="text-4xl font-black tracking-tighter tabular-nums text-foreground/80">{selectedScore.sessionCount} <span className="text-sm font-bold text-foreground/30 ml-1 tracking-normal">Tickets</span></span>
                                </div>
                                {trendDir !== 'none' && (
                                  <div className={`flex items-center lg:justify-end gap-2 font-black text-sm p-3 rounded-2xl bg-foreground/[0.03] border border-border/30 ${trendDir === 'up' ? 'text-emerald-500' : trendDir === 'down' ? 'text-rose-500' : 'text-foreground/40'}`}>
                                    {trendDir === 'up' ? <TrendingUp className="w-5 h-5" /> : trendDir === 'down' ? <TrendingDown className="w-5 h-5" /> : <Minus className="w-5 h-5" />}
                                    <span className="tracking-tight">{trendDir === 'up' ? '+' : ''}{(selectedScore.finalScore - (prevScore?.finalScore || 0)).toFixed(1)}% performance drift</span>
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

                          <AnimatePresence>
                            {automatedCoaching && (
                              <motion.div 
                                initial={{ opacity: 0, y: 30 }} 
                                animate={{ opacity: 1, y: 0 }} 
                                className="group relative bg-indigo-600 rounded-[2.5rem] p-10 text-white overflow-hidden shadow-2xl shadow-indigo-600/30"
                              >
                                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-[100px]" />
                                <div className="absolute -right-8 -bottom-8 opacity-[0.05] rotate-12"><Zap className="w-64 h-64" /></div>
                                
                                <div className="flex items-center gap-4 mb-8">
                                  <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-xl">
                                    <Zap className="w-6 h-6 text-white" />
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/50 leading-none mb-2">Automated Smart Insight</p>
                                    <h4 className="text-2xl font-black tracking-tighter leading-none">Focus Area: {automatedCoaching.parameter}</h4>
                                  </div>
                                </div>
                                
                                <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-[1.5rem] p-8 mb-8">
                                  <p className="text-lg font-medium leading-relaxed italic text-white/90">
                                    "{automatedCoaching.recommendation}"
                                  </p>
                                </div>

                                <div className="flex flex-wrap gap-8">
                                  <div className="space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Priority Level</p>
                                    <div className={`text-xs font-black px-3 py-1 rounded-full border ${automatedCoaching.isCritical ? 'bg-white text-rose-600 border-white' : 'bg-indigo-500/50 text-white border-white/30'}`}>
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

                          <div className="bg-card/40 backdrop-blur-sm rounded-[2.5rem] border border-border/50 p-10 shadow-xl">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-10 gap-4">
                              <div>
                                <h4 className="text-sm font-black uppercase tracking-[0.2em] text-foreground/30">Long-term Performance Trend</h4>
                                <p className="text-[10px] text-foreground/20 font-bold mt-1 uppercase tracking-widest">Aggregate scoring & Top-3 parameter issues</p>
                              </div>
                              <div className="flex items-center bg-foreground/5 border border-border/50 rounded-2xl p-1.5 gap-1 shadow-inner">
                                {(['3m', '6m', 'all'] as const).map((tf) => (
                                  <button
                                    key={tf}
                                    onClick={() => handleTimeframeChange(tf)}
                                    className={`px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all duration-300 ${
                                      timeframe === tf 
                                        ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                                        : 'hover:bg-foreground/5 text-foreground/40'
                                    }`}
                                  >
                                    {tf === '3m' ? 'Quarterly' : tf === '6m' ? 'Semi-Annual' : 'Lifetime'}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div className="w-full">
                              {loadingData ? (
                                <div className="w-full h-[350px] flex items-center justify-center"><div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" /></div>
                              ) : personalTrend && (
                                <>
                                  <div className="flex flex-wrap gap-1.5 mb-8">
                                    <button
                                      onClick={() => setActiveTrendFilter('all')}
                                      className={`px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all duration-300 border ${activeTrendFilter === 'all' ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-105' : 'bg-card/50 text-foreground/40 border-border/50 hover:bg-card hover:text-foreground hover:border-border'}`}
                                    >
                                      All
                                    </button>
                                    {personalTrend.datasets.map((ds: any, i: number) => {
                                      const labelDisplay = ds.label.length > 25 ? ds.label.substring(0, 22) + '...' : ds.label;
                                      const color = ds.isTotal ? 'hsl(var(--primary))' : TREND_COLORS[i % TREND_COLORS.length];
                                      const isActive = activeTrendFilter === ds.label;
                                      
                                      return (
                                        <button
                                          key={ds.label}
                                          onClick={() => setActiveTrendFilter(ds.label)}
                                          title={ds.label}
                                          className={`group px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all duration-300 border flex items-center gap-2 ${isActive ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-105' : 'bg-card/50 text-foreground/40 border-border/50 hover:bg-card hover:text-foreground hover:border-border'}`}
                                        >
                                          <span 
                                            className="w-1.5 h-1.5 rounded-full transition-transform group-hover:scale-125" 
                                            style={{ backgroundColor: isActive ? 'white' : color }} 
                                          />
                                          {labelDisplay}
                                        </button>
                                      );
                                    })}
                                  </div>
                                  <div className="h-[350px] w-full mt-4">
                                    <ParamTrendChart data={personalTrend} filterLabel={activeTrendFilter} />
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="bg-card/40 backdrop-blur-sm rounded-[3rem] border border-border/50 overflow-hidden shadow-2xl shadow-black/5">
                    <div className="px-10 py-10 border-b border-border/50 flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-foreground/[0.01]">
                      <div>
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-foreground/30 mb-2">
                          <BarChart2 className="w-3.5 h-3.5" /> Itemized Observations
                        </div>
                        <h3 className="text-3xl font-black tracking-tighter">Audit Discovery Detail</h3>
                      </div>
                      {selectedPeriod && (
                        <div className="px-6 py-2.5 bg-background/50 border border-border/50 rounded-2xl text-[10px] font-black uppercase tracking-widest text-foreground/50 shadow-inner">
                          Period: {selectedPeriod.label}
                        </div>
                      )}
                    </div>
                    <div className="divide-y divide-border/50">
                      {groupedTemuan.length === 0 ? (
                        <div className="px-10 py-24 text-center">
                          <div className="w-20 h-20 rounded-[2rem] bg-foreground/5 flex items-center justify-center mx-auto mb-6">
                            <ShieldCheck className="w-10 h-10 text-foreground/10" />
                          </div>
                          <h4 className="text-xl font-black text-foreground/30">No issues found in this period.</h4>
                          <p className="text-xs text-foreground/20 mt-2 font-bold uppercase tracking-widest">Excellent record of service</p>
                        </div>
                      ) : (
                        groupedTemuan.map(group => (
                          <div key={group.no_tiket ?? `audit-${group.urutan}`} className="group/audit">
                            <div className="flex items-center justify-between px-10 py-6 bg-foreground/[0.03] group-hover/audit:bg-foreground/[0.05] transition-colors">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center text-xs font-black shadow-lg shadow-primary/30">
                                  {group.urutan}
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/20 leading-none mb-1.5">Reference / Ticket ID</span>
                                  <span className="text-sm font-black font-mono tracking-tight text-foreground/70">{group.no_tiket || 'INTERNAL PERFORMANCE AUDIT'}</span>
                                </div>
                              </div>
                              <div className="px-4 py-1.5 rounded-full bg-background/80 border border-border/50 text-[10px] font-black uppercase tracking-widest text-foreground/40 shadow-sm">
                                {group.items.length} Variable{group.items.length > 1 ? 's' : ''} Highlighted
                              </div>
                            </div>
                            <div className="divide-y divide-border/20">
                              {group.items.map((t: any) => {
                                const isCritical = t.qa_indicators?.category === 'critical';
                                return (
                                  <div key={t.id} className="px-10 py-10 flex items-start gap-10 hover:bg-foreground/[0.01] transition-all duration-300 group">
                                    <NilaiBadge nilai={t.nilai} />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-start justify-between gap-4 mb-6">
                                        <div>
                                          <div className="flex items-center gap-2 mb-2">
                                            <div className={`w-1.5 h-1.5 rounded-full ${isCritical ? 'bg-rose-500 animate-pulse' : 'bg-blue-500'}`} />
                                            <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${isCritical ? 'text-rose-500' : 'text-blue-500'}`}>
                                              {isCritical ? 'Critical Compliance Error' : 'General Performance Issue'}
                                            </span>
                                          </div>
                                          <h4 className="text-xl font-black tracking-tight text-foreground/80">{t.qa_indicators?.name}</h4>
                                        </div>
                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <button onClick={() => startEdit(t)} className="text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 p-2 rounded-xl transition-colors" title="Edit Temuan">
                                            <Edit2 className="w-4 h-4" />
                                          </button>
                                          <button onClick={() => handleDelete(t.id)} disabled={deletingId === t.id} className="text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 p-2 rounded-xl transition-colors disabled:opacity-50" title="Hapus Temuan">
                                            {deletingId === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                          </button>
                                        </div>
                                      </div>
                                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                                        <div className="space-y-3 p-5 rounded-2xl bg-foreground/[0.02] border border-border/30 hover:border-border/60 transition-colors">
                                          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/20 leading-none">Gap Analysis / Discrepancy</p>
                                          <p className="text-sm text-foreground/70 leading-relaxed font-medium">{t.ketidaksesuaian || '-'}</p>
                                        </div>
                                        <div className="space-y-3 p-5 rounded-2xl bg-primary/5 border border-primary/20 hover:border-primary/40 transition-colors">
                                          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-primary/40 leading-none">Strategic Improvement Plan</p>
                                          <p className="text-sm text-foreground/80 leading-relaxed font-bold italic">{t.sebaiknya || '-'}</p>
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
        </div>
      </main>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingTemuan && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => !isSubmitting && setEditingTemuan(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-2xl bg-card border border-border/50 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="px-8 py-6 border-b border-border/50 flex items-center justify-between bg-foreground/[0.02]">
                <div>
                  <h3 className="text-xl font-black tracking-tight">Edit Temuan</h3>
                  <p className="text-xs text-foreground/50 mt-1 font-medium">{editingTemuan.qa_indicators?.name}</p>
                </div>
                <button onClick={() => !isSubmitting && setEditingTemuan(null)} className="w-8 h-8 rounded-full bg-foreground/5 hover:bg-foreground/10 flex items-center justify-center text-foreground/50 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-8 overflow-y-auto flex-1 space-y-6">
                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-foreground/50">Nilai</label>
                  <div className="grid grid-cols-4 gap-3">
                    {[3, 2, 1, 0].map(val => (
                      <button
                        key={val}
                        onClick={() => setEditForm(prev => ({ ...prev, nilai: val }))}
                        className={`p-4 rounded-xl border transition-all flex flex-col items-center gap-2 ${
                          editForm.nilai === val 
                            ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20 scale-105' 
                            : 'bg-background hover:bg-foreground/5 border-border/50'
                        }`}
                      >
                        <span className="text-2xl font-black">{val}</span>
                        <span className="text-[9px] font-black uppercase tracking-widest opacity-80">{val === 3 ? 'EXCELLENT' : val === 2 ? 'GOOD' : val === 1 ? 'DEFICIT' : 'CRITICAL'}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-foreground/50">Ketidaksesuaian</label>
                  <textarea
                    value={editForm.ketidaksesuaian}
                    onChange={e => setEditForm(prev => ({ ...prev, ketidaksesuaian: e.target.value }))}
                    className="w-full h-24 bg-background border border-border/50 rounded-xl p-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="Deskripsikan gap atau isu..."
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-foreground/50">Sebaiknya</label>
                  <textarea
                    value={editForm.sebaiknya}
                    onChange={e => setEditForm(prev => ({ ...prev, sebaiknya: e.target.value }))}
                    className="w-full h-24 bg-background border border-border/50 rounded-xl p-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="Saran perbaikan..."
                  />
                </div>
              </div>
              <div className="px-8 py-6 border-t border-border/50 bg-foreground/[0.02] flex justify-end gap-3">
                <button
                  onClick={() => setEditingTemuan(null)}
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold bg-background border border-border/50 hover:bg-foreground/5 transition-colors disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  onClick={handleEditSave}
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0 flex items-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
