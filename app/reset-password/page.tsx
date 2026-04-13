'use client';

import { useState, useEffect, FormEvent } from 'react';
import { Cpu, Loader2, KeyRound, CheckCircle } from 'lucide-react';
import { createClient } from '@/app/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setSessionReady(true);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('Password dan konfirmasi password tidak cocok.');
      return;
    }
    if (password.length < 6) {
      setError('Password minimal 6 karakter.');
      return;
    }
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setTimeout(() => router.push('/dashboard'), 3000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full bg-card border border-border/50 rounded-[2.5rem] p-10 shadow-2xl">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
            <Cpu className="text-primary-foreground w-6 h-6" />
          </div>
          <span className="font-black tracking-widest uppercase text-sm text-foreground">Trainers App</span>
        </div>

        {!sessionReady ? (
          <div className="text-center py-12">
            <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-6" />
            <p className="text-muted-foreground font-medium">Memvalidasi link reset password Anda...</p>
          </div>
        ) : success ? (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <h1 className="text-2xl font-black mb-3">Password Berhasil Diubah!</h1>
            <p className="text-foreground/50 text-sm">Mengalihkan ke dashboard...</p>
          </div>
        ) : (
          <>
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <KeyRound className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-black tracking-tighter mb-2 text-center">Buat Password Baru</h1>
            <p className="text-foreground/50 text-sm text-center mb-8">Masukkan password baru Anda di bawah ini.</p>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2 pl-1">Password Baru</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-background border border-border/40 rounded-xl px-4 py-3.5 text-sm font-black tracking-widest text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2 pl-1">Konfirmasi Password</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  className="w-full bg-background border border-border/40 rounded-xl px-4 py-3.5 text-sm font-black tracking-widest text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                  placeholder="••••••••"
                />
              </div>
              {error && (
                <p className="text-xs font-bold text-red-500 bg-red-500/10 p-4 rounded-2xl border border-red-500/20">{error}</p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 px-8 py-4 bg-primary text-primary-foreground rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Simpan Password Baru'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
