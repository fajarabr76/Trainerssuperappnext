'use client';

import { useState, useEffect, Suspense } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, Shield, Zap, Cpu, MessageSquare, Mail, Phone, ExternalLink, X, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ThemeToggle } from "./components/ThemeToggle";
import AuthModal from "@/app/components/AuthModal";
import { createClient } from "@/app/lib/supabase/client";

function AuthTrigger({ onOpen }: { onOpen: (mode: 'login'|'register') => void }) {
  const searchParams = useSearchParams();
  useEffect(() => {
    const authParam = searchParams.get('auth');
    if (authParam === 'login' || authParam === 'register') {
      onOpen(authParam);
    }
  }, [searchParams, onOpen]);
  return null;
}

export default function LandingPage() {
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
      setIsCheckingAuth(false);
    });
  }, []);

  const handleOpenAuth = (mode: 'login' | 'register') => {
    setAuthMode(mode);
    setShowAuthModal(true);
  };

  return (
    <main className="min-h-screen bg-background relative overflow-hidden">
      {/* Background Atmosphere */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-violet-500/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-[0.03] dark:opacity-[0.05]" 
             style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)', backgroundSize: '40px 40px' }} />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-32 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="space-y-8"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-[0.2em] border border-primary/20">
              <Shield size={12} className="animate-pulse" />
              Kontak OJK 157 Official
            </div>
            
            <div className="space-y-2">
              <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-[0.85] text-foreground">
                TRAINERS<br />
                <span className="text-primary italic">SUPERAPP</span>
              </h1>
            </div>

            <p className="text-xl text-muted-foreground max-w-lg leading-relaxed font-light">
              Elevate your training ecosystem. A unified platform designed to orchestrate agent excellence and service quality at scale.
            </p>

            <div className="flex flex-wrap gap-4 pt-4">
              {isCheckingAuth ? (
                <div className="px-8 py-4 bg-primary/50 text-primary-foreground rounded-2xl font-bold flex items-center justify-center opacity-50 cursor-not-allowed min-w-[200px]">
                  <Loader2 className="animate-spin w-5 h-5" />
                </div>
              ) : isLoggedIn ? (
                <Link 
                  href="/dashboard" 
                  className="group relative px-8 py-4 bg-primary text-primary-foreground rounded-2xl font-bold overflow-hidden transition-all hover:shadow-2xl hover:shadow-primary/30 active:scale-95 flex items-center gap-2"
                >
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                  <span className="relative flex items-center gap-2">
                    Buka Dashboard <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </span>
                </Link>
              ) : (
                <button 
                  onClick={() => handleOpenAuth('login')}
                  className="group relative px-8 py-4 bg-primary text-primary-foreground rounded-2xl font-bold overflow-hidden transition-all hover:shadow-2xl hover:shadow-primary/30 active:scale-95 flex items-center gap-2"
                >
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                  <span className="relative flex items-center gap-2">
                    Masuk / Daftar <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </span>
                </button>
              )}
              
              <button 
                onClick={() => setShowAboutModal(true)}
                className="px-8 py-4 bg-accent/50 text-foreground rounded-2xl font-bold border border-border hover:bg-accent transition-all active:scale-95"
              >
                Explore Modules
              </button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="relative"
          >
            <div className="grid grid-cols-2 gap-6">
              {[
                { title: 'KETIK', icon: <MessageSquare size={32} />, color: 'text-blue-500', bg: 'bg-blue-500/10', desc: 'Chat Simulation' },
                { title: 'PDKT', icon: <Mail size={32} />, color: 'text-purple-500', bg: 'bg-purple-500/10', desc: 'Email Correspondence' },
                { title: 'TELEFUN', icon: <Phone size={32} />, color: 'text-emerald-500', bg: 'bg-emerald-500/10', desc: 'Voice & Audio' },
                { title: 'PROFILER', icon: <Shield size={32} />, color: 'text-orange-500', bg: 'bg-orange-500/10', desc: 'Agent Database' },
                { title: 'QA ANALYZER', icon: <Cpu size={32} />, color: 'text-rose-500', bg: 'bg-rose-500/10', desc: 'Performance Dashboard' },
              ].map((item, idx) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + (idx * 0.1) }}
                  className="group p-8 rounded-[2.5rem] border border-border bg-card/50 backdrop-blur-xl hover:border-primary/50 transition-all hover:shadow-2xl hover:-translate-y-2 relative overflow-hidden"
                >
                  <div className={`${item.bg} ${item.color} w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500`}>
                    {item.icon}
                  </div>
                  <h3 className="text-xl font-black tracking-tight mb-2 uppercase">{item.title}</h3>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest opacity-60">{item.desc}</p>
                  
                  <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-500 rotate-12">
                    {item.icon}
                  </div>
                </motion.div>
              ))}
            </div>
            
            {/* Decorative floating element */}
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/20 rounded-full blur-3xl animate-pulse" />
          </motion.div>
        </div>
      </div>

      <div className="absolute top-8 right-8 z-50">
        <ThemeToggle />
      </div>

      {/* Footer Micro-details */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-8 opacity-30">
        <div className="flex items-center gap-2">
          <div className="w-1 h-1 rounded-full bg-foreground" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em]">Precision</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1 h-1 rounded-full bg-foreground" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em]">Excellence</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1 h-1 rounded-full bg-foreground" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em]">Innovation</span>
        </div>
      </div>

      <Suspense fallback={null}>
        <AuthTrigger onOpen={handleOpenAuth} />
      </Suspense>

      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
        initialMode={authMode} 
      />

      {/* About Modal */}
      <AnimatePresence>
        {showAboutModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAboutModal(false)}
              className="absolute inset-0 bg-background/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-card border border-border rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 md:p-12 space-y-8">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h2 className="text-3xl font-black tracking-tight uppercase">Trainers SuperApp</h2>
                    <p className="text-primary text-[10px] font-black uppercase tracking-[0.2em]">The Ultimate Training Ecosystem</p>
                  </div>
                  <button 
                    onClick={() => setShowAboutModal(false)}
                    className="p-2 hover:bg-accent rounded-full transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="space-y-6">
                  <p className="text-muted-foreground leading-relaxed">
                    Trainers SuperApp adalah platform terpadu yang dirancang khusus untuk mengelola, melatih, dan memantau performa agent di lingkungan Kontak OJK 157. Aplikasi ini mengintegrasikan berbagai modul simulasi dan database untuk memastikan kualitas layanan yang unggul.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-accent/30 border border-border space-y-2">
                      <div className="flex items-center gap-2 text-blue-500">
                        <MessageSquare size={16} />
                        <span className="text-xs font-black uppercase tracking-widest">KETIK</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">Simulasi chat interaktif untuk melatih kemampuan komunikasi tertulis agent.</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-accent/30 border border-border space-y-2">
                      <div className="flex items-center gap-2 text-purple-500">
                        <Mail size={16} />
                        <span className="text-xs font-black uppercase tracking-widest">PDKT</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">Modul korespondensi email untuk standarisasi balasan layanan konsumen.</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-accent/30 border border-border space-y-2">
                      <div className="flex items-center gap-2 text-emerald-500">
                        <Phone size={16} />
                        <span className="text-xs font-black uppercase tracking-widest">TELEFUN</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">Pelatihan komunikasi suara dan audio untuk meningkatkan kualitas panggilan.</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-accent/30 border border-border space-y-2">
                      <div className="flex items-center gap-2 text-orange-500">
                        <Shield size={16} />
                        <span className="text-xs font-black uppercase tracking-widest">PROFILER</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">Database pusat data agent untuk manajemen profil dan rekam jejak pelatihan.</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-accent/30 border border-border space-y-2">
                      <div className="flex items-center gap-2 text-rose-500">
                        <Cpu size={16} />
                        <span className="text-xs font-black uppercase tracking-widest">QA ANALYZER</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">Dashboard performa QA dan root cause analysis untuk identifikasi masalah.</p>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => setShowAboutModal(false)}
                  className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-bold hover:opacity-90 transition-opacity"
                >
                  Mulai Eksplorasi
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
