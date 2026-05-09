'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Play, AlertCircle } from 'lucide-react';
import { Scenario } from '../types';

interface CreateEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  scenarios: Scenario[];
  onCreate: (scenario: Scenario) => void;
  isLoading: boolean;
}

export const CreateEmailModal: React.FC<CreateEmailModalProps> = ({
  isOpen,
  onClose,
  scenarios,
  onCreate,
  isLoading
}) => {
  const activeScenarios = scenarios.filter(s => s.isActive);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative w-full max-w-lg bg-background rounded-3xl shadow-2xl overflow-hidden border border-border"
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-border/50">
              <h3 className="text-lg font-bold text-foreground">Buat Email Baru</h3>
              <button
                onClick={onClose}
                className="p-2 hover:bg-foreground/5 rounded-xl transition-all"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {activeScenarios.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <AlertCircle className="w-12 h-12 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Tidak ada skenario aktif.<br />
                    Harap aktifkan skenario di Pengaturan.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.1em] mb-4">
                    Pilih Skenario Sesuai Masalah
                  </p>
                  <p className="text-[10px] text-muted-foreground/70 mb-3">
                    Setiap skenario aktif dibuat sebagai email terpisah. Pilih satu skenario saat Create Email.
                  </p>
                  {activeScenarios.map((scenario) => (
                    <motion.button
                      key={scenario.id}
                      whileHover={{ scale: 1.01, x: 2 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => onCreate(scenario)}
                      disabled={isLoading}
                      className="w-full flex items-start gap-4 p-4 rounded-2xl border border-border hover:border-module-pdkt/50 hover:bg-module-pdkt/5 text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                      <div className="shrink-0 w-10 h-10 rounded-xl bg-module-pdkt/10 flex items-center justify-center text-module-pdkt group-hover:bg-module-pdkt group-hover:text-white transition-colors">
                        <Play className="w-4 h-4 fill-current" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="text-xs font-black text-foreground uppercase tracking-wide truncate">
                            {scenario.title}
                          </div>
                          {scenario.alwaysUseSampleEmail && scenario.sampleEmailTemplate?.body ? (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[7px] font-black uppercase tracking-widest shrink-0">
                              Always use
                            </span>
                          ) : scenario.sampleEmailTemplate?.body ? (
                            <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20 text-[7px] font-black uppercase tracking-widest shrink-0">
                              Template tersedia
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded bg-green-500/10 text-green-500 border border-green-500/20 text-[7px] font-black uppercase tracking-widest shrink-0">
                              AI generated
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                          {scenario.description}
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-5 bg-foreground/5 border-t border-border/50 flex justify-end">
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-all"
              >
                Batal
              </button>
            </div>

            {isLoading && (
              <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] flex flex-col items-center justify-center z-10">
                <div className="h-8 w-8 animate-spin rounded-full border-3 border-module-pdkt/30 border-t-module-pdkt mb-3" />
                <span className="text-xs font-bold text-module-pdkt animate-pulse">Menghasilkan Email...</span>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
