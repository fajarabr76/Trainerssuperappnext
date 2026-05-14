'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Dashboard Error]', error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center p-8">
      <div className="max-w-md text-center space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 text-red-500">
          <AlertCircle className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">Terjadi Kesalahan</h2>
          <p className="text-sm text-muted-foreground leading-6">
            Dashboard gagal dimuat. Ini mungkin masalah sementara dengan koneksi ke server.
          </p>
          {error.digest && (
            <p className="text-xs text-muted-foreground font-mono">
              Digest: {error.digest}
            </p>
          )}
        </div>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-5 py-3 text-sm font-semibold transition hover:bg-accent"
        >
          <RefreshCw className="h-4 w-4" />
          Coba Lagi
        </button>
      </div>
    </main>
  );
}
