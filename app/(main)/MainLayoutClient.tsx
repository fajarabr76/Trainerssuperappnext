'use client';

import React, { useState } from 'react';
import Sidebar from '@/app/components/Sidebar';
import { Menu } from 'lucide-react';

export default function MainLayoutClient({ 
  user, 
  role, 
  children 
}: { 
  user: any, 
  role: string, 
  children: React.ReactNode 
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {children}
      </div>
    </div>
  );
}
