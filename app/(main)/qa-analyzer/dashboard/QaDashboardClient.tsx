'use client';

import React, { startTransition, useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Loader2, 
  AlertTriangle, 
  Sparkles, 
  LayoutDashboard, 
  ChevronRight,
  Filter,
  BarChart3,
  Users,
  Calendar,
  Layers,
  Info,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Search,
  RefreshCw,
  PieChart,
  LineChart,
  ArrowRight
} from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';

import { DashboardData, TrendDataset, SERVICE_LABELS } from '../lib/qa-types';

import { ResponsiveContainer, AreaChart, Area } from 'recharts';
import ServiceBarChart from './components/ServiceBarChart';
import ParetoChart from './components/ParetoChart';
import FatalDonutChart from './components/FatalDonutChart';
import ParamTrendChart, { TREND_COLORS } from './components/ParamTrendChart';

import { User } from '@supabase/supabase-js';
import { Profile } from '@/app/types/auth';
import { MonthRangePicker } from '@/app/components/ui/MonthRangePicker';

const _MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

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
  user: _user, 
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
  
  // Trend local state
  const [hiddenParams, setHiddenParams] = useState<Set<string>>(new Set());

  // Sync state when initialData (props) changes
  useEffect(() => {
    setLoading(false);
    setSelectedYear(initialFilters.year);
    setStartMonth(initialFilters.startMonth);
    setEndMonth(initialFilters.endMonth);
    setSelectedFolderId(initialFilters.folder);
    setSelectedService(initialFilters.service);
    setDisplayData(initialData);
    
    // Default: hide all params except total for trend analysis focus initially
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

  const updateFilters = (newStart: number, newEnd: number, newFolder: string, newService: string, newYear: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('start_month', String(newStart));
    params.set('end_month', String(newEnd));
    params.set('folder', newFolder);
    params.set('service', newService);
    params.set('year', String(newYear));
    
    // Clean up old params
    params.delete('period');
    params.delete('timeframe');
    
    setLoading(true);
    startTransition(() => {
      router.replace(`?${params.toString()}`);
    });
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

  const activeFolderName = useMemo(() => {
    if (selectedFolderId === 'ALL') return 'Semua Tim';
    return displayData.folders.find(f => f.id === selectedFolderId)?.name || selectedFolderId;
  }, [selectedFolderId, displayData.folders]);

  const activePeriodText = useMemo(() => {
    if (startMonth === endMonth) return `${_MONTHS[startMonth - 1]} ${selectedYear}`;
    return `${_MONTHS[startMonth - 1]} - ${_MONTHS[endMonth - 1]} ${selectedYear}`;
  }, [startMonth, endMonth, selectedYear]);

  return (
    <div data-module="qa-analyzer" className="module-clean-app flex-1 flex flex-col min-h-screen bg-background relative overflow-x-hidden">
      
      {/* 1. Utility Header */}
      <header className="sticky top-0 z-[40] bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-1">
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Workspace</span>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-foreground">SIDAK Dashboard</span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">Analitik Operasional</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex flex-col pr-4 border-r border-border/50 hidden lg:flex">
              <span className="text-xs text-muted-foreground">Scope Aktif</span>
              <span className="text-sm font-semibold">{SERVICE_LABELS[selectedService as keyof typeof SERVICE_LABELS] || selectedService} • {activeFolderName}</span>
            </div>
            <div className="flex flex-col pr-4 border-r border-border/50 hidden lg:flex">
              <span className="text-xs text-muted-foreground">Periode</span>
              <span className="text-sm font-semibold">{activePeriodText}</span>
            </div>
            <button 
              onClick={() => updateFilters(1, new Date().getMonth() + 1, 'ALL', 'call', new Date().getFullYear())}
              className="h-9 px-4 rounded-xl flex items-center gap-2 text-sm font-medium border border-border/50 hover:bg-secondary transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Reset
            </button>
          </div>
        </div>
      </header>

      {/* 2. Command Bar (Sticky Filters) */}
      <div className="sticky top-[73px] z-[35] bg-background border-b border-border/40 py-3">
        <div className="max-w-[1600px] mx-auto px-6">
          <div className="flex flex-col xl:flex-row gap-3 items-stretch xl:items-center">
            
            {/* Service & Team Selectors */}
            <div className="flex flex-1 gap-2">
              <div className="relative group/input flex-1 max-w-[200px]">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-muted-foreground group-focus-within/input:text-foreground transition-colors">
                  <Layers className="w-3.5 h-3.5" />
                </div>
                <select
                  value={selectedService}
                  onChange={(e) => { setSelectedService(e.target.value); updateFilters(startMonth, endMonth, selectedFolderId, e.target.value, selectedYear); }}
                  className="w-full h-9 pl-9 pr-8 bg-card border border-border rounded-lg text-sm font-medium appearance-none focus:outline-none focus:ring-1 focus:ring-ring transition-all cursor-pointer"
                >
                  {Object.entries(SERVICE_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-muted-foreground">
                  <ChevronRight className="w-3.5 h-3.5 rotate-90" />
                </div>
              </div>

              <div className="relative group/input flex-1 max-w-[200px]">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-muted-foreground group-focus-within/input:text-foreground transition-colors">
                  <Users className="w-3.5 h-3.5" />
                </div>
                <select
                  value={selectedFolderId}
                  onChange={(e) => { setSelectedFolderId(e.target.value); updateFilters(startMonth, endMonth, e.target.value, selectedService, selectedYear); }}
                  className="w-full h-9 pl-9 pr-8 bg-card border border-border rounded-lg text-sm font-medium appearance-none focus:outline-none focus:ring-1 focus:ring-ring transition-all cursor-pointer"
                >
                  <option key="folder-all" value="ALL">Semua Tim</option>
                  {displayData.folders.map(f => (
                    <option key={`folder-${f.id}`} value={f.id}>{f.name}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-muted-foreground">
                  <ChevronRight className="w-3.5 h-3.5 rotate-90" />
                </div>
              </div>

              <div className="relative group/input flex-1 max-w-[140px]">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-muted-foreground group-focus-within/input:text-foreground transition-colors">
                  <Calendar className="w-3.5 h-3.5" />
                </div>
                <select
                  value={selectedYear}
                  onChange={(e) => { const y = parseInt(e.target.value); setSelectedYear(y); updateFilters(startMonth, endMonth, selectedFolderId, selectedService, y); }}
                  className="w-full h-9 pl-9 pr-8 bg-card border border-border rounded-lg text-sm font-medium appearance-none focus:outline-none focus:ring-1 focus:ring-ring transition-all cursor-pointer"
                >
                  {displayData.availableYears.map(y => (
                    <option key={`year-${y}`} value={y}>{y}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-muted-foreground">
                  <ChevronRight className="w-3.5 h-3.5 rotate-90" />
                </div>
              </div>
            </div>

            <div className="hidden xl:block w-px h-6 bg-border mx-2" />

            {/* Month Range Picker Redesigned */}
            <div className="flex-[1.5] min-w-[300px]">
              <MonthRangePicker 
                selectedYear={selectedYear}
                startMonth={startMonth}
                endMonth={endMonth}
                onRangeChange={handleRangeChange}
                variant="toolbar"
                className="w-full"
              />
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-[1600px] mx-auto px-6 py-8 w-full flex-1">
        
        {loading ? (
          <div className="flex flex-col items-center justify-center py-40">
            <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
            <p className="mt-4 text-sm font-medium text-muted-foreground">Memuat data dashboard...</p>
          </div>
        ) : !displayData.summary ? (
          <div className="flex flex-col items-center justify-center py-32 bg-card rounded-2xl border border-border shadow-sm">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-bold mb-2">Data Tidak Ditemukan</h2>
            <p className="text-muted-foreground text-sm max-w-sm text-center px-6">
              Tidak ada rekaman QA untuk filter yang Anda pilih. Coba sesuaikan rentang waktu atau tim.
            </p>
            <button 
              onClick={() => updateFilters(1, new Date().getMonth() + 1, 'ALL', 'call', new Date().getFullYear())}
              className="mt-6 px-6 py-2.5 rounded-lg text-sm font-medium border border-border bg-background hover:bg-muted transition-colors"
            >
              Reset Filter
            </button>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            
            {/* 3. Summary Strip */}
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  id: 'total-defects',
                  label: "Total Temuan QA",
                  value: displayData.summary.totalDefects,
                  icon: Search,
                  color: "text-orange-500",
                  desc: "Kumulatif temuan parameter",
                  sparklineData: displayData.sparklines.total || [],
                  invertDelta: true
                },
                {
                  id: 'avg-defects',
                  label: "Rata-rata Temuan per Agen",
                  value: displayData.summary.avgDefectsPerAudit.toFixed(1),
                  icon: Target,
                  color: "text-red-500",
                  desc: "Rasio temuan / sesi audit",
                  sparklineData: displayData.sparklines.avg || [],
                  invertDelta: true
                },
                {
                  id: 'avg-score',
                  label: "Rata-rata Skor",
                  value: `${displayData.summary.avgAgentScore?.toFixed(1) ?? '0.0'}%`,
                  icon: BarChart3,
                  color: "text-blue-500",
                  desc: "Kualitas performa rata-rata",
                  sparklineData: displayData.sparklines.avgAgentScore || [],
                  invertDelta: false
                },
                {
                  id: 'compliance',
                  label: startMonth === endMonth ? "Compliance Rate" : "Average Compliance Rate",
                  value: `${displayData.summary.complianceRate.toFixed(1)}%`,
                  icon: Sparkles,
                  color: "text-emerald-500",
                  desc: "Agent dengan skor ≥ 95%",
                  sparklineData: displayData.sparklines.compliance || [],
                  invertDelta: false
                }
              ].map((card) => (
                <SummaryCard 
                  key={card.id}
                  label={card.label}
                  value={card.value}
                  icon={card.icon}
                  color={card.color}
                  desc={card.desc}
                  sparklineData={card.sparklineData}
                  invertDelta={card.invertDelta}
                />
              ))}
            </section>

            {/* 4. Analysis Workspace (Main Grid) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Left Lane: Trends & Detailed Analysis (2/3) */}
              <div className="lg:col-span-2 space-y-8">
                
                {/* Trend Section */}
                <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <LineChart className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold">Tren Kualitas & Parameter</h2>
                        <p className="text-sm text-muted-foreground">Fluktuasi temuan berdasarkan parameter QA</p>
                      </div>
                    </div>
                  </div>

                  {isTrendEmpty ? (
                    <div className="h-[400px] flex flex-col items-center justify-center bg-muted/20 rounded-xl border border-dashed">
                      <p className="text-sm text-muted-foreground font-medium">Data tren tidak tersedia</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Compact Toggles */}
                      <div className="flex flex-wrap items-center gap-1.5 pb-2">
                        <span className="text-xs font-semibold text-muted-foreground mr-2">Tampilkan:</span>
                        {displayData.paramTrend?.datasets.map((ds: TrendDataset, i: number) => {
                          if (ds.isTotal) return null;
                          const color = TREND_COLORS[i % TREND_COLORS.length];
                          const isHidden = hiddenParams.has(ds.label);
                          return (
                            <button
                              key={ds.label}
                              onClick={() => toggleParam(ds.label)}
                              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                                isHidden
                                  ? 'bg-transparent border-transparent text-muted-foreground hover:bg-muted'
                                  : 'border-border shadow-sm'
                              }`}
                              style={{
                                backgroundColor: isHidden ? undefined : `${color}15`,
                                color: isHidden ? undefined : color,
                              }}
                            >
                              <div 
                                className={`w-2 h-2 rounded-full ${isHidden ? 'bg-muted-foreground/30' : ''}`}
                                style={{ backgroundColor: isHidden ? undefined : color }}
                              />
                              <span className="max-w-[120px] truncate">{ds.label}</span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="h-[360px] w-full mt-2">
                        <ParamTrendChart 
                          data={displayData.paramTrend!} 
                          showParameters={true} 
                          hiddenKeys={hiddenParams}
                          hideTotal={hasVisibleParam}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Pareto / Root Cause Section */}
                <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                      <BarChart3 className="w-5 h-5 text-orange-500" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold">Root Cause Analysis</h2>
                      <p className="text-sm text-muted-foreground">80% temuan biasanya berasal dari 20% kategori utama</p>
                    </div>
                  </div>

                  <div className="w-full">
                    <ParetoChart data={displayData.paretoData} />
                  </div>
                </div>
              </div>

              {/* Right Lane: Secondary Insights & Leaderboard (1/3) */}
              <div className="space-y-8">
                
                {/* Agent Leaderboard Card */}
                <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                        <Users className="w-5 h-5 text-red-500" />
                      </div>
                      <div>
                        <h2 className="text-base font-bold">Top Agen (Temuan)</h2>
                        <p className="text-xs text-muted-foreground">Prioritas Coaching</p>
                      </div>
                    </div>
                    <Link href="/qa-analyzer/ranking" className="text-xs font-semibold text-primary hover:underline">
                      View All
                    </Link>
                  </div>

                  <div className="space-y-3">
                    {displayData.topAgents.slice(0, 5).map((agent, i) => (
                      <div key={agent.agentId} className="flex items-center justify-between p-3 rounded-xl border border-border/50 hover:bg-muted/50 transition-colors group cursor-pointer" onClick={() => router.push(`/qa-analyzer/agents/${agent.agentId}`)}>
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground group-hover:text-primary transition-colors">
                            #{i+1}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold truncate max-w-[120px]">{agent.nama}</span>
                            <span className="text-xs text-muted-foreground">{agent.tim || agent.batch}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-sm font-bold text-red-500">{agent.defects}</span>
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Temuan</span>
                        </div>
                      </div>
                    ))}
                    {displayData.topAgents.length === 0 && (
                      <p className="text-center py-10 text-sm text-muted-foreground italic">Tidak ada data agen</p>
                    )}
                  </div>
                </div>

                {/* Critical Ratio Card */}
                <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                      <PieChart className="w-5 h-5 text-indigo-500" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold">Severity Mix</h2>
                      <p className="text-xs text-muted-foreground">Critical vs Non-Critical</p>
                    </div>
                  </div>
                  
                  <div className="h-[240px] flex items-center justify-center">
                    {displayData.donutData && <FatalDonutChart data={displayData.donutData} />}
                  </div>
                </div>

                {/* Service Distribution */}
                <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
                  <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-primary rounded-full" />
                    Distribusi per Layanan
                  </h3>
                  <div className="h-[240px] w-full text-left">
                    <ServiceBarChart data={displayData.serviceData} />
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}
      </main>

      {/* Floating Action for Mobile / Quick Access */}
      <div className="fixed bottom-6 right-6 z-[100] md:hidden">
        <button className="w-14 h-14 rounded-2xl bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors">
          <Filter className="w-6 h-6" />
        </button>
      </div>

    </div>
  );
}

function SummaryCard({ 
  label, 
  value, 
  icon: Icon, 
  color,
  desc,
  sparklineData,
  invertDelta = false
}: { 
  label: string; 
  value: string | number; 
  icon: any; 
  color: string;
  desc: string;
  sparklineData: any[];
  invertDelta?: boolean;
}) {
  const sparklineColor = color.includes('orange') ? '#F97316' : 
                        color.includes('red') ? '#EF4444' :
                        color.includes('blue') ? '#3B82F6' :
                        color.includes('green') ? '#10B981' : '#1E293B';
  
  let delta = null;
  let isPositive = false;
  let isNeutral = true;
  
  if (sparklineData && sparklineData.length >= 2) {
    const current = sparklineData[sparklineData.length - 1].value;
    const prev = sparklineData[sparklineData.length - 2].value;
    
    if (prev > 0) {
      const change = ((current - prev) / prev) * 100;
      delta = Math.abs(change).toFixed(1);
      isNeutral = change === 0;
      // if invertDelta is true, meaning an increase is BAD (like total defects)
      if (invertDelta) {
        isPositive = change <= 0; // Less defects = good
      } else {
        isPositive = change > 0; // More score = good
      }
    }
  }

  return (
    <div className="bg-card p-5 rounded-2xl border border-border shadow-sm flex flex-col justify-between h-full min-h-[180px]">
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className={`w-9 h-9 rounded-xl ${color.replace('text-', 'bg-')}/10 flex items-center justify-center`}>
            <Icon className={`w-4.5 h-4.5 ${color}`} />
          </div>
          {delta !== null && !isNeutral && (
            <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold ${isPositive ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>
              {isPositive !== invertDelta ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
              {delta}%
            </div>
          )}
          {delta !== null && isNeutral && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-muted-foreground bg-muted">
              0%
            </div>
          )}
        </div>
        
        <span className="block text-sm font-medium text-muted-foreground mb-1">{label}</span>
        <div className="flex items-baseline gap-1">
          <h3 className="text-3xl font-bold">{value}</h3>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">{desc}</p>
      </div>

      <div className="h-12 w-full -mx-5 -mb-5 mt-4 relative overflow-hidden shrink-0">
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-card via-transparent to-card z-10" />
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sparklineData}>
            <defs>
              <linearGradient id={`gradient-${label.replace(/\s+/g, '-')}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={sparklineColor} stopOpacity={0.2}/>
                <stop offset="95%" stopColor={sparklineColor} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke={sparklineColor} 
              strokeWidth={2} 
              fillOpacity={1} 
              fill={`url(#gradient-${label.replace(/\s+/g, '-')})`}
              isAnimationActive={true}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
