import {
  Activity,
  BarChart3,
  LayoutDashboard,
  Mail,
  MessageSquare,
  Phone,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface AppModuleConfig {
  id: 'dashboard' | 'ketik' | 'pdkt' | 'telefun' | 'profiler' | 'qa-analyzer' | 'monitoring';
  title: string;
  shortTitle: string;
  description: string;
  href: string;
  icon: LucideIcon;
  accentClassName: string;
  accentSoftClassName: string;
  allowedRoles?: string[];
  children?: Array<{ title: string; href: string; allowedRoles?: string[] }>;
}

export const APP_MODULES: AppModuleConfig[] = [
  {
    id: 'dashboard',
    title: 'Unified Dashboard',
    shortTitle: 'Dashboard',
    description: 'Pusat kendali untuk memantau performa, aktivitas, dan prioritas kerja harian.',
    href: '/dashboard',
    icon: LayoutDashboard,
    accentClassName: 'text-primary',
    accentSoftClassName: 'bg-primary/10',
  },
  {
    id: 'ketik',
    title: 'KETIK',
    shortTitle: 'Ketik',
    description: 'Simulasi chat layanan untuk melatih komunikasi tertulis yang empatik dan solutif.',
    href: '/ketik',
    icon: MessageSquare,
    accentClassName: 'text-module-ketik',
    accentSoftClassName: 'bg-module-ketik/10',
  },
  {
    id: 'pdkt',
    title: 'PDKT',
    shortTitle: 'PDKT',
    description: 'Workspace korespondensi email untuk standardisasi tanggapan layanan konsumen.',
    href: '/pdkt',
    icon: Mail,
    accentClassName: 'text-module-pdkt',
    accentSoftClassName: 'bg-module-pdkt/10',
  },
  {
    id: 'telefun',
    title: 'TELEFUN',
    shortTitle: 'Telefun',
    description: 'Simulasi komunikasi suara untuk melatih percakapan telepon yang presisi dan profesional.',
    href: '/telefun',
    icon: Phone,
    accentClassName: 'text-module-telefun',
    accentSoftClassName: 'bg-module-telefun/10',
  },
  {
    id: 'profiler',
    title: 'KTP',
    shortTitle: 'KTP',
    description: 'Database profil agen dan peserta untuk operasional training yang lebih rapi dan terstruktur.',
    href: '/profiler',
    icon: Users,
    accentClassName: 'text-module-profiler',
    accentSoftClassName: 'bg-module-profiler/10',
    allowedRoles: ['trainer', 'leader', 'admin'],
  },
  {
    id: 'qa-analyzer',
    title: 'SIDAK',
    shortTitle: 'SIDAK',
    description: 'Analytics kualitas untuk membaca pola temuan, ranking, dan area perbaikan lintas tim.',
    href: '/qa-analyzer/dashboard',
    icon: BarChart3,
    accentClassName: 'text-module-sidak',
    accentSoftClassName: 'bg-module-sidak/10',
    allowedRoles: ['trainer', 'leader', 'admin'],
    children: [
      { title: 'Dashboard SIDAK', href: '/qa-analyzer/dashboard' },
      { title: 'Analisis Individu', href: '/qa-analyzer/agents' },
      { title: 'Ranking Agen', href: '/qa-analyzer/ranking' },
      { title: 'Laporan', href: '/qa-analyzer/reports', allowedRoles: ['trainer', 'admin'] },
      { title: 'Input Temuan', href: '/qa-analyzer/input', allowedRoles: ['trainer', 'admin'] },
      { title: 'Periode QA', href: '/qa-analyzer/periods', allowedRoles: ['trainer', 'admin'] },
      { title: 'Parameter QA', href: '/qa-analyzer/settings', allowedRoles: ['trainer', 'admin'] },
    ],
  },
  {
    id: 'monitoring',
    title: 'Monitoring',
    shortTitle: 'Monitoring',
    description: 'Ringkasan manajemen untuk memantau aktivitas dan operasional pengguna.',
    href: '/dashboard/monitoring',
    icon: Activity,
    accentClassName: 'text-primary',
    accentSoftClassName: 'bg-primary/10',
    allowedRoles: ['trainer', 'leader', 'admin'],
  },
];

export function normalizeRoleLabel(role?: string | null) {
  const value = role?.toLowerCase().trim();
  switch (value) {
    case 'agent':
    case 'agents':
      return 'Agent';
    case 'leader':
      return 'Leader';
    case 'trainer':
    case 'trainers':
      return 'Trainer';
    case 'admin':
      return 'Admin';
    default:
      return 'User';
  }
}

export function isRoleAllowed(role: string | undefined | null, allowedRoles?: string[]) {
  if (!allowedRoles || allowedRoles.length === 0) return true;
  const normalizedRole = role?.toLowerCase().trim();
  
  // Normalize role to singular form
  const finalRole = normalizedRole === 'trainers' ? 'trainer' : normalizedRole === 'agents' ? 'agent' : normalizedRole;
  
  return allowedRoles.includes(finalRole || '');
}
