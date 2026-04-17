'use client';

import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Activity,
  AlertCircle,
  Clock,
  Loader2,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { MonthRangePicker } from '@/app/components/ui/MonthRangePicker';
import { getDashboardTrendByRangeAction } from './actions';
import { deleteActivityAction } from './activities/actions';

interface DashboardAnalyticsPanelProps {
  role: string;
  serviceTrendMap: Record<'3m' | '6m' | 'all', {
    labels: string[];
    totalData: number[];
    serviceData: Record<string, number[]>;
    activeServices: string[];
    serviceSummary: Record<string, { totalDefects: number; auditedAgents: number }>;
    totalSummary: { totalDefects: number; auditedAgents: number; activeServiceCount: number };
    topParameters?: Record<string, { name: string; count: number }>;
  }>;
  initialRecentLogs: Array<{ id: string | number; user: string; action: string; time: string; type: string }>;
  availableYears: number[];
  initialYear: number;
}

const SERVICE_COLORS: Record<string, string> = {
  call: '#3B82F6',
  chat: '#10B981',
  email: '#F59E0B',
  cso: '#8B5CF6',
  pencatatan: '#EC4899',
  bko: '#06B6D4',
  slik: '#F97316',
};

const SERVICE_LABELS: Record<string, string> = {
  call: 'Layanan Call',
  chat: 'Layanan Chat',
  email: 'Layanan Email',
  cso: 'Layanan CSO',
  pencatatan: 'Pencatatan',
  bko: 'BKO',
  slik: 'SLIK',
};

