'use client';

import dynamic from 'next/dynamic';
import { motion } from "motion/react";
import { LayoutDashboard, MessageSquare, Mail, Phone, ChevronRight, Users, BarChart3, ArrowRight } from "lucide-react";
import Link from "next/link";
import React from 'react';
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { useTelefunWarning } from "@/app/context/TelefunWarningContext";

const DashboardAnalyticsPanel = dynamic(() => import('./DashboardAnalyticsPanel'), {
  ssr: false,
  loading: () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-[420px] rounded-3xl border border-border/40 bg-card/30 animate-pulse" />
        <div className="h-[420px] rounded-3xl border border-border/40 bg-card/30 animate-pulse" />
      </div>
      <div className="h-[260px] rounded-3xl border border-border/40 bg-card/30 animate-pulse" />
    </div>
  ),
});

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
    topParameter?: { name: string; count: number } | null;
  }>;
  initialRecentLogs: Array<{ id: string | number, user: string, action: string, time: string, type: string }>;
  availableYears: number[];
  initialYear: number;
}

export default function DashboardClient({ 
  user, role, profile, 
  serviceTrendMap, initialRecentLogs,
  availableYears, initialYear
}: DashboardClientProps) {
  const { openMaintenance } = useTelefunWarning();

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

          <DashboardAnalyticsPanel
            role={role}
            serviceTrendMap={serviceTrendMap}
            initialRecentLogs={initialRecentLogs}
            availableYears={availableYears}
            initialYear={initialYear}
          />
        </div>
      </main>
    </>
  );
}
