'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';

interface MaintenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MaintenanceModal = ({ isOpen, onClose }: MaintenanceModalProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-background/60 backdrop-blur-sm"
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
              Peringatan Modul
            </h3>
            
            <p className="text-sm text-foreground/60 leading-relaxed mb-8 font-medium">
              Modul ini tidak berjalan dengan baik pada aplikasi ini. <br />
              <span className="text-destructive font-bold">Silakan menghubungi trainer</span> untuk informasi lebih lanjut.
            </p>
            
            <button
              onClick={onClose}
              className="w-full py-4 bg-foreground text-background rounded-2xl font-bold hover:opacity-90 transition-all shadow-lg"
            >
              Mengerti
            </button>
            
            <button 
              onClick={onClose}
              className="absolute top-6 right-6 p-2 rounded-full hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4 text-foreground/40" />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
