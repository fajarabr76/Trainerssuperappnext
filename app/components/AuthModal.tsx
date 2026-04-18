'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, ArrowRight, Cpu, Loader2, ShieldCheck, X } from 'lucide-react';
import { createClient } from '@/app/lib/supabase/client';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register' | 'forgot';
  initialNotice?: { type: 'error' | 'info'; text: string };
}

const AUTH_COPY = {
  login: {
    title: 'Masuk',
    description: 'Silakan masuk menggunakan akun aktif perusahaan Anda.',
    submit: 'Masuk sekarang',
  },
  register: {
    title: 'Minta Akses Baru',
    description: 'Isi data berikut untuk meminta akses ke sistem. Proses ini memerlukan persetujuan dari administrator.',
    submit: 'Ajukan akses',
  },
  forgot: {
    title: 'Lupa Kata Sandi',
    description: 'Masukkan email Anda dan kami akan mengirimkan instruksi untuk mengatur ulang kata sandi.',
    submit: 'Kirim tautan pemulihan',
  },
} as const;

export default function AuthModal({ isOpen, onClose, initialMode = 'login', initialNotice }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(initialMode);
  const [error, setError] = useState<string | null>(initialNotice?.type === 'error' ? initialNotice.text : null);
  const [successMessage, setSuccessMessage] = useState<string | null>(initialNotice?.type === 'info' ? initialNotice.text : null);
  const [loading, setLoading] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setError(initialNotice?.type === 'error' ? initialNotice.text : null);
      setSuccessMessage(initialNotice?.type === 'info' ? initialNotice.text : null);
      setLoading(false);
      setForgotLoading(false);
    }
  }, [initialMode, isOpen, initialNotice]);

  const handleClose = () => {
    setError(null);
    setSuccessMessage(null);
    setLoading(false);
    setForgotLoading(false);
    const url = new URL(window.location.href);
    url.searchParams.delete('auth');
    window.history.replaceState({}, '', url.pathname || '/');
    onClose();
  };

  async function waitForActiveSession() {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (user && !error) {
        const { data: { session } } = await supabase.auth.getSession();
        return session;
      }

      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    return null;
  }

  async function resolvePostLoginPath(userId: string) {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('status')
      .eq('id', userId)
      .maybeSingle();

    if (profileError || !profile) {
      console.warn('[AuthModal] Failed to read profile after login:', profileError?.message);
      await supabase.auth.signOut();
      throw new Error('Data akun tidak ditemukan atau gagal diverifikasi. Silakan hubungi admin.');
    }

    const profileStatus = profile?.status?.toLowerCase();

    if (profileStatus === 'pending') {
      return '/waiting-approval';
    }

    if (profileStatus === 'rejected') {
      await supabase.auth.signOut();
      throw new Error('Akun Anda belum dapat diakses. Silakan hubungi administrator Anda.');
    }

    return '/dashboard';
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    if (mode === 'login') {
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });

      if (loginError) {
        setError(loginError.message);
        setLoading(false);
        return;
      }

      const session = await waitForActiveSession();

      if (!session?.user) {
        setError('Sesi login belum siap. Silakan coba sekali lagi.');
        setLoading(false);
        return;
      }

      try {
        const nextPath = await resolvePostLoginPath(session.user.id);
        window.location.assign(nextPath);
      } catch (postLoginError) {
        setError(postLoginError instanceof Error ? postLoginError.message : 'Login berhasil, tetapi status akun belum dapat diverifikasi.');
        setLoading(false);
      }
      return;
    }

    const role = formData.get('role') as string;
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, status')
      .eq('email', email)
      .maybeSingle();

    if (existingProfile?.status === 'pending') {
      setError('Pengajuan Anda telah kami terima dan saat ini sedang menunggu persetujuan administrator.');
      setLoading(false);
      return;
    }

    if (existingProfile?.status === 'rejected') {
      setError('Pengajuan Anda sebelumnya belum dapat disetujui. Silakan hubungi administrator Anda.');
      setLoading(false);
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').upsert(
        [
          {
            id: data.user.id,
            email,
            role,
            status: 'pending',
          },
        ],
        { onConflict: 'id' }
      );

      if (profileError) {
        setError('Terjadi masalah jaringan saat mendaftar. Silakan coba lagi.');
        setLoading(false);
        return;
      }
    }

    setSuccessMessage('Permintaan akses berhasil dikirim! Anda bisa masuk setelah akun Anda disetujui.');
    setLoading(false);
  }

  async function handleForgotPassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setForgotLoading(true);
    setError(null);
    setSuccessMessage(null);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;

    const { error: forgotError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (forgotError) {
      setError(forgotError.message);
    } else {
      setSuccessMessage('Tautan untuk mengatur ulang kata sandi sudah dikirim ke email Anda.');
    }

    setForgotLoading(false);
  }

  const content = AUTH_COPY[mode];
  const isBusy = loading || forgotLoading;

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
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 20 }}
            className="relative w-full max-w-5xl overflow-hidden rounded-[2rem] border border-border/50 bg-card/85 shadow-2xl shadow-black/10 backdrop-blur-2xl"
          >
            <div className="absolute inset-x-8 top-0 h-24 rounded-b-full bg-primary/12 blur-3xl" />
            <div className="relative z-10 grid md:grid-cols-[1.05fr_0.95fr]">
              <div className="relative hidden overflow-hidden border-r border-border/50 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--card)_72%,transparent),color-mix(in_srgb,var(--background)_88%,transparent))] p-9 md:block">
                <div className="absolute left-10 top-12 h-44 w-44 rounded-full bg-primary/10 blur-3xl" />
                <div className="absolute bottom-10 right-8 h-36 w-36 rounded-full bg-module-sidak/10 blur-3xl" />
                <div className="relative z-10 flex h-full flex-col">
                  <div className="mb-10 flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                      <Cpu className="h-5 w-5" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold tracking-tight">Trainers SuperApp</span>
                      <span className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Workspace internal</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/8 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-primary">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Arsitektur Terpadu
                    </div>
                    <h2 className="max-w-sm text-3xl font-semibold tracking-tight text-balance">
                      Platform operasional pintar untuk tim trainer.
                    </h2>
                    <p className="max-w-md text-sm leading-6 text-muted-foreground">
                      Latih tim, pantau metrik, dan analisis kualitas interaksi layanan dari satu panel instrumen yang terpusat.
                    </p>
                  </div>

                  <div className="mt-auto space-y-3 pt-10">
                    <div className="rounded-[1.5rem] border border-border/50 bg-background/70 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Lebih Teratur</p>
                      <p className="mt-2 text-sm leading-6 text-foreground/90">
                        Dirancang agar pelatih bisa fokus penuh membimbing tim tanpa terdistraksi masalah pelaporan data.
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[1.5rem] border border-border/50 bg-card/70 p-4">
                        <p className="text-xs font-semibold">Simulasi Nyata</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">Praktikkan dialog pelanggan layaknya kasus sesungguhnya.</p>
                      </div>
                      <div className="rounded-[1.5rem] border border-border/50 bg-card/70 p-4">
                        <p className="text-xs font-semibold">Terkendali Penuh</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">Kelola siapa yang bisa mengakses bagian dari sistem ini sedetail mungkin.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-8 sm:p-9">
                <button
                  onClick={handleClose}
                  className="absolute right-5 top-5 rounded-full border border-border/60 bg-background/70 p-2 text-muted-foreground transition hover:text-foreground"
                  aria-label="Tutup"
                >
                  <X className="h-4 w-4" />
                </button>

                <div className="mb-8 flex items-center gap-3 md:hidden">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                    <Cpu className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold tracking-tight">Trainers SuperApp</span>
                    <span className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Workspace internal</span>
                  </div>
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={mode}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.25 }}
                  >
                    <div className="mb-8 space-y-3">
                      <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/8 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-primary">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        {mode === 'login' ? 'Masuk aman' : mode === 'register' ? 'Permintaan akses' : 'Pemulihan akun'}
                      </div>
                      <h2 className="text-3xl font-semibold tracking-tight">{content.title}</h2>
                      <p className="text-sm leading-6 text-muted-foreground">{content.description}</p>
                    </div>

                    {mode === 'forgot' ? (
                      <form onSubmit={handleForgotPassword} className="flex flex-col gap-4">
                        <Field label="Email">
                          <input
                            type="email"
                            name="email"
                            required
                            disabled={forgotLoading}
                            autoComplete="email"
                            placeholder="nama@perusahaan.com"
                            className="auth-input"
                          />
                        </Field>
                        <Feedback error={error} successMessage={successMessage} />
                        <button type="submit" disabled={forgotLoading || !!successMessage} className="auth-submit">
                          {forgotLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : content.submit}
                          {!forgotLoading && <ArrowRight className="h-4 w-4" />}
                        </button>
                      </form>
                    ) : (
                      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <Field label="Email">
                          <input
                            type="email"
                            name="email"
                            required
                            disabled={loading}
                            autoComplete="email"
                            placeholder="nama@perusahaan.com"
                            className="auth-input"
                          />
                        </Field>

                        <Field label="Password">
                          <input
                            type="password"
                            name="password"
                            required
                            disabled={loading}
                            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                            placeholder="••••••••"
                            className="auth-input tracking-[0.2em]"
                          />
                        </Field>

                        {mode === 'login' && (
                          <div className="-mt-2 flex justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                setError(null);
                                setSuccessMessage(null);
                                setMode('forgot');
                              }}
                              className="px-1 text-xs font-semibold text-muted-foreground transition hover:text-primary"
                              disabled={loading}
                            >
                              Lupa kata sandi?
                            </button>
                          </div>
                        )}

                        {mode === 'register' && (
                          <Field label="Peran">
                            <select name="role" required disabled={loading} className="auth-input">
                              <option value="agent">Agent</option>
                              <option value="leader">Leader</option>
                              <option value="trainer">Trainer</option>
                            </select>
                          </Field>
                        )}

                        <Feedback error={error} successMessage={successMessage} />

                        <button type="submit" disabled={loading || !!successMessage} className="auth-submit">
                          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : content.submit}
                          {!loading && <ArrowRight className="h-4 w-4" />}
                        </button>
                      </form>
                    )}

                    <div className="mt-7 text-center">
                      {mode === 'forgot' ? (
                        <button
                          type="button"
                          onClick={() => {
                            setError(null);
                            setSuccessMessage(null);
                            setMode('login');
                          }}
                          className="text-xs font-semibold text-muted-foreground transition hover:text-primary"
                          disabled={isBusy}
                        >
                          Sudah ingat kata sandimu? Masuk lagi
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setError(null);
                            setSuccessMessage(null);
                            setMode(mode === 'login' ? 'register' : 'login');
                          }}
                          className="text-xs font-semibold text-muted-foreground transition hover:text-primary"
                          disabled={isBusy}
                        >
                          {mode === 'login' ? 'Belum punya akun? Ajukan akses' : 'Sudah punya akun? Masuk di sini'}
                        </button>
                      )}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Feedback({ error, successMessage }: { error: string | null; successMessage: string | null }) {
  return (
    <>
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-start gap-3 overflow-hidden rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-600"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-xs font-semibold leading-5">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden rounded-2xl border border-green-500/20 bg-green-500/10 p-4 text-green-700"
          >
            <p className="text-xs font-semibold leading-5">{successMessage}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
