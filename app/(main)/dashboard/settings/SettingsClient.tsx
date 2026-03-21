'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from "motion/react";
import { 
  User, Shield, Bell, Palette, Globe, Lock, 
  ChevronRight, Settings, Mail, BadgeCheck, 
  Save, KeyRound, Eye, EyeOff, CheckCircle2,
  AlertCircle, Loader2, LogOut, LayoutDashboard,
  MessageSquare, Phone, Users, BarChart3, ChevronLeft
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from '@/app/lib/supabase/client';
import { ThemeToggle } from "@/app/components/ThemeToggle";

interface SettingsClientProps {
  user: any;
  profile: any;
}

type Category = 'profile' | 'security' | 'appearance' | 'about';

export default function SettingsClient({ user, profile: initialProfile }: SettingsClientProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  
  const [activeCategory, setActiveCategory] = useState<Category>('profile');
  const [profile, setProfile] = useState(initialProfile);
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Security State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);

  const categories = [
    { id: 'profile', icon: User, label: 'Informasi Pribadi', description: 'Nama & Detail Kontak' },
    { id: 'security', icon: Shield, label: 'Keamanan', description: 'Kata Sandi & Akses' },
    { id: 'appearance', icon: Palette, label: 'Tampilan', description: 'Tema & Estetika' },
    { id: 'about', icon: AlertCircle, label: 'Tentang', description: 'Informasi Sistem' },
  ];

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', user.id);

      if (error) throw error;
      
      setMessage({ type: 'success', text: 'Profil berhasil diperbarui.' });
      setProfile({ ...profile, full_name: fullName });
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Gagal memperbarui profil.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Konfirmasi password tidak cocok.' });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      
      setMessage({ type: 'success', text: 'Kata sandi berhasil diperbarui.' });
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Gagal memperbarui kata sandi.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground transition-colors duration-500">
      {/* Sidebar Navigation */}
      <aside className="w-72 border-r border-border flex flex-col bg-card/50 backdrop-blur-xl relative z-20">
        <div className="p-8">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
              <Phone className="text-primary-foreground w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold tracking-widest uppercase text-sm text-balance">Trainers SuperApp</span>
              <span className="font-mono text-[10px] tracking-widest uppercase opacity-50">Kontak OJK 157</span>
            </div>
          </div>

          <nav className="space-y-1">
             <div className="font-mono text-[10px] uppercase tracking-widest text-foreground/30 mb-4 ml-2">Navigasi Utama</div>
             {[
               { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
               { href: '/ketik', icon: MessageSquare, label: 'Ketik' },
               { href: '/pdkt', icon: Mail, label: 'PDKT' },
               { href: '/telefun', icon: Phone, label: 'Telefun' },
               { href: '/profiler', icon: Users, label: 'Profiler' },
               { href: '/qa-analyzer', icon: BarChart3, label: 'QA Analyzer' },
             ].map((item) => (
               <Link key={item.href} href={item.href} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${pathname === item.href ? 'bg-primary text-primary-foreground' : 'text-foreground/60 hover:bg-foreground/5'}`}>
                 <item.icon className="w-4 h-4" /> {item.label}
               </Link>
             ))}
             
             <div className="font-mono text-[10px] uppercase tracking-widest text-foreground/30 mb-4 mt-8 ml-2">Manajemen</div>
             <Link href="/dashboard/settings" className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all bg-primary/10 text-primary border border-primary/20">
               <Settings className="w-4 h-4" /> Pengaturan
             </Link>
          </nav>
        </div>

        <div className="mt-auto p-8 border-t border-border">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 text-red-500/80 hover:text-red-500 rounded-xl text-sm font-medium transition-colors">
            <LogOut className="w-4 h-4" /> Keluar
          </button>
        </div>
      </aside>

      {/* Settings Container */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <div className="absolute top-0 right-0 p-6 z-50">
          <ThemeToggle />
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Categories Sidebar (Split Layout) */}
          <div className="w-1/3 max-w-sm border-r border-border/40 p-12 overflow-y-auto">
            <header className="mb-12">
              <h1 className="text-3xl font-black tracking-tight mb-2">Pengaturan</h1>
              <p className="text-foreground/40 text-sm font-medium leading-relaxed">Kelola preferensi dan data akun Anda di sini.</p>
            </header>

            <div className="space-y-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id as Category)}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all text-left group ${
                    activeCategory === cat.id 
                      ? 'bg-card border border-border shadow-md ring-1 ring-primary/20' 
                      : 'hover:bg-foreground/5 border border-transparent'
                  }`}
                >
                  <div className={`p-2.5 rounded-xl transition-all ${
                    activeCategory === cat.id ? 'bg-primary text-primary-foreground shadow-lg' : 'bg-foreground/5 text-foreground/40 group-hover:text-foreground group-hover:bg-foreground/10'
                  }`}>
                    <cat.icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-bold ${activeCategory === cat.id ? 'text-foreground' : 'text-foreground/60'}`}>{cat.label}</div>
                    <div className="text-[10px] text-foreground/30 font-medium truncate uppercase tracking-widest mt-0.5">{cat.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Active Category Content */}
          <div className="flex-1 p-12 overflow-y-auto bg-card/20 backdrop-blur-3xl relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeCategory}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="max-w-2xl mx-auto"
              >
                {/* Status Message */}
                {message && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`mb-8 p-4 rounded-2xl border flex items-center gap-3 ${
                      message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-red-500/10 border-red-500/20 text-red-500'
                    }`}
                  >
                    {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
                    <span className="text-sm font-bold tracking-tight">{message.text}</span>
                    <button onClick={() => setMessage(null)} className="ml-auto opacity-40 hover:opacity-100 transition-opacity"><X className="w-4 h-4" /></button>
                  </motion.div>
                )}

                {activeCategory === 'profile' && (
                  <form onSubmit={handleUpdateProfile} className="space-y-12">
                    <section>
                      <h2 className="text-xl font-black tracking-tight mb-8">Informasi Pribadi</h2>
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 gap-6">
                          <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-widest text-foreground/40 ml-1">E-mail Akses (Read-only)</label>
                            <div className="relative group">
                              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/20" />
                              <input 
                                type="text" 
                                value={user?.email} 
                                readOnly
                                className="w-full pl-12 pr-4 py-4 bg-foreground/5 border border-border rounded-2xl text-foreground/40 cursor-not-allowed font-medium text-sm transition-all"
                              />
                              <BadgeCheck className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-500/40" />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-widest text-foreground/40 ml-1">Nama Lengkap</label>
                            <div className="relative group">
                              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40 group-focus-within:text-primary transition-colors" />
                              <input 
                                type="text" 
                                value={fullName} 
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="Masukkan nama lengkap Anda..."
                                className="w-full pl-12 pr-4 py-4 bg-card border border-border rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none font-bold text-sm"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </section>

                    <section className="pt-8 border-t border-border/40">
                      <div className="flex items-center justify-between">
                         <div className="space-y-1">
                           <h3 className="text-sm font-bold">Role Akun</h3>
                           <p className="text-[11px] text-foreground/30 font-medium tracking-tight uppercase tracking-[0.1em]">Hanya bisa diubah oleh Trainer melalui panel admin.</p>
                         </div>
                         <div className="px-5 py-2.5 bg-primary/10 border border-primary/20 rounded-xl text-primary text-xs font-black uppercase tracking-widest">
                            {initialProfile?.role || 'Agent'}
                         </div>
                      </div>
                    </section>

                    <button 
                      type="submit"
                      disabled={isSaving || fullName === profile?.full_name}
                      className="w-full py-5 bg-primary text-primary-foreground rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:grayscale disabled:scale-100 flex items-center justify-center gap-3"
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Simpan Perubahan
                    </button>
                  </form>
                )}

                {activeCategory === 'security' && (
                  <form onSubmit={handleUpdatePassword} className="space-y-12">
                    <section>
                      <h2 className="text-xl font-black tracking-tight mb-8">Informasi Keamanan</h2>
                      <div className="space-y-6">
                        <div className="space-y-2">
                          <label className="text-xs font-black uppercase tracking-widest text-foreground/40 ml-1">Password Baru</label>
                          <div className="relative group">
                            <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40 group-focus-within:text-primary transition-colors" />
                            <input 
                              type={showPasswords ? "text" : "password"}
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              placeholder="••••••••"
                              className="w-full pl-12 pr-12 py-4 bg-card border border-border rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none font-bold"
                            />
                            <button 
                              type="button"
                              onClick={() => setShowPasswords(!showPasswords)}
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-foreground/20 hover:text-foreground transition-colors"
                            >
                              {showPasswords ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-black uppercase tracking-widest text-foreground/40 ml-1">Konfirmasi Password</label>
                          <div className="relative group">
                            <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40 group-focus-within:text-primary transition-colors" />
                            <input 
                              type={showPasswords ? "text" : "password"}
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              placeholder="••••••••"
                              className="w-full pl-12 pr-4 py-4 bg-card border border-border rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none font-bold"
                            />
                          </div>
                        </div>
                      </div>
                    </section>

                    <div className="p-6 bg-amber-500/5 border border-amber-500/10 rounded-3xl flex gap-4">
                        <Shield className="w-6 h-6 text-amber-500 flex-shrink-0" />
                        <p className="text-[11px] font-medium text-amber-500/80 leading-relaxed uppercase tracking-widest">
                          Gunakan minimal 8 karakter dengan kombinasi huruf besar, kecil, angka, dan simbol untuk keamanan maksimal.
                        </p>
                    </div>

                    <button 
                      type="submit"
                      disabled={isSaving || !newPassword || newPassword !== confirmPassword}
                      className="w-full py-5 bg-foreground text-background rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-foreground/10 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                      Update Kata Sandi
                    </button>
                  </form>
                )}

                {activeCategory === 'appearance' && (
                  <div className="space-y-12">
                    <section>
                      <h2 className="text-xl font-black tracking-tight mb-8">Pilih Tema</h2>
                      <div className="grid grid-cols-2 gap-6">
                        <div className="p-6 bg-card border-2 border-primary rounded-[2.5rem] shadow-xl relative overflow-hidden">
                           <div className="flex items-center justify-between mb-8">
                              <span className="text-[10px] font-black uppercase tracking-widest">Sistem Saat Ini</span>
                              <CheckCircle2 className="w-5 h-5 text-primary" />
                           </div>
                           <div className="w-full aspect-video bg-background border border-border rounded-2xl mb-4" />
                           <p className="text-sm font-bold text-center">Gunakan Theme Toggle di atas untuk mengganti mode.</p>
                        </div>
                      </div>
                    </section>
                  </div>
                )}

                {activeCategory === 'about' && (
                  <div className="space-y-12 text-center py-12">
                     <div className="w-24 h-24 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-primary/20 shadow-inner">
                        <Settings className="w-12 h-12 text-primary" />
                     </div>
                     <h2 className="text-3xl font-black tracking-tighter">Trainers SuperApp</h2>
                     <div className="flex flex-col items-center gap-2">
                        <span className="px-4 py-2 bg-muted rounded-full text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Versi 2.0.0 (Beta Edition)</span>
                        <span className="text-[10px] font-medium text-foreground/20 uppercase tracking-widest leading-loose">
                          Build ID: {new Date().getTime().toString(16)} <br/>
                          Engine: Next.js + Supabase + Framer Motion
                        </span>
                     </div>
                     <p className="max-w-md mx-auto text-xs font-medium text-foreground/40 leading-relaxed mt-12 bg-foreground/5 p-6 rounded-3xl border border-border">
                        Platform simulasi pelatihan premium yang dirancang untuk meningkatkan performa Agent Kontak OJK 157 melalui teknologi modern.
                     </p>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}

function X(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
