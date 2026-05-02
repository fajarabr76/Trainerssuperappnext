'use client';

import { useState } from 'react';
import { Shield, ShieldCheck, ShieldOff, ShieldX, Clock, Loader2 } from 'lucide-react';
import type { LeaderAccessStatus as AccessStatus, LeaderAccessModule } from '@/app/lib/access-control/leaderScope';
import { requestLeaderModuleAccess } from '@/app/actions/leader-access';

interface LeaderAccessStatusProps {
  status: AccessStatus;
  module: LeaderAccessModule;
  moduleLabel: string;
  accessGroups?: string[];
}

const moduleLabels: Record<LeaderAccessModule, string> = {
  ktp: 'KTP / Profiler',
  sidak: 'SIDAK / QA Analyzer',
};

export default function LeaderAccessStatus({
  status,
  module,
  moduleLabel,
  accessGroups = [],
}: LeaderAccessStatusProps) {
  const [requesting, setRequesting] = useState(false);
  const [requestResult, setRequestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleRequest = async () => {
    setRequesting(true);
    setRequestResult(null);
    try {
      const result = await requestLeaderModuleAccess(module);
      setRequestResult(result);
    } catch {
      setRequestResult({ success: false, message: 'Terjadi kesalahan. Silakan coba lagi.' });
    } finally {
      setRequesting(false);
    }
  };

  const config = getStatusConfig(status);

  return (
    <div className="bg-card border border-border rounded-[2rem] overflow-hidden shadow-lg">
      <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent pointer-events-none" />

      <div className="relative p-8 sm:p-10">
        {/* Icon */}
        <div className={config.iconBgClass + ' w-14 h-14 rounded-2xl flex items-center justify-center mb-5'}>
          {config.icon}
        </div>

        {/* Title */}
        <h2 className="text-xl font-black tracking-tight text-foreground mb-2">
          {config.title}
        </h2>

        {/* Module label */}
        <p className="text-sm text-muted-foreground mb-1">
          Modul: <span className="font-semibold text-foreground">{moduleLabel || moduleLabels[module]}</span>
        </p>

        {/* Description */}
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          {config.description}
        </p>

        {/* Access groups (if approved) */}
        {status === 'approved' && accessGroups.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
              Access Groups
            </p>
            <div className="flex flex-wrap gap-2">
              {accessGroups.map((group) => (
                <span
                  key={group}
                  className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.22em] bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                >
                  {group}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Action button for 'none' status */}
        {status === 'none' && (
          <>
            <button
              onClick={handleRequest}
              disabled={requesting}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-5 py-2.5 font-bold shadow-lg shadow-primary/20 hover:brightness-110 transition-all disabled:cursor-not-allowed disabled:opacity-50"
            >
              {requesting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Shield className="w-4 h-4" />
              )}
              {requesting ? 'Mengajukan...' : 'Ajukan Akses'}
            </button>

            {requestResult && (
              <p className={`mt-3 text-sm font-medium ${
                requestResult.success ? 'text-emerald-600' : 'text-red-600'
              }`}>
                {requestResult.message}
              </p>
            )}
          </>
        )}

        {/* Status badge */}
        <div className="mt-6">
          <span className={config.badgeClass}>
            {config.badgeLabel}
          </span>
        </div>
      </div>
    </div>
  );
}

function getStatusConfig(status: AccessStatus) {
  switch (status) {
    case 'none':
      return {
        icon: <Shield className="w-7 h-7 text-amber-600" />,
        iconBgClass: 'bg-amber-500/10',
        title: 'Akses Belum Tersedia',
        description:
          'Anda belum memiliki akses ke modul ini. Klik tombol di bawah untuk mengajukan permintaan akses kepada Admin atau Trainer.',
        badgeClass:
          'rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.22em] bg-amber-500/10 text-amber-600 border border-amber-500/20',
        badgeLabel: 'Belum Ada Akses',
      };
    case 'pending':
      return {
        icon: <Clock className="w-7 h-7 text-sky-600" />,
        iconBgClass: 'bg-sky-500/10',
        title: 'Menunggu Approval',
        description:
          'Permintaan akses Anda sedang menunggu persetujuan dari Admin atau Trainer. Anda akan dapat mengakses data modul ini setelah disetujui.',
        badgeClass:
          'rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.22em] bg-sky-500/10 text-sky-600 border border-sky-500/20',
        badgeLabel: 'Pending',
      };
    case 'rejected':
      return {
        icon: <ShieldX className="w-7 h-7 text-rose-600" />,
        iconBgClass: 'bg-rose-500/10',
        title: 'Permintaan Ditolak',
        description:
          'Permintaan akses Anda ditolak. Hubungi Admin atau Trainer untuk informasi lebih lanjut.',
        badgeClass:
          'rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.22em] bg-rose-500/10 text-rose-600 border border-rose-500/20',
        badgeLabel: 'Ditolak',
      };
    case 'revoked':
      return {
        icon: <ShieldOff className="w-7 h-7 text-red-600" />,
        iconBgClass: 'bg-red-500/10',
        title: 'Akses Dicabut',
        description:
          'Akses Anda ke modul ini telah dicabut. Hubungi Admin atau Trainer untuk informasi lebih lanjut.',
        badgeClass:
          'rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.22em] bg-red-500/10 text-red-600 border border-red-500/20',
        badgeLabel: 'Dicabut',
      };
    case 'approved':
      return {
        icon: <ShieldCheck className="w-7 h-7 text-emerald-600" />,
        iconBgClass: 'bg-emerald-500/10',
        title: 'Akses Disetujui',
        description:
          'Anda memiliki akses ke modul ini dengan batasan scope yang telah ditentukan.',
        badgeClass:
          'rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.22em] bg-emerald-500/10 text-emerald-600 border border-emerald-500/20',
        badgeLabel: 'Disetujui',
      };
  }
}
