'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Cpu,
  LockKeyhole,
  Loader2,
  Orbit,
  PanelsTopLeft,
  Shield,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthModal from '@/app/components/AuthModal';
import { ThemeToggle } from './components/ThemeToggle';
import { createClient } from '@/app/lib/supabase/client';
import { APP_MODULES } from '@/app/lib/app-config';

function AuthTrigger({ onOpen }: { onOpen: (mode: 'login' | 'register' | 'forgot') => void }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const authParam = searchParams.get('auth');
    if (authParam === 'login' || authParam === 'register' || authParam === 'forgot') {
      onOpen(authParam);
    }
  }, [onOpen, searchParams]);

  return null;
}

const featureRows = [
  'Masuk sekali, lanjut kerja tanpa pindah-pindah konteks.',
  'Alur untuk agent, leader, trainer, dan admin sudah dibedakan dengan jelas.',
  'Tampilan tetap konsisten dari halaman awal sampai workspace internal.',
];

const proofPoints = [
  {
    title: 'Akses lebih rapi',
    description: 'Satu pintu masuk untuk modul training, monitoring, dan kebutuhan operasional harian.',
    icon: LockKeyhole,
  },
  {
    title: 'Prioritas lebih jelas',
    description: 'Dashboard membantu tim melihat apa yang perlu dikerjakan lebih dulu, bukan sekadar menumpuk menu.',
    icon: PanelsTopLeft,
  },
  {
    title: 'Perpindahan lebih ringan',
    description: 'Saat berpindah modul, ritme visual dan struktur kerjanya tetap terasa familiar.',
    icon: Orbit,
  },
];

