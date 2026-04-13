'use client';

import React, { useState } from 'react';
import Sidebar from '@/app/components/Sidebar';
import { Menu } from 'lucide-react';
import { TelefunWarningProvider, useTelefunWarning } from '@/app/context/TelefunWarningContext';
import { AccessDeniedProvider, useAccessDenied } from '@/app/context/AccessDeniedContext';
import { SessionTimeoutProvider } from '@/app/context/SessionTimeoutContext';
import { MaintenanceModal } from '@/app/(main)/telefun/components/MaintenanceModal';
import { AccessDeniedModal } from '@/app/components/AccessDeniedModal';

import { usePathname, useRouter } from 'next/navigation';

function MainLayoutContent({ 
  user, 
  role, 
  profile: _profile,
  children 
}: { 
  user: any, 
  role: string, 
  profile?: any,
  children: React.ReactNode 
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { isMaintenanceOpen, openMaintenance } = useTelefunWarning();
  const { isAccessDeniedOpen, openAccessDenied } = useAccessDenied();

  // Auto-trigger if someone tries to access /telefun directly
  React.useEffect(() => {
    if (pathname === '/telefun') {
      openMaintenance();
    }
    
    // Check for restricted modules for Agent role
    if (role?.toLowerCase() === 'agent' || role?.toLowerCase() === 'agents') {
      if (pathname?.startsWith('/profiler') || pathname?.startsWith('/qa-analyzer')) {
        openAccessDenied();
        router.push('/dashboard');
      }
    }
  }, [pathname, openMaintenance, openAccessDenied, role, router]);

  return (
    <div className="flex h-screen bg-background overflow-hidden font-sans text-foreground selection:bg-primary/20">
      <Sidebar 
        user={user} 
        role={role} 
        isMobileMenuOpen={isMobileMenuOpen} 
        setIsMobileMenuOpen={setIsMobileMenuOpen} 
      />
      
      {/* Mobile Header/Hamburger (visible only on mobile) */}
      <div className="lg:hidden absolute top-4 left-4 z-40">
        <button 
          onClick={() => setIsMobileMenuOpen(true)}
          className="p-2 bg-card/80 backdrop-blur-md border border-border/40 rounded-xl text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring shadow-sm"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 flex flex-col h-full w-full overflow-y-auto relative">
        {/* Hide content if we are on /telefun to ensure "tanpa masuk ke modul" */}
        {pathname === '/telefun' ? (
          <div className="flex-1 bg-background flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          children
        )}
      </div>

      <MaintenanceModal 
        isOpen={isMaintenanceOpen}
      />
      
      <AccessDeniedModal 
        isOpen={isAccessDeniedOpen}
      />
    </div>
  );
}

export default function MainLayoutClient(props: any) {
  return (
    <AccessDeniedProvider>
      <TelefunWarningProvider>
        <SessionTimeoutProvider>
          <MainLayoutContent {...props} />
        </SessionTimeoutProvider>
      </TelefunWarningProvider>
    </AccessDeniedProvider>
  );
}
