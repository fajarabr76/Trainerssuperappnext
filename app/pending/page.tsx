'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PendingPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/waiting-approval');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="text-sm font-medium text-muted-foreground animate-pulse">Menghubungkan ke pusat persetujuan...</p>
      </div>
    </div>
  );
}
