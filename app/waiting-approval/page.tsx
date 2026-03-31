'use client';

import { useEffect } from 'react';
import { Cpu, Clock, LogOut } from 'lucide-react';
import { createClient } from '@/app/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function WaitingApprovalPage() {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/');
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('status')
        .eq('id', user.id)
        .single();

      if (profile?.status === 'approved') {
        router.push('/dashboard');
      }
    };
    checkStatus();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full text-center bg-card border border-border/50 rounded-[2.5rem] p-10 shadow-2xl">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
            <Cpu className="text-primary-foreground w-6 h-6" />
          </div>
          <span className="font-black tracking-widest uppercase text-sm text-foreground">Trainers App</span>
        </div>
        <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <Clock className="w-8 h-8 text-yellow-600" />
        </div>
        <h1 className="text-2xl font-black tracking-tighter mb-3 text-foreground">
          Menunggu Persetujuan
        </h1>
        <p className="text-foreground/50 text-sm leading-relaxed mb-8">
          Akun Anda sedang dalam proses review oleh trainer.
          Anda akan mendapatkan akses penuh setelah disetujui.
          Mohon bersabar dan tunggu konfirmasi selanjutnya.
        </p>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 mx-auto px-6 py-3 bg-foreground/5 hover:bg-foreground/10 text-foreground/60 hover:text-foreground rounded-xl text-sm font-bold transition-all"
        >
          <LogOut className="w-4 h-4" />
          Keluar
        </button>
      </div>
    </div>
  );
}
