'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle, KeyRound, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/lib/supabase/client';
import AuthPageFrame from '@/app/components/AuthPageFrame';

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
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
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
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setTimeout(() => router.push('/dashboard'), 2500);
  };

  return (
    <AuthPageFrame
      eyebrow="Password recovery"
      title="Perbarui akses Anda tanpa keluar dari ritme kerja."
      description="Gunakan halaman ini untuk membuat password baru lalu kembali ke dashboard terpadu Anda."
    >
      <div className="rounded-[1.6rem] border border-border/50 bg-background/70 p-6">
        {!sessionReady ? (
          <div className="py-12 text-center">
            <Loader2 className="mx-auto mb-5 h-10 w-10 animate-spin text-primary" />
            <h2 className="text-2xl font-semibold tracking-tight">Memvalidasi tautan reset</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">Mohon tunggu sebentar, kami sedang memastikan sesi pemulihan Anda aktif.</p>
          </div>
        ) : success ? (
          <div className="py-8 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10 text-green-600">
              <CheckCircle className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">Password berhasil diubah</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">Anda akan diarahkan kembali ke dashboard dalam beberapa detik.</p>
          </div>
        ) : (
          <>
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/15 bg-primary/8 text-primary">
              <KeyRound className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">Buat password baru</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Gunakan password yang kuat agar akses ke platform tetap aman.</p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Password baru</span>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="auth-input" placeholder="••••••••" />
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Konfirmasi password</span>
                <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required className="auth-input" placeholder="••••••••" />
              </label>
              {error && <p className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-xs font-semibold text-red-600">{error}</p>}
              <button type="submit" disabled={loading} className="auth-submit">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Simpan Password Baru'}
              </button>
            </form>
          </>
        )}
      </div>
    </AuthPageFrame>
  );
}
