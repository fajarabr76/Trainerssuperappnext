'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, History, Trash2, ChevronRight, MessageSquare, Calendar, Clock, Database } from 'lucide-react';
import { ChatSession } from '@/app/types';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: ChatSession[];
  onClear: () => void;
  onDelete: (id: string) => void;
  onReview: (session: ChatSession) => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, onClose, history, onClear, onDelete, onReview }) => {
  if (!isOpen) return null;

  return (
    <div data-module="ketik" className="module-clean-app module-clean-modal fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-8">
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
        className="module-clean-modal-shell relative w-full max-w-2xl rounded-[2.5rem] overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <header className="module-clean-toolbar px-10 py-8 border-b flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="module-clean-chip w-14 h-14 rounded-2xl flex items-center justify-center">
              <History className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-foreground tracking-tighter">Riwayat Simulasi</h2>
              <p className="text-sm text-foreground/50 font-medium">Tinjau kembali percakapan sebelumnya.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {history.length > 0 && (
              <button 
                onClick={() => { if(confirm('Hapus semua riwayat?')) onClear(); }}
                className="w-12 h-12 flex items-center justify-center hover:bg-red-500/10 text-red-500/60 hover:text-red-500 rounded-2xl transition-all border border-transparent hover:border-red-500/20"
                title="Hapus Semua"
              >
                <Trash2 className="w-6 h-6" />
              </button>
            )}
            <button 
              onClick={onClose} 
              className="w-12 h-12 flex items-center justify-center hover:bg-foreground/5 rounded-2xl transition-all border border-transparent hover:border-foreground/10"
            >
              <X className="w-6 h-6 text-muted-foreground" />
            </button>
          </div>
        </header>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-10 space-y-6 custom-scrollbar">
          {history.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-center">
              <div className="w-24 h-24 bg-foreground/5 rounded-[2rem] flex items-center justify-center mb-6">
                <Database className="w-12 h-12 text-foreground/10" />
              </div>
              <p className="text-xl font-black text-muted-foreground tracking-tight italic">Belum ada riwayat simulasi.</p>
              <p className="text-sm text-foreground/10 font-medium mt-2">Mulai sesi simulasi baru untuk melihat riwayat di sini.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {history.map((session) => (
                <motion.div 
                  key={session.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="module-clean-panel group relative hover:border-module-ketik/40 rounded-[2rem] p-8 transition-all cursor-pointer overflow-hidden"
                  onClick={() => onReview(session)}
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                  
                  <div className="flex items-start justify-between relative z-10">
                    <div className="flex items-center gap-5">
                      <div className="module-clean-chip w-14 h-14 rounded-2xl flex items-center justify-center group-hover:bg-module-ketik group-hover:text-white transition-all duration-500">
                        <MessageSquare className="w-6 h-6 text-primary group-hover:text-white transition-all duration-500" />
                      </div>
                      <div>
                        <h3 className="font-black text-lg text-foreground tracking-tight group-hover:text-primary transition-colors">{session.scenarioTitle}</h3>
                        <div className="flex items-center gap-4 mt-2">
                           <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-black uppercase tracking-widest">
                             <Calendar className="w-3.5 h-3.5" />
                             {new Date(session.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                           </div>
                           <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-black uppercase tracking-widest">
                             <Clock className="w-3.5 h-3.5" />
                             {new Date(session.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                           </div>
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); onDelete(session.id); }}
                      className="w-10 h-10 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-red-500/60 hover:text-red-500 rounded-xl transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="mt-8 pt-6 border-t border-border/50 flex items-center justify-between relative z-10">
                    <div className="flex gap-8">
                      <div className="space-y-1.5">
                        <div className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground font-black">Konsumen</div>
                        <div className="text-xs font-bold text-foreground flex items-center gap-2">
                           <div className="w-4 h-4 rounded-full bg-foreground/10 flex items-center justify-center text-[8px]">👤</div>
                           {session.consumerName}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground font-black">Intensitas</div>
                        <div className="text-xs font-bold text-foreground flex items-center gap-2">
                           <div className="w-4 h-4 rounded-full bg-foreground/10 flex items-center justify-center text-[8px]">💬</div>
                           {session.messages.length} Chat
                        </div>
                      </div>
                    </div>
                    <div className="w-10 h-10 bg-foreground/5 rounded-xl flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all duration-500">
                      <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <footer className="module-clean-toolbar px-10 py-6 border-t text-center shrink-0">
          <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.3em] flex items-center justify-center gap-2">
            <Database className="w-3 h-3" />
            Data lokal terenkripsi di browser Anda
          </p>
        </footer>
      </motion.div>
    </div>
  );
};
