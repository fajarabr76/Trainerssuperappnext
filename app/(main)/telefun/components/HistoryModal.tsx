'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Trash2, Phone, Clock, Download, History as HistoryIcon } from 'lucide-react';

interface CallRecord {
  id: string;
  date: string;
  url: string;
  consumerName: string;
  scenarioTitle: string;
  duration: number;
  score?: number;
  feedback?: string;
}

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: CallRecord[];
  onDeleteSession: (id: string) => Promise<void>;
  onClearHistory: () => Promise<void>;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({ 
  isOpen, 
  onClose, 
  history, 
  onDeleteSession, 
  onClearHistory 
}) => {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  const handleDelete = async (id: string) => {
    setProcessingId(id);
    await onDeleteSession(id);
    setProcessingId(null);
  };

  const handleClear = async () => {
    if (!confirm('Apakah Anda yakin ingin menghapus semua riwayat?')) return;
    setIsClearing(true);
    await onClearHistory();
    setIsClearing(false);
  };
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-background/80 backdrop-blur-md"
          />
          
            <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl bg-card border border-border rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
          >
            {/* Header */}
            <div className="p-6 border-b border-border flex items-center justify-between shrink-0 bg-foreground/[0.02]">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20">
                  <HistoryIcon className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-foreground">Riwayat Panggilan</h2>
                  <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">
                    {history.length} Rekaman Tersimpan
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {history.length > 0 && (
                   <button 
                    onClick={handleClear}
                    disabled={isClearing}
                    className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-red-500 hover:bg-red-500/10 rounded-xl transition-all border border-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isClearing ? 'Menghapus...' : 'Hapus Semua'}
                  </button>
                )}
                <button 
                  onClick={onClose} 
                  className="p-2 hover:bg-foreground/5 rounded-full transition-colors border border-border"
                >
                  <X className="w-6 h-6 text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide">
              {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="w-20 h-20 bg-foreground/5 rounded-full flex items-center justify-center mb-6 border border-border">
                    <Clock className="w-10 h-10 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-bold mb-2 text-foreground">Belum Ada Rekaman</h3>
                  <p className="text-muted-foreground text-sm max-w-xs mx-auto font-light">
                    Selesaikan simulasi panggilan pertama Anda untuk melihat rekaman di sini.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {history.map(rec => (
                    <motion.div
                      key={rec.id}
                      whileHover={{ scale: 1.01, backgroundColor: 'rgba(var(--foreground),0.03)' }}
                      className="group relative bg-foreground/[0.02] border border-border rounded-3xl p-5 transition-all"
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-5">
                          <div className="w-12 h-12 bg-emerald-500/5 rounded-2xl flex items-center justify-center border border-emerald-500/10">
                            <Phone className="w-6 h-6 text-emerald-600/60 dark:text-emerald-400/60" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-foreground leading-tight">{rec.scenarioTitle}</h4>
                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">
                              {rec.consumerName} · {new Date(rec.date).toLocaleDateString('id-ID')}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <a 
                            href={rec.url} 
                            download={`Telefun_${rec.consumerName}_${rec.id}.webm`}
                            className="p-3 bg-foreground/5 hover:bg-foreground/10 text-emerald-600 dark:text-emerald-400 rounded-xl border border-border transition-all"
                            title="Unduh Rekaman"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                          <button 
                            onClick={() => handleDelete(rec.id)}
                            disabled={processingId === rec.id}
                            className="p-3 bg-red-500/5 hover:bg-red-500/10 text-red-500 rounded-xl border border-red-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Hapus"
                          >
                            {processingId === rec.id ? (
                              <div className="w-4 h-4 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
