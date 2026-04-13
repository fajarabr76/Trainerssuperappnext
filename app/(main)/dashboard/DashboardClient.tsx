'use client';

import dynamic from 'next/dynamic';
import { motion } from 'motion/react';
import { ArrowRight, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { ThemeToggle } from '@/app/components/ThemeToggle';
import { useTelefunWarning } from '@/app/context/TelefunWarningContext';
import { APP_MODULES, isRoleAllowed, normalizeRoleLabel } from '@/app/lib/app-config';

const DashboardAnalyticsPanel = dynamic(() => import('./DashboardAnalyticsPanel'), {
  ssr: false,
  loading: () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="h-[420px] rounded-[2rem] border border-border/40 bg-card/40 animate-pulse lg:col-span-2" />
        <div className="h-[420px] rounded-[2rem] border border-border/40 bg-card/40 animate-pulse" />
      </div>
      <div className="h-[260px] rounded-[2rem] border border-border/40 bg-card/40 animate-pulse" />
    </div>
  ),
});

interface DashboardClientProps {
  user: any;
  role: string;
  profile: any;
  serviceTrendMap: Record<'3m' | '6m' | 'all', {
    labels: string[];
    totalData: number[];
    serviceData: Record<string, number[]>;
    activeServices: string[];
    serviceSummary: Record<string, { totalDefects: number; auditedAgents: number }>;
    totalSummary: { totalDefects: number; auditedAgents: number; activeServiceCount: number };
    topParameter?: { name: string; count: number } | null;
  }>;
  initialRecentLogs: Array<{ id: string | number; user: string; action: string; time: string; type: string }>;
  availableYears: number[];
  initialYear: number;
}

export default function DashboardClient({
  user,
  role,
  profile,
  serviceTrendMap,
  initialRecentLogs,
  availableYears,
  initialYear,
}: DashboardClientProps) {
  const { openMaintenance } = useTelefunWarning();

  const visibleModules = APP_MODULES.filter(
    (module) => ['ketik', 'pdkt', 'telefun', 'profiler', 'qa-analyzer'].includes(module.id) && isRoleAllowed(role, module.allowedRoles)
  );
  const roleLabel = normalizeRoleLabel(role);
  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Tim';

  return (
    <main className="relative flex flex-1 flex-col overflow-y-auto">
      <div className="sticky top-0 z-30 border-b border-border/40 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between px-6 py-4 lg:px-10">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Unified Dashboard</p>
            <h1 className="mt-1 text-lg font-semibold tracking-tight">Command center</h1>
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

      <div className="relative z-10 mx-auto flex w-full max-w-[1600px] flex-col gap-8 px-6 py-8 lg:px-10 lg:py-10">
        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[2rem] border border-border/50 bg-card/75 p-7 shadow-xl shadow-black/5 backdrop-blur-xl lg:p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/8 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Role-aware workspace
            </div>
            <div className="mt-5 space-y-4">
              <h2 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance lg:text-5xl">
                Selamat datang, {displayName}.
              </h2>
              <p className="max-w-3xl text-base leading-7 text-muted-foreground lg:text-lg">
                Anda masuk sebagai {roleLabel}. Gunakan dashboard ini untuk bergerak cepat antar simulasi, monitoring kualitas,
                dan operasi training tanpa berpindah antar layout yang terasa asing.
              </p>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-border/50 bg-background/70 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Modules in view</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight">{visibleModules.length}</p>
              </div>
              <div className="rounded-3xl border border-border/50 bg-background/70 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Primary focus</p>
                <p className="mt-2 text-sm font-medium text-foreground">{roleLabel === 'Agent' ? 'Simulation & self-practice' : 'Monitoring & orchestration'}</p>
              </div>
              <div className="rounded-3xl border border-border/50 bg-background/70 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Access model</p>
                <p className="mt-2 text-sm font-medium text-foreground">Unified shell, preserved legacy routes</p>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-border/50 bg-card/65 p-6 backdrop-blur-xl lg:p-7">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Quick actions</p>
            <div className="mt-5 space-y-3">
              {visibleModules.slice(0, 4).map((module) => (
                <Link
                  key={module.id}
                  href={module.href}
                  onClick={(event) => {
                    if (module.id === 'telefun') {
                      event.preventDefault();
                      openMaintenance();
                    }
                  }}
                  className="group flex items-center justify-between rounded-3xl border border-border/50 bg-background/70 px-5 py-4 transition hover:-translate-y-0.5 hover:border-primary/20"
                >
                  <div className="flex items-center gap-4">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${module.accentSoftClassName} ${module.accentClassName}`}>
                      <module.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold tracking-tight">{module.title}</p>
                      <p className="text-sm text-muted-foreground">{module.description}</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Unified workspaces</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight">Masuk ke modul tanpa keluar dari ritme kerja yang sama</h3>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            {visibleModules.map((module, idx) => (
              <motion.div
                key={module.id}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.08, duration: 0.35 }}
              >
                <Link
                  href={module.href}
                  onClick={(event) => {
                    if (module.id === 'telefun') {
                      event.preventDefault();
                      openMaintenance();
                    }
                  }}
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
                  <div className="mt-auto pt-5 text-[10px] font-bold uppercase tracking-[0.24em] text-primary">Open workspace</div>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>

        <DashboardAnalyticsPanel
          role={role}
          serviceTrendMap={serviceTrendMap}
          initialRecentLogs={initialRecentLogs}
          availableYears={availableYears}
          initialYear={initialYear}
        />
      </div>
    </main>
  );
}
