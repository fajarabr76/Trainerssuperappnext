'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Cpu } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

interface AuthPageFrameProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}

export default function AuthPageFrame({
  eyebrow,
  title,
  description,
  children,
}: AuthPageFrameProps) {
  return (
    <main className="min-h-screen bg-background text-foreground relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-8%] left-[-10%] h-[28rem] w-[28rem] rounded-full bg-primary/12 blur-[120px]" />
        <div className="absolute right-[-8%] top-[18%] h-[22rem] w-[22rem] rounded-full bg-module-sidak/10 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)',
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-6">
        <header className="mb-10 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-3 text-sm font-semibold tracking-tight">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
              <Cpu className="h-5 w-5" />
            </span>
            <span className="flex flex-col">
              <span className="text-foreground">Trainers SuperApp</span>
              <span className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Workspace internal</span>
            </span>
          </Link>
          <ThemeToggle />
        </header>

        <div className="grid flex-1 items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="max-w-2xl space-y-6">
            <div className="inline-flex items-center rounded-full border border-primary/15 bg-primary/8 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.24em] text-primary">
              {eyebrow}
            </div>
            <div className="space-y-4">
              <h1 className="max-w-xl text-5xl font-semibold tracking-tight text-balance md:text-6xl">
                {title}
              </h1>
              <p className="max-w-xl text-base leading-7 text-muted-foreground md:text-lg">
                {description}
              </p>
            </div>
            <div className="grid gap-4 text-sm text-muted-foreground sm:grid-cols-2">
              <div className="rounded-3xl border border-border/50 bg-card/60 p-5 backdrop-blur-md">
                Akses training, simulasi, dan analytics dari satu platform yang terasa konsisten.
              </div>
              <div className="rounded-3xl border border-border/50 bg-card/60 p-5 backdrop-blur-md">
                Experience public dan area kerja internal sekarang mengikuti visual language yang sama.
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-border/50 bg-card/75 p-4 shadow-2xl shadow-black/5 backdrop-blur-2xl md:p-6">
            {children}
          </section>
        </div>
      </div>
    </main>
  );
}