export default function LandingPage() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const router = useRouter();
  const productModules = useMemo(
    () => APP_MODULES.filter((module) => ['ketik', 'pdkt', 'telefun', 'profiler', 'qa-analyzer'].includes(module.id)),
    []
  );

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
      setIsCheckingAuth(false);
    });
  }, []);

  const handleOpenAuth = useCallback((mode: 'login' | 'register' | 'forgot') => {
    setAuthMode(mode);
    setShowAuthModal(true);
  }, []);

  const handleCloseAuth = useCallback(() => {
    setShowAuthModal(false);
    const url = new URL(window.location.href);
    url.searchParams.delete('auth');
    router.replace(url.pathname, { scroll: false });
  }, [router]);

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-[-10%] top-[-8%] h-[34rem] w-[34rem] rounded-full bg-primary/12 blur-[140px]" />
        <div className="absolute right-[-8%] top-[20%] h-[30rem] w-[30rem] rounded-full bg-module-sidak/10 blur-[140px]" />
        <div className="absolute bottom-[-12%] left-[22%] h-[24rem] w-[24rem] rounded-full bg-module-ketik/10 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)',
            backgroundSize: '36px 36px',
          }}
        />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-6 lg:px-8">
        <header className="mb-12 flex items-center justify-between">
          <div className="inline-flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
              <Cpu className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight">Trainers SuperApp</span>
              <span className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Kontak OJK 157</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!isCheckingAuth && !isLoggedIn && (
              <button
                onClick={() => handleOpenAuth('login')}
                className="hidden rounded-full border border-border/60 bg-card/70 px-4 py-2 text-sm font-medium text-foreground/80 transition hover:border-primary/20 hover:text-foreground md:inline-flex"
              >
                Masuk
              </button>
            )}
            <ThemeToggle />
          </div>
        </header>

        <section className="grid flex-1 items-start gap-14 lg:grid-cols-[1.08fr_0.92fr] lg:gap-10">
          <div className="space-y-10 pt-4 lg:pt-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/8 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.24em] text-primary">
              <Shield className="h-3.5 w-3.5" />
              Workspace untuk operasional trainers
            </div>

            <div className="space-y-6">
              <h1 className="max-w-4xl text-5xl font-semibold tracking-tight text-balance md:text-7xl">
                Halaman masuk yang tenang, dashboard yang siap dipakai kerja.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground md:text-xl">
                Trainers SuperApp merangkum modul penting dalam satu alur yang terasa utuh. Begitu masuk, tim bisa lanjut ke
                simulasi, profiler, QA analyzer, dan dashboard tanpa perlu menyesuaikan diri ulang di setiap halaman.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {proofPoints.map((point, index) => (
                <motion.div
                  key={point.title}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: 0.08 * index }}
                  className="rounded-[1.75rem] border border-border/60 bg-card/70 p-5 shadow-lg shadow-black/5 backdrop-blur-xl"
                >
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">
                    <point.icon className="h-[18px] w-[18px]" />
                  </div>
                  <h2 className="text-base font-semibold tracking-tight">{point.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{point.description}</p>
                </motion.div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              {isCheckingAuth ? (
                <div className="inline-flex min-w-44 items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground opacity-70">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Menyiapkan akses
                </div>
              ) : isLoggedIn ? (
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/25"
                >
                  Buka Dashboard
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <>
                  <button
                    onClick={() => handleOpenAuth('login')}
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/25"
                  >
                    Masuk ke Platform
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleOpenAuth('register')}
                    className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/70 px-6 py-3 text-sm font-semibold text-foreground transition hover:border-primary/20 hover:bg-card"
                  >
                    Daftar Akses
                  </button>
                </>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {featureRows.map((feature) => (
                <div key={feature} className="rounded-3xl border border-border/50 bg-card/60 p-4 text-sm leading-6 text-muted-foreground backdrop-blur-md">
                  <CheckCircle2 className="mb-3 h-4 w-4 text-primary" />
                  {feature}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6 lg:pt-6">
            <div className="overflow-hidden rounded-[2rem] border border-border/50 bg-card/70 p-6 shadow-2xl shadow-black/5 backdrop-blur-2xl">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Workspace Map</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight">Modul yang tersusun seperti satu produk</h2>
                </div>
                <div className="rounded-full border border-primary/15 bg-primary/8 p-2 text-primary">
                  <Sparkles className="h-4 w-4" />
                </div>
              </div>

              <div className="mb-6 rounded-[1.5rem] border border-border/50 bg-background/75 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Ringkas</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Setiap modul tetap punya fungsi yang berbeda, tapi tampilan dan arahnya dibuat selaras supaya tim tidak terasa
                      sedang berpindah ke produk lain.
                    </p>
                  </div>
                  <div className="hidden rounded-2xl border border-primary/10 bg-primary/8 px-4 py-3 text-right sm:block">
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Aktif digunakan</p>
                    <p className="mt-1 text-2xl font-semibold tracking-tight">{productModules.length} modul</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {productModules.map((module, index) => (
                  <motion.div
                    key={module.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: 0.08 * index }}
                    className="group rounded-[1.75rem] border border-border/50 bg-background/70 p-5 transition hover:-translate-y-1 hover:border-primary/15 hover:shadow-lg hover:shadow-black/5"
                  >
                    <div className="mb-5 flex items-start justify-between gap-4">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${module.accentSoftClassName} ${module.accentClassName}`}>
                        <module.icon className="h-5 w-5" />
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold tracking-tight">{module.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{module.description}</p>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-border/50 bg-card/60 p-6 backdrop-blur-md">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Kenapa dibuat seperti ini</p>
              <div className="mt-3 space-y-3 text-sm leading-7 text-muted-foreground">
                <p>Landing page ini dirancang untuk langsung menjelaskan fungsi platform, bukan sekadar menjadi halaman pembuka.</p>
                <p>Setelah login, pengguna dibawa ke suasana kerja yang sama: bersih, fokus, dan cukup jelas untuk dipakai setiap hari.</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <Suspense fallback={null}>
        <AuthTrigger onOpen={handleOpenAuth} />
      </Suspense>

      <AnimatePresence>
        {showAuthModal && (
          <AuthModal isOpen={showAuthModal} onClose={handleCloseAuth} initialMode={authMode} />
        )}
      </AnimatePresence>
    </main>
  );
}
