'use client';

import React from 'react';
import Link from 'next/link';
import { 
  BarChart3, 
  ChevronLeft, 
  LayoutDashboard, 
  Users, 
  Trophy, 
  FileText,
  ArrowRight
} from 'lucide-react';
import { motion } from 'motion/react';

type Props = {
  role: string;
};

export default function SidakLandingClient({ role }: Props) {
  const isManagerRole = ['trainer', 'admin'].includes(role?.toLowerCase());

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <header className="relative z-20 flex shrink-0 flex-col items-start justify-between gap-4 border-b border-border/50 bg-background/80 px-4 py-4 backdrop-blur-xl sm:h-28 sm:flex-row sm:items-center sm:px-6 sm:py-0 lg:px-10">
        <div>
          <Link
            href="/dashboard"
            className="mb-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary"
          >
            <ChevronLeft className="h-3 w-3" /> Pusat Kendali
          </Link>
          <div className="mb-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            <BarChart3 className="h-3 w-3" /> SIDAK
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-foreground">Sistem Informasi Data Analisis Kualitas</h1>
          <p className="mt-1 text-xs text-foreground/50">
            Analytics kualitas untuk membaca pola temuan, ranking, dan area perbaikan lintas tim.
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-10">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
          
          {/* Hero Welcome Card */}
          <div className="relative overflow-hidden rounded-[2.5rem] border border-border/50 bg-card/40 p-8 sm:p-10 lg:p-12 backdrop-blur-xl shadow-xl shadow-black/5">
            <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
            <div className="absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />
            
            <div className="relative z-10 max-w-3xl">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-blue-500 mb-6">
                <BarChart3 className="h-3.5 w-3.5" />
                Modul Utama
              </div>
              <h2 className="text-4xl font-black tracking-tight text-foreground lg:text-5xl mb-4">
                Selamat Datang di SIDAK
              </h2>
              <p className="text-base leading-relaxed text-muted-foreground lg:text-lg">
                Pusat kendali analisis kualitas. Pantau performa agen, identifikasi area perbaikan, dan hasilkan laporan komprehensif untuk mendorong pertumbuhan dan kualitas layanan yang lebih baik.
              </p>
            </div>
          </div>

          <div>
            <div className="mb-6">
              <h3 className="text-xl font-bold tracking-tight">Pilih Modul</h3>
              <p className="text-sm text-muted-foreground">Akses fitur analitik dan laporan SIDAK.</p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              
              {/* Dashboard */}
              <Link href="/qa-analyzer/dashboard" className="block h-full">
                <motion.div
                  whileHover={{ y: -5 }}
                  className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-border/50 bg-card/40 p-6 backdrop-blur-sm transition-all hover:bg-card/60 hover:border-blue-500/30 hover:shadow-lg hover:shadow-blue-500/5"
                >
                  <div className="mb-4 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-500 transition-colors group-hover:bg-blue-500 group-hover:text-white">
                    <LayoutDashboard className="h-6 w-6" />
                  </div>
                  <h4 className="text-lg font-bold tracking-tight text-foreground">Dashboard</h4>
                  <p className="mt-2 flex-1 text-xs leading-relaxed text-muted-foreground">
                    Pusat kendali utama menampilkan ringkasan metrik secara real-time dan tren kinerja operasional.
                  </p>
                  <div className="mt-6 flex items-center text-[10px] font-bold uppercase tracking-widest text-blue-500 opacity-0 transition-opacity group-hover:opacity-100">
                    Buka Modul <ArrowRight className="ml-1 h-3 w-3" />
                  </div>
                </motion.div>
              </Link>

              {/* Analisis Individu */}
              <Link href="/qa-analyzer/agents" className="block h-full">
                <motion.div
                  whileHover={{ y: -5 }}
                  className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-border/50 bg-card/40 p-6 backdrop-blur-sm transition-all hover:bg-card/60 hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/5"
                >
                  <div className="mb-4 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500 transition-colors group-hover:bg-emerald-500 group-hover:text-white">
                    <Users className="h-6 w-6" />
                  </div>
                  <h4 className="text-lg font-bold tracking-tight text-foreground">Analisis Individu</h4>
                  <p className="mt-2 flex-1 text-xs leading-relaxed text-muted-foreground">
                    Pemeriksaan mendalam terhadap riwayat, log aktivitas, dan pencapaian target spesifik tiap agen.
                  </p>
                  <div className="mt-6 flex items-center text-[10px] font-bold uppercase tracking-widest text-emerald-500 opacity-0 transition-opacity group-hover:opacity-100">
                    Buka Modul <ArrowRight className="ml-1 h-3 w-3" />
                  </div>
                </motion.div>
              </Link>

              {/* Ranking Agen */}
              <Link href="/qa-analyzer/ranking" className="block h-full">
                <motion.div
                  whileHover={{ y: -5 }}
                  className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-border/50 bg-card/40 p-6 backdrop-blur-sm transition-all hover:bg-card/60 hover:border-amber-500/30 hover:shadow-lg hover:shadow-amber-500/5"
                >
                  <div className="mb-4 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 transition-colors group-hover:bg-amber-500 group-hover:text-white">
                    <Trophy className="h-6 w-6" />
                  </div>
                  <h4 className="text-lg font-bold tracking-tight text-foreground">Ranking Agen</h4>
                  <p className="mt-2 flex-1 text-xs leading-relaxed text-muted-foreground">
                    Papan peringkat berbasis data algoritma komposit untuk mengidentifikasi top performer.
                  </p>
                  <div className="mt-6 flex items-center text-[10px] font-bold uppercase tracking-widest text-amber-500 opacity-0 transition-opacity group-hover:opacity-100">
                    Buka Modul <ArrowRight className="ml-1 h-3 w-3" />
                  </div>
                </motion.div>
              </Link>

              {/* Laporan (Conditional) */}
              {isManagerRole && (
                <Link href="/qa-analyzer/reports" className="block h-full">
                  <motion.div
                    whileHover={{ y: -5 }}
                    className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-border/50 bg-card/40 p-6 backdrop-blur-sm transition-all hover:bg-card/60 hover:border-violet-500/30 hover:shadow-lg hover:shadow-violet-500/5"
                  >
                    <div className="mb-4 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-500 transition-colors group-hover:bg-violet-500 group-hover:text-white">
                      <FileText className="h-6 w-6" />
                    </div>
                    <h4 className="text-lg font-bold tracking-tight text-foreground">Laporan</h4>
                    <p className="mt-2 flex-1 text-xs leading-relaxed text-muted-foreground">
                      Ekstraksi data historis dan generasi laporan audit dalam berbagai format standar institusi.
                    </p>
                    <div className="mt-6 flex items-center text-[10px] font-bold uppercase tracking-widest text-violet-500 opacity-0 transition-opacity group-hover:opacity-100">
                      Buka Modul <ArrowRight className="ml-1 h-3 w-3" />
                    </div>
                  </motion.div>
                </Link>
              )}

            </div>
          </div>
          
        </div>
      </div>
    </main>
  );
}
