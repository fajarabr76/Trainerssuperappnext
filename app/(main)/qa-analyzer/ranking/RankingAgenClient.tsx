'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Calendar, 
  Trophy, 
  LayoutGrid,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { 
  TopAgentData, 
  QAPeriod, 
  ServiceType, 
  SERVICE_LABELS,
  scoreColor,
} from '../lib/qa-types';
import { getRankingAgenAction } from '../actions';
import { YearSelector } from '../dashboard/components/YearSelector';
import QaStatePanel from '../components/QaStatePanel';

interface Props {
  initialData: TopAgentData[];
  periods: QAPeriod[];
  folders: { id: string, name: string }[];
  availableYears: number[];
  serviceTypes: ServiceType[];
  defaultServiceType: string;
  defaultPeriodId: string;
  defaultYear: number;
  role: string;
}

type SortKey = 'defects' | 'nama' | 'score';
type SortDirection = 'asc' | 'desc';

export default function RankingAgenClient({
  initialData,
  periods,
  folders,
  availableYears,
  serviceTypes,
  defaultServiceType,
  defaultPeriodId,
  defaultYear,
  role
}: Props) {
  const MONTHS = [
    'Januari', 'Februari', 'Maret', 'April',
    'Mei', 'Juni', 'Juli', 'Agustus',
    'September', 'Oktober', 'November', 
    'Desember'
  ];

  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const isFirstRender = useRef(true);
  const [sortKey, setSortKey] = useState<SortKey>('defects');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const isReadOnly = role?.toLowerCase() === 'leader';

  // Local state for rankings (refetched when filters change)
  const [rankings, setRankings] = useState<TopAgentData[]>(initialData);

  const sortedRankings = React.useMemo(() => {
    const collator = new Intl.Collator('id', { sensitivity: 'base', numeric: true });
    const sorted = [...rankings].sort((a, b) => {
      if (sortKey === 'nama') {
        return sortDirection === 'asc'
          ? collator.compare(a.nama, b.nama)
          : collator.compare(b.nama, a.nama);
      }

      if (sortKey === 'score') {
        return sortDirection === 'asc'
          ? a.score - b.score
          : b.score - a.score;
      }

      return sortDirection === 'asc'
        ? a.defects - b.defects
        : b.defects - a.defects;
    });

    return sorted;
  }, [rankings, sortKey, sortDirection]);

  // Derive filters from URL or defaults
  const serviceType = searchParams.get('service') as ServiceType || defaultServiceType;
  const periodId = searchParams.get('period') || defaultPeriodId;
  const selectedYear = Number(searchParams.get('year')) || defaultYear;
  const folderId = searchParams.get('folder') || 'ALL';
  const isYearToDate = periodId === 'ytd';
  const scoreColumnLabel = isYearToDate ? 'Rata-rata Skor QA' : 'Skor QA';

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const folderIds = folderId === 'ALL' ? [] : [folderId];
        const { data, error } = await getRankingAgenAction(
          periodId,
          serviceType,
          folderIds,
          selectedYear
        );
        if (!error && data) setRankings(data);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [serviceType, periodId, selectedYear, folderId]);

  const updateFilters = (newFilters: Record<string, string | number>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(newFilters).forEach(([key, value]) => {
      params.set(key, String(value));
    });
    router.push(`?${params.toString()}`, { scroll: false });
  };

  const toggleSort = (key: SortKey, defaultDirection: SortDirection) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortKey(key);
    setSortDirection(defaultDirection);
  };

  const renderSortIcon = (key: SortKey) => {
    const isActive = sortKey === key;

    if (!isActive) {
      return <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />;
    }

    return sortDirection === 'asc'
      ? <ArrowUp className="w-3.5 h-3.5" />
      : <ArrowDown className="w-3.5 h-3.5" />;
  };

  return (
    <main className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-8">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-1"
        >
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-2xl">
              <Trophy className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground/90">
              Ranking Agen
            </h1>
            {isReadOnly && (
              <span className="px-2 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase tracking-wider">
                Read Only
              </span>
            )}
          </div>
          <p className="text-muted-foreground pl-12 text-sm md:text-base font-medium">
            Peringkat agen berdasarkan jumlah temuan QA. Klik nama atau skor QA untuk mengubah urutan.
          </p>
        </motion.div>
      </div>

      {/* FILTER BAR */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-1 rounded-[2rem] bg-background/40 backdrop-blur-3xl border border-white/20 shadow-2xl overflow-hidden"
      >
        <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          {/* Layanan */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2 px-1">
              <LayoutGrid className="w-3 h-3" /> Layanan
            </label>
            <div className="relative group">
              <select
                value={serviceType}
                onChange={(e) => updateFilters({ service: e.target.value })}
                className="w-full h-12 bg-white/50 dark:bg-black/20 backdrop-blur-md border border-black/5 dark:border-white/10 rounded-2xl px-4 appearance-none focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-semibold text-sm cursor-pointer"
              >
                {serviceTypes.map(st => (
                  <option key={st} value={st}>{SERVICE_LABELS[st]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Periode */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2 px-1">
              <Calendar className="w-3 h-3" /> Periode
            </label>
            <div className="relative group">
              <select
                value={periodId}
                onChange={(e) => updateFilters({ period: e.target.value })}
                className="w-full h-12 bg-white/50 dark:bg-black/20 backdrop-blur-md border border-black/5 dark:border-white/10 rounded-2xl px-4 appearance-none focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-semibold text-sm cursor-pointer"
              >
                <option value="ytd">Year to Date (YTD)</option>
                <option value="alltime">All Time</option>
                <optgroup label="Bulan Terdaftar">
                  {periods
                    .filter(p => p.year === selectedYear)
                    .map(p => (
                      <option key={p.id} value={p.id}>
                        {`${MONTHS[(p.month ?? 1) - 1]} ${p.year}`}
                      </option>
                    ))}
                </optgroup>
              </select>
            </div>
          </div>

          {/* Tahun */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2 px-1">
              <Calendar className="w-3 h-3" /> Tahun
            </label>
            <YearSelector
              years={availableYears}
              selectedYear={selectedYear}
              onYearChange={(y) => updateFilters({ year: y })}
            />
          </div>

          {/* Folder/Batch */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2 px-1">
              <Users className="w-3 h-3" /> Folder/Tim
            </label>
            <select
              value={folderId}
              onChange={(e) => updateFilters({ folder: e.target.value })}
              className="w-full h-12 bg-white/50 dark:bg-black/20 backdrop-blur-md border border-black/5 dark:border-white/10 rounded-2xl px-4 appearance-none focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-semibold text-sm cursor-pointer"
            >
              <option value="ALL">Semua Tim</option>
              {folders.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
        </div>
      </motion.div>

      {/* RANKING TABLE */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-background/40 backdrop-blur-2xl border border-white/20 rounded-[2.5rem] shadow-xl overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/50 dark:bg-black/20">
                <th className="px-6 py-5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60 w-16">Rank</th>
                <th className="px-6 py-5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">
                  <button
                    type="button"
                    onClick={() => toggleSort('nama', 'asc')}
                    className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
                    aria-label="Sortir berdasarkan nama agen"
                  >
                    Agen
                    {renderSortIcon('nama')}
                  </button>
                </th>
                <th className="px-6 py-5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Tim/Batch</th>
                <th className="px-6 py-5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60 text-right">
                  <button
                    type="button"
                    onClick={() => toggleSort('defects', 'desc')}
                    className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
                    aria-label="Sortir berdasarkan jumlah temuan"
                  >
                    Total Temuan
                    {renderSortIcon('defects')}
                  </button>
                </th>
                <th className="px-6 py-5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60 text-right">
                  <button
                    type="button"
                    onClick={() => toggleSort('score', 'desc')}
                    className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
                    aria-label="Sortir berdasarkan skor QA"
                  >
                    {scoreColumnLabel}
                    {renderSortIcon('score')}
                  </button>
                </th>
                <th className="px-6 py-5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5 relative">
              <AnimatePresence mode='wait'>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <motion.tr 
                      key={`skeleton-${i}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <td colSpan={6} className="px-6 py-8">
                        <div className="h-6 bg-foreground/5 rounded-lg w-full animate-pulse" />
                      </td>
                    </motion.tr>
                  ))
                ) : sortedRankings.length > 0 ? (
                  sortedRankings.map((agent, i) => {
                    const rank = i + 1;
                    const isTop3 = rank <= 3;
                    return (
                      <motion.tr 
                        key={agent.agentId}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        onClick={() => router.push(`/qa-analyzer/agents/${agent.agentId}`)}
                        className={`group cursor-pointer hover:bg-primary/5 transition-all duration-200 ${isTop3 ? 'bg-primary/5' : ''}`}
                      >
                        <td className="px-6 py-5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                            rank === 1 ? 'bg-amber-400/20 text-amber-600 dark:text-amber-400' :
                            rank === 2 ? 'bg-slate-400/20 text-slate-600 dark:text-slate-400' :
                            rank === 3 ? 'bg-orange-400/20 text-orange-600 dark:text-orange-400' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {rank}
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="font-bold text-foreground/80 group-hover:text-primary transition-colors">
                            {agent.nama}
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="text-xs font-semibold px-2 py-1 bg-foreground/5 rounded-md inline-block">
                            {agent.batch}
                          </div>
                        </td>
                        <td className="px-6 py-5 text-right font-mono font-bold text-foreground/80">
                          {agent.defects}
                        </td>
                        <td className={`px-6 py-5 text-right font-bold ${scoreColor(agent.score)}`}>
                          {agent.score.toFixed(1)}%
                        </td>
                        <td className="px-6 py-5 text-center">
                          {agent.hasCritical && (
                            <motion.span 
                              initial={{ scale: 0.8 }}
                              animate={{ scale: 1 }}
                              className="px-2 py-1 bg-red-500 text-white text-[10px] font-black uppercase tracking-tighter rounded-full shadow-lg shadow-red-500/20"
                            >
                              ⚠ Fatal
                            </motion.span>
                          )}
                        </td>
                      </motion.tr>
                    );
                  })
                ) : (
                  <motion.tr 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <td colSpan={6} className="px-6 py-24 text-center">
                      <QaStatePanel
                        type="empty"
                        title="Data ranking belum tersedia untuk filter ini"
                        description="Ubah layanan, periode, tahun, atau folder untuk menampilkan data ranking agen."
                        className="mx-auto max-w-md text-left"
                      />
                    </td>
                  </motion.tr>
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </motion.div>
        </div>
      </div>
    </main>
  );
}
