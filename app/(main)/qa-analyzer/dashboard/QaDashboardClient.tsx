'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';

import { 
  QAPeriod, 
  DashboardSummary, 
  TrendPoint as SparklineData,
  ServiceComparisonData, 
  TopAgentData, 
  ParetoData, 
  CriticalVsNonCriticalData,
  DashboardData
} from '../lib/qa-types';

import DashboardFilters from './components/DashboardFilters';
import KpiCard from './components/KpiCard';
import ServiceBarChart from './components/ServiceBarChart';
import TopAgentsTable from './components/TopAgentsTable';
import ParetoChart from './components/ParetoChart';
import FatalDonutChart from './components/FatalDonutChart';
import ParamTrendChart, { TREND_COLORS } from './components/ParamTrendChart';
import { getDashboardDataAction, getTrendByRangeAction } from '../actions';
import { MonthRangePicker } from '@/app/components/ui/MonthRangePicker';

interface QaDashboardClientProps {
  user: any;
  role: string;
  profile: any;
  initialData: DashboardData;
  filters: {
    period: string;
    folder: string;
    timeframe: '3m' | '6m' | 'all';
    service: string;
  };
}

export default function QaDashboardClient({ 
  user, 
  role, 
  profile,
  initialData,
  filters: initialFilters
}: QaDashboardClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [loading, setLoading] = useState(false);
  const [displayData, setDisplayData] = useState(initialData);
  const [selectedYear, setSelectedYear] = useState(initialData.currentYear || new Date().getFullYear());
  
  // Use state for filters to handle immediate UI updates before navigation completes
  const [selectedPeriodId, setSelectedPeriodId] = useState(initialFilters.period);
  const [selectedFolderId, setSelectedFolderId] = useState(initialFilters.folder);
  const [timeframe, setTimeframe] = useState(initialFilters.timeframe);
  const [selectedService, setSelectedService] = useState(initialFilters.service);
  
  // Local trend states (not synced to URL)
  const [trendStartMonth, setTrendStartMonth] = useState<number | null>(null);
  const [trendEndMonth, setTrendEndMonth] = useState<number | null>(null);
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendData, setTrendData] = useState<any>(initialData.paramTrend);

  const [hiddenParams, setHiddenParams] = useState<Set<string>>(() => {
    const labels = initialData.paramTrend?.datasets
      .filter((ds: any) => !ds.isTotal && ds.label)
      .map((ds: any) => ds.label as string) || [];
    return new Set(labels);
  });

  // Reset local trend states when global filters change
  useEffect(() => {
    setTrendStartMonth(null);
    setTrendEndMonth(null);
    setTrendData(initialData.paramTrend);
    
    const newLabels = initialData.paramTrend?.datasets
      .filter((ds: any) => !ds.isTotal && ds.label)
      .map((ds: any) => ds.label as string) || [];
    setHiddenParams(new Set(newLabels));
  }, [selectedYear, selectedService, selectedFolderId, initialData.paramTrend]);

  const toggleParam = (label: string) => {
    setHiddenParams(prev => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  };

  // Update URL when filters change
  const updateFilters = (newPeriod: string, newFolder: string, newTimeframe: string, newService: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('period', newPeriod);
    params.set('folder', newFolder);
    params.set('timeframe', newTimeframe);
    params.set('service', newService);
    setLoading(true);
    router.push(`?${params.toString()}`);
  };

  const handleYearChange = async (year: number) => {
    setSelectedYear(year);
    if (year === selectedYear) return;
    
    setLoading(true);
    try {
      const folderIds = selectedFolderId === 'ALL' ? [] : [selectedFolderId];
      const newData = await getDashboardDataAction(selectedPeriodId, selectedService, folderIds, timeframe, year);
      setDisplayData(prev => ({
        ...prev,
        ...newData
      }));
      // Local reset is handled by useEffect dependency [selectedYear, initialData]
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRangeChange = async (start: number | null, end: number | null) => {
    setTrendStartMonth(start);
    setTrendEndMonth(end);

    // Only fetch if both are selected and valid
    if (start !== null && end !== null && end >= start) {
      setTrendLoading(true);
      try {
        const folderIds = selectedFolderId === 'ALL' ? [] : [selectedFolderId];
        const result = await getTrendByRangeAction(selectedService, folderIds, selectedYear, start, end);
        setTrendData(result.paramTrend);
        
        // Reset hidden params for new dataset
        const newLabels = result.paramTrend?.datasets
          .filter((ds: any) => !ds.isTotal && ds.label)
          .map((ds: any) => ds.label as string) || [];
        setHiddenParams(new Set(newLabels));
      } catch (err) {
        console.error('Failed to fetch trend by range:', err);
      } finally {
        setTrendLoading(false);
      }
    } else if (start === null && end === null) {
      // Reset to original data
      setTrendData(initialData.paramTrend);
      const newLabels = initialData.paramTrend?.datasets
        .filter((ds: any) => !ds.isTotal && ds.label)
        .map((ds: any) => ds.label as string) || [];
      setHiddenParams(new Set(newLabels));
    }
  };

  useEffect(() => {
    // Stop loading when props update (navigation complete)
    setLoading(false);
    setSelectedPeriodId(initialFilters.period);
    setSelectedFolderId(initialFilters.folder);
    setTimeframe(initialFilters.timeframe);
    setSelectedService(initialFilters.service);
    setDisplayData(initialData);
    const newLabels = initialData.paramTrend?.datasets
      .filter((ds: any) => !ds.isTotal && ds.label)
      .map((ds: any) => ds.label as string) || [];
    setHiddenParams(new Set(newLabels));
  }, [initialData]);

  const hasVisibleParam = trendData?.datasets
    .filter((ds: any) => !ds.isTotal && ds.label)
    .some((ds: any) => !hiddenParams.has(ds.label)) ?? false;

  const isTrendEmpty = !trendData || trendData.labels.length === 0 || 
    (trendData.datasets.filter((ds: any) => !ds.isTotal).every((ds: any) => ds.data.every((v: number) => v === 0)));

  return (
    <>
      <main className="flex-1 overflow-y-auto relative flex flex-col pb-20">
        <div className="sticky top-0 z-30 flex items-center justify-between p-6 bg-background/80 backdrop-blur-md border-b border-border/50">
          <div className="flex items-center gap-4">
            <div className="h-8 w-px bg-border mx-2 hidden md:block" />
            <div className="hidden md:flex flex-col">
              <span className="text-[10px] font-mono uppercase tracking-widest opacity-40">Status Sesi</span>
              <span className="text-xs font-bold text-emerald-500 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Aktif & Terenkripsi
              </span>
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
              <div className="flex items-center gap-2 text-sm text-foreground/60 mb-4">
                <Link href="/dashboard" className="hover:text-primary transition-colors">Dashboard</Link>
                <span>/</span>
                <span className="text-foreground font-medium">SIDAK</span>
              </div>
              <h1 className="text-4xl lg:text-5xl font-bold tracking-tighter mb-4 bg-gradient-to-r from-foreground to-foreground/50 bg-clip-text text-transparent">
                SIDAK Performance Dashboard
              </h1>
              <p className="text-lg text-foreground/40 font-light max-w-2xl leading-relaxed">
                Pantau performa kualitas, analisis akar masalah, dan temukan area perbaikan untuk tim Anda.
              </p>
            </motion.div>
          </header>

          <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <DashboardFilters 
                periods={displayData.periods}
                selectedPeriodId={selectedPeriodId}
                onPeriodChange={(v) => { setSelectedPeriodId(v); updateFilters(v, selectedFolderId, timeframe, selectedService); }}
                folders={displayData.folders}
                selectedFolderId={selectedFolderId}
                onFolderChange={(v) => { setSelectedFolderId(v); updateFilters(selectedPeriodId, v, timeframe, selectedService); }}
                timeframe={timeframe}
                onTimeframeChange={(v) => { setTimeframe(v); updateFilters(selectedPeriodId, selectedFolderId, v, selectedService); }}
                serviceType={selectedService}
                onServiceChange={(v) => { setSelectedService(v); updateFilters(selectedPeriodId, selectedFolderId, timeframe, v); }}
                selectedYear={selectedYear}
                availableYears={displayData.availableYears || []}
                onYearChange={handleYearChange}
              />
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-32 text-foreground/40">
                <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                <p>Membarui data SIDAK...</p>
              </div>
            ) : !initialData.summary ? (
              <div className="flex flex-col items-center justify-center py-32 text-foreground/40 bg-card rounded-2xl border border-dashed border-border">
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
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <span className="w-1 h-5 bg-primary rounded-full"></span>
                    Executive Summary
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
                    <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                      <span className="w-1 h-5 bg-chart-blue rounded-full"></span>
                      Total Temuan per Layanan
                    </h2>
                    <ServiceBarChart data={displayData.serviceData} />
                  </section>

                  <section className="bg-card rounded-2xl border border-border/40 p-5">
                    <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
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
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <span className="w-1 h-5 bg-primary rounded-full"></span>
                      Historical Trends & Parameter Analysis
                    </h2>
                    <div className="flex items-center gap-2 px-3 py-1 bg-primary/5 rounded-full border border-primary/10">
                      <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                        {timeframe === '3m' ? 'Last 3 Months' : timeframe === '6m' ? 'Last 6 Months' : 'All Available Data'}
                      </span>
                    </div>
                  </div>

                  <MonthRangePicker 
                    selectedYear={selectedYear}
                    startMonth={trendStartMonth}
                    endMonth={trendEndMonth}
                    onRangeChange={handleRangeChange}
                  />

                  {trendLoading ? (
                    <div className="flex flex-col items-center justify-center py-24 text-foreground/40">
                      <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                      <p className="text-sm">Membarui tren parameter...</p>
                    </div>
                  ) : isTrendEmpty ? (
                    <div className="flex flex-col items-center justify-center py-24 text-foreground/40 bg-background/20 rounded-2xl border border-dashed border-border/50">
                      <AlertTriangle className="w-8 h-8 text-yellow-500 mb-3 opacity-30" />
                      <p className="text-sm font-medium">Tidak ada data pada rentang bulan ini</p>
                    </div>
                  ) : trendData && (
                    <>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {trendData.datasets.map((ds: any, i: number) => {
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
                      <p className="text-xs text-foreground/40 mt-1 mb-3">
                        Klik parameter untuk menampilkan tren spesifik
                      </p>
                      <div className="h-[350px] w-full">
                        <ParamTrendChart 
                          data={trendData} 
                          showParameters={true} 
                          hiddenKeys={hiddenParams}
                          hideTotal={hasVisibleParam}
                        />
                      </div>
                    </>
                  )}
                </section>

                <section className="bg-card rounded-2xl border border-border/40 p-5">
                  <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                    <span className="w-1 h-5 bg-chart-red rounded-full"></span>
                    Root Cause Analysis
                  </h2>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2">
                      <h3 className="text-sm font-medium text-foreground/60 mb-4">Pareto Kategori Temuan (80/20 Rule)</h3>
                      <ParetoChart data={displayData.paretoData} />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-foreground/60 mb-4 text-center">Proporsi Critical vs Non-Critical</h3>
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
