'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Phone, Calendar, Clock, Star, MessageSquare, Download, FileText, User } from 'lucide-react';

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

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: CallRecord | null;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({ isOpen, onClose, record }) => {
  return (
    <AnimatePresence>
      {isOpen && record && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 md:p-6">
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
            <div className="p-6 border-b border-border flex items-center justify-between shrink-0 bg-foreground/[0.02]">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20">
                  <Phone className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-foreground leading-tight">
                    {record.scenarioTitle}
                  </h2>
                  <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">
                    Detail Sesi
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-foreground/5 rounded-full transition-colors border border-border"
              >
                <X className="w-6 h-6 text-muted-foreground" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-foreground/[0.02] border border-border rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="w-4 h-4 text-emerald-600/60 dark:text-emerald-400/60" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Konsumen</span>
                  </div>
                  <p className="text-sm font-bold text-foreground">{record.consumerName}</p>
                </div>

                <div className="bg-foreground/[0.02] border border-border rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-4 h-4 text-emerald-600/60 dark:text-emerald-400/60" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Tanggal</span>
                  </div>
                  <p className="text-sm font-bold text-foreground">
                    {new Date(record.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(record.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>

                <div className="bg-foreground/[0.02] border border-border rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-emerald-600/60 dark:text-emerald-400/60" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Durasi</span>
                  </div>
                  <p className="text-sm font-bold text-foreground">{formatDuration(record.duration)}</p>
                </div>

                <div className="bg-foreground/[0.02] border border-border rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Star className="w-4 h-4 text-emerald-600/60 dark:text-emerald-400/60" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Skor</span>
                  </div>
                  <p className="text-sm font-bold text-foreground">
                    {record.score != null ? `${record.score}/100` : '—'}
                  </p>
                </div>
              </div>

              {/* Feedback */}
              {record.feedback && (
                <div className="bg-foreground/[0.02] border border-border rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="w-4 h-4 text-emerald-600/60 dark:text-emerald-400/60" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Feedback</span>
                  </div>
                  <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                    {record.feedback}
                  </p>
                </div>
              )}

              {/* Recording */}
              <div className="bg-foreground/[0.02] border border-border rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Download className="w-4 h-4 text-emerald-600/60 dark:text-emerald-400/60" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Rekaman</span>
                </div>
                {record.url && (record.url.startsWith('http') || record.url.startsWith('https')) ? (
                  <div className="space-y-3">
                    <audio controls className="w-full h-10" src={record.url}>
                      Browser Anda tidak mendukung pemutaran audio.
                    </audio>
                    <a
                      href={record.url}
                      download={`Telefun_${record.consumerName}_${record.id}.webm`}
                      className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10 rounded-xl border border-emerald-500/10 transition-all"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Unduh Rekaman
                    </a>
                  </div>
                ) : record.url ? (
                  <a
                    href={record.url}
                    download={`Telefun_${record.consumerName}_${record.id}.webm`}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10 rounded-xl border border-emerald-500/10 transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Unduh Rekaman
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground">Rekaman tidak tersedia.</p>
                )}
              </div>

              {/* Transcript */}
              <div className="bg-foreground/[0.02] border border-border rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-amber-500/60" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Transkrip</span>
                </div>
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <FileText className="w-10 h-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">
                    Transkrip belum tersedia
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-1 max-w-sm">
                    Fitur transkrip otomatis untuk sesi Telefun akan hadir di pembaruan mendatang. Untuk saat ini, Anda dapat memutar ulang rekaman audio di atas.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
