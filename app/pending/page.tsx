'use client';

import { motion } from 'motion/react';
import { Clock, Cpu, LogOut, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/app/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function PendingPage() {
  const supabase = createClient();
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/?auth=login');
    router.refresh();
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#050505] text-white selection:bg-white/20 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-lg p-12 rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-xl relative z-10 text-center"
      >
        <div className="flex items-center justify-center gap-3 mb-12">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(255,255,255,0.2)]">
            <Cpu className="text-black w-5 h-5" />
          </div>
          <span className="font-bold tracking-widest uppercase text-sm">Trainers SuperApp</span>
        </div>

        <div className="mb-8 flex justify-center">
          <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center border border-amber-500/20">
            <Clock className="w-10 h-10 text-amber-500 animate-pulse" />
          </div>
        </div>

        <h1 className="text-3xl font-bold tracking-tighter mb-4">Akun Menunggu Persetujuan</h1>
        <p className="text-white/50 mb-12 font-light leading-relaxed">
          Terima kasih telah mendaftar. Akun Anda saat ini sedang dalam proses peninjauan oleh tim Trainer. 
          Anda akan mendapatkan akses penuh setelah akun Anda disetujui.
        </p>

        <div className="flex flex-col gap-4">
          <button
            onClick={() => window.location.reload()}
            className="w-full px-8 py-4 bg-white text-black rounded-xl font-medium transition-all hover:bg-white/90 hover:scale-[1.02] active:scale-[0.98]"
          >
            Cek Status Lagi
          </button>
          
          <button
            onClick={handleLogout}
            className="w-full px-8 py-4 bg-white/5 border border-white/10 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-white/10 transition-all"
          >
            <LogOut className="w-4 h-4" /> Keluar
          </button>
        </div>

        <div className="mt-12 pt-8 border-t border-white/5">
          <Link href="/" className="text-white/30 hover:text-white transition-colors text-sm flex items-center justify-center gap-2 group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Kembali ke Beranda
          </Link>
        </div>
      </motion.div>

      {/* Decorative elements */}
      <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/3 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />
    </main>
  );
}
