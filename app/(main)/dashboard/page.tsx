import { qaServiceServer } from '../qa-analyzer/services/qaService.server';
import { activityServiceServer } from '@/app/lib/services/activityService.server';
import { normalizeActionText } from '@/app/lib/utils';
import { requirePageAccess } from '@/app/lib/authz';
import Link from 'next/link';
import { ArrowRight, Sparkles, PlusCircle, Users, Trophy, UserCog, Shield, Activity, History } from 'lucide-react';
import { APP_MODULES, isRoleAllowed, normalizeRoleLabel } from '@/app/lib/app-config';
import { ThemeToggle } from '@/app/components/ThemeToggle';
import { DashboardShortcutLink, DashboardActivityClient, DashboardTrendClient } from './DashboardClientComponents';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const { user, profile, role } = await requirePageAccess();

  // 1. Fetch base data
  const periods = await qaServiceServer.getPeriods();
  const periodIds = periods.slice(0, 12).map(p => p.id); 

  // Parallel fetch: Trends (RPC with legacy fallback) + Recent Activities
  const [trendResult, activities] = await Promise.all([
    qaServiceServer.getServiceTrendDashboard(periodIds).catch(err => {
      console.warn('[Dashboard] RPC failed, using fallback:', err);
      return qaServiceServer.getServiceTrendForDashboard('all');
    }),
    activityServiceServer.getRecentActivities(5)
  ]);

  const serviceTrendAll = trendResult;

  // 2. Derive 3m and 6m trends from the 'all' fetch (12m)
  const serviceTrendMap = {
    '3m': qaServiceServer.sliceTrendData(serviceTrendAll, 3),
    '6m': qaServiceServer.sliceTrendData(serviceTrendAll, 6),
    'all': serviceTrendAll,
  };

  const formattedLogs = activities.map(act => ({
    id: act.id,
    user: act.user_name || 'Pengguna internal',
    action: normalizeActionText(act.action),
    time: activityServiceServer.formatTimeAgo(act.created_at),
    type: act.type
  }));

  // 3. Additional metadata
  const availableYears = await qaServiceServer.getAvailableYears();
  const currentYear = new Date().getFullYear();

  const visibleModules = APP_MODULES.filter(
    (module) => ['ketik', 'pdkt', 'telefun', 'profiler', 'qa-analyzer'].includes(module.id) && isRoleAllowed(role, module.allowedRoles)
  );
  const roleLabel = normalizeRoleLabel(role);
  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Tim';
  const managementActions = [
    {
      href: '/dashboard/users',
      title: 'User Management',
      description: 'Kelola peran pengguna dan atur akses operasional setiap individu di tim Anda.',
      icon: Shield,
      allowed: ['trainer', 'admin'].includes(role?.toLowerCase()),
    },
    {
      href: '/dashboard/monitoring',
      title: 'Monitoring',
      description: 'Pantau log aktivitas layanan secara ringkas untuk menjamin kualitas operasional berjalan konsisten.',
      icon: Activity,
      allowed: ['trainer', 'leader', 'admin'].includes(role?.toLowerCase()),
    },
    {
      href: '/dashboard/activities',
      title: 'Activity Logs',
      description: 'Riwayat rekam jejak untuk menelusuri aktivitas yang dilakukan pengguna kapan saja.',
      icon: History,
      allowed: ['trainer', 'admin'].includes(role?.toLowerCase()),
    },
  ].filter((item) => item.allowed);

  const isManagerRole = ['trainer', 'admin'].includes(role?.toLowerCase());

  const trainerShortcuts = [
    {
      id: 'qa-input',
      href: '/qa-analyzer/input',
      title: 'Input Temuan',
      description: 'Catat hasil evaluasi QA terbaru',
      icon: PlusCircle,
      accentSoftClassName: 'bg-indigo-600/10',
      accentClassName: 'text-indigo-600 dark:text-indigo-400',
    },
    {
      id: 'qa-agents',
      href: '/qa-analyzer/agents',
      title: 'Analisis Individu',
      description: 'Laporan performa QA agen',
      icon: Users,
      accentSoftClassName: 'bg-emerald-600/10',
      accentClassName: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      id: 'qa-ranking',
      href: '/qa-analyzer/ranking',
      title: 'Ranking Agen',
      description: 'Papan peringkat performa auditan',
      icon: Trophy,
      accentSoftClassName: 'bg-amber-600/10',
      accentClassName: 'text-amber-600 dark:text-amber-400',
    },
    {
      id: 'account',
      href: '/account',
      title: 'Pengaturan Profil',
      description: 'Preferensi dan keamanan akun Anda',
      icon: UserCog,
      accentSoftClassName: 'bg-slate-600/10',
      accentClassName: 'text-slate-600 dark:text-slate-400',
    },
  ];

  const shortcutsToDisplay = isManagerRole ? trainerShortcuts : visibleModules.slice(0, 4);

  return (
    <main className="relative flex flex-1 flex-col overflow-y-auto">
      <div className="sticky top-0 z-30 border-b border-border/40 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between px-6 py-4 lg:px-10">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Dashboard Terpadu</p>
            <h1 className="mt-1 text-lg font-semibold tracking-tight">Pusat Kendali</h1>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-sm font-semibold text-primary">
              {user?.email?.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute left-1/2 top-0 h-[36rem] w-full max-w-[1200px] -translate-x-1/2 rounded-full bg-primary/6 blur-[140px]" />

      <div className="relative z-10 mx-auto flex w-full max-w-[1600px] flex-col gap-10 px-6 py-8 lg:px-10 lg:py-10">
        <section className="overflow-hidden rounded-[2.5rem] border border-border/50 bg-card/40 shadow-xl shadow-black/5 backdrop-blur-xl">
          <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="flex flex-col justify-center p-8 lg:p-12">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.24em] text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Pusat Kendali
              </div>
              <div className="mt-6 space-y-4">
                <h2 className="text-4xl font-bold tracking-tight text-balance lg:text-5xl">
                  Halo, {displayName}.
                </h2>
                <p className="max-w-2xl text-base leading-relaxed text-muted-foreground lg:text-lg">
                  Anda memiliki akses untuk {roleLabel === 'Agent' ? 'mempelajari skenario latihan baru dan memvalidasi skor capaian bulanan secara komprehensif' : 'memantau tren performa layanan utama, mengevaluasi aktivitas harian staf, dan menggunakan perangkat manajemen'} dalam satu platform.
                </p>
              </div>

              {managementActions.length > 0 && (
                <div className="mt-10 lg:mt-12">
                  <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Opsi Manajerial</p>
                  <div className="flex flex-wrap gap-3">
                    {managementActions.map(action => (
                      <Link 
                        key={action.href} 
                        href={action.href} 
                        className="group flex items-center gap-3 rounded-2xl border border-border/60 bg-background/60 px-5 py-3 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-background hover:shadow-md"
                      >
                        <action.icon className="h-4 w-4 text-primary/70" />
                        <span className="text-sm font-semibold text-foreground/90">{action.title}</span>
                        <ArrowRight className="h-4 w-4 text-primary/40 transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col justify-center border-t border-border/40 bg-muted/20 p-8 lg:border-l lg:border-t-0 lg:p-12">
              <p className="mb-6 text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Pintasan Modul</p>
              <div className="flex flex-col gap-3">
                {shortcutsToDisplay.map((module) => (
                  <DashboardShortcutLink
                    key={module.href}
                    href={module.href}
                    id={module.id}
                    className="group flex items-center gap-4 rounded-3xl border border-background/50 bg-background/50 p-3 transition-all hover:-translate-y-0.5 hover:border-primary/20 hover:bg-background hover:shadow-sm"
                  >
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${module.accentSoftClassName} ${module.accentClassName}`}>
                      <module.icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="text-sm font-semibold tracking-tight text-foreground/90">{module.title}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground pr-2">{module.description}</p>
                    </div>
                    <div className="mr-2 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                       <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </DashboardShortcutLink>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Workspace Terpadu</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight">Lebih mudah berpindah dari satu modul ke modul yang lain</h3>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            {visibleModules.map((module, idx) => (
              <div
                key={module.id}
                className="animate-in fade-in slide-in-from-bottom-4"
                style={{ animationDuration: '400ms', animationFillMode: 'both', animationDelay: `${idx * 80}ms` }}
              >
                <DashboardShortcutLink
                  href={module.href}
                  id={module.id}
                  className="group flex h-full flex-col rounded-[2rem] border border-border/50 bg-card/70 p-5 backdrop-blur-md transition hover:-translate-y-1 hover:border-primary/20 hover:shadow-lg hover:shadow-black/5"
                >
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${module.accentSoftClassName} ${module.accentClassName}`}>
                      <module.icon className="h-5 w-5" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
                  </div>
                  <h4 className="text-lg font-semibold tracking-tight">{module.title}</h4>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{module.description}</p>
                  <div className="mt-auto pt-5 text-[10px] font-bold uppercase tracking-[0.24em] text-primary">Buka Modul</div>
                </DashboardShortcutLink>
              </div>
            ))}
          </div>
        </section>

        {/* Analytics shell split */}
        {['trainer', 'leader', 'admin'].includes(role?.toLowerCase() || '') && (
          <DashboardTrendClient 
            role={role}
            serviceTrendMap={serviceTrendMap}
            availableYears={availableYears}
            initialYear={currentYear}
          />
        )}

        {['trainer', 'admin'].includes(role?.toLowerCase() || '') && (
          <div className="rounded-3xl border border-border/40 bg-card/40 backdrop-blur-sm p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-lg font-bold tracking-tight">Aktivitas Terakhir</h2>
              <Link href="/dashboard/activities" className="text-[10px] font-mono uppercase tracking-widest text-primary hover:text-primary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-2 py-1 transition-colors">
                Lihat Semua
              </Link>
            </div>
            <DashboardActivityClient 
              role={role}
              initialRecentLogs={formattedLogs}
            />
          </div>
        )}
      </div>
    </main>
  );
}
