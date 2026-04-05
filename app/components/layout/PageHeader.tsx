'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, LucideIcon } from 'lucide-react';
import { ThemeToggle } from '../ThemeToggle';

interface PageHeaderProps {
  moduleCode: string;
  moduleName: string;
  Icon: LucideIcon;
  backUrl?: string;
  moduleColor?: string; // Tailwind class for background, e.g., 'bg-module-ketik'
}

export function PageHeader({
  moduleCode,
  moduleName,
  Icon,
  backUrl = '/dashboard',
  moduleColor = 'bg-primary'
}: PageHeaderProps) {
  const router = useRouter();

  return (
    <header className="flex items-center justify-between px-8 py-4 bg-card/30 backdrop-blur-2xl border-b border-border/40 sticky top-0 z-50">
      {/* Kiri: Back button */}
      <div className="flex-1">
        <button
          onClick={() => router.push(backUrl)}
          className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.2em] text-foreground/70 hover:text-primary transition-all group"
        >
          <div className="w-8 h-8 rounded-xl bg-accent/50 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-all">
            <ChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          </div>
          <span className="hidden md:block">Dashboard</span>
        </button>
      </div>

      {/* Tengah: Identitas modul */}
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-2xl ${moduleColor} flex items-center justify-center shadow-xl shadow-primary/20`}>
          <Icon className="w-5 h-5 text-primary-foreground" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-black tracking-tighter uppercase leading-none">
            {moduleCode}
          </span>
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] opacity-70">
            {moduleName}
          </span>
        </div>
      </div>

      {/* Kanan: Theme toggle */}
      <div className="flex-1 flex justify-end">
        <ThemeToggle />
      </div>
    </header>
  );
}
