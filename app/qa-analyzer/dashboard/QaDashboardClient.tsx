'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ArrowLeft, Loader2, AlertTriangle, LayoutDashboard, MessageSquare, Mail, Phone, Users, BarChart3, Settings, LogOut, ChevronRight, CalendarDays } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { createClient } from '@/app/lib/supabase/client';
import { ThemeToggle } from "../../components/ThemeToggle";
import Sidebar from "../../components/Sidebar";

import { qaService } from '../services/qaService';
import { 
  QAPeriod, 
  DashboardSummary, 
  TrendPoint as SparklineData, 
  calculateQAScoreFromTemuan 
} from '../lib/qa-types';
import type { TeamComparisonData, TopAgentData, ParetoData, FatalVsNonFatalData } from '../services/qaService';
import { profilerService } from '../../profiler/services/profilerService';

import DashboardFilters from './components/DashboardFilters';
import KpiCard from './components/KpiCard';
import TeamBarChart from './components/TeamBarChart';
import TopAgentsTable from './components/TopAgentsTable';
import ParetoChart from './components/ParetoChart';
import FatalDonutChart from './components/FatalDonutChart';
import ParamTrendChart from './components/ParamTrendChart';


export default function QaDashboardClient({ user, role, profile }: { user: any, role: string, profile: any }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [periods, setPeriods] = useState<QAPeriod[]>([]);
  const [folders, setFolders] = useState<{id: string, name: string}[]>([]);
  
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('ytd');
  const [selectedFolderId, setSelectedFolderId] = useState<string>('ALL');
  const [timeframe, setTimeframe] = useState<'3m' | '6m' | 'all'>('3m');
  
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [sparklines, setSparklines] = useState<Record<string, SparklineData[]>>({});
  const [teamData, setTeamData] = useState<TeamComparisonData[]>([]);
  const [topAgents, setTopAgents] = useState<TopAgentData[]>([]);
  const [paretoData, setParetoData] = useState<ParetoData[]>([]);
  const [donutData, setDonutData] = useState<FatalVsNonFatalData | null>(null);
  const [paramTrend, setParamTrend] = useState<any>(null);

  useEffect(() => {
    async function init() {
      try {
        const [fetchedPeriods, fetchedFolders] = await Promise.all([
          qaService.getPeriods(),
          profilerService.getFolders()
        ]);
        
        setPeriods(fetchedPeriods);
        setFolders(fetchedFolders.map(f => ({ id: f.name, name: f.name }))); // Using name as ID for batch filtering
        
        // Remove auto-selection of first period so it defaults to 'ytd'
      } catch (error) {
        console.error("Failed to init dashboard:", error);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (!selectedPeriodId) return;

    async function loadDashboardData() {
      setLoading(true);
      try {
        const folderIds = selectedFolderId === 'ALL' ? [] : [selectedFolderId];
        
        const [
          sumData,
          tData,
          aData,
          pData,
          dData,
          spark1, spark2, spark3, spark4,
          pTrend
        ] = await Promise.all([
          qaService.getDashboardSummary(folderIds, selectedPeriodId),
          qaService.getTeamComparison(folderIds, selectedPeriodId),
          qaService.getTopAgentsWithDefects(folderIds, selectedPeriodId, 5),
          qaService.getParetoData(folderIds, selectedPeriodId),
          qaService.getFatalVsNonFatal(folderIds, selectedPeriodId),
          qaService.getKpiSparkline(folderIds, null, 'total', timeframe),
          qaService.getKpiSparkline(folderIds, null, 'avg', timeframe),
          qaService.getKpiSparkline(folderIds, null, 'fatal', timeframe),
          qaService.getKpiSparkline(folderIds, null, 'compliance', timeframe),
          qaService.getTrendWithParameters(folderIds, timeframe)
        ]);

        setSummary(sumData);
        setTeamData(tData);
        setTopAgents(aData);
        setParetoData(pData);
        setDonutData(dData);
        setParamTrend(pTrend);
        
        setSparklines({
          total: spark1,
          avg: spark2,
          fatal: spark3,
          compliance: spark4
        });
      } catch (error) {
        console.error("Failed to load dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, [selectedPeriodId, selectedFolderId, timeframe]);


  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const selectedFolderName = useMemo(() => {
    if (selectedFolderId === 'ALL') return 'Semua Tim';
    return folders.find(f => f.id === selectedFolderId)?.name || 'Tim';
  }, [selectedFolderId, folders]);

  const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

  const selectedPeriodName = useMemo(() => {
    if (selectedPeriodId === 'ytd') return `YTD ${new Date().getFullYear()}`;
    const p = periods.find(p => p.id === selectedPeriodId);
    return p ? `${MONTHS[p.month - 1]} ${p.year}` : 'Periode';
  }, [selectedPeriodId, periods]);

  return (
    <div className="min-h-screen bg-background text-foreground flex transition-all duration-500 ease-in-out">
      {/* Sidebar */}
      <Sidebar user={user} role={role} />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative flex flex-col pb-20">
        {/* Top Header */}
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
            <ThemeToggle />
            <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-sm">
              {user?.email?.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>

        {/* Background glow */}
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
                <span className="text-foreground font-medium">QA Analyzer</span>
              </div>
              <h1 className="text-4xl lg:text-5xl font-bold tracking-tighter mb-4 bg-gradient-to-r from-foreground to-foreground/50 bg-clip-text text-transparent">
                QA Performance Dashboard
              </h1>
              <p className="text-lg text-foreground/40 font-light max-w-2xl leading-relaxed">
                Pantau performa kualitas, analisis akar masalah, dan temukan area perbaikan untuk tim Anda.
              </p>
            </motion.div>
          </header>

          <div className="space-y-8">
            {/* Filters */}
            <DashboardFilters 
              periods={periods}
              selectedPeriodId={selectedPeriodId}
              onPeriodChange={setSelectedPeriodId}
              folders={folders}
              selectedFolderId={selectedFolderId}
              onFolderChange={setSelectedFolderId}
              timeframe={timeframe}
              onTimeframeChange={setTimeframe}
            />


            {loading && !summary ? (
              <div className="flex flex-col items-center justify-center py-32 text-foreground/40">
                <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                <p>Memuat data dashboard...</p>
              </div>
            ) : !summary ? (
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
                {/* LEVEL 1: EXECUTIVE SUMMARY */}
                <section>
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <span className="w-1 h-5 bg-primary rounded-full"></span>
                    Executive Summary
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <KpiCard 
                      label="Total Temuan QA"
                      value={summary.totalDefects}
                      delta={-12} // Mock delta for MVP
                      target="Target: < 100"
                      reverseLogic={true}
                      sparklineData={sparklines.total || []}
                    />
                    <KpiCard 
                      label="Rata-rata Temuan / Audit"
                      value={summary.avgDefectsPerAudit.toFixed(1)}
                      delta={-5}
                      target="Target: < 1.0"
                      reverseLogic={true}
                      sparklineData={sparklines.avg || []}
                    />
                    <KpiCard 
                      label="Fatal Error Rate"
                      value={summary.fatalErrorRate.toFixed(1)}
                      unit="%"
                      delta={2}
                      target="Target: < 1%"
                      reverseLogic={true}
                      sparklineData={sparklines.fatal || []}
                    />
                    <KpiCard 
                      label="Kepatuhan SOP"
                      value={summary.complianceRate.toFixed(1)}
                      unit="%"
                      delta={4}
                      target="Target: > 95%"
                      reverseLogic={false}
                      sparklineData={sparklines.compliance || []}
                    />
                  </div>
                </section>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* LEVEL 2: TEAM PERFORMANCE */}
                  <section className="bg-card rounded-2xl border border-border p-5">
                    <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                      <span className="w-1 h-5 bg-blue-500 rounded-full"></span>
                      Total Temuan per Tim
                    </h2>
                    <TeamBarChart data={teamData} />
                  </section>

                  {/* LEVEL 2: AGENT PERFORMANCE */}
                  <section className="bg-card rounded-2xl border border-border p-5">
                    <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                      <span className="w-1 h-5 bg-orange-500 rounded-full"></span>
                      Top 5 Agen (Temuan Tertinggi)
                    </h2>
                    <TopAgentsTable agents={topAgents} />
                  </section>
                </div>
                
                {/* NEW LEVEL: HISTORICAL TRENDS */}
                <section className="bg-card rounded-2xl border border-border p-5">
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
                  {paramTrend && <ParamTrendChart data={paramTrend} showParameters={selectedFolderId !== 'ALL'} />}
                </section>

                {/* LEVEL 3: ROOT CAUSE */}
                <section className="bg-card rounded-2xl border border-border p-5">
                  <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                    <span className="w-1 h-5 bg-red-500 rounded-full"></span>
                    Root Cause Analysis
                  </h2>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2">
                      <h3 className="text-sm font-medium text-foreground/60 mb-4">Pareto Kategori Temuan (80/20 Rule)</h3>
                      <ParetoChart data={paretoData} />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-foreground/60 mb-4 text-center">Proporsi Fatal vs Non-Fatal</h3>
                      {donutData && <FatalDonutChart data={donutData} />}
                    </div>
                  </div>
                </section>


              </motion.div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
