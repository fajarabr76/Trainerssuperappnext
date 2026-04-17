'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Trash2, Calendar, Clock, ChevronRight, History as HistoryIcon, Eye, User, Tag, Loader2, AlertTriangle } from 'lucide-react';
import { SessionHistory } from '../types';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: SessionHistory[];
  onSelectSession: (session: SessionHistory) => void;
  onDeleteSession: (id: string) => void;
  onClearHistory: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({ 
  isOpen, 
  onClose, 
  history, 
  onSelectSession, 
  onDeleteSession, 
  onClearHistory 
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div data-module="pdkt" className="module-clean-app module-clean-modal fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 md:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="module-clean-overlay absolute inset-0"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="module-clean-modal-shell relative w-full max-w-3xl rounded-[2rem] overflow-hidden flex flex-col max-h-[86vh] shadow-2xl shadow-black/10"
          >
            {/* Header */}
            <div className="module-clean-toolbar px-5 py-4 sm:px-6 sm:py-5 border-b flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <div className="module-clean-chip w-11 h-11 rounded-xl flex items-center justify-center">
                  <HistoryIcon className="w-5 h-5 text-module-pdkt" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">Riwayat Simulasi</h2>
                  <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">
                    {history.length} Sesi PDKT Tersimpan
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {history.length > 0 && (
                  <button 
                    onClick={() => { if(confirm('Apakah Anda yakin ingin menghapus semua riwayat?')) onClearHistory(); }}
                    className="px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider text-red-500 hover:bg-red-500/10 rounded-lg transition-all border border-red-500/20"
                  >
                    Hapus Semua
                  </button>
                )}
                <button 
                  onClick={onClose} 
                  className="w-10 h-10 flex items-center justify-center hover:bg-foreground/5 rounded-xl transition-colors border border-border"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-5 sm:p-6 space-y-4 scrollbar-hide">
              {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="w-20 h-20 bg-foreground/5 rounded-full flex items-center justify-center mb-6 border border-border">
                    <Clock className="w-10 h-10 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-bold mb-2 text-foreground">Belum Ada Riwayat</h3>
                  <p className="text-muted-foreground text-sm max-w-xs mx-auto font-light">
                    Selesaikan simulasi pertama Anda untuk melihat riwayatnya di sini.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {history.map(session => {
                    const score = session.evaluation?.score || 0;
                    const scoreColor = score >= 80 ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 
                                     score >= 60 ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20' : 
                                     'text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20';
                    const statusBadge = session.evaluationStatus === 'processing'
                      ? 'text-sky-600 dark:text-sky-400 bg-sky-500/10 border-sky-500/20'
                      : session.evaluationStatus === 'failed'
                        ? 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20'
                        : scoreColor;
                    
                    const lastEmail = session.emails[session.emails.length - 1];
                    const subject = lastEmail?.subject || 'Tanpa Subjek';

                    return (
                      <motion.div
                        key={session.id}
                        whileHover={{ scale: 1.01, backgroundColor: 'rgba(var(--foreground),0.03)' }}
                        className="module-clean-panel group relative rounded-[1.5rem] p-4 sm:p-5 transition-all cursor-pointer overflow-hidden"
                        onClick={() => onSelectSession(session)}
                      >
                        <div className="flex justify-between items-start gap-3 mb-4">
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2.5 mb-2">
                              <div className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest border flex items-center gap-1.5 ${statusBadge}`}>
                                {session.evaluationStatus === 'processing' ? (
                                  <>
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    Evaluasi
                                  </>
                                ) : session.evaluationStatus === 'failed' ? (
                                  <>
                                    <AlertTriangle className="w-3 h-3" />
                                    Gagal
                                  </>
                                ) : (
                                  <>Skor: {score}</>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono uppercase tracking-wider min-w-0">
                                <Calendar className="w-3 h-3" />
                                {new Date(session.timestamp).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                <span className="mx-1">•</span>
                                {new Date(session.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                            <h3 className="text-lg font-bold leading-tight group-hover:text-module-pdkt transition-colors line-clamp-1 text-foreground min-w-0">
                              {subject}
                            </h3>
                          </div>
                          
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0 shrink-0">
                            <button
                              onClick={(e) => { e.stopPropagation(); onSelectSession(session); }}
                              className="p-2 bg-foreground/5 hover:bg-foreground/10 text-muted-foreground hover:text-foreground rounded-lg border border-border transition-all"
                              title="Lihat Detail"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id); }}
                              className="p-2 bg-red-500/5 hover:bg-red-500/10 text-red-500/60 hover:text-red-500 rounded-lg border border-red-500/10 transition-all"
                              title="Hapus"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap gap-2 mt-4 min-w-0">
                          <div className="flex items-center gap-1.5 text-[10px] text-foreground/50 bg-foreground/5 px-3 py-1.5 rounded-full border border-border max-w-full min-w-0">
                            <User className="w-3 h-3" />
                            <span className="truncate">{session.config.consumerType.name}</span>
                          </div>
                          {session.config.scenarios.slice(0, 2).map(s => (
                            <div key={s.id} className="flex items-center gap-1.5 text-[10px] text-foreground/50 bg-foreground/5 px-3 py-1.5 rounded-full border border-border max-w-full sm:max-w-[180px] min-w-0">
                              <Tag className="w-3 h-3" />
                              <span className="truncate">{s.title}</span>
                            </div>
                          ))}
                          {session.config.scenarios.length > 2 && (
                            <div className="text-[10px] text-muted-foreground px-2 py-1.5">
                              +{session.config.scenarios.length - 2} lainnya
                            </div>
                          )}
                          {session.evaluationStatus === 'failed' && session.evaluationError && (
                            <div className="text-[10px] text-rose-500 px-2 py-1.5 max-w-full truncate min-w-0">
                              {session.evaluationError}
                            </div>
                          )}
                          {session.timeTaken && (
                            <div className="flex items-center gap-1.5 text-[10px] text-foreground/50 bg-foreground/5 px-3 py-1.5 rounded-full border border-border sm:ml-auto">
                              <Clock className="w-3 h-3" />
                              {Math.floor(session.timeTaken / 60)}m {session.timeTaken % 60}s
                            </div>
                          )}
                        </div>
                        
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all pointer-events-none">
                          <ChevronRight className="w-5 h-5 text-muted-foreground" />
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
