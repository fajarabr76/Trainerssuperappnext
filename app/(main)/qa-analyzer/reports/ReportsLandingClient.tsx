'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  FileText, 
  ChevronLeft, 
  Database, 
  Sparkles, 
  ArrowRight
} from 'lucide-react';
import { motion } from 'motion/react';
import { ReportWarningModal } from './ai/components/ReportWarningModal';

type Props = {
  role: string;
};

export default function ReportsLandingClient({ role }: Props) {
  const router = useRouter();
  const [showAiWarning, setShowAiWarning] = useState(false);

  const handleAiClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowAiWarning(true);
  };

  const handleContinueAi = () => {
    sessionStorage.setItem('sidak-ai-report-acknowledged', 'true');
    setShowAiWarning(false);
    router.push('/qa-analyzer/reports/ai');
  };

  const handleCancelAi = () => {
    setShowAiWarning(false);
    router.push('/qa-analyzer/dashboard');
  };

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <header className="relative z-20 flex shrink-0 flex-col items-start justify-between gap-4 border-b border-border/50 bg-background/80 px-4 py-4 backdrop-blur-xl sm:h-28 sm:flex-row sm:items-center sm:px-6 sm:py-0 lg:px-10">
        <div>
          <Link
            href="/qa-analyzer/dashboard"
            className="mb-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary"
          >
            <ChevronLeft className="h-3 w-3" /> Dashboard SIDAK
          </Link>
          <div className="mb-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            <FileText className="h-3 w-3" /> SIDAK
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-foreground">Menu Laporan</h1>
          <p className="mt-1 text-xs text-foreground/50">
            Pilih jenis laporan yang ingin Anda akses. Role: {role}
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-10">
        <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-6 md:grid-cols-2">
          {/* Laporan Data Card */}
          <motion.div
            whileHover={{ y: -5 }}
            className="group relative flex flex-col overflow-hidden rounded-[2.5rem] border border-border/50 bg-card/40 p-8 backdrop-blur-sm transition-all hover:bg-card/60"
          >
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-500/10 border border-blue-500/20 text-blue-500">
              <Database className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-black tracking-tight text-foreground">Laporan Data</h2>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
              Akses laporan berbasis database. Filter parameter QA, periode, dan layanan untuk mendapatkan tabel data mentah dan temuan operasional secara instan.
            </p>
            <div className="mt-8">
              <Link
                href="/qa-analyzer/reports/data"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-foreground text-background px-6 text-xs font-black uppercase tracking-widest transition-all hover:opacity-90 group-hover:gap-3"
              >
                Masuk ke Workspace <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            
            {/* Background pattern */}
            <div className="absolute -bottom-12 -right-12 h-40 w-40 rounded-full bg-blue-500/5 blur-3xl" />
          </motion.div>

          {/* Laporan AI Card */}
          <motion.div
            whileHover={{ y: -5 }}
            className="group relative flex flex-col overflow-hidden rounded-[2.5rem] border border-border/50 bg-card/40 p-8 backdrop-blur-sm transition-all hover:bg-card/60"
          >
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
              <Sparkles className="h-8 w-8" />
            </div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-black tracking-tight text-foreground">Laporan AI</h2>
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-amber-600 border border-amber-500/20">
                Premium
              </span>
            </div>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
              Generate laporan naratif otomatis menggunakan teknologi AI. Dapatkan analisis mendalam, tren kinerja, dan rekomendasi strategis dalam format dokumen Word.
            </p>
            <div className="mt-8">
              <button
                onClick={handleAiClick}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-amber-500 text-white px-6 text-xs font-black uppercase tracking-widest transition-all hover:bg-amber-600 group-hover:gap-3 shadow-lg shadow-amber-500/20"
              >
                Buka AI Generator <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            {/* Background pattern */}
            <div className="absolute -bottom-12 -right-12 h-40 w-40 rounded-full bg-amber-500/5 blur-3xl" />
          </motion.div>
        </div>
      </div>

      <ReportWarningModal 
        isOpen={showAiWarning} 
        onConfirm={handleContinueAi}
        onCancel={handleCancelAi}
      />
    </main>
  );
}
