'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Reply, 
  Trash2, 
  Paperclip, 
  X, 
  ChevronDown, 
  ChevronUp,
  AlertCircle,
  Loader2,
  RotateCcw
} from 'lucide-react';
import { PdktMailboxItem, EvaluationResult, EvaluationStatus } from '../types';

interface EmailDetailPaneProps {
  item: PdktMailboxItem;
  onReply: () => void;
  onDelete: () => void;
  onRetryEval?: () => void;
  evaluation: EvaluationResult | null;
  evaluationStatus: EvaluationStatus | null;
  evaluationError: string | null;
  timeTaken: number | null;
  isLoading: boolean;
}

export const EmailDetailPane: React.FC<EmailDetailPaneProps> = ({
  item,
  onReply,
  onDelete,
  onRetryEval,
  evaluation,
  evaluationStatus,
  evaluationError,
  timeTaken,
  isLoading
}) => {
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const formatEmailDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('id-ID', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs} detik`;
    return `${mins} menit ${secs} detik`;
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const historyEmails = item.emails_thread.slice(1);
  const isEvaluationProcessing = evaluationStatus === 'processing';
  const isEvaluationFailed = evaluationStatus === 'failed';

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-background relative h-full">
      {/* Zoomed Image Modal */}
      <AnimatePresence>
        {zoomedImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4 cursor-pointer"
            onClick={() => setZoomedImage(null)}
          >
            <motion.img 
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              src={zoomedImage} 
              alt="Zoomed Attachment" 
              className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain ring-1 ring-white/10" 
            />
            <button className="absolute top-6 right-6 text-white/80 hover:text-white transition-colors">
              <X className="w-8 h-8" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pane Header */}
      <div className="px-6 py-3 border-b border-border/50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
              Detail Email
            </span>
            {item.status === 'replied' && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-wide">
                  Telah Dibalas
                </span>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {item.status === 'open' && (
            <button
              onClick={onReply}
              className="p-2 text-module-pdkt hover:bg-module-pdkt/10 rounded-xl transition-all"
              title="Balas"
            >
              <Reply className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onDelete}
            className="p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-xl transition-all"
            title="Hapus"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Pane Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-3xl mx-auto px-6 py-8">
          {/* Subject */}
          <h2 className={`text-2xl md:text-3xl leading-tight mb-8 ${item.subject ? 'font-black text-foreground' : 'font-bold text-muted-foreground/40'}`}>
            {item.subject || '(Tanpa Subjek)'}
          </h2>

          {/* Sender Info */}
          <div className="flex items-start gap-4 mb-8">
            <div className="shrink-0 w-12 h-12 rounded-2xl bg-module-pdkt/10 border border-module-pdkt/20 flex items-center justify-center text-sm font-black text-module-pdkt shadow-sm">
              {getInitials(item.sender_name)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4 mb-1">
                <div className="min-w-0">
                  <div className="text-sm font-black text-foreground truncate">
                    {item.sender_name}
                  </div>
                  <div className="text-xs text-muted-foreground truncate opacity-70">
                    {item.sender_email}
                  </div>
                </div>
                <div className="text-[10px] font-bold text-muted-foreground whitespace-nowrap bg-foreground/5 px-2 py-1 rounded-lg">
                  {formatEmailDate(item.created_at)}
                </div>
              </div>
              <div className="text-[10px] text-muted-foreground opacity-60">
                Kepada: <span className="text-foreground font-medium">konsumen@ojk.go.id</span>
              </div>
            </div>
          </div>

          {/* Email Body */}
          <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed text-justify mb-8 font-medium">
            {item.inbound_email.body}
          </div>

          {/* Attachments */}
          {item.inbound_email.attachments && item.inbound_email.attachments.length > 0 && (
            <div className="mb-8 p-4 rounded-2xl border border-border bg-foreground/[0.02]">
              <div className="flex items-center gap-2 mb-4">
                <Paperclip className="w-4 h-4 text-muted-foreground" />
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                  Lampiran ({item.inbound_email.attachments.length})
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {item.inbound_email.attachments.map((base64, i) => (
                  <motion.div 
                    key={i}
                    whileHover={{ scale: 1.02 }}
                    className="relative aspect-square rounded-xl overflow-hidden border border-border bg-foreground/5 cursor-pointer shadow-sm group"
                    onClick={() => setZoomedImage(`data:image/png;base64,${base64}`)}
                  >
                    <Image 
                      src={`data:image/png;base64,${base64}`} 
                      alt={`Attachment ${i + 1}`}
                      fill
                      className="object-cover group-hover:opacity-90 transition-opacity"
                      unoptimized
                    />
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Evaluation Results (if replied) */}
          {item.status === 'replied' && (
            <div className="mt-12 pt-8 border-t border-border/50">
              {isLoading || isEvaluationProcessing ? (
                <div className="flex flex-col items-center justify-center p-8 bg-module-pdkt/5 rounded-2xl border border-module-pdkt/10">
                  <Loader2 className="w-8 h-8 text-module-pdkt animate-spin mb-3" />
                  <p className="text-xs font-black text-module-pdkt uppercase tracking-widest animate-pulse">
                    Menganalisis Jawaban...
                  </p>
                </div>
              ) : isEvaluationFailed ? (
                <div className="p-6 rounded-2xl border border-destructive/20 bg-destructive/5">
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-destructive" />
                      <h3 className="text-xs font-black text-destructive uppercase tracking-widest">Evaluasi Gagal</h3>
                    </div>
                    <button 
                      onClick={onRetryEval}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-[9px] font-black uppercase tracking-widest hover:bg-destructive/20 transition-all"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Coba Lagi
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                    {evaluationError || 'Terjadi gangguan saat memproses evaluasi AI.'}
                  </p>
                </div>
              ) : evaluation ? (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-black text-foreground uppercase tracking-widest">Hasil Evaluasi</h3>
                      <p className="text-[10px] text-muted-foreground font-bold mt-1">
                        Selesai dikerjakan dalam <span className="text-foreground">{timeTaken ? formatTime(timeTaken) : '-'}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-module-pdkt/10 border border-module-pdkt/20">
                      <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Skor</span>
                      <span className="text-2xl font-black text-module-pdkt">{evaluation.score}%</span>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="p-5 rounded-2xl border border-destructive/10 bg-destructive/5">
                      <h4 className="text-[9px] font-black text-destructive uppercase tracking-widest mb-3">
                        Typo / Salah Ketik
                      </h4>
                      {evaluation.typos.length > 0 ? (
                        <ul className="space-y-2">
                          {evaluation.typos.map((item, idx) => (
                            <li key={idx} className="text-xs text-muted-foreground font-medium">
                              • {item}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-muted-foreground italic font-medium opacity-60">Tidak ditemukan typo.</p>
                      )}
                    </div>

                    <div className="p-5 rounded-2xl border border-border bg-foreground/[0.02]">
                      <h4 className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-3">
                        Kejelasan Kalimat
                      </h4>
                      {evaluation.clarityIssues.length > 0 ? (
                        <ul className="space-y-2">
                          {evaluation.clarityIssues.map((item, idx) => (
                            <li key={idx} className="text-xs text-muted-foreground font-medium">
                              • {item}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-muted-foreground italic font-medium opacity-60">Kalimat sudah jelas.</p>
                      )}
                    </div>

                    <div className="p-5 rounded-2xl border border-module-pdkt/10 bg-module-pdkt/5">
                      <h4 className="text-[9px] font-black text-module-pdkt uppercase tracking-widest mb-3">
                        Relevansi Solusi
                      </h4>
                      {evaluation.contentGaps.length > 0 ? (
                        <ul className="space-y-2">
                          {evaluation.contentGaps.map((item, idx) => (
                            <li key={idx} className="text-xs text-muted-foreground font-medium">
                              • {item}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-muted-foreground italic font-medium opacity-60">Jawaban relevan.</p>
                      )}
                    </div>

                    <div className="p-5 rounded-2xl border border-border bg-foreground/[0.02]">
                      <h4 className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-3">Masukan</h4>
                      <p className="text-xs text-muted-foreground italic font-medium leading-relaxed opacity-80">
                        &quot;{evaluation.feedback}&quot;
                      </p>
                    </div>
                  </div>
                </motion.div>
              ) : null}

              {/* Thread History */}
              {historyEmails.length > 0 && (
                <div className="mt-8">
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="flex items-center gap-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest hover:text-foreground transition-colors mb-4"
                  >
                    Riwayat Percakapan ({historyEmails.length})
                    {showHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  
                  <AnimatePresence>
                    {showHistory && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden space-y-4"
                      >
                        {historyEmails.map((email, idx) => (
                          <div key={idx} className="pl-6 border-l-2 border-border/30 py-2">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] font-black text-foreground uppercase">
                                {email.isAgent ? 'Balasan Anda' : email.from}
                              </span>
                              <span className="text-[9px] text-muted-foreground font-bold">
                                {formatEmailDate(email.timestamp.toString())}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                              {email.body}
                            </p>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Reply Button (Floating or Bottom) */}
      {item.status === 'open' && !isLoading && (
        <div className="p-6 border-t border-border/50 shrink-0 bg-background">
          <button
            onClick={onReply}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-module-pdkt text-white font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-module-pdkt/20 hover:bg-module-pdkt/90 transition-all"
          >
            <Reply className="w-4 h-4" />
            Tulis Balasan
          </button>
        </div>
      )}
    </div>
  );
};
