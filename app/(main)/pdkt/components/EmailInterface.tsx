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

      {/* Premium Header */}
      <header className="px-8 py-6 border-b border-border/50 flex items-center justify-between bg-card/40 backdrop-blur-3xl z-50 shrink-0 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent pointer-events-none" />
        
        <div className="flex items-center gap-6 flex-1 min-w-0 relative z-10">
          <button 
            onClick={onEndSession}
            className="w-12 h-12 flex items-center justify-center rounded-2xl bg-foreground/5 text-foreground/40 hover:text-foreground hover:bg-foreground/10 transition-all border border-transparent hover:border-border/50 group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          </button>
          <div className="flex flex-col flex-1 min-w-0">
            <h1 className="text-2xl font-black truncate tracking-tighter text-foreground">
              {latestSubject}
            </h1>
            <div className="flex items-center gap-4 mt-1.5">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Active Ticket</span>
              </div>
              <div className="flex items-center gap-3 bg-foreground/5 px-3 py-1 rounded-full border border-border/50">
                <span className="text-[10px] text-foreground font-black uppercase tracking-[0.2em]">
                  {config.identity.name}
                </span>
                <span className="w-1 h-1 bg-foreground/20 rounded-full"></span>
                <span className="text-[10px] text-foreground/40 font-black uppercase tracking-widest">
                  {config.identity.city}
                </span>
              </div>
              <span className="text-[10px] text-primary font-black uppercase tracking-[0.2em] bg-primary/5 px-2 py-0.5 rounded-lg border border-primary/10">
                {config.consumerType.name}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4 ml-8 shrink-0 relative z-10">
          {timeTaken !== null && (
            <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-foreground/5 rounded-2xl border border-border/50">
              <Clock className="w-4 h-4 text-primary" />
              <span className="text-xs font-black tracking-tight text-foreground/60">{formatTime(timeTaken)}</span>
            </div>
          )}
          <button 
            onClick={onEndSession}
            className="px-6 py-2.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-red-500/20 shadow-lg shadow-red-500/5"
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
              <Info className="w-3 h-3 text-primary" />
              <span className="text-[10px] text-muted-foreground font-medium">Simulasi email dimulai. Balas dengan format formal dan profesional.</span>
            </div>
          </div>



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
                <div className={`flex flex-col w-full max-w-[98%] md:max-w-3xl mx-auto`}>
                  <div className={`rounded-[2rem] border p-6 md:p-8 shadow-xl backdrop-blur-sm bg-card/40 border-border/30 transition-all hover:border-primary/20 ${email.isAgent ? 'rounded-tr-none border-r-primary/20' : 'rounded-tl-none border-l-primary/20'}`}>
                    
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-6 border-b border-border/30 pb-6">
                      <div className="flex items-center gap-5 min-w-0">
                        <div className={`shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shadow-lg border ${
                          email.isAgent 
                            ? 'bg-foreground text-background border-foreground/10' 
                            : 'bg-primary text-primary-foreground border-primary/20'
                        }`}>
                          {email.isAgent ? 'CS' : getInitials(config.identity.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-black text-foreground text-xl tracking-tighter truncate">
                            {email.isAgent ? 'Customer Service (Anda)' : config.identity.name}
                          </div>
                          <div className="text-[10px] font-black uppercase tracking-widest text-foreground/30 truncate mt-1">
                            {email.isAgent ? 'cc.ojk@ojk.go.id' : email.from}
                          </div>
                        </div>
                      </div>
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/20 whitespace-nowrap text-left sm:text-right">
                        <div className="flex items-center sm:justify-end gap-2 mb-1">
                          <Clock className="w-3 h-3" />
                          <span>{safeDate(email.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                        <div>{safeDate(email.timestamp).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                      </div>
                    </div>

                    <div className="mb-8">
                      <h3 className="text-2xl font-black text-foreground tracking-tight leading-tight">
                        {email.subject}
                      </h3>
                    </div>

                    <div className="text-base text-foreground/80 whitespace-pre-wrap font-medium leading-relaxed font-sans">
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
            <div className="flex flex-col items-center justify-center p-16 bg-card/40 backdrop-blur-xl rounded-[3rem] border-2 border-dashed border-primary/20 shadow-2xl">
              <div className="relative w-16 h-16 mb-8 group">
                <div className="absolute inset-0 border-4 border-primary/10 rounded-full group-hover:scale-110 transition-transform"></div>
                <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                <Mail className="absolute inset-4 w-8 h-8 text-primary animate-pulse" />
              </div>
              <p className="text-foreground/30 font-black text-[11px] uppercase tracking-[0.4em] text-center">
                {emails.length === 0 ? "Menerima Email Masuk..." : "Mengevaluasi Tanggapan..."}
              </p>
            </div>
          )}

          {/* Evaluation Result */}
          {evaluation && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-card border-2 border-primary/30 rounded-[2.5rem] overflow-hidden shadow-2xl"
            >
              <div className="bg-gradient-to-r from-primary to-primary/80 p-6 text-primary-foreground flex justify-between items-center">
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
                  <div className="bg-indigo-500/5 p-5 rounded-2xl border border-indigo-500/10">
                    <h4 className="font-bold text-indigo-500 text-xs mb-3 flex items-center gap-2 uppercase tracking-widest">
                      <CheckCircle2 className="w-4 h-4" /> Relevansi & Solusi
                    </h4>
                    {evaluation.contentGaps.length > 0 ? (
                      <ul className="space-y-2">
                        {evaluation.contentGaps.map((item, idx) => (
                          <li key={idx} className="text-xs text-muted-foreground flex gap-2">
                            <span className="text-indigo-500">•</span> {item}
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
              className="group flex items-center gap-5 text-foreground/30 border-2 border-dashed border-border/50 hover:border-primary/50 rounded-[2rem] px-8 py-6 w-full hover:bg-card/50 transition-all bg-card/20 backdrop-blur-md shadow-inner"
            >
              <div className="w-12 h-12 rounded-2xl bg-foreground/5 flex items-center justify-center group-hover:bg-primary/10 group-hover:text-primary transition-all">
                <Reply className="w-6 h-6" />
              </div>
              <span className="font-black text-sm uppercase tracking-[0.2em]">Balas Email Ini...</span>
            </button>
          ) : (
            <div className="bg-card/80 backdrop-blur-3xl rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] border border-border/50 overflow-hidden relative">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/50 to-primary/10" />
              <div className="flex items-center justify-between px-8 py-5 border-b border-border/30">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                  <span className="text-[10px] font-black text-foreground/30 uppercase tracking-[0.3em]">
                    Drafting Reply to: <span className="text-foreground/60">{config.identity.name}</span>
                  </span>
                </div>
                <button 
                  onClick={() => setIsDrafting(false)} 
                  className="w-8 h-8 flex items-center justify-center hover:bg-foreground/5 rounded-xl transition-all"
                >
                  <X className="w-5 h-5 text-foreground/40" />
                </button>
              </div>
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="w-full h-64 p-10 outline-none text-foreground bg-transparent resize-none font-sans text-base leading-relaxed font-medium placeholder:text-foreground/10"
                placeholder="Tulis balasan Anda secara profesional..."
                autoFocus
              />
              <div className="px-10 py-6 bg-foreground/5 flex justify-end items-center border-t border-border/30">
                <button 
                  onClick={handleSend}
                  disabled={!replyText.trim() || isLoading}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl shadow-primary/20 flex items-center gap-4 disabled:opacity-50 transition-all group"
                >
                  {isLoading ? "Mengirim..." : "Kirim & Evaluasi"}
                  {!isLoading && <Send className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />}
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
