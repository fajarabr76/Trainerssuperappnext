'use client';

import { useState, FormEvent, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, ArrowRight, Cpu, Loader2, X, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/lib/supabase/client';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
}

export default function AuthModal({ isOpen, onClose, initialMode = 'login' }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);

  // Sync mode with initialMode when modal opens
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
    }
  }, [isOpen, initialMode]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // Reset state when modal closes
  const handleClose = () => {
    setError(null);
    setSuccessMessage(null);
    setLoading(false);
    onClose();
  };

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        setLoading(false);
      } else {
        router.push('/dashboard');
        router.refresh();
      }
    } else {
      const role = formData.get('role') as string;
      
      // Cek apakah email sudah pernah mendaftar dengan status pending
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, status')
        .eq('email', email)
        .maybeSingle();

      if (existingProfile) {
        if (existingProfile.status === 'pending') {
          setError('Anda sudah mendaftar dan sedang menunggu persetujuan trainer. Mohon bersabar.');
          setLoading(false);
          return;
        }
        if (existingProfile.status === 'rejected') {
          setError('Pendaftaran Anda sebelumnya ditolak. Hubungi trainer untuk informasi lebih lanjut.');
          setLoading(false);
          return;
        }
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      if (data.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert([
            {
              id: data.user.id,
              email: email,
              role: role,
              status: 'pending',
            },
          ], { onConflict: 'id' });

        if (profileError) {
          setError('Gagal membuat profil. Silakan coba lagi.');
          setLoading(false);
          return;
        }
      }

      // JANGAN redirect ke dashboard, tampilkan pesan sukses
      setError(null);
      setSuccessMessage('Pendaftaran berhasil! Akun Anda sedang menunggu persetujuan dari trainer. Kami akan menghubungi Anda setelah disetujui.');
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-background/80 backdrop-blur-md"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-card/80 backdrop-blur-3xl border border-border/50 rounded-[2.5rem] shadow-2xl overflow-hidden"
          >
            {/* Background Glows */}
            <div className="absolute top-0 left-1/4 w-32 h-32 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-32 h-32 bg-violet-500/20 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 p-8 sm:p-10">
              <button 
                onClick={handleClose}
                className="absolute top-6 right-6 p-2 bg-foreground/5 hover:bg-foreground/10 text-foreground/40 hover:text-foreground rounded-full transition-all"
                aria-label="Tutup"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center justify-center gap-3 mb-8">
                <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 relative group">
                  <div className="absolute inset-0 bg-white/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                  <Cpu className="text-primary-foreground w-6 h-6 relative z-10" />
                </div>
                <span className="font-black tracking-widest uppercase text-sm text-foreground">Trainers App</span>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={mode}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <h2 className="text-3xl font-black tracking-tighter mb-2 text-center text-foreground">
                    {mode === 'login' ? 'Selamat Datang' : 'Buat Akun'}
                  </h2>
                  <p className="text-foreground/40 text-center mb-8 font-light text-sm">
                    {mode === 'login' 
                      ? 'Masuk menggunakan kredensial Anda untuk melanjutkan akses ke fasilitas trainers.'
                      : 'Daftarkan profil Anda untuk memulai pengaturan kelas dan evaluasi simulasi.'}
                  </p>

                  <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-foreground/40 mb-2 pl-1">Email</label>
                      <input
                        type="email"
                        name="email"
                        required
                        className="w-full bg-background border border-border/40 hover:border-border rounded-xl px-4 py-3.5 text-sm font-medium text-foreground placeholder:text-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                        placeholder="nama@email.com"
                        disabled={loading}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-foreground/40 mb-2 pl-1">Password</label>
                      <input
                        type="password"
                        name="password"
                        required
                        className="w-full bg-background border border-border/40 hover:border-border rounded-xl px-4 py-3.5 text-sm font-black tracking-widest text-foreground placeholder:text-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                        placeholder="••••••••"
                        disabled={loading}
                      />
                    </div>

                    {mode === 'register' && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                      >
                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-foreground/40 mb-2 mt-1 pl-1">Peran (Role)</label>
                        <select
                          name="role"
                          required
                          className="w-full bg-background border border-border/40 hover:border-border rounded-xl px-4 py-3.5 text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none shadow-sm cursor-pointer"
                          disabled={loading}
                        >
                          <option value="Agent">Agent</option>
                          <option value="Leader">Leader</option>
                          <option value="Trainer">Trainer</option>
                        </select>
                      </motion.div>
                    )}

                    <AnimatePresence>
                      {error && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="flex items-start gap-3 text-red-500 bg-red-500/10 p-4 rounded-2xl border border-red-500/20 overflow-hidden mt-1"
                        >
                          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                          <p className="text-xs font-bold leading-relaxed">{error}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <AnimatePresence>
                      {successMessage && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="flex items-start gap-3 text-green-600 bg-green-500/10 p-4 rounded-2xl border border-green-500/20 overflow-hidden mt-1"
                        >
                          <p className="text-xs font-bold leading-relaxed">{successMessage}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <button
                      type="submit"
                      disabled={loading || !!successMessage}
                      className="w-full mt-4 px-8 py-4 bg-primary text-primary-foreground rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (mode === 'login' ? 'Masuk ke Dashboard' : 'Buat Akun Sekarang')}
                      {!loading && <ArrowRight className="w-4 h-4" />}
                    </button>
                  </form>

                  <div className="mt-8 text-center">
                    <button 
                      type="button"
                      onClick={() => {
                        setError(null);
                        setSuccessMessage(null);
                        setMode(mode === 'login' ? 'register' : 'login');
                      }}
                      className="text-xs font-bold text-foreground/40 hover:text-primary transition-colors focus-visible:outline-none focus-visible:text-primary"
                      disabled={loading}
                    >
                      {mode === 'login' 
                        ? 'Belum memiliki akses? Daftar di sini' 
                        : 'Sudah memiliki akun? Masuk di sini'}
                    </button>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
