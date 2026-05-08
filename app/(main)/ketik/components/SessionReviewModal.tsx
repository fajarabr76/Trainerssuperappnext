'use client';

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  X, 
  Award, 
  Zap, 
  AlertTriangle, 
  Target, 
  MessageSquare, 
  CheckCircle2, 
  Play,
  Heart,
  TrendingUp,
  BrainCircuit,
  Sparkles
} from 'lucide-react';
import { ChatSession, KetikSessionReview, KetikTypoFinding } from '@/app/types';

interface SessionReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: ChatSession;
  review?: KetikSessionReview;
  typos?: KetikTypoFinding[];
  onReplay: () => void;
  onStartReview?: (sessionId: string) => Promise<void>;
}

export const SessionReviewModal: React.FC<SessionReviewModalProps> = ({
  isOpen,
  onClose,
  session,
  review,
  typos = [],
  onReplay,
  onStartReview
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const isProcessing = isAnalyzing || session.reviewStatus === 'pending' || session.reviewStatus === 'processing';

  if (!isOpen) return null;

  const handleAnalyze = async () => {
    if (!onStartReview || isProcessing) return;
    setIsAnalyzing(true);
    try {
      await onStartReview(session.id);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const scoreCards = [
    { 
      label: 'Empathy', 
      score: session.empathyScore || 0, 
      icon: Heart, 
      color: 'text-rose-500', 
      bg: 'bg-rose-500/10' 
    },
    { 
      label: 'Probing', 
      score: session.probingScore || 0, 
      icon: Zap, 
      color: 'text-amber-500', 
      bg: 'bg-amber-500/10' 
    },
    { 
      label: 'Typo', 
      score: session.typoScore || 0, 
      icon: AlertTriangle, 
      color: 'text-orange-500', 
      bg: 'bg-orange-500/10' 
    },
    { 
      label: 'Compliance', 
      score: session.complianceScore || 0, 
      icon: Award, 
      color: 'text-emerald-500', 
      bg: 'bg-emerald-500/10' 
    },
  ];

  return (
    <div data-module="ketik" className="module-clean-app module-clean-modal fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 md:p-6">
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
        className="module-clean-modal-shell relative w-full max-w-3xl rounded-[2rem] overflow-hidden flex flex-col max-h-[90vh] shadow-2xl shadow-black/10"
      >
        {/* Header */}
        <header className="module-clean-toolbar px-5 py-4 sm:px-6 sm:py-5 border-b flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="module-clean-chip w-11 h-11 rounded-xl flex items-center justify-center">
              <BrainCircuit className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-foreground tracking-tight line-clamp-1">Hasil Review AI</h2>
              <p className="text-xs text-foreground/50 font-medium">Sesi: {session.scenarioTitle}</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-10 h-10 flex items-center justify-center hover:bg-foreground/5 rounded-xl transition-all border border-transparent hover:border-foreground/10"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 custom-scrollbar">
          {review ? (
            <>
              {/* Score Cards Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {scoreCards.map((card) => (
                  <div key={card.label} className="module-clean-panel p-4 rounded-2xl flex flex-col items-center text-center gap-2">
                    <div className={`w-10 h-10 ${card.bg} ${card.color} rounded-xl flex items-center justify-center mb-1`}>
                      <card.icon className="w-5 h-5" />
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{card.label}</div>
                    <div className="text-2xl font-black text-foreground">{card.score}</div>
                  </div>
                ))}
              </div>

              {/* Final Score Banner */}
              <div className="bg-primary/5 rounded-[1.5rem] p-6 border border-primary/10 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
                    <TrendingUp className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/60">Skor Akhir</div>
                    <div className="text-3xl font-black text-primary">{session.finalScore || 0}</div>
                  </div>
                </div>
                <div className="text-sm text-foreground/60 font-medium max-w-[400px] text-center md:text-right">
                  Performa Anda dinilai berdasarkan kemampuan empati, probing informasi, ketepatan penulisan, dan kepatuhan prosedur.
                </div>
              </div>

              <div className="space-y-6">
                {/* AI Summary Section */}
                <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-primary" />
                    <h3 className="text-xs font-black uppercase tracking-widest text-foreground/70">Ringkasan AI</h3>
                  </div>
                  <div className="module-clean-panel p-5 rounded-2xl bg-foreground/[0.02] border-none shadow-none">
                    <p className="text-sm text-foreground/80 leading-relaxed italic">
                      &quot;{review.aiSummary}&quot;
                    </p>
                  </div>
                </section>

                {/* Strengths & Weaknesses */}
                <div className="grid md:grid-cols-2 gap-6">
                  <section className="space-y-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <h3 className="text-xs font-black uppercase tracking-widest text-foreground/70">Kekuatan</h3>
                    </div>
                    <div className="space-y-2">
                      {review.strengths.map((str, i) => (
                        <div key={i} className="flex gap-3 text-sm text-foreground/70 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                          <div className="mt-1 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          {str}
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="space-y-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-orange-500" />
                      <h3 className="text-xs font-black uppercase tracking-widest text-foreground/70">Area Perbaikan</h3>
                    </div>
                    <div className="space-y-2">
                      {review.weaknesses.map((weak, i) => (
                        <div key={i} className="flex gap-3 text-sm text-foreground/70 p-3 rounded-xl bg-orange-500/5 border border-orange-500/10">
                          <div className="mt-1 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-orange-500" />
                          {weak}
                        </div>
                      ))}
                    </div>
                  </section>
                </div>

                {/* Typos Section (Optional display) */}
                {typos.length > 0 && (
                  <section className="space-y-3">
                     <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-500" />
                      <h3 className="text-xs font-black uppercase tracking-widest text-foreground/70">Typo Terdeteksi ({typos.length})</h3>
                    </div>
                    <div className="module-clean-panel overflow-hidden">
                      <div className="max-h-40 overflow-y-auto custom-scrollbar p-1">
                        {typos.map((typo) => (
                          <div key={typo.id} className="flex items-center justify-between p-3 hover:bg-foreground/5 rounded-lg transition-colors">
                            <div className="flex items-center gap-3">
                              <span className="text-xs line-through text-muted-foreground">{typo.originalWord}</span>
                              <span className="text-xs font-bold text-emerald-500">→ {typo.correctedWord}</span>
                            </div>
                            <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${
                              typo.severity === 'critical' ? 'bg-rose-500 text-white' : 
                              typo.severity === 'medium' ? 'bg-orange-500 text-white' : 'bg-muted text-muted-foreground'
                            }`}>
                              {typo.severity}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                )}

                {/* Coaching Focus */}
                <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-primary" />
                    <h3 className="text-xs font-black uppercase tracking-widest text-foreground/70">Fokus Coaching</h3>
                  </div>
                  <div className="bg-primary/10 border border-primary/20 p-5 rounded-[1.5rem]">
                    <ul className="space-y-3">
                      {review.coachingFocus.map((focus, i) => (
                        <li key={i} className="flex gap-4 items-start">
                          <div className="mt-1 w-5 h-5 rounded-lg bg-primary text-white flex items-center justify-center flex-shrink-0 text-[10px] font-bold">
                            {i + 1}
                          </div>
                          <p className="text-sm font-bold text-primary/80 leading-snug">
                            {focus}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                </section>
              </div>
            </>
          ) : (
            <div className="py-20 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mb-6">
                <Sparkles className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">Analisis Performa Chat AI</h3>
              <p className="text-sm text-muted-foreground max-w-md mb-8">
                Gunakan AI untuk menilai empati, teknik probing, kepatuhan prosedur, dan mendeteksi typo pada sesi chat Anda.
              </p>
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="inline-flex h-14 items-center justify-center gap-3 rounded-2xl bg-primary px-8 text-xs font-black uppercase tracking-widest text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
              >
                {isAnalyzing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                    Menganalisis Sesi...
                  </>
                ) : (
                  <>
                    <BrainCircuit className="w-5 h-5" />
                    Mulai Analisis
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <footer className="module-clean-toolbar p-5 sm:p-6 border-t flex flex-col sm:flex-row gap-3 shrink-0">
          <button 
            onClick={onReplay}
            className="flex-1 h-14 bg-primary text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
          >
            <Play className="w-4 h-4 fill-current" />
            Tonton Replay
          </button>
          <button 
            onClick={onClose}
            className="h-14 px-8 border border-foreground/10 hover:bg-foreground/5 text-foreground font-black uppercase tracking-widest text-xs rounded-2xl transition-all"
          >
            Tutup
          </button>
        </footer>
      </motion.div>
    </div>
  );
};
