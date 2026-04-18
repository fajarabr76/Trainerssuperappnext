'use client';

import React, { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

function DownloadPesertaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const batch = searchParams.get('batch');

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/profiler')} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full text-[#5A5A40] transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Download Data</h1>
        </div>
        
        <div className="bg-white dark:bg-card rounded-2xl p-6 border border-[#5A5A40]/10 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">Batch Terpilih</p>
            <span className="px-3 py-1 bg-[#5A5A40]/10 text-[#5A5A40] rounded-full text-xs font-bold">{batch}</span>
          </div>
          <div className="h-px bg-gray-100 dark:bg-white/5" />
          <p className="text-sm text-gray-500 dark:text-gray-400 italic text-center py-8">
            Fitur export ke Excel, CSV, PDF, dan PPTX sedang diproses...
          </p>
        </div>
      </div>
    </div>
  );
}

export default function DownloadPesertaPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading...</div>}>
      <DownloadPesertaContent />
    </Suspense>
  );
}
