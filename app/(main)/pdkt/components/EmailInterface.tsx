'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import ScenarioImage from './ScenarioImage';
import { getImageDataUri } from '../utils/detectMimeType';
import { ReplyComposer } from './ReplyComposer';
import { 
  Reply, 
  ArrowLeft,
  Clock,
  AlertCircle,
  Loader2,
  X,
  Paperclip,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { EmailMessage, SessionConfig, EvaluationResult, EvaluationStatus } from '../types';

interface EmailInterfaceProps {
  emails: EmailMessage[];
  onSendReply: (text: string) => void;
  isLoading: boolean;
  config: SessionConfig;
  onEndSession: () => void;
  evaluation: EvaluationResult | null;
  evaluationStatus: EvaluationStatus | null;
  evaluationError: string | null;
  timeTaken: number | null;
}

export const EmailInterface: React.FC<EmailInterfaceProps> = ({ 
  emails, 
  onSendReply, 
  isLoading, 
  config, 
  onEndSession, 
  evaluation, 
  evaluationStatus,
  evaluationError,
  timeTaken 
}) => {
  const [isDrafting, setIsDrafting] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [emails, isDrafting, evaluation]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs} detik`;
    return `${mins} menit ${secs} detik`;
  };

  const safeDate = (val: any): Date => {
    if (!val) return new Date();
    const d = new Date(val);
    return isNaN(d.getTime()) ? new Date() : d;
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const firstInboundEmail = emails.find((email) => !email.isAgent) ?? emails[0];
  const hasAgentReplied = emails.some(e => e.isAgent);
  const isEvaluationProcessing = evaluationStatus === 'processing';
  const isEvaluationFailed = evaluationStatus === 'failed';

  const historyEmails = emails.slice(1);

  const formatEmailDate = (date: Date) => {
    return safeDate(date).toLocaleDateString('id-ID', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div data-module="pdkt" className="module-clean-app flex flex-col h-full bg-background text-foreground transition-colors duration-300 relative">
      
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

      {/* Top Bar */}
      <header className="module-clean-toolbar px-4 md:px-6 py-3 border-b flex items-center justify-between z-50 shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button 
            onClick={onEndSession}
            className="module-clean-button-secondary w-10 h-10 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex flex-col flex-1 min-w-0">
            <h1 className="text-base font-semibold truncate text-foreground">
              Simulasi Email
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full module-clean-chip">
                <span className="w-1.5 h-1.5 bg-module-pdkt rounded-full animate-pulse" />
                <span className="text-[9px] font-medium text-module-pdkt uppercase tracking-wide">
                  {isEvaluationProcessing ? 'Evaluasi Berjalan' : isEvaluationFailed ? 'Evaluasi Gagal' : 'Aktif'}
                </span>
              </div>
              {timeTaken !== null && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span className="text-[9px] font-medium">{formatTime(timeTaken)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 ml-4 shrink-0">
          <button 
            onClick={onEndSession}
            className="module-clean-button-secondary px-3 py-2 rounded-lg text-[9px] font-medium uppercase tracking-wide transition-all"
          >
            Tutup
          </button>
        </div>
      </header>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto bg-background">
        <div className="max-w-3xl mx-auto">
          
          {/* Main Email Detail View */}
          {firstInboundEmail && (
            <div className="border-b border-border/50">
              {/* Subject Header */}
              <div className="px-4 md:px-6 pt-4 pb-3">
                <h2 className={`text-base md:text-lg leading-snug ${firstInboundEmail.subject ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground/60'}`}>
                  {firstInboundEmail.subject || 'Tanpa Subjek'}
                </h2>
              </div>

              {/* Sender Metadata */}
              <div className="px-4 md:px-6 pb-4">
                <div className="flex items-start gap-3">
                  <div className="shrink-0 w-10 h-10 rounded-full bg-module-pdkt/10 border border-module-pdkt/20 flex items-center justify-center">
                    <span className="text-xs font-semibold text-module-pdkt">
                      {getInitials(firstInboundEmail.from)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">
                          {config.identity.name}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {firstInboundEmail.from}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatEmailDate(firstInboundEmail.timestamp)}
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground/60 w-14 shrink-0">Dari</span>
                        <span className="text-foreground truncate">{firstInboundEmail.from}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground/60 w-14 shrink-0">Kepada</span>
                        <span className="text-foreground truncate">{firstInboundEmail.to || config.identity.email}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground/60 w-14 shrink-0">Cc</span>
                        <span className="text-muted-foreground truncate">-</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Email Body */}
              <div className="px-4 md:px-6 pb-5">
                <div className="text-[13px] text-foreground leading-relaxed space-y-3">
                  {firstInboundEmail.body.split(/\n\s*\n/).map((paragraph, idx) => (
                    <p key={idx} className="whitespace-pre-wrap text-justify">
                      {paragraph.trim()}
                    </p>
                  ))}
                </div>
              </div>

              {/* Attachments */}
              {firstInboundEmail.attachments && firstInboundEmail.attachments.length > 0 && (
                <div className="px-4 md:px-6 pb-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">
                      Lampiran ({firstInboundEmail.attachments.length})
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {firstInboundEmail.attachments.map((base64, i) => (
                      <ScenarioImage
                        key={i}
                        variant="grid"
                        base64={base64}
                        alt={`Attachment ${i + 1}`}
                        onClick={() => setZoomedImage(getImageDataUri(base64))}
                        className="cursor-pointer"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Reply Action */}
              {!hasAgentReplied && !evaluation && (
                <div className="px-4 md:px-6 pb-4">
                  <button 
                    onClick={() => setIsDrafting(true)}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border hover:border-module-pdkt/50 hover:bg-module-pdkt/5 text-muted-foreground hover:text-module-pdkt transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Reply className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium">Balas</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* History Toggle */}
          {historyEmails.length > 0 && (
            <div className="border-b border-border/50">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="w-full flex items-center justify-between px-4 md:px-6 py-3 text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className="text-xs font-medium uppercase tracking-wide">
                  Riwayat ({historyEmails.length})
                </span>
                {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              
              <AnimatePresence>
                {showHistory && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 md:px-6 pb-4 space-y-4">
                      {historyEmails.map((email) => (
                        <div key={email.id} className="border-l-2 border-border/30 pl-4 py-2">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="min-w-0">
                              <div className="text-xs font-medium text-foreground truncate">
                                {email.isAgent ? 'Anda' : email.from}
                              </div>
                              <div className="text-[10px] text-muted-foreground truncate">
                                {email.subject || 'Tanpa Subjek'}
                              </div>
                            </div>
                            <div className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {formatEmailDate(email.timestamp)}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground whitespace-pre-wrap text-justify">
                            {email.body}
                          </div>
                          {email.attachments && email.attachments.length > 0 && (
                            <div className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground">
                              <Paperclip className="w-3 h-3" />
                              <span>{email.attachments.length} lampiran</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center p-12">
              <Loader2 className="w-8 h-8 text-module-pdkt animate-spin mb-3" />
              <p className="text-muted-foreground text-xs font-medium">
                {emails.length === 0 ? "Menerima Email Masuk..." : "Memproses..."}
              </p>
            </div>
          )}

          {/* Evaluation Processing */}
          {!isLoading && isEvaluationProcessing && (
            <div className="flex flex-col items-center justify-center p-10">
              <Loader2 className="w-6 h-6 text-module-pdkt animate-spin mb-3" />
              <p className="text-module-pdkt text-xs font-medium">
                Evaluasi sedang diproses
              </p>
              <p className="text-muted-foreground text-xs text-center mt-2 max-w-sm">
                Riwayat email sudah tersimpan. Hasil evaluasi akan muncul otomatis saat selesai.
              </p>
            </div>
          )}

          {/* Evaluation Failed */}
          {!isLoading && isEvaluationFailed && (
            <div className="p-6 mx-4 md:mx-6 my-4 rounded-lg border border-destructive/20 bg-destructive/5">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-destructive" />
                <h3 className="text-sm font-medium text-destructive">Evaluasi belum berhasil</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                {evaluationError || 'Terjadi gangguan saat menjalankan evaluasi AI untuk sesi ini.'}
              </p>
            </div>
          )}

          {/* Evaluation Result */}
          {evaluation && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="border-t border-border/50"
            >
              <div className="bg-module-pdkt/5 px-4 md:px-6 py-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Hasil Evaluasi</h3>
                  <p className="text-xs text-muted-foreground">Analisis performa balasan Anda.</p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-module-pdkt/10 border border-module-pdkt/20">
                  <span className="text-[9px] font-medium text-muted-foreground uppercase">Skor</span>
                  <span className="text-lg font-semibold text-module-pdkt">{evaluation.score}%</span>
                </div>
              </div>
              
              <div className="px-4 md:px-6 py-5 grid gap-5 md:grid-cols-2">
                <div className="space-y-4">
                  <div className="p-4 rounded-lg border border-destructive/10 bg-destructive/5">
                    <h4 className="text-[10px] font-medium text-destructive uppercase tracking-wide mb-2">
                      Typo / Salah Ketik
                    </h4>
                    {evaluation.typos.length > 0 ? (
                      <ul className="space-y-1.5">
                        {evaluation.typos.map((item, idx) => (
                          <li key={idx} className="text-xs text-muted-foreground">
                            • {item}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">Tidak ditemukan typo.</p>
                    )}
                  </div>

                  <div className="module-clean-panel p-4 rounded-lg">
                    <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
                      Kejelasan Kalimat
                    </h4>
                    {evaluation.clarityIssues.length > 0 ? (
                      <ul className="space-y-1.5">
                        {evaluation.clarityIssues.map((item, idx) => (
                          <li key={idx} className="text-xs text-muted-foreground">
                            • {item}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">Kalimat sudah jelas & efektif.</p>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-4 rounded-lg border border-module-pdkt/10 bg-module-pdkt/5">
                    <h4 className="text-[10px] font-medium text-module-pdkt uppercase tracking-wide mb-2">
                      Relevansi & Solusi
                    </h4>
                    {evaluation.contentGaps.length > 0 ? (
                      <ul className="space-y-1.5">
                        {evaluation.contentGaps.map((item, idx) => (
                          <li key={idx} className="text-xs text-muted-foreground">
                            • {item}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">Jawaban relevan & solutif.</p>
                    )}
                  </div>

                  <div className="module-clean-panel p-4 rounded-lg">
                    <h4 className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide mb-2">Masukan & Saran</h4>
                    <p className="text-xs text-muted-foreground italic leading-relaxed">&quot;{evaluation.feedback}&quot;</p>
                  </div>
                </div>
              </div>

              <div className="px-4 md:px-6 py-4 border-t border-border/50 flex justify-center">
                <button 
                  onClick={onEndSession}
                  className="bg-foreground text-background px-6 py-2.5 rounded-lg font-medium text-sm hover:opacity-90 transition-all"
                >
                  Selesaikan Sesi
                </button>
              </div>
            </motion.div>
          )}
          
          <div ref={bottomRef} className="h-2" />
        </div>
      </div>

      {/* Reply Composer */}
      <AnimatePresence>
        {isDrafting && !evaluation && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="z-30 shrink-0"
          >
            <ReplyComposer
              recipient={firstInboundEmail?.from || '-'}
              subject={firstInboundEmail?.subject || ''}
              onSend={(text) => { onSendReply(text); setIsDrafting(false); }}
              onClose={() => setIsDrafting(false)}
              isLoading={isLoading}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reply Prompt (when not drafting) */}
      {!isDrafting && !hasAgentReplied && !evaluation && !isLoading && (
        <div className="module-clean-toolbar border-t z-30 shrink-0 px-4 md:px-6 py-3">
          <button 
            onClick={() => setIsDrafting(true)}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border/60 hover:border-module-pdkt/50 hover:bg-module-pdkt/5 text-muted-foreground hover:text-module-pdkt transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Reply className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">Balas</span>
          </button>
        </div>
      )}

      {/* Post-reply Status */}
      {(hasAgentReplied || evaluation) && !isDrafting && (
        <div className="module-clean-toolbar border-t z-30 shrink-0 px-4 md:px-6 py-3">
          <div className="text-center text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
            {evaluation ? "Tiket telah dievaluasi" : isEvaluationFailed ? "Evaluasi gagal diproses" : "Menunggu evaluasi..."}
          </div>
        </div>
      )}
    </div>
  );
};
