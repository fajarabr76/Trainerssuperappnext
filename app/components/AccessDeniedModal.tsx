'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAccessDenied } from '@/app/context/AccessDeniedContext';

export function AccessDeniedModal({ isOpen }: { isOpen: boolean }) {
  const router = useRouter();
  const { closeAccessDenied } = useAccessDenied();

  const handleBackToDashboard = () => {
    closeAccessDenied();
    router.push('/dashboard');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleBackToDashboard}
            className="absolute inset-0 bg-background/80 backdrop-blur-md"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-card border border-border/50 rounded-[32px] p-8 shadow-2xl overflow-hidden"
          >
            {/* Background Accent */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-red-500/10 border border-red-500/20 rounded-3xl flex items-center justify-center mb-8 relative">
                <ShieldAlert className="w-10 h-10 text-red-500" />
                <div className="absolute inset-0 bg-red-500/20 rounded-3xl animate-ping opacity-20" />
              </div>
              
              <h2 className="text-2xl font-bold tracking-tight mb-4">Akses Terbatas</h2>
              <p className="text-muted-foreground leading-relaxed mb-8">
                Maaf, Anda belum diberi akses untuk membuka modul ini. Silakan hubungi Trainer Anda untuk informasi lebih lanjut mengenai hak akses akun Anda.
              </p>
              
              <div className="grid grid-cols-1 w-full gap-3">
                <button
                  onClick={handleBackToDashboard}
                  className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground h-14 rounded-2xl font-bold hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-primary/20"
                >
                  <Home className="w-4 h-4" /> Kembali ke Dashboard
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
