'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCw, LogOut } from 'lucide-react';
import { createClient } from '@/app/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function MainLayoutError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error('[MainLayout Error]', error);
  }, [error]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-8">
      <div className="max-w-md text-center space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 text-red-500">
          <AlertCircle className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">Terjadi Kesalahan Server</h2>
          <p className="text-sm text-muted-foreground leading-6">
            Aplikasi mengalami masalah saat memuat halaman ini. Silakan coba muat ulang atau hubungi administrator.
          </p>
          {error.digest && (
            <p className="text-xs text-muted-foreground font-mono">
              Digest: {error.digest}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-5 py-3 text-sm font-semibold text-primary transition hover:bg-primary/20"
          >
            <RefreshCw className="h-4 w-4" />
            Muat Ulang
          </button>
          <button
            onClick={handleLogout}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-border/60 bg-card px-5 py-3 text-sm font-semibold transition hover:bg-accent"
          >
            <LogOut className="h-4 w-4" />
            Keluar dan Login Ulang
          </button>
        </div>
      </div>
    </div>
  );
}
