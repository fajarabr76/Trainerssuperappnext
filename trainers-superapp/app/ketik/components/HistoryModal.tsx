'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, History, Trash2, ChevronRight, MessageSquare, Calendar } from 'lucide-react';
import { ChatSession } from '../../types';

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
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-2xl bg-card border border-border rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        <header className="p-8 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-foreground/5 rounded-xl flex items-center justify-center">
              <History className="w-5 h-5 text-blue-500 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Riwayat Simulasi</h2>
              <p className="text-xs text-foreground/40">Tinjau kembali percakapan sebelumnya.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button 
                onClick={() => { if(confirm('Hapus semua riwayat?')) onClear(); }}
                className="p-2 hover:bg-red-500/10 text-red-500 rounded-full transition-colors"
                title="Hapus Semua"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-foreground/5 rounded-full transition-colors">
              <X className="w-5 h-5 text-foreground/60" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {history.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center opacity-20 text-foreground">
              <History className="w-16 h-16 mb-4" />
              <p className="text-sm italic">Belum ada riwayat simulasi.</p>
            </div>
          ) : (
            history.map((session) => (
              <motion.div 
                key={session.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="group relative bg-foreground/[0.02] border border-border hover:border-foreground/20 rounded-2xl p-6 transition-all cursor-pointer"
                onClick={() => onReview(session)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-foreground">{session.scenarioTitle}</h3>
                      <div className="flex items-center gap-2 text-[10px] text-foreground/40 mt-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(session.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(session.id); }}
                    className="p-2 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-red-500 rounded-lg transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex gap-4">
                    <div className="space-y-1">
                      <div className="text-[9px] uppercase tracking-widest text-foreground/20 font-bold">Konsumen</div>
                      <div className="text-xs font-medium text-foreground">{session.consumerName}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[9px] uppercase tracking-widest text-foreground/20 font-bold">Pesan</div>
                      <div className="text-xs font-medium text-foreground">{session.messages.length} Chat</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-foreground/20 group-hover:text-foreground/60 transition-colors" />
                </div>
              </motion.div>
            ))
          )}
        </div>

        <footer className="p-8 border-t border-border bg-foreground/[0.02] text-center">
          <p className="text-[10px] text-foreground/20 uppercase tracking-[0.2em]">Data disimpan secara lokal di browser Anda</p>
        </footer>
      </motion.div>
    </div>
  );
};
