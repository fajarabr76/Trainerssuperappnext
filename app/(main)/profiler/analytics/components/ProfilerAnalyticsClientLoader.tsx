'use client';

import dynamic from 'next/dynamic';
import React from 'react';

const ProfilerAnalyticsClient = dynamic(
  () => import('./ProfilerAnalyticsClient'),
  {
    loading: () => (
      <div className="flex-1 flex flex-col min-h-screen bg-background p-8">
        <div className="h-[60px] rounded-2xl bg-muted/20 animate-pulse mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-[300px] rounded-2xl bg-muted/20 animate-pulse" />
          ))}
        </div>
      </div>
    ),
  }
);

export default ProfilerAnalyticsClient;
