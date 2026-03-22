'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Home } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTelefunWarning } from '@/app/context/TelefunWarningContext';

interface MaintenanceModalProps {
  isOpen: boolean;
}

export const MaintenanceModal = ({ isOpen }: MaintenanceModalProps) => {
  const router = useRouter();
  const { closeMaintenance } = useTelefunWarning();

  const handleRedirect = () => {
    closeMaintenance();
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
            className="absolute inset-0 bg-background/80 backdrop-blur-md"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-sm bg-card border border-destructive/20 rounded-[2.5rem] p-8 shadow-2xl text-center overflow-hidden"
          >
            {/* Background Decorative Element */}
            <div className="absolute top-0 left-0 w-full h-1 bg-destructive/20" />
            
            <div className="w-20 h-20 bg-destructive/10 rounded-3xl mx-auto mb-6 flex items-center justify-center">
              <AlertTriangle className="w-10 h-10 text-destructive" />
            </div>
            
            <h3 className="text-xl font-black text-foreground mb-4 tracking-tight">
              Akses Dibatasi
            </h3>
            
            <p className="text-sm text-foreground/60 leading-relaxed mb-8 font-medium px-4">
              Modul ini tidak berjalan dengan baik pada aplikasi ini. <br />
              <span className="text-destructive font-bold">Silakan menghubungi trainer</span> untuk informasi lebih lanjut.
            </p>
            
            <button
              onClick={handleRedirect}
              className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-bold hover:opacity-90 transition-all shadow-lg flex items-center justify-center gap-3"
            >
              <Home className="w-5 h-5" />
              Kembali ke Dashboard
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
