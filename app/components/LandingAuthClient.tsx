'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { createClient } from '@/app/lib/supabase/client';
import { Loader2, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { ThemeToggle } from './ThemeToggle';

const AuthModal = dynamic(() => import('@/app/components/AuthModal'), { ssr: false });

type AuthContextType = {
  isLoggedIn: boolean;
  isCheckingAuth: boolean;
  openAuth: (mode: 'login' | 'register' | 'forgot') => void;
};

const AuthContext = createContext<AuthContextType>({
  isLoggedIn: false,
  isCheckingAuth: true,
  openAuth: () => {},
});

export function LandingAuthProvider({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const router = useRouter();

  const initialNotice = useMemo(() => {
    const msg = searchParams.get('message');
    if (msg === 'rejected') return { type: 'error' as const, text: 'Akun Anda belum disetujui untuk mengakses sistem.' };
    if (msg === 'deleted') return { type: 'error' as const, text: 'Akun Anda telah dinonaktifkan.' };
    if (msg === 'profile-unavailable') return { type: 'error' as const, text: 'Data profil akun tidak ditemukan atau gagal diverifikasi. Silakan hubungi admin.' };
    return undefined;
  }, [searchParams]);

  useEffect(() => {
    const authParam = searchParams.get('auth');
    if (authParam === 'login' || authParam === 'register' || authParam === 'forgot') {
      setAuthMode(authParam);
      setShowAuthModal(true);
    }
  }, [searchParams]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user);
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
    url.searchParams.delete('message');
    router.replace(url.pathname, { scroll: false });
  }, [router]);

  return (
    <AuthContext.Provider value={{ isLoggedIn, isCheckingAuth, openAuth: handleOpenAuth }}>
      {children}
      {showAuthModal && (
        <AuthModal 
          isOpen={showAuthModal} 
          onClose={handleCloseAuth} 
          initialMode={authMode} 
          initialNotice={initialNotice}
        />
      )}
    </AuthContext.Provider>
  );
}

export function NavbarAuthActions() {
  const { isCheckingAuth, isLoggedIn, openAuth } = useContext(AuthContext);
  return (
    <div className="flex items-center gap-4">
      {!isCheckingAuth && !isLoggedIn && (
        <button
          onClick={() => openAuth('login')}
          className="px-4 py-2 rounded-full text-sm font-semibold text-muted-foreground transition hover:text-foreground hover:bg-muted/50"
        >
          Masuk
        </button>
      )}
      {isLoggedIn && (
        <Link
          href="/dashboard"
          className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          Dashboard
        </Link>
      )}
      <ThemeToggle />
    </div>
  );
}

export function HeroAuthActions() {
  const { isCheckingAuth, isLoggedIn, openAuth } = useContext(AuthContext);
  if (isCheckingAuth) {
    return (
      <div className="inline-flex h-12 min-w-44 items-center justify-center gap-2 rounded-full bg-primary px-8 text-sm font-semibold text-primary-foreground opacity-70">
        <Loader2 className="h-4 w-4 animate-spin" />
        Menyiapkan akses
      </div>
    );
  }
  if (isLoggedIn) {
    return (
      <Link
        href="/dashboard"
        className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-8 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:-translate-y-0.5"
      >
        Buka Dashboard
        <ArrowRight className="h-4 w-4" />
      </Link>
    );
  }
  return (
    <>
      <button
        onClick={() => openAuth('login')}
        className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-10 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
      >
        Masuk ke Platform
        <ArrowRight className="h-4 w-4" />
      </button>
      <button
        onClick={() => openAuth('register')}
        className="inline-flex h-12 items-center gap-2 rounded-full border border-border bg-card/50 px-8 text-sm font-semibold transition hover:bg-muted/50"
      >
        Ajukan Akses
      </button>
    </>
  );
}

export function FooterAuthActions() {
  const { isCheckingAuth, isLoggedIn, openAuth } = useContext(AuthContext);
  if (isCheckingAuth) return null;
  if (isLoggedIn) return null;
  
  return (
    <>
      <button
        onClick={() => openAuth('login')}
        className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-10 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:scale-[1.05]"
      >
        Mulai Sekarang
        <ArrowRight className="h-4 w-4" />
      </button>
      <button
        onClick={() => openAuth('register')}
        className="text-sm font-semibold hover:underline"
      >
        Belum punya akses? Minta akses
      </button>
    </>
  );
}
