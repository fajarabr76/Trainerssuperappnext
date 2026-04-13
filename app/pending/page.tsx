'use client';

import { Clock, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/lib/supabase/client';
import AuthPageFrame from '@/app/components/AuthPageFrame';

export default function PendingPage() {
  const supabase = createClient();
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/?auth=login');
    router.refresh();
  };

  return (
    <AuthPageFrame
      eyebrow="Pending access"
      title="Permintaan akses Anda sudah masuk."
      description="Saat ini akun Anda masih dalam status pending. Begitu disetujui, Anda bisa langsung lanjut ke command center."
    >
      <div className="rounded-[1.6rem] border border-border/50 bg-background/70 p-6 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
          <Clock className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">Akun menunggu persetujuan</h2>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Terima kasih sudah mendaftar. Tim trainer sedang meninjau permintaan akses Anda sebelum dashboard diaktifkan.
        </p>
        <div className="mt-6 grid gap-3">
          <button onClick={() => window.location.reload()} className="auth-submit">
            Cek Status Lagi
          </button>
          <button
            onClick={handleLogout}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border/60 bg-card px-5 py-3 text-sm font-semibold transition hover:bg-accent"
          >
            <LogOut className="h-4 w-4" />
            Keluar
          </button>
        </div>
      </div>
    </AuthPageFrame>
  );
}
