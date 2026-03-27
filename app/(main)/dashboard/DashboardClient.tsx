'use client';

import { motion } from "motion/react";
import { LayoutDashboard, MessageSquare, Mail, Phone, Settings, LogOut, ChevronRight, Activity, Users, BarChart3, TrendingUp, Clock, Target, ArrowRight, ChevronLeft, Trash2 } from "lucide-react";
import Link from "next/link";
import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/app/lib/supabase/client';
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { useTheme } from 'next-themes';
import { activityService } from "../../lib/services/activityService";
import { useTelefunWarning } from "@/app/context/TelefunWarningContext";

const modules = [
  {
    id: "ketik",
    title: "KETIK",
    description: "Kelas Etika & Trik Komunikasi — simulasi chat layanan konsumen Kontak OJK 157.",
    icon: MessageSquare,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    href: "/ketik"
  },
  {
    id: "pdkt",
    title: "PDKT",
    description: "Paham Dulu Kasih Tanggapan — simulasi email dan korespondensi tertulis.",
    icon: Mail,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    href: "/pdkt"
  },
  {
    id: "telefun",
    title: "TELEFUN",
    description: "Telephone Fun — simulasi panggilan suara dan telepon untuk melatih komunikasi lisan.",
    icon: Phone,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    href: "/telefun"
  },
  {
    id: "profiler",
    title: "KTP",
    description: "Kotak Tool Profil — database profil agen terpusat untuk manajemen data peserta.",
    icon: Users,
    color: "text-violet-500",
    bg: "bg-violet-500/10",
    border: "border-violet-500/20",
    href: "/profiler"
  },
  {
    id: "qa-analyzer",
    title: "SIDAK",
    description: "Sistem Informasi Data Kualitas — monitoring QA dan analisis data performa secara real-time.",
    icon: BarChart3,
    color: "text-rose-500",
    bg: "bg-rose-500/10",
    border: "border-rose-500/20",
    href: "/qa-analyzer/dashboard"
  }
];

interface DashboardClientProps {
  user: any;
  role: string;
  profile: any;
  serviceTrendMap: Record<'3m' | '6m' | 'all', {
    labels: string[];
    totalData: number[];
    serviceData: Record<string, number[]>;
    activeServices: string[];
    serviceSummary: Record<string, { totalDefects: number, auditedAgents: number }>;
    totalSummary: { totalDefects: number, auditedAgents: number, activeServiceCount: number };
  }>;
  initialRecentLogs: Array<{ id: string | number, user: string, action: string, time: string, type: string }>;
}

const SERVICE_COLORS: Record<string, string> = {
  call: '#3B82F6',       // Blue
  chat: '#10B981',       // Emerald
  email: '#F59E0B',      // Amber
  cso: '#8B5CF6',        // Violet
  pencatatan: '#EC4899', // Pink
  bko: '#06B6D4',        // Cyan
  slik: '#F97316',       // Orange
};

const SERVICE_LABELS: Record<string, string> = {
  call: 'Layanan Call',
  chat: 'Layanan Chat',
  email: 'Layanan Email',
  cso: 'Layanan CSO',
  pencatatan: 'Pencatatan',
  bko: 'BKO',
  slik: 'SLIK'
};

