'use client';

import dynamic from 'next/dynamic';
import React from 'react';

const ProfilerTableClient = dynamic(
  () => import('./ProfilerTableClient'),
  {
    loading: () => (
      <div className="flex-1 flex flex-col min-h-screen bg-background p-8">
        <div className="h-[60px] rounded-2xl bg-muted/20 animate-pulse mb-6" />
        <div className="h-[400px] rounded-2xl bg-muted/20 animate-pulse" />
      </div>
    ),
  }
);

export default ProfilerTableClient;
