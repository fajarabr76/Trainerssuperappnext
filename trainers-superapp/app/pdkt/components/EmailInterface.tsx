'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mail, 
  Send, 
  Reply, 
  ArrowLeft,
  User,
  Clock,
  Info,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  X,
  Paperclip,
  Search,
  Star,
  Archive,
  Trash2,
  MoreVertical
} from 'lucide-react';
import { EmailMessage, SessionConfig, EvaluationResult } from '../types';

interface EmailInterfaceProps {
  emails: EmailMessage[];
  onSendReply: (text: string) => void;
  isLoading: boolean;
  config: SessionConfig;
  onEndSession: () => void;
  evaluation: EvaluationResult | null;
  timeTaken: number | null;
}

const FraudWarning = () => (
  <div className="flex justify-center my-4">
    <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 max-w-lg">
      <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
      <p className="text-xs text-red-600 dark:text-red-200/80 leading-relaxed">
        <strong className="text-red-500 dark:text-red-400">Peringatan Penipuan:</strong> Konsumen mungkin mencoba memancing data pribadi atau melakukan penipuan. Tetap waspada dan jangan berikan informasi sensitif.
      </p>
    </div>
  </div>
);

export const EmailInterface: React.FC<EmailInterfaceProps> = ({ 
  emails, 
  onSendReply, 
  isLoading, 
  config, 
  onEndSession, 
  evaluation, 
  timeTaken 
}) => {
  const [replyText, setReplyText] = useState('');
  const [isDrafting, setIsDrafting] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [emails, isDrafting, evaluation]);

  const handleSend = () => {
    if (!replyText.trim()) return;
    onSendReply(replyText);
    setReplyText('');
    setIsDrafting(false);
  };

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

  const getInitials = (name: string) => name.substring(0, 2).toUpperCase();

  const latestSubject = emails.length > 0 
    ? emails[emails.length - 1].subject 
    : (isLoading ? "Tiket Baru Masuk..." : "No Subject");
    
  const hasAgentReplied = emails.some(e => e.isAgent);

  return (
    <div className="flex flex-col h-full bg-background text-foreground transition-colors duration-300 relative">
      
      {/* Zoomed Image Modal */}
      <AnimatePresence>
        {zoomedImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
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
            <button className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors">
              <X className="w-8 h-8" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="p-4 md:p-6 border-b border-border flex items-center justify-between bg-card/80 backdrop-blur-xl z-20 shrink-0">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <button 
            onClick={onEndSession}
            className="p-2 hover:bg-foreground/5 rounded-full transition-colors shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex flex-col flex-1 min-w-0">
            <h1 className="text-lg font-bold truncate tracking-tight">
              {latestSubject}
            </h1>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                Inbox • {config.consumerType.name}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3 ml-4 shrink-0">
          {timeTaken !== null && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-foreground/5 rounded-full border border-border">
              <Clock className="w-3 h-3 text-pink-500" />
              <span className="text-xs font-mono">{formatTime(timeTaken)}</span>
            </div>
          )}
          <button 
            onClick={onEndSession}
            className="bg-foreground/5 text-foreground/80 px-4 py-2 rounded-xl text-xs font-bold hover:bg-foreground/10 border border-border transition-all flex items-center gap-2"
          >
            Tutup Tiket
          </button>
        </div>
      </header>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 bg-background">
        <div className="max-w-4xl mx-auto space-y-8 pb-32">
          
          {/* System Info */}
          <div className="flex justify-center">
            <div className="px-4 py-2 bg-foreground/5 rounded-full border border-border/50 flex items-center gap-2">
              <Info className="w-3 h-3 text-pink-500" />
              <span className="text-[10px] text-muted-foreground font-medium">Simulasi email dimulai. Balas dengan format formal dan profesional.</span>
            </div>
          </div>

          <FraudWarning />

          {/* Conversation History */}
          <div className="space-y-8">
            {emails.map((email, idx) => (
              <motion.div 
                key={email.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`flex w-full ${email.isAgent ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex flex-col w-full max-w-[95%] md:max-w-[85%]`}>
                  <div className={`rounded-3xl border p-6 md:p-8 shadow-sm bg-card border-border ${email.isAgent ? 'rounded-tr-xl' : 'rounded-tl-xl'}`}>
                    
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 border-b border-border/50 pb-5">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg shadow-inner ${
                          email.isAgent 
                            ? 'bg-foreground text-background' 
                            : 'bg-pink-500 text-white'
                        }`}>
                          {email.isAgent ? 'CS' : getInitials(config.identity.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-foreground text-base tracking-tight truncate">
                            {email.isAgent ? 'Customer Service (Anda)' : config.identity.name}
                          </div>
                          <div className="text-xs text-muted-foreground truncate mt-0.5">
                            {email.isAgent ? 'cc.ojk@ojk.go.id' : email.from}
                          </div>
                        </div>
                      </div>
                      <div className="text-[10px] font-medium text-muted-foreground whitespace-nowrap text-left sm:text-right font-mono">
                        <div>{safeDate(email.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                        <div className="mt-0.5">{safeDate(email.timestamp).toLocaleDateString()}</div>
                      </div>
                    </div>

                    <div className="mb-6">
                      <h3 className="text-lg font-bold text-foreground leading-snug">
                        {email.subject}
                      </h3>
                    </div>

                    <div className="text-sm text-foreground/80 whitespace-pre-wrap font-sans leading-relaxed">
                      {email.body}
                    </div>

                    {/* Attachments */}
                    {email.attachments && email.attachments.length > 0 && (
                      <div className="mt-8 pt-8 border-t border-border/50">
                        <div className="flex items-center gap-2 mb-4">
                          <Paperclip className="w-4 h-4 text-muted-foreground" />
                          <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Lampiran ({email.attachments.length})</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                          {email.attachments.map((base64, i) => (
                            <motion.div 
                              key={i}
                              whileHover={{ scale: 1.02 }}
                              className="relative aspect-square rounded-2xl overflow-hidden border border-border bg-foreground/5 group cursor-zoom-in"
                              onClick={() => window.open(`data:image/png;base64,${base64}`, '_blank')}
                            >
                              <Image 
                                src={`data:image/png;base64,${base64}`} 
                                alt={`Attachment ${i + 1}`}
                                fill
                                className="object-cover"
                                unoptimized
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                <Search className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {isLoading && (
            <div className="flex flex-col items-center justify-center p-10 bg-foreground/5 backdrop-blur-sm rounded-3xl border-2 border-dashed border-border">
              <div className="relative w-12 h-12 mb-6">
                <div className="absolute inset-0 border-4 border-pink-500/20 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
              <p className="text-muted-foreground font-bold text-[10px] uppercase tracking-widest">
                {emails.length === 0 ? "Sedang memeriksa email..." : "Sedang Mengecek Jawaban..."}
              </p>
            </div>
          )}

          {/* Evaluation Result */}
          {evaluation && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-card border-2 border-pink-500/30 rounded-[2.5rem] overflow-hidden shadow-2xl"
            >
              <div className="bg-gradient-to-r from-pink-500 to-rose-500 p-6 text-white flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold">Hasil Evaluasi</h3>
                  <p className="text-xs text-white/70">Analisis performa balasan Anda.</p>
                </div>
                <div className="flex items-center gap-3 bg-black/20 px-5 py-2 rounded-2xl backdrop-blur-md border border-white/10">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">Skor</span>
                  <span className="text-3xl font-black tracking-tighter">{evaluation.score}%</span>
                </div>
              </div>
              
              <div className="p-8 grid gap-8 md:grid-cols-2">
                <div className="space-y-6">
                  <div className="bg-rose-500/5 p-5 rounded-2xl border border-rose-500/10">
                    <h4 className="font-bold text-rose-500 text-xs mb-3 flex items-center gap-2 uppercase tracking-widest">
                      <AlertCircle className="w-4 h-4" /> Typo / Salah Ketik
                    </h4>
                    {evaluation.typos.length > 0 ? (
                      <ul className="space-y-2">
                        {evaluation.typos.map((item, idx) => (
                          <li key={idx} className="text-xs text-muted-foreground flex gap-2">
                            <span className="text-rose-500">•</span> {item}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">Tidak ditemukan typo.</p>
                    )}
                  </div>

                  <div className="bg-amber-500/5 p-5 rounded-2xl border border-amber-500/10">
                    <h4 className="font-bold text-amber-500 text-xs mb-3 flex items-center gap-2 uppercase tracking-widest">
                      <Info className="w-4 h-4" /> Kejelasan Kalimat
                    </h4>
                    {evaluation.clarityIssues.length > 0 ? (
                      <ul className="space-y-2">
                        {evaluation.clarityIssues.map((item, idx) => (
                          <li key={idx} className="text-xs text-muted-foreground flex gap-2">
                            <span className="text-amber-500">•</span> {item}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">Kalimat sudah jelas & efektif.</p>
                    )}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-blue-500/5 p-5 rounded-2xl border border-blue-500/10">
                    <h4 className="font-bold text-blue-500 text-xs mb-3 flex items-center gap-2 uppercase tracking-widest">
                      <CheckCircle2 className="w-4 h-4" /> Relevansi & Solusi
                    </h4>
                    {evaluation.contentGaps.length > 0 ? (
                      <ul className="space-y-2">
                        {evaluation.contentGaps.map((item, idx) => (
                          <li key={idx} className="text-xs text-muted-foreground flex gap-2">
                            <span className="text-blue-500">•</span> {item}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">Jawaban relevan & solutif.</p>
                    )}
                  </div>

                  <div className="bg-foreground/5 p-5 rounded-2xl border border-border">
                    <h4 className="font-bold text-muted-foreground text-[10px] mb-3 uppercase tracking-widest">Masukan & Saran</h4>
                    <p className="text-sm text-foreground/60 italic leading-relaxed">&quot;{evaluation.feedback}&quot;</p>
                  </div>
                </div>
              </div>

              <div className="p-8 border-t border-border flex justify-center">
                <button 
                  onClick={onEndSession}
                  className="bg-foreground text-background px-10 py-4 rounded-2xl font-bold text-sm hover:opacity-90 transition-all shadow-xl"
                >
                  Selesaikan Sesi
                </button>
              </div>
            </motion.div>
          )}
          
          <div ref={bottomRef} className="h-4" />
        </div>
      </div>

      {/* Reply Section */}
      <div className={`p-4 md:p-6 sticky bottom-0 z-30 transition-all duration-300 ${
        evaluation ? 'bg-transparent' : 'bg-card/80 backdrop-blur-xl border-t border-border'
      }`}>
        {!hasAgentReplied && !evaluation ? (
          !isDrafting ? (
            <button 
              onClick={() => setIsDrafting(true)}
              disabled={isLoading}
              className="flex items-center gap-3 text-muted-foreground border-2 border-dashed border-border rounded-2xl px-6 py-4 w-full hover:bg-foreground/5 hover:border-pink-500/50 transition-all bg-card"
            >
              <Reply className="w-5 h-5" />
              <span className="font-medium text-sm">Balas Email...</span>
            </button>
          ) : (
            <div className="bg-card rounded-3xl shadow-2xl border border-border overflow-hidden">
              <div className="flex items-center justify-between p-3 bg-foreground/5 border-b border-border">
                <span className="text-[10px] font-bold text-muted-foreground pl-3 uppercase tracking-widest">
                  Balas ke: <span className="text-foreground">{config.identity.name}</span>
                </span>
                <button 
                  onClick={() => setIsDrafting(false)} 
                  className="p-1.5 hover:bg-foreground/10 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="w-full h-48 p-6 outline-none text-foreground bg-transparent resize-none font-sans text-sm leading-relaxed"
                placeholder="Tulis balasan Anda di sini..."
                autoFocus
              />
              <div className="p-4 bg-foreground/5 flex justify-end items-center border-t border-border">
                <button 
                  onClick={handleSend}
                  disabled={!replyText.trim() || isLoading}
                  className="bg-pink-500 hover:bg-pink-400 text-white px-8 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-pink-500/20 flex items-center gap-2 disabled:opacity-50 transition-all"
                >
                  {isLoading ? "Mengirim..." : "Kirim & Cek"}
                  {!isLoading && <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )
        ) : (
          <div className="text-center p-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {evaluation ? "Tiket telah dievaluasi" : "Menunggu evaluasi..."}
          </div>
        )}
      </div>
    </div>
  );
};
