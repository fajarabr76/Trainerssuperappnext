'use client';

import { useEffect } from 'react';
import { Clock, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/lib/supabase/client';
import AuthPageFrame from '@/app/components/AuthPageFrame';

export default function WaitingApprovalPage() {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  useEffect(() => {
    const checkStatus = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/?auth=login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('status, is_deleted')
        .eq('id', user.id)
        .maybeSingle();
      
      if (profile?.is_deleted) {
        await supabase.auth.signOut();
        router.push('/?auth=login&message=deleted');
        router.refresh();
        return;
      }

      if (profile?.status === 'approved') {
        router.push('/dashboard');
        router.refresh();
      } else if (profile?.status === 'rejected') {
        await supabase.auth.signOut();
        router.push('/?auth=login&message=rejected');
        router.refresh();
      }
    };

    void checkStatus();
    const interval = setInterval(() => void checkStatus(), 60000);
    return () => clearInterval(interval);
  }, [router, supabase]);

  return (
    <AuthPageFrame
      eyebrow="Access review"
      title="Akun Anda sedang direview trainer."
      description="Begitu disetujui, Anda akan langsung diarahkan ke dashboard baru tanpa perlu setup tambahan."
    >
      <div className="rounded-[1.6rem] border border-border/50 bg-background/70 p-6 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Clock className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">Menunggu persetujuan</h2>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Akun Anda berhasil dibuat dan sedang menunggu verifikasi. Halaman ini akan memeriksa status secara berkala.
        </p>
        <div className="mt-6 rounded-3xl border border-primary/15 bg-primary/8 p-5 text-sm leading-6 text-primary/90">
          Estimasi normal sekitar 1x24 jam. Jika akses dibutuhkan segera, hubungi trainer atau admin Anda.
        </div>
        <button onClick={handleLogout} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full border border-border/60 bg-card px-5 py-3 text-sm font-semibold transition hover:bg-accent">
          <LogOut className="h-4 w-4" />
          Keluar dari Akun
        </button>
      </div>
    </AuthPageFrame>
  );
}
