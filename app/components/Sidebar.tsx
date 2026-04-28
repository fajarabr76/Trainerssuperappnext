import React, { useEffect, useState } from 'react';
import {
  Activity,
  BarChart3,
  ChevronDown,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  UserCog,
  Shield,
  History,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { useTelefunWarning } from '@/app/context/TelefunWarningContext';
import { useAccessDenied } from '@/app/context/AccessDeniedContext';
import { useSessionTimeout } from '@/app/context/SessionTimeoutContext';
import { APP_MODULES, isRoleAllowed, normalizeRoleLabel } from '@/app/lib/app-config';
import { User } from '@supabase/supabase-js';

interface SidebarProps {
  user?: User | null;
  role?: string;
  isMobileMenuOpen?: boolean;
  setIsMobileMenuOpen?: (isOpen: boolean) => void;
}

export default function Sidebar({ user, role, isMobileMenuOpen, setIsMobileMenuOpen }: SidebarProps) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { openMaintenance, hasTelefunAccess } = useTelefunWarning();
  const { openAccessDenied } = useAccessDenied();
  const { signOut } = useSessionTimeout();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [isQaExpanded, setIsQaExpanded] = useState(pathname?.startsWith('/qa-analyzer') || false);
  const [mounted, setMounted] = useState(false);

  const effectiveIsCollapsed = isSidebarCollapsed && !isSidebarHovered;
  const normalizedRole = role?.toLowerCase();
  const visibleModules = APP_MODULES.filter((module) =>
    ['dashboard', 'ketik', 'pdkt', 'telefun', 'profiler'].includes(module.id) && isRoleAllowed(role, module.allowedRoles)
  );
  const qaModule = APP_MODULES.find((module) => module.id === 'qa-analyzer');
  const managementLinks = [
    {
      href: '/dashboard/users',
      label: 'User Management',
      icon: Shield,
      allowed: ['trainer', 'trainers', 'admin'].includes(normalizedRole || ''),
    },
    {
      href: '/dashboard/monitoring',
      label: 'Monitoring',
      icon: Activity,
      allowed: ['trainer', 'trainers', 'leader', 'admin'].includes(normalizedRole || ''),
    },
    {
      href: '/dashboard/activities',
      label: 'Activity Logs',
      icon: History,
      allowed: ['trainer', 'trainers', 'admin'].includes(normalizedRole || ''),
    },
  ].filter((item) => item.allowed);

  useEffect(() => {
    setMounted(true);
    if (pathname?.startsWith('/qa-analyzer')) setIsQaExpanded(true);
    
    // Close mobile menu on route change
    if (isMobileMenuOpen && setIsMobileMenuOpen) {
      setIsMobileMenuOpen(false);
    }
  }, [pathname, isMobileMenuOpen, setIsMobileMenuOpen]);

  // Prevent background scroll when mobile sidebar is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isMobileMenuOpen]);

  const navItemClass = (active: boolean) =>
    `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-300 ${
      active ? 'bg-primary text-primary-foreground shadow-md shadow-primary/15' : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
    } ${effectiveIsCollapsed ? 'justify-center px-0' : ''}`;

  return (
    <>
      {/* Mobile Overlay (Higher Z-Index) */}
      {isMobileMenuOpen && setIsMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm lg:hidden" 
          onClick={() => setIsMobileMenuOpen(false)} 
        />
      )}

      <aside
        onMouseEnter={() => isSidebarCollapsed && setIsSidebarHovered(true)}
        onMouseLeave={() => setIsSidebarHovered(false)}
        className={`${effectiveIsCollapsed ? 'w-20' : 'w-76'} relative z-50 shrink-0 border-r border-border/40 bg-card/55 backdrop-blur-2xl transition-all duration-500 ease-in-out lg:z-20 ${isMobileMenuOpen ? 'fixed inset-y-0 left-0 flex translate-x-0 z-[70]' : 'fixed inset-y-0 left-0 hidden -translate-x-full lg:static lg:flex lg:translate-x-0'}`}
      >
        <div className="flex flex-1 flex-col overflow-hidden p-6">
          <div className={`mb-8 flex items-center overflow-hidden ${effectiveIsCollapsed ? 'justify-center' : 'justify-between'}`}>
            <Link href="/dashboard" className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                <BarChart3 className="h-5 w-5" />
              </div>
              {!effectiveIsCollapsed && (
                <div className="flex flex-col">
                  <span className="text-sm font-semibold tracking-tight">Trainers SuperApp</span>
                  <span className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Unified workspace</span>
                </div>
              )}
            </Link>

            {!effectiveIsCollapsed && (
              <button
                onClick={() => setIsSidebarCollapsed(true)}
                className="hidden h-8 w-8 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground lg:flex"
                title="Sembunyikan menu"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            )}

            {effectiveIsCollapsed && (
              <button
                onClick={() => setIsSidebarCollapsed(false)}
                className="absolute right-0 top-[28px] hidden h-6 w-6 translate-x-1/2 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition hover:border-primary hover:text-primary lg:flex"
                title="Tampilkan menu"
              >
                <PanelLeftOpen className="h-3 w-3" />
              </button>
            )}
          </div>

          <nav className="flex-1 space-y-2 overflow-y-auto pb-4 pr-2 -mr-2">
            {!effectiveIsCollapsed && <p className="mb-4 ml-2 text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Platform</p>}

            {visibleModules.map((module) => (
              <Link
                key={module.id}
                href={module.href}
                className={navItemClass(pathname === module.href)}
                onClick={(event) => {
                  if (module.id === 'telefun' && !hasTelefunAccess) {
                    event.preventDefault();
                    openMaintenance();
                  }
                  if (module.id === 'profiler' && (role?.toLowerCase() === 'agent' || role?.toLowerCase() === 'agents')) {
                    event.preventDefault();
                    openAccessDenied();
                  }
                }}
              >
                <module.icon className="h-4 w-4 shrink-0" />
                {!effectiveIsCollapsed && <span>{module.shortTitle}</span>}
              </Link>
            ))}

            {qaModule && isRoleAllowed(role, qaModule.allowedRoles) && (
              <div className="pt-2">
                <button
                  onClick={() => {
                    if (role?.toLowerCase() === 'agent' || role?.toLowerCase() === 'agents') {
                      openAccessDenied();
                      return;
                    }
                    if (effectiveIsCollapsed) setIsSidebarCollapsed(false);
                    setIsQaExpanded(!isQaExpanded);
                  }}
                  className={`w-full ${navItemClass(Boolean(pathname?.startsWith('/qa-analyzer')) && !isQaExpanded)}`}
                >
                  <BarChart3 className="h-4 w-4 shrink-0" />
                  {!effectiveIsCollapsed && (
                    <>
                      <span className="flex-1 text-left">{qaModule.shortTitle}</span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${isQaExpanded ? 'rotate-180' : ''}`} />
                    </>
                  )}
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ${isQaExpanded && !effectiveIsCollapsed ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}
                >
                  <div className="space-y-1 px-2 pb-2 pl-11 pt-2">
                    {qaModule.children?.filter((item) => isRoleAllowed(role, item.allowedRoles)).map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`block rounded-xl px-3 py-2 text-[11px] font-bold uppercase tracking-[0.2em] transition ${
                          pathname === item.href || pathname?.startsWith(`${item.href}/`)
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
                        }`}
                      >
                        {item.title}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {managementLinks.length > 0 && (
              <>
                {!effectiveIsCollapsed && <p className="mb-4 ml-2 mt-8 text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Management</p>}
                {managementLinks.map((item) => (
                  <Link key={item.href} href={item.href} className={navItemClass(pathname === item.href)}>
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!effectiveIsCollapsed && <span>{item.label}</span>}
                  </Link>
                ))}
              </>
            )}
          </nav>

          <div className="mt-auto space-y-2 border-t border-border/40 pt-6">
            {!effectiveIsCollapsed && (
              <div className="rounded-3xl border border-border/50 bg-background/60 px-4 py-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Signed in</p>
                <p className="mt-2 text-sm font-semibold text-foreground">{user?.email}</p>
                <p className="mt-1 text-xs text-muted-foreground">Role: {normalizeRoleLabel(role)}</p>
              </div>
            )}


            <Link
              href="/account"
              className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground ${effectiveIsCollapsed ? 'justify-center px-0' : ''}`}
            >
              <UserCog className="h-4 w-4" />
              {!effectiveIsCollapsed && <span>Akun</span>}
            </Link>

            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground ${effectiveIsCollapsed ? 'justify-center px-0' : ''}`}
            >
              {mounted ? (
                <>
                  {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  {!effectiveIsCollapsed && <span>Tema {theme === 'dark' ? 'Terang' : 'Gelap'}</span>}
                </>
              ) : (
                <div className="h-4 w-4 rounded-full bg-foreground/10" />
              )}
            </button>

            <button
              onClick={() => void signOut()}
              className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-muted-foreground transition hover:bg-red-500/10 hover:text-red-600 ${effectiveIsCollapsed ? 'justify-center px-0' : ''}`}
            >
              <LogOut className="h-4 w-4" />
              {!effectiveIsCollapsed && <span>Keluar</span>}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
