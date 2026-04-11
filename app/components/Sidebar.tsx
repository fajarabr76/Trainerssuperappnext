'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, MessageSquare, Mail, Phone, Users, BarChart3, 
  Settings, LogOut, ChevronRight, CalendarDays, ClipboardList,
  ChevronDown, Activity, FileText
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/app/lib/supabase/client';
import { useTheme } from 'next-themes';
import { Sun, Moon, AlertCircle, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useTelefunWarning } from '@/app/context/TelefunWarningContext';
import { useAccessDenied } from '@/app/context/AccessDeniedContext';

interface SidebarProps {
  user?: any;
  role?: string;
  isMobileMenuOpen?: boolean;
  setIsMobileMenuOpen?: (isOpen: boolean) => void;
}

export default function Sidebar({ user, role, isMobileMenuOpen, setIsMobileMenuOpen }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { theme, setTheme } = useTheme();
  const { openMaintenance } = useTelefunWarning();
  const { openAccessDenied } = useAccessDenied();
  
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [isQaExpanded, setIsQaExpanded] = useState(pathname?.startsWith('/qa-analyzer') || false);
  const [mounted, setMounted] = useState(false);

  const effectiveIsCollapsed = isSidebarCollapsed && !isSidebarHovered;

  useEffect(() => {
    setMounted(true);
    // Auto-expand QA if we navigate to a QA route
    if (pathname?.startsWith('/qa-analyzer')) {
      setIsQaExpanded(true);
    }
  }, [pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/?auth=login');
    router.refresh();
  };

  const navItemClass = (active: boolean) => 
    `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background ${
      active 
        ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' 
        : 'text-foreground/60 hover:bg-foreground/5 hover:text-foreground'
    } ${effectiveIsCollapsed ? 'justify-center px-0' : ''}`;

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileMenuOpen && setIsMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden" 
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <aside 
        onMouseEnter={() => isSidebarCollapsed && setIsSidebarHovered(true)}
        onMouseLeave={() => setIsSidebarHovered(false)}
        className={`${effectiveIsCollapsed ? 'w-20' : 'w-72'} border-r border-border/40 flex flex-col bg-card/40 backdrop-blur-2xl relative z-50 lg:z-20 transition-all duration-500 ease-in-out group shrink-0 ${isMobileMenuOpen ? 'translate-x-0 fixed inset-y-0 left-0 flex' : '-translate-x-full fixed lg:static lg:translate-x-0 inset-y-0 left-0 hidden lg:flex'}`}
      >
        <div className="p-6 flex-1 flex flex-col overflow-hidden">
          <div className={`flex items-center ${effectiveIsCollapsed ? 'justify-center' : 'justify-between'} mb-8 overflow-hidden`}>
            <div className="flex items-center gap-3">
              <div className="min-w-[40px] w-10 h-10 bg-primary/10 text-primary border border-primary/20 rounded-xl flex items-center justify-center shrink-0">
                <LayoutDashboard className="text-primary w-5 h-5" />
              </div>
              {!effectiveIsCollapsed && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex flex-col whitespace-nowrap"
                >
                  <span className="font-bold tracking-widest uppercase text-sm">Trainers SuperApp</span>
                  <span className="font-mono text-[10px] tracking-widest uppercase opacity-50">Kontak OJK 157</span>
                </motion.div>
              )}
            </div>
            
            {!effectiveIsCollapsed && (
              <button 
                onClick={() => setIsSidebarCollapsed(true)}
                className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg text-foreground/40 hover:text-foreground hover:bg-foreground/5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title="Sembunyikan Menu"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            )}
            {effectiveIsCollapsed && (
               <button 
                onClick={() => setIsSidebarCollapsed(false)}
                className="hidden lg:flex absolute right-0 top-[28px] translate-x-1/2 items-center justify-center w-6 h-6 rounded-full bg-card border border-border text-foreground/60 hover:text-primary hover:border-primary transition-all focus-visible:outline-none shadow-sm z-50"
                title="Tampilkan Menu"
               >
                 <PanelLeftOpen className="w-3 h-3" />
               </button>
            )}
          </div>

          <nav className="space-y-2 flex-1 overflow-y-auto pr-2 -mr-2 pb-4">
            {!effectiveIsCollapsed && <div className="font-mono text-[10px] uppercase tracking-widest text-foreground/40 mb-4 ml-2 mt-2">Menu Utama</div>}
            
            <Link href="/dashboard" className={navItemClass(pathname === '/dashboard')}>
              <LayoutDashboard className="w-4 h-4 shrink-0" /> 
              {!effectiveIsCollapsed && <span>Dashboard</span>}
            </Link>
            <Link href="/ketik" className={navItemClass(pathname === '/ketik')}>
              <MessageSquare className="w-4 h-4 shrink-0" /> 
              {!effectiveIsCollapsed && <span>Ketik</span>}
            </Link>
            <Link href="/pdkt" className={navItemClass(pathname === '/pdkt')}>
              <Mail className="w-4 h-4 shrink-0" /> 
              {!effectiveIsCollapsed && <span>PDKT</span>}
            </Link>
            <button 
              onClick={(e) => {
                e.preventDefault();
                openMaintenance();
              }}
              className={navItemClass(pathname === '/telefun')}
            >
              <Phone className="w-4 h-4 shrink-0" /> 
              {!effectiveIsCollapsed && <span>Telefun</span>}
            </button>
            <Link 
              href="/profiler" 
              className={navItemClass(pathname === '/profiler')}
              onClick={(e) => {
                if (role?.toLowerCase() === 'agent' || role?.toLowerCase() === 'agents') {
                  e.preventDefault();
                  openAccessDenied();
                }
              }}
            >
              <Users className="w-4 h-4 shrink-0" /> 
              {!effectiveIsCollapsed && <span>KTP</span>}
            </Link>

            {/* SIDAK Accordion */}
            <div>
              <button 
                onClick={() => {
                  if (role?.toLowerCase() === 'agent' || role?.toLowerCase() === 'agents') {
                    openAccessDenied();
                    return;
                  }
                  if (effectiveIsCollapsed) setIsSidebarCollapsed(false);
                  setIsQaExpanded(!isQaExpanded);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background ${
                  pathname?.startsWith('/qa-analyzer') && !isQaExpanded 
                    ? 'bg-primary/5 text-primary' 
                    : 'text-foreground/60 hover:bg-foreground/5 hover:text-foreground'
                } ${effectiveIsCollapsed ? 'justify-center px-0' : ''}`}
              >
                <BarChart3 className="w-4 h-4 shrink-0" /> 
                {!effectiveIsCollapsed && (
                  <>
                    <span className="flex-1 text-left">SIDAK</span>
                    <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isQaExpanded ? 'rotate-180' : ''}`} />
                  </>
                )}
              </button>
              <AnimatePresence>
                {isQaExpanded && !effectiveIsCollapsed && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                      <div className="pl-11 pr-2 py-2 space-y-1">
                        <Link href="/qa-analyzer/dashboard" className={`block px-3 py-2 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all duration-200 ${pathname === '/qa-analyzer/dashboard' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground/60 hover:bg-foreground/5 hover:text-foreground'}`}>Dashboard SIDAK</Link>
                        <Link href="/qa-analyzer/agents" className={`block px-3 py-2 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all duration-200 ${pathname === '/qa-analyzer/agents' || pathname?.startsWith('/qa-analyzer/agents/') ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground/60 hover:bg-foreground/5 hover:text-foreground'}`}>Analisis Individu</Link>
                        <Link href="/qa-analyzer/ranking" className={`block px-3 py-2 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all duration-200 ${pathname === '/qa-analyzer/ranking' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground/60 hover:bg-foreground/5 hover:text-foreground'}`}>Ranking Agen</Link>
                        {(role?.toLowerCase() === 'trainer' ||
                          role?.toLowerCase() === 'trainers' ||
                          role?.toLowerCase() === 'admin' ||
                          role?.toLowerCase() === 'superadmin') && (
                          <Link
                            href="/qa-analyzer/reports"
                            className={`flex items-center gap-2 px-3 py-2 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all duration-200 ${
                              pathname === '/qa-analyzer/reports' || pathname?.startsWith('/qa-analyzer/reports/')
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'text-foreground/60 hover:bg-foreground/5 hover:text-foreground'
                            }`}
                          >
                            <FileText className="h-3.5 w-3.5 opacity-70" />
                            Report Maker
                          </Link>
                        )}
                        {role?.toLowerCase() !== 'leader' && (
                          <Link href="/qa-analyzer/input" className={`block px-3 py-2 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all duration-200 ${pathname?.startsWith('/qa-analyzer/input') ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground/60 hover:bg-foreground/5 hover:text-foreground'}`}>Input Temuan</Link>
                        )}
                        {(role?.toLowerCase() === 'trainer' || role?.toLowerCase() === 'trainers') && (
                          <>
                            <Link href="/qa-analyzer/periods" className={`block px-3 py-2 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all duration-200 ${pathname === '/qa-analyzer/periods' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground/60 hover:bg-foreground/5 hover:text-foreground'}`}>Periode QA</Link>
                            <Link href="/qa-analyzer/settings" className={`block px-3 py-2 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all duration-200 ${pathname === '/qa-analyzer/settings' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground/60 hover:bg-foreground/5 hover:text-foreground'}`}>Parameter QA</Link>
                          </>
                        )}
                      </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {(role?.toLowerCase() === 'trainer' || role?.toLowerCase() === 'trainers' || role?.toLowerCase() === 'leader') && (
              <>
                {!effectiveIsCollapsed && <div className="font-mono text-[10px] uppercase tracking-widest text-foreground/40 mb-4 mt-8 ml-2">Manajemen</div>}
                <Link href="/dashboard/monitoring" className={navItemClass(pathname === '/dashboard/monitoring')}>
                  <Activity className="w-4 h-4 shrink-0" /> 
                  {!effectiveIsCollapsed && <span>Monitoring</span>}
                </Link>
              </>
            )}

            {(role?.toLowerCase() === 'trainer' || role?.toLowerCase() === 'trainers') && (
               <Link href="/dashboard/users" className={navItemClass(pathname === '/dashboard/users')}>
                 <Users className="w-4 h-4 shrink-0" /> 
                 {!effectiveIsCollapsed && <span>Kelola Pengguna</span>}
               </Link>
            )}
          </nav>

          <div className="mt-auto pt-6 border-t border-border/40">
            {!effectiveIsCollapsed && <div className="font-mono text-[10px] uppercase tracking-widest text-foreground/40 mb-4 ml-2">Sistem</div>}
            <div className="space-y-2">
              {!effectiveIsCollapsed && (
                <div className="px-4 py-3 text-sm font-medium text-foreground/60 mb-2 overflow-hidden flex flex-col items-start gap-1">
                  <span className="text-[10px] flex items-center gap-1.5 opacity-50 px-2 py-0.5 rounded-full bg-foreground/10 uppercase tracking-widest font-bold">
                    Role: {role || "User"}
                  </span>
                  <span className="text-xs text-foreground font-semibold truncate block max-w-full" title={user?.email}>{user?.email}</span>
                </div>
              )}
              <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-foreground/5 rounded-xl text-sm font-medium transition-colors text-foreground/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background ${effectiveIsCollapsed ? 'justify-center px-0' : ''}`}>
                {mounted ? (
                  <>
                    {theme === 'dark' ? <Sun className="w-4 h-4 shrink-0" /> : <Moon className="w-4 h-4 shrink-0" />}
                    {!effectiveIsCollapsed && <span>Tema {theme === 'dark' ? 'Terang' : 'Gelap'}</span>}
                  </>
                ) : (
                  <>
                    <div className="w-4 h-4 shrink-0 bg-foreground/10 animate-pulse rounded-full" />
                    {!effectiveIsCollapsed && <div className="w-24 h-4 bg-foreground/10 animate-pulse rounded" />}
                  </>
                )}
              </button>
              <Link 
                href="/dashboard/settings"
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-foreground/5 rounded-xl text-sm font-medium transition-colors text-foreground/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background ${effectiveIsCollapsed ? 'justify-center px-0' : ''}`}
              >
                <Settings className="w-4 h-4 shrink-0" /> 
                {!effectiveIsCollapsed && <span>Pengaturan</span>}
              </Link>
              <button onClick={handleLogout} className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 text-red-500/80 hover:text-red-500 rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background ${effectiveIsCollapsed ? 'justify-center px-0' : ''}`}>
                <LogOut className="w-4 h-4 shrink-0" /> 
                {!effectiveIsCollapsed && <span>Keluar</span>}
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
