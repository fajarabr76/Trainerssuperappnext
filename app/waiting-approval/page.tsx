'use client';

import { useEffect } from 'react';
import { Cpu, Clock, LogOut } from 'lucide-react';
import { createClient } from '@/app/lib/supabase/client';
import { useRouter } from 'next/navigation';

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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('status')
        .eq('id', user.id)
        .single();
        
      if (profile?.status === 'approved') {
        router.push('/dashboard');
        router.refresh();
      }
    };
    
    checkStatus(); // cek langsung saat halaman dibuka
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, [supabase, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full bg-card border border-border/50 rounded-[2.5rem] p-10 shadow-2xl">
        {/* Header Logo - Same as reset-password/page.tsx */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
            <Cpu className="text-primary-foreground w-6 h-6" />
          </div>
          <span className="font-black tracking-widest uppercase text-sm text-foreground">Trainers App</span>
        </div>

        <div className="text-center">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Clock className="w-10 h-10 text-primary" />
          </div>
          
          <h1 className="text-3xl font-black tracking-tighter mb-4 text-foreground">Menunggu Persetujuan</h1>
          
          <p className="text-foreground/60 text-sm leading-relaxed mb-8">
            Akun Anda telah berhasil dibuat dan sedang dalam proses review oleh trainer. 
            Anda akan mendapatkan akses penuh setelah disetujui.
          </p>

          <div className="bg-primary/10 border border-primary/20 rounded-2xl p-6 mb-8 text-center text-balance">
            <p className="text-xs font-bold text-primary/80 leading-relaxed">
              Proses persetujuan biasanya memakan waktu 1x24 jam. 
              Hubungi trainer Anda jika membutuhkan akses segera.
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-4 px-6 rounded-xl border border-border hover:bg-foreground/5 text-foreground/60 hover:text-foreground font-bold text-sm transition-all active:scale-[0.98]"
          >
            <LogOut className="w-4 h-4" />
            Keluar dari Akun
          </button>
        </div>
      </div>
    </div>
  );
}
