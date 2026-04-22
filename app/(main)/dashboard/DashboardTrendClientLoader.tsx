'use client';

import dynamic from 'next/dynamic';
import React from 'react';

export const DashboardTrendClientLoader = dynamic(
  () => import('./DashboardTrendClient').then((mod) => mod.DashboardTrendClient),
  {
    loading: () => (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
        <div className="lg:col-span-2 h-[420px] rounded-3xl border border-border/40 bg-card/30 animate-pulse" />
        <div className="h-[420px] rounded-3xl border border-border/40 bg-card/30 animate-pulse" />
      </div>
    ),
  }
);
