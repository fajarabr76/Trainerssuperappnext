'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, ArrowRight, Home } from 'lucide-react';

interface ReportWarningModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ReportWarningModal({ isOpen, onConfirm, onCancel }: ReportWarningModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="absolute inset-0 bg-background/80 backdrop-blur-md"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-card border border-border/50 rounded-[32px] p-8 shadow-2xl overflow-hidden"
          >
            {/* Background Accent */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-amber-500/10 border border-amber-500/20 rounded-3xl flex items-center justify-center mb-8 relative">
                <AlertTriangle className="w-10 h-10 text-amber-500" />
                <div className="absolute inset-0 bg-amber-500/20 rounded-3xl animate-pulse opacity-20" />
              </div>
              
              <h2 className="text-2xl font-bold tracking-tight mb-4">Akses Terbatas & Notifikasi Biaya</h2>
              <div className="text-muted-foreground leading-relaxed mb-8 space-y-4">
                <p>
                  Fitur ini saat ini berada dalam tahap pengembangan intensif. Harap diperhatikan bahwa modul ini merupakan layanan khusus yang bersifat <strong className="text-foreground font-bold">berbayar</strong>.
                </p>
                <p>
                  Penggunaan fitur ini akan berdampak pada kuota komputasi dan dapat menimbulkan <strong className="text-foreground font-bold">tagihan</strong> langsung pada akun Trainer Anda. Kami menyarankan untuk kembali ke Dashboard jika Anda tidak yakin.
                </p>
              </div>
              
              <div className="grid grid-cols-1 w-full gap-3">
                <button
                  onClick={onCancel}
                  className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground h-14 rounded-2xl font-bold hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-primary/20"
                >
                  <Home className="w-4 h-4" /> Kembali ke dashboard
                </button>
                <button
                  onClick={onConfirm}
                  className="w-full h-14 rounded-2xl font-medium text-muted-foreground hover:text-muted-foreground hover:bg-foreground/5 transition-all text-sm"
                >
                  Tetap Lanjutkan <ArrowRight className="w-3 h-3 ml-1 inline" />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
