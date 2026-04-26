'use client';

import dynamic from 'next/dynamic';
import React from 'react';

const QaDashboardClient = dynamic(
  () => import('./QaDashboardClient'),
  {
    loading: () => (
      <div className="flex-1 flex flex-col min-h-screen bg-background p-8">
        <div className="h-[73px] rounded-2xl bg-muted/20 animate-pulse mb-4" />
        <div className="h-[50px] rounded-xl bg-muted/20 animate-pulse mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-[180px] rounded-2xl bg-muted/20 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
          <div className="lg:col-span-2 h-[500px] rounded-2xl bg-muted/20 animate-pulse" />
          <div className="h-[500px] rounded-2xl bg-muted/20 animate-pulse" />
        </div>
      </div>
    ),
  }
);

export default QaDashboardClient;