export default function DashboardClient({ 
  user, role, profile, 
  serviceTrendMap, initialRecentLogs 
}: DashboardClientProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [timeframe, setTimeframe] = useState<'3m' | '6m' | 'all'>('all');
  const [selectedService, setSelectedService] = useState<string>('all');

  const { openMaintenance } = useTelefunWarning();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Bug #7 Fix: Reset selectedService to 'all' if the new timeframe doesn't have the current service
  useEffect(() => {
    const currentTrend = serviceTrendMap[timeframe];
    if (selectedService !== 'all' && !currentTrend.activeServices.includes(selectedService)) {
      setSelectedService('all');
    }
  }, [timeframe, serviceTrendMap]);

  // Derive stats dynamically from the selected timeframe and service
  const currentTrend = serviceTrendMap[timeframe];
  
  const totalFindings = selectedService === 'all'
    ? currentTrend.totalSummary.totalDefects
    : currentTrend.serviceSummary[selectedService]?.totalDefects ?? 0;

  const auditedAgents = selectedService === 'all'
    ? currentTrend.totalSummary.auditedAgents
    : currentTrend.serviceSummary[selectedService]?.auditedAgents ?? 0;

  const avgPerService = selectedService === 'all'
    ? currentTrend.totalSummary.activeServiceCount > 0
      ? (totalFindings / currentTrend.totalSummary.activeServiceCount).toFixed(1)
      : '0'
    : null;

  const avgPerAgent = auditedAgents > 0
    ? (totalFindings / auditedAgents).toFixed(1)
    : '0';

  const qaTrendPoints = currentTrend.labels.map((label, i) => {
    const point: any = { name: label };
    
    // Bug #9 Fix: Tooltip only shows visible fields
    if (selectedService === 'all') {
      point['Total'] = currentTrend.totalData[i];
      Object.entries(currentTrend.serviceData).forEach(([svc, data]) => {
        point[SERVICE_LABELS[svc] || svc] = data[i];
      });
    } else {
      const svcLabel = SERVICE_LABELS[selectedService] || selectedService;
      point[svcLabel] = (currentTrend.serviceData[selectedService] || [])[i] || 0;
    }
    
    return point;
  });

  const trendDataPoints = selectedService === 'all' 
    ? currentTrend.totalData 
    : (currentTrend.serviceData[selectedService] || currentTrend.labels.map(() => 0));

  const lastVal = trendDataPoints.length > 0 ? trendDataPoints[trendDataPoints.length - 1] : 0;
  const prevVal = trendDataPoints.length > 1 ? trendDataPoints[trendDataPoints.length - 2] : 0;
  
  const trendStatus = trendDataPoints.length < 2 ? "Stabil" : (lastVal < prevVal ? "Tren Membaik" : lastVal > prevVal ? "Tren Menurun" : "Stabil");
  const timeframeLabel = timeframe === '3m' ? '3 bulan terakhir' : timeframe === '6m' ? '6 bulan terakhir' : 'semua periode';

  // We could use searchParams to re-fetch trend data server-side
  // or keep this client-side for dynamic switching for now.
  // Given we want to minimize client-side supabase access, 
  // let's just use the initial data for now.
  // If we really need dynamic timeframe SSR, we should use router.push with searchParams.

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/?auth=login');
    router.refresh();
  };

  const { theme } = useTheme();
  const themeValue = isMounted ? theme : 'dark';
  const chartColor = themeValue === 'dark' ? 'var(--gold)' : 'var(--navy)';

  if (!isMounted) return null;

  return (
    <>
      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative flex flex-col">
        {/* Top Header */}
        <div className="sticky top-0 z-30 flex items-center justify-between px-8 py-5 bg-background/60 backdrop-blur-xl border-b border-border/40">
          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col">
              <span className="text-[10px] font-mono uppercase tracking-widest opacity-70">Status Sesi</span>
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
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1200px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none opacity-40" />
        
        <div className="p-8 xl:p-12 w-full max-w-[1600px] mx-auto relative z-10">
          <header className="mb-12">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h1 className="text-4xl lg:text-5xl font-bold tracking-tight mb-4">Dashboard</h1>
              <p className="text-lg text-foreground/70 font-light max-w-2xl leading-relaxed">
                Selamat datang di pusat kendali pelatihan <span className="text-foreground font-medium">Kontak OJK 157</span>. 
                Kelola simulasi, pantau performa, dan tingkatkan kualitas layanan melalui modul terintegrasi kami.
              </p>
            </motion.div>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-12">
            {modules.map((module, idx) => (
              <motion.div
                key={module.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1, duration: 0.5 }}
              >
                <Link 
                  href={module.href} 
                  onClick={(e) => {
                    if (module.id === 'telefun') {
                      e.preventDefault();
                      openMaintenance();
                    }
                  }}
                  className="group block h-full p-6 rounded-3xl border border-border/40 bg-card/30 backdrop-blur-md hover:border-primary/20 transition-all relative overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-6">
                      <div className={`w-10 h-10 ${module.bg} ${module.color} rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-500`}>
                        <module.icon className="w-5 h-5" />
                      </div>
                      <div className="w-8 h-8 rounded-full border border-border/40 flex items-center justify-center opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 bg-background">
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                    <h3 className="text-lg font-bold mb-1 tracking-tight group-hover:text-primary transition-colors">{module.title}</h3>
                    <p className="text-sm text-foreground/70 leading-relaxed font-light mb-6">
                      {module.description}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-primary opacity-0 group-hover:opacity-100 transition-all duration-300">
                      Buka Modul <ArrowRight className="w-3 h-3" />
                    </div>
                  </div>
                  <div className="absolute -right-6 -bottom-6 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity duration-500 rotate-12 pointer-events-none">
                    <module.icon className="w-32 h-32" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>

            {(role?.toLowerCase() === 'trainer' || role?.toLowerCase() === 'trainers' || role?.toLowerCase() === 'leader') && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4, duration: 0.5 }}
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
                        {currentTrend.activeServices.map(svc => (
                          <button
                            key={svc}
                            onClick={() => setSelectedService(selectedService === svc ? 'all' : svc)}
                            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${
                              selectedService === svc
                                ? 'bg-foreground/10 text-foreground shadow-sm'
                                : 'hover:bg-foreground/5 text-foreground/50'
                            }`}
                          >
                            <span 
                              className="w-1.5 h-1.5 rounded-full" 
                              style={{ backgroundColor: SERVICE_COLORS[svc] || '#ccc' }} 
                            />
                            {SERVICE_LABELS[svc] || svc}
                          </button>
                        ))}
                      </div>

                      <div className="h-4 w-px bg-border/40 hidden sm:block" />

                      <div className="flex items-center bg-background/50 border border-border/40 rounded-xl p-1">
                        {(['3m', '6m', 'all'] as const).map((tf) => (
                          <button
                            key={tf}
                            onClick={() => setTimeframe(tf)}
                            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                              timeframe === tf 
                              ? 'bg-primary text-primary-foreground shadow-sm' 
                              : 'hover:bg-foreground/5 text-foreground/50'
                            }`}
                          >
                            {tf === '3m' ? '3 B' : tf === '6m' ? '6 B' : 'All'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="h-[300px] w-full">
                    {isMounted && (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={qaTrendPoints}>
                          <defs>
                            <linearGradient id="colorFindings" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={chartColor} stopOpacity={0.3}/>
                              <stop offset="95%" stopColor={chartColor} stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.1} />
                          <XAxis 
                            dataKey="name" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.4, fontWeight: 700 }}
                            dy={10}
                          />
                          <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.4, fontWeight: 700 }}
                            dx={-10}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'var(--card)', 
                              borderColor: 'var(--border)',
                              borderRadius: '16px',
                              fontSize: '12px',
                              fontWeight: 'bold',
                              boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                              color: 'var(--foreground)'
                            }}
                          />
                          
                          {/* Total line - only show if all is selected or it is the total */}
                          {(selectedService === 'all') && (
                            <Area 
                              type="monotone" 
                              dataKey="Total" 
                              name="Total Temuan"
                              stroke={chartColor} 
                              fillOpacity={1} 
                              fill="url(#colorFindings)" 
                              strokeWidth={4}
                              animationDuration={1500}
                              dot={{ r: 4, fill: 'var(--card)', strokeWidth: 2, stroke: chartColor }}
                              activeDot={{ r: 6, fill: chartColor, strokeWidth: 0 }}
                            />
                          )}

                          {/* Individual service lines */}
                          {Object.entries(SERVICE_COLORS).map(([svc, color]) => {
                            const label = SERVICE_LABELS[svc] || svc;
                            const isSelected = selectedService === svc;
                            const shouldShow = selectedService === 'all' || isSelected;
                            
                            if (!shouldShow || !currentTrend.serviceData[svc]) return null;

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
                                animationDuration={1000}
                              />
                            );
                          })}
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                </motion.div>

                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5, duration: 0.5 }}
                  className="rounded-3xl border border-primary/20 bg-primary/95 text-primary-foreground p-8 flex flex-col shadow-2xl shadow-primary/10 relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                  
                  <h2 className="text-lg font-bold tracking-tight mb-8 relative z-10">Ringkasan Performa</h2>
                  <div className="flex-1 flex flex-col justify-center gap-6 relative z-10">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10">
                        <Activity className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="text-[10px] font-mono uppercase tracking-widest opacity-70 mb-1">Total Temuan</div>
                        <div className="text-4xl font-bold tracking-tight">{totalFindings}</div>
                      </div>
                    </div>
                    
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
                  </div>
                </motion.div>
              </div>
            )}

            {(role?.toLowerCase() === 'trainer' || role?.toLowerCase() === 'trainers') && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.5 }}
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
                        <div className="text-[10px] font-mono text-foreground/40">{log.time}</div>
                        {(role?.toLowerCase() === 'trainer' || role?.toLowerCase() === 'trainers') && (
                          <button 
                            onClick={async () => {
                              if (confirm('Hapus log aktivitas ini?')) {
                                try {
                                  await activityService.deleteActivity(log.id.toString());
                                  router.refresh();
                                } catch (err) {
                                  console.error(err);
                                  alert('Gagal menghapus log');
                                }
                              }
                            }}
                            className="p-2 text-foreground/20 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
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
        </div>
      </main>
    </>
  );
}
