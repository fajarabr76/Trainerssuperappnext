'use client';

import React, { startTransition, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, AlertTriangle, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';

import { DashboardData, TrendDataset } from '../lib/qa-types';

import DashboardFilters from './components/DashboardFilters';
import KpiCard from './components/KpiCard';
import ServiceBarChart from './components/ServiceBarChart';
import TopAgentsTable from './components/TopAgentsTable';
import ParetoChart from './components/ParetoChart';
import FatalDonutChart from './components/FatalDonutChart';
import ParamTrendChart, { TREND_COLORS } from './components/ParamTrendChart';

import { User } from '@supabase/supabase-js';
import { Profile } from '@/app/types/auth';

interface QaDashboardClientProps {
  user: User | null;
  role: string;
  profile: Profile | null;
  initialData: DashboardData;
  filters: {
    startMonth: number;
    endMonth: number;
    folder: string;
    service: string;
    year: number;
  };
}

export default function QaDashboardClient({ 
  user, 
  role: _role, 
  profile: _profile,
  initialData,
  filters: initialFilters
}: QaDashboardClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [loading, setLoading] = useState(false);
  const [displayData, setDisplayData] = useState(initialData);
  const [selectedYear, setSelectedYear] = useState(initialFilters.year);
  
  // States synchronized with URL
  const [startMonth, setStartMonth] = useState(initialFilters.startMonth);
  const [endMonth, setEndMonth] = useState(initialFilters.endMonth);
  const [selectedFolderId, setSelectedFolderId] = useState(initialFilters.folder);
  const [selectedService, setSelectedService] = useState(initialFilters.service);
  
  // Trend local state for hiding/showing parameters only
  const [hiddenParams, setHiddenParams] = useState<Set<string>>(() => {
    const labels = initialData.paramTrend?.datasets
      .filter((ds: any) => !ds.isTotal && ds.label)
      .map((ds: any) => ds.label as string) || [];
    return new Set(labels);
  });

  // Sync state when initialData (props) changes (navigation complete)
  useEffect(() => {
    setLoading(false);
    setSelectedYear(initialFilters.year);
    setStartMonth(initialFilters.startMonth);
    setEndMonth(initialFilters.endMonth);
    setSelectedFolderId(initialFilters.folder);
    setSelectedService(initialFilters.service);
    setDisplayData(initialData);
    
    const newLabels = initialData.paramTrend?.datasets
      .filter((ds: TrendDataset) => !ds.isTotal && ds.label)
      .map((ds: TrendDataset) => ds.label as string) || [];
    setHiddenParams(new Set(newLabels));
  }, [initialData, initialFilters]);

  const toggleParam = (label: string) => {
    setHiddenParams(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  // Update URL when filters change
  const updateFilters = (newStart: number, newEnd: number, newFolder: string, newService: string, newYear: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('start_month', String(newStart));
    params.set('end_month', String(newEnd));
    params.set('folder', newFolder);
    params.set('service', newService);
    params.set('year', String(newYear));
    
    // Remove legacy params if they exist
    params.delete('period');
    params.delete('timeframe');
    
    setLoading(true);
    startTransition(() => {
      router.replace(`?${params.toString()}`);
    });
  };

  const handleYearChange = (year: number) => {
    if (year === selectedYear) return;
    updateFilters(startMonth, endMonth, selectedFolderId, selectedService, year);
  };

  const handleRangeChange = (start: number | null, end: number | null) => {
    if (start !== null && end !== null) {
      updateFilters(start, end, selectedFolderId, selectedService, selectedYear);
    }
  };

  const hasVisibleParam = displayData.paramTrend?.datasets
    .filter((ds: TrendDataset) => !ds.isTotal && ds.label)
    .some((ds: TrendDataset) => !hiddenParams.has(ds.label)) ?? false;

  const isTrendEmpty = !displayData.paramTrend || displayData.paramTrend.labels.length === 0 || 
    (displayData.paramTrend.datasets.filter((ds: TrendDataset) => !ds.isTotal).every((ds: TrendDataset) => ds.data.every((v: number) => v === 0)));

  return (
    <>
      <main className="flex-1 overflow-y-auto relative flex flex-col pb-20">
        <div className="sticky top-0 z-30 flex items-center justify-between border-b border-border/50 bg-background/80 p-6 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col leading-none">
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-foreground/70 font-display">SIDAK Workspace</span>
              <span className="mt-1 text-sm font-semibold tracking-tight">Analitik kualitas</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-sm">
              {user?.email?.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>

        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1200px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none opacity-50" />
        
        <div className="p-8 lg:p-12 w-full max-w-[1600px] mx-auto relative z-10">
          <header className="mb-12">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                <Link href="/dashboard" className="hover:text-primary transition-colors">Dashboard</Link>
                <span>/</span>
                <span className="text-foreground font-medium">SIDAK</span>
              </div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/8 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Workspace analitik terpadu
              </div>
              <h1 className="mb-4 text-4xl font-semibold tracking-tight lg:text-5xl font-display">
                Dashboard Analitik SIDAK
              </h1>
              <p className="max-w-2xl text-lg font-light leading-relaxed text-muted-foreground">
                Pantau performa kualitas, analisis akar masalah, dan temukan area perbaikan untuk tim Anda.
              </p>
            </motion.div>
          </header>

          <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <DashboardFilters 
                startMonth={startMonth}
                endMonth={endMonth}
                onRangeChange={handleRangeChange}
                folders={displayData.folders}
                selectedFolderId={selectedFolderId}
                onFolderChange={(v) => { setSelectedFolderId(v); updateFilters(startMonth, endMonth, v, selectedService, selectedYear); }}
                serviceType={selectedService}
                onServiceChange={(v) => { setSelectedService(v); updateFilters(startMonth, endMonth, selectedFolderId, v, selectedYear); }}
                selectedYear={selectedYear}
                availableYears={displayData.availableYears || []}
                onYearChange={handleYearChange}
              />
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-32 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                <p>Membarui data SIDAK...</p>
              </div>
            ) : !displayData.summary ? (
              <div className="flex flex-col items-center justify-center py-32 text-muted-foreground bg-card rounded-2xl border border-dashed border-border">
                <AlertTriangle className="w-12 h-12 text-yellow-500 mb-4 opacity-50" />
                <p className="text-lg font-medium text-foreground mb-1">Tidak Ada Data</p>
                <p className="text-sm">Silakan pilih periode atau tim yang berbeda.</p>
              </div>
            ) : (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                <section>
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 font-display">
                    <span className="w-1 h-5 bg-primary rounded-full"></span>
                    Ringkasan Utama
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <KpiCard 
                      label="Total Temuan QA"
                      value={displayData.summary.totalDefects}
                      delta={-12}
                      target="Target: < 100"
                      reverseLogic={true}
                      sparklineData={displayData.sparklines.total || []}
                    />
                    <KpiCard 
                      label="Rata-rata temuan parameter / agent"
                      value={displayData.summary.avgDefectsPerAudit.toFixed(1)}
                      delta={-5}
                      target="Target: < 1.0"
                      reverseLogic={true}
                      sparklineData={displayData.sparklines.avg || []}
                    />
                    <KpiCard 
                      label="Rata-rata Skor Agent"
                      value={displayData.summary.avgAgentScore?.toFixed(1) ?? '0.0'}
                      unit="%"
                      delta={0}
                      target="TARGET: ≥ 95%"
                      targetValue={95}
                      reverseLogic={false}
                      sparklineData={displayData.sparklines.avgAgentScore || []}
                    />
                    <KpiCard 
                      label="Kepatuhan (Skor ≥ 95%)"
                      value={displayData.summary.complianceCount}
                      unit={` agent (${displayData.summary.complianceRate.toFixed(1)}%)`}
                      delta={4}
                      target="Target: > 95%"
                      reverseLogic={false}
                      sparklineData={displayData.sparklines.compliance || []}
                    />
                  </div>
                </section>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <section className="bg-card rounded-2xl border border-border/40 p-5">
                    <h2 className="text-lg font-semibold mb-6 flex items-center gap-2 font-display">
                      <span className="w-1 h-5 bg-chart-blue rounded-full"></span>
                      Total Temuan per Layanan
                    </h2>
                    <ServiceBarChart data={displayData.serviceData} />
                  </section>

                  <section className="bg-card rounded-2xl border border-border/40 p-5">
                    <h2 className="text-lg font-semibold mb-6 flex items-center gap-2 font-display">
                      <span className="w-1 h-5 bg-chart-orange rounded-full"></span>
                      Top 5 Agen (Temuan Tertinggi)
                    </h2>
                    <TopAgentsTable 
                      agents={displayData.topAgents} 
                      serviceType={selectedService}
                      selectedYear={selectedYear}
                    />
                  </section>
                </div>
                
                <section className="bg-card rounded-2xl border border-border/40 p-5">
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="text-lg font-semibold flex items-center gap-2 font-display">
                      <span className="w-1 h-5 bg-primary rounded-full"></span>
                      Tren Historis & Analisis Parameter
                    </h2>
                    <div className="flex items-center gap-2 px-3 py-1 bg-primary/5 rounded-full border border-primary/10">
                      <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                        Periode Analisis Tersinkronisasi
                      </span>
                    </div>
                  </div>

                  {isTrendEmpty ? (
                    <div className="flex flex-col items-center justify-center py-24 text-muted-foreground bg-background/20 rounded-2xl border border-dashed border-border/50">
                      <AlertTriangle className="w-8 h-8 text-yellow-500 mb-3 opacity-30" />
                      <p className="text-sm font-medium">Tidak ada data pada rentang bulan ini</p>
                    </div>
                  ) : displayData.paramTrend && (
                    <>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {displayData.paramTrend.datasets.map((ds: any, i: number) => {
                          if (ds.isTotal) return null;
                          const color = TREND_COLORS[i % TREND_COLORS.length];
                          const isHidden = hiddenParams.has(ds.label);
                          return (
                            <button
                              key={ds.label}
                              onClick={() => toggleParam(ds.label)}
                              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all duration-200 ${
                                isHidden
                                  ? 'opacity-40 border-border bg-transparent line-through'
                                  : 'border-transparent'
                              }`}
                              style={{
                                backgroundColor: isHidden ? 'transparent' : `${color}22`,
                                color,
                              }}
                            >
                              <span
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: color }}
                              />
                              {ds.label}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 mb-3">
                        Klik parameter untuk menampilkan tren spesifik
                      </p>
                      <div className="h-[350px] w-full rounded-[2rem] border border-border/40 bg-background/60 dark:bg-white/[0.04] p-3 shadow-inner">
                        <ParamTrendChart 
                          data={displayData.paramTrend} 
                          showParameters={true} 
                          hiddenKeys={hiddenParams}
                          hideTotal={hasVisibleParam}
                        />
                      </div>
                    </>
                  )}
                </section>

                <section className="bg-card rounded-2xl border border-border/40 p-5">
                  <h2 className="text-lg font-semibold mb-6 flex items-center gap-2 font-display">
                    <span className="w-1 h-5 bg-chart-red rounded-full"></span>
                    Analisis Akar Masalah
                  </h2>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2">
                      <h3 className="text-sm font-medium text-muted-foreground mb-4">Pareto Kategori Temuan (80/20 Rule)</h3>
                      <ParetoChart data={displayData.paretoData} />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-4 text-center">Proporsi Critical vs Non-Critical</h3>
                      {displayData.donutData && <FatalDonutChart data={displayData.donutData} />}
                    </div>
                  </div>
                </section>
              </motion.div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
