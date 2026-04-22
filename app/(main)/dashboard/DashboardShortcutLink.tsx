'use client';

import React from 'react';
import Link from 'next/link';
import { useTelefunWarning } from '@/app/context/TelefunWarningContext';

export function DashboardShortcutLink({ href, id, children, className }: { href: string, id: string, children: React.ReactNode, className?: string }) {
  const { openMaintenance } = useTelefunWarning();
  return (
    <Link
      href={href}
      className={className}
      onClick={(e) => {
        if (id === 'telefun') {
          e.preventDefault();
          openMaintenance();
        }
      }}
    >
      {children}
    </Link>
  );
}