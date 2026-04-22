'use client';

import { useEffect } from 'react';
import QaStatePanel from '../components/QaStatePanel';
import { RefreshCcw, X } from 'lucide-react';

export default function InputError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[SIDAK][input] route error:', error);
  }, [error]);

  const rawMessage = error.message || '';
  const isInternal = /supabase|postgrest|postgres|database|schema|connection|timeout|fetch|PGRST/i.test(rawMessage);
  const safeMessage = isInternal 
    ? 'Gagal memproses data input SIDAK. Silakan coba lagi atau hubungi administrator jika kendala berlanjut.' 
    : rawMessage;

  return (
    <div className="flex-1 p-4 md:p-8 lg:p-10 bg-background min-h-screen flex items-center justify-center">
      <div className="max-w-2xl w-full">
        <QaStatePanel
          type="error"
          title="Terjadi kesalahan saat memuat halaman input"
          description={safeMessage || 'Gagal memproses data input SIDAK. Silakan coba lagi atau hubungi administrator jika kendala berlanjut.'}
          action={
            <div className="flex items-center gap-3">
              <button
                onClick={() => reset()}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-bold shadow-lg shadow-primary/20 transition-all hover:bg-primary/90"
              >
                <RefreshCcw className="w-4 h-4" />
                Coba Lagi
              </button>
              <button
                onClick={() => window.location.href = '/qa-analyzer/input'}
                className="flex items-center gap-2 px-4 py-2 bg-card border border-border hover:border-primary/40 rounded-xl text-sm font-semibold transition-all"
              >
                <X className="w-4 h-4" />
                Reset Halaman
              </button>
            </div>
          }
        />
        {error.digest && (
          <p className="mt-6 text-[10px] text-muted-foreground font-mono opacity-50 text-center">
            Error ID: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