const MONTH_FULL_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export default function DashboardAnalyticsPanel({
  role,
  serviceTrendMap,
  initialRecentLogs,
  availableYears,
  initialYear,
}: DashboardAnalyticsPanelProps) {
  const router = useRouter();
  const { theme } = useTheme();
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [trendStartMonth, setTrendStartMonth] = useState<number | null>(null);
  const [trendEndMonth, setTrendEndMonth] = useState<number | null>(null);
  const [trendLoading, setTrendLoading] = useState(false);
  const [localTrendData, setLocalTrendData] = useState<any>(null);
  const [selectedService, setSelectedService] = useState<string>('all');

  const handleYearChange = async (year: number) => {
    setSelectedYear(year);
    setTrendStartMonth(null);
    setTrendEndMonth(null);

    setTrendLoading(true);
    try {
      const newData = await getDashboardTrendByRangeAction(year, 1, 12);
      setLocalTrendData(newData);
    } catch (err) {
      console.error('Failed to fetch dashboard trend for year:', err);
    } finally {
      setTrendLoading(false);
    }
  };

  const handleRangeChange = async (start: number | null, end: number | null) => {
    let targetStart = start;
    let targetEnd = end;

    if (targetStart === null && targetEnd !== null) {
      targetStart = 1;
    } else if (targetStart !== null && targetEnd === null) {
      targetEnd = new Date().getMonth() + 1;
    }

    setTrendStartMonth(targetStart);
    setTrendEndMonth(targetEnd);

    if (targetStart !== null && targetEnd !== null && targetEnd >= targetStart) {
      setTrendLoading(true);
      try {
        const newData = await getDashboardTrendByRangeAction(selectedYear, targetStart, targetEnd);
        setLocalTrendData(newData);
      } catch (err) {
        console.error('Failed to fetch dashboard trend by range:', err);
      } finally {
        setTrendLoading(false);
      }
    } else if (targetStart === null && targetEnd === null) {
      setLocalTrendData(null);
    }
  };

  const activeTrend = localTrendData || serviceTrendMap.all;
  const totalFindings = selectedService === 'all'
    ? activeTrend.totalSummary.totalDefects
    : activeTrend.serviceSummary[selectedService]?.totalDefects ?? 0;
  const auditedAgents = selectedService === 'all'
    ? activeTrend.totalSummary.auditedAgents
    : activeTrend.serviceSummary[selectedService]?.auditedAgents ?? 0;
  const avgPerService = selectedService === 'all'
    ? activeTrend.totalSummary.activeServiceCount > 0
      ? (totalFindings / activeTrend.totalSummary.activeServiceCount).toFixed(1)
      : '0'
    : null;
  const avgPerAgent = auditedAgents > 0 ? (totalFindings / auditedAgents).toFixed(1) : '0';

  const qaTrendPoints = activeTrend.labels.map((label: string, i: number) => {
    const point: Record<string, string | number> = { name: label };

    if (selectedService === 'all') {
      point.Total = activeTrend.totalData[i];
      Object.entries(activeTrend.serviceData).forEach(([svc, data]) => {
        point[SERVICE_LABELS[svc] || svc] = data[i];
      });
    } else {
      const svcLabel = SERVICE_LABELS[selectedService] || selectedService;
      point[svcLabel] = (activeTrend.serviceData[selectedService] || [])[i] || 0;
    }

    return point;
  });

  const trendDataPoints = selectedService === 'all'
    ? activeTrend.totalData
    : (activeTrend.serviceData[selectedService] || activeTrend.labels.map(() => 0));
  const lastVal = trendDataPoints.length > 0 ? trendDataPoints[trendDataPoints.length - 1] : 0;
  const prevVal = trendDataPoints.length > 1 ? trendDataPoints[trendDataPoints.length - 2] : 0;
  const trendStatus = trendDataPoints.length < 2 ? 'Stagnan' : (lastVal < prevVal ? 'Membaik' : lastVal > prevVal ? 'Memburuk' : 'Stagnan');
  const timeframeLabel = trendStartMonth && trendEndMonth
    ? `periode ${MONTH_FULL_NAMES[trendStartMonth - 1]} - ${MONTH_FULL_NAMES[trendEndMonth - 1]} ${selectedYear}`
    : 'semua periode';
  const prevTrendVal = trendDataPoints.length > 1 ? trendDataPoints[trendDataPoints.length - 2] : null;
  const trendDelta = prevTrendVal !== null && prevTrendVal !== 0
    ? ((lastVal - prevTrendVal) / prevTrendVal) * 100
    : null;
  const chartColor = theme === 'dark' ? 'var(--gold)' : 'var(--navy)';
  const topParameter = selectedService !== 'all' && activeTrend.topParameters ? activeTrend.topParameters[selectedService] : null;

  return (
    <>
      {(role?.toLowerCase() === 'trainer' || role?.toLowerCase() === 'leader' || role?.toLowerCase() === 'admin') && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="lg:col-span-2 rounded-3xl border border-border/40 bg-card/30 backdrop-blur-sm p-8 shadow-sm overflow-hidden"
          >
            <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/5 text-primary rounded-lg border border-primary/10">
                  <TrendingUp className="w-4 h-4 text-primary" />
                </div>
                <h2 className="text-lg font-bold tracking-tight">Tren Temuan QA</h2>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center bg-background/50 border border-border/40 rounded-xl p-1 gap-1">
                  <button
                    onClick={() => setSelectedService('all')}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                      selectedService === 'all'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'hover:bg-foreground/5 text-foreground/50'
                    }`}
                  >
                    Semua
                  </button>
                  {activeTrend.activeServices.map((svc) => (
                    <button
                      key={svc}
                      onClick={() => setSelectedService(selectedService === svc ? 'all' : svc)}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${
                        selectedService === svc
                          ? 'bg-foreground/10 text-foreground shadow-sm'
                          : 'hover:bg-foreground/5 text-foreground/50'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: SERVICE_COLORS[svc] || '#ccc' }} />
                      {SERVICE_LABELS[svc] || svc}
                    </button>
                  ))}
                </div>

                <div className="flex items-center bg-background/50 border border-border/40 rounded-xl px-3 py-1.5 gap-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Tahun:</span>
                  <select
                    value={selectedYear}
                    onChange={(event) => handleYearChange(Number(event.target.value))}
                    className="bg-transparent text-[9px] font-black uppercase tracking-widest focus:outline-none cursor-pointer"
                  >
                    {availableYears.map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>

                <div className="h-4 w-px bg-border/40 hidden sm:block" />

                <MonthRangePicker
                  selectedYear={selectedYear}
                  startMonth={trendStartMonth}
                  endMonth={trendEndMonth}
                  onRangeChange={handleRangeChange}
                  className="mb-0 !gap-0"
                />
              </div>
            </div>

            <div className="h-[300px] w-full relative">
              {trendLoading && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-card/50 backdrop-blur-[1px] rounded-2xl">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              )}
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={qaTrendPoints}>
                  <defs>
                    <linearGradient id="colorFindings" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.1} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.4, fontWeight: 700 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.4, fontWeight: 700 }} dx={-10} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--card)',
                      borderColor: 'var(--border)',
                      borderRadius: '16px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                      color: 'var(--foreground)',
                    }}
                  />

                  {selectedService === 'all' && (
                    <Area
                      type="monotone"
                      dataKey="Total"
                      name="Total Temuan"
                      stroke={chartColor}
                      fillOpacity={1}
                      fill="url(#colorFindings)"
                      strokeWidth={4}
                      animationDuration={1200}
                      dot={{ r: 4, fill: 'var(--card)', strokeWidth: 2, stroke: chartColor }}
                      activeDot={{ r: 6, fill: chartColor, strokeWidth: 0 }}
                    />
                  )}

                  {Object.entries(SERVICE_COLORS).map(([svc, color]) => {
                    const label = SERVICE_LABELS[svc] || svc;
                    const isSelected = selectedService === svc;
                    const shouldShow = selectedService === 'all' || isSelected;

                    if (!shouldShow || !activeTrend.serviceData[svc]) return null;

                    return (
                      <Area
                        key={svc}
                        type="monotone"
                        dataKey={label}
                        name={label}
                        stroke={color}
                        fill={color}
                        fillOpacity={isSelected ? 0.3 : 0}
                        strokeWidth={isSelected ? 4 : 2}
                        dot={isSelected ? { r: 4, fill: 'var(--card)', strokeWidth: 2, stroke: color } : false}
                        activeDot={{ r: 6, fill: color, strokeWidth: 0 }}
                        animationDuration={900}
                      />
                    );
                  })}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="rounded-3xl border border-primary/20 bg-primary/95 text-primary-foreground p-6 flex flex-col shadow-2xl shadow-primary/10 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

            <h2 className="text-lg font-bold tracking-tight mb-4 relative z-10">Ringkasan Performa</h2>
            <div className="flex-1 flex flex-col justify-center gap-4 relative z-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10">
                  <Activity className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="text-[10px] font-mono uppercase tracking-widest opacity-70">Total Temuan</div>
                    {trendDelta !== null && (
                      <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${trendDelta <= 0 ? 'bg-emerald-400/20 text-emerald-400' : 'bg-rose-400/20 text-rose-400'}`}>
                        {trendDelta <= 0 ? <TrendingDown className="w-2.5 h-2.5" /> : <TrendingUp className="w-2.5 h-2.5" />}
                        {Math.abs(Math.round(trendDelta))}%
                      </div>
                    )}
                  </div>
                  <div className="text-4xl font-bold tracking-tight">{totalFindings}</div>
                </div>
              </div>

              {selectedService === 'all' && (
                <div className="flex flex-wrap gap-2 pt-2 pb-4">
                  {Object.entries(activeTrend.serviceSummary).map(([svc, stats]) => (
                    <div key={svc} className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 flex flex-col items-start gap-0.5 min-w-[70px]">
                      <span className="text-[8px] uppercase tracking-tighter opacity-60 font-bold">{SERVICE_LABELS[svc] || svc}</span>
                      <span className="text-xs font-bold leading-none">{(stats as { totalDefects: number }).totalDefects}</span>
                    </div>
                  ))}
                </div>
              )}

              {selectedService === 'all' && (
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10">
                    <Target className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-widest opacity-70 mb-1">Rata-rata / Layanan</div>
                    <div className="text-4xl font-bold tracking-tight">{avgPerService}</div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-widest opacity-70 mb-1">Rata-rata / Agent</div>
                  <div className="text-4xl font-bold tracking-tight">{avgPerAgent}</div>
                </div>
              </div>

              <div className="mt-2 p-4 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium opacity-80">Status Saat Ini</span>
                  <TrendingUp className="w-4 h-4 opacity-80" />
                </div>
                <div className="text-xl font-bold">{trendStatus}</div>
                <div className="text-[10px] opacity-60 mt-1">Berdasarkan data {timeframeLabel}</div>
              </div>

              {topParameter && (
                <div className="mt-2 pt-4 border-t border-white/10 relative overflow-hidden">
                  <div className="flex items-start gap-3 relative z-10">
                    <div className="w-8 h-8 rounded-xl bg-amber-400/20 flex items-center justify-center border border-amber-400/20 shrink-0">
                      <AlertCircle className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-widest text-amber-400 mb-0.5">Top Finding Issue</div>
                      <div className="text-sm font-semibold leading-snug line-clamp-2 pr-2">{topParameter.name}</div>
                      <div className="text-[10px] opacity-60 mt-1 font-mono">{topParameter.count} temuan terdeteksi</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {(role?.toLowerCase() === 'trainer' || role?.toLowerCase() === 'admin') && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="rounded-3xl border border-border/40 bg-card/40 backdrop-blur-sm p-8 shadow-sm"
        >
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-lg font-bold tracking-tight">Aktivitas Terakhir</h2>
            <Link href="/dashboard/activities" className="text-[10px] font-mono uppercase tracking-widest text-primary hover:text-primary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-2 py-1 transition-colors">
              Lihat Semua
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {initialRecentLogs.length > 0 ? initialRecentLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between p-4 rounded-2xl bg-background/50 border border-border/30 hover:border-primary/30 transition-all group relative">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${
                    log.type === 'login' ? 'bg-blue-500/10 text-blue-500' :
                    log.type === 'edit' ? 'bg-purple-500/10 text-purple-500' :
                    log.type === 'add' ? 'bg-emerald-500/10 text-emerald-500' :
                    'bg-orange-500/10 text-orange-500'
                  }`}>
                    {log.type === 'login' ? <Users className="w-5 h-5" /> :
                    log.type === 'edit' ? <Activity className="w-5 h-5" /> :
                    log.type === 'add' ? <Target className="w-5 h-5" /> :
                    <Clock className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="text-sm font-semibold tracking-tight">{log.user}</div>
                    <div className="text-xs text-foreground/50 font-light mt-0.5">
                      {log.action}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-[10px] font-mono text-muted-foreground">{log.time}</div>
                  {(role?.toLowerCase() === 'trainer' || role?.toLowerCase() === 'admin') && (
                    <button
                      onClick={async () => {
                        if (confirm('Hapus log aktivitas ini?')) {
                          try {
                            await deleteActivityAction(log.id.toString());
                            router.refresh();
                          } catch (err) {
                            console.error(err);
                            alert('Gagal menghapus log');
                          }
                        }
                      }}
                      className="p-2 text-muted-foreground hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )) : (
              <div className="col-span-full py-8 text-center text-foreground/50 text-sm border border-dashed border-border/40 rounded-2xl bg-background/30">
                Belum ada aktivitas terbaru.
              </div>
            )}
          </div>
        </motion.div>
      )}
    </>
  );
}
