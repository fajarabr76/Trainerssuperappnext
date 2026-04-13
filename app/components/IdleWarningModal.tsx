'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, LogOut, ShieldAlert, Cpu } from 'lucide-react';

interface IdleWarningModalProps {
  isOpen: boolean;
  onStayLoggedIn: () => void;
  onLogout: () => void;
  countdownSeconds: number;
}

export default function IdleWarningModal({ 
  isOpen, 
  onStayLoggedIn, 
  onLogout,
  countdownSeconds 
}: IdleWarningModalProps) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (isOpen) {
      // Logic for progress bar purely for visual feedback
      // 300 seconds (5 mins) is the total grace period
      const percentage = (countdownSeconds / 300) * 100;
      setProgress(percentage);
    }
  }, [isOpen, countdownSeconds]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-background/80 backdrop-blur-xl"
          />
          
          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            className="relative w-full max-w-lg bg-card/90 backdrop-blur-3xl border border-border/50 rounded-[2.5rem] shadow-2xl overflow-hidden p-8 sm:p-10"
          >
            {/* Background Glows */}
            <div className="absolute top-0 left-1/4 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-32 h-32 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col items-center text-center">
              {/* Icon Section */}
              <div className="mb-8 relative">
                <div className="w-20 h-20 bg-orange-500/10 rounded-3xl flex items-center justify-center border border-orange-500/20 relative">
                  <Clock className="w-10 h-10 text-orange-500 animate-pulse" />
                </div>
                <div className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 shadow-lg">
                  <ShieldAlert className="w-4 h-4" />
                </div>
              </div>

              {/* Title & Info */}
              <div className="space-y-3 mb-10">
                <h2 className="text-3xl font-black tracking-tight text-foreground">Sesi Akan Berakhir</h2>
                <p className="text-muted-foreground text-sm leading-relaxed max-w-sm mx-auto">
                    Anda sudah tidak aktif selama beberapa waktu. Demi keamanan data, sesi Anda akan otomatis diakhiri dalam:
                </p>
                
                {/* Countdown Large */}
                <div className="flex items-center justify-center gap-2 mt-4">
                  <span className="text-5xl font-black font-mono tracking-tighter text-primary">
                    {Math.floor(countdownSeconds / 60)}:{String(countdownSeconds % 60).padStart(2, '0')}
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-1.5 bg-foreground/5 rounded-full mb-10 overflow-hidden">
                <motion.div 
                   className="h-full bg-orange-500"
                   initial={{ width: '100%' }}
                   animate={{ width: `${progress}%` }}
                   transition={{ duration: 1, ease: "linear" }}
                />
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-4 w-full">
                <button
                  onClick={onStayLoggedIn}
                  className="flex-1 px-8 py-4 bg-primary text-primary-foreground rounded-2xl text-sm font-bold shadow-lg shadow-primary/20 hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <Cpu className="w-4 h-4" />
                  Lanjutkan Bekerja
                </button>
                <button
                  onClick={onLogout}
                  className="flex-1 px-8 py-4 bg-foreground/5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-2xl text-sm font-bold active:scale-[0.98] transition-all flex items-center justify-center gap-2 border border-transparent hover:border-red-500/20"
                >
                  <LogOut className="w-4 h-4" />
                  Selesaikan Sesi
                </button>
              </div>

              <div className="mt-8 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                <ShieldAlert className="w-3 h-3" />
                Sistem Keamanan Otomatis Aktif
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
