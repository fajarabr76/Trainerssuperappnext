'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Play, Pause, ChevronLeft, ChevronRight, RotateCcw, MessageSquare, User, Clock } from 'lucide-react';
import { ChatMessage } from '@/app/types';

interface SessionReplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  scenarioTitle?: string;
  consumerName?: string;
}

export const SessionReplayModal: React.FC<SessionReplayModalProps> = ({ 
  isOpen, 
  onClose, 
  messages,
  scenarioTitle = 'Session Replay',
  consumerName = 'Consumer'
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-play logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && currentIndex < messages.length - 1) {
      interval = setInterval(() => {
        setCurrentIndex((prev) => prev + 1);
      }, 1500);
    } else if (currentIndex >= messages.length - 1) {
      setIsPlaying(false);
    }
    return () => clearInterval(interval);
  }, [isPlaying, currentIndex, messages.length]);

  // Scroll to bottom when index changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [currentIndex]);

  if (!isOpen) return null;

  const currentMessages = messages.slice(0, currentIndex + 1);

  const handleNext = () => {
    if (currentIndex < messages.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleReset = () => {
    setCurrentIndex(0);
    setIsPlaying(false);
  };

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
        className="module-clean-modal-shell relative w-full max-w-2xl rounded-[2rem] overflow-hidden flex flex-col h-full max-h-[86vh] shadow-2xl shadow-black/10"
      >
        {/* Header */}
        <header className="module-clean-toolbar px-5 py-4 sm:px-6 sm:py-5 border-b flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="module-clean-chip w-11 h-11 rounded-xl flex items-center justify-center">
              <Play className="w-5 h-5 text-primary fill-current" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-foreground tracking-tight line-clamp-1">{scenarioTitle}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-primary">Replay</span>
                <span className="w-1 h-1 bg-foreground/20 rounded-full"></span>
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{consumerName}</span>
              </div>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-10 h-10 flex items-center justify-center hover:bg-foreground/5 rounded-xl transition-all"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </header>

        {/* Body - Chat Area */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-3 custom-scrollbar bg-background/50"
        >
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-20">
              <MessageSquare className="w-12 h-12 mb-4" />
              <p className="font-black uppercase tracking-widest text-[10px]">Tidak ada pesan</p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {currentMessages.map((msg, idx) => {
                if (msg.sender === 'system') {
                  return (
                    <motion.div 
                      key={msg.id || idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex justify-center py-2"
                    >
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 bg-foreground/5 px-3 py-1 rounded-full">
                        {msg.text}
                      </span>
                    </motion.div>
                  );
                }

                const isAgent = msg.sender === 'agent';
                return (
                  <motion.div 
                    key={msg.id || idx}
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className={`flex w-full ${isAgent ? 'justify-end' : 'justify-start'}`}
                  >
                    <div 
                      className={`max-w-[85%] px-5 py-3.5 relative text-[14px] leading-relaxed shadow-sm
                      ${isAgent 
                        ? 'bg-module-ketik text-white rounded-[1.5rem] rounded-tr-none' 
                        : 'module-clean-panel text-foreground rounded-[1.5rem] rounded-tl-none'
                      }`}
                    >
                      <div className="font-medium whitespace-pre-wrap break-words">
                        {msg.text}
                      </div>
                      <div className={`text-[8px] font-black uppercase tracking-widest mt-2 flex items-center gap-1.5 opacity-60 ${isAgent ? 'justify-end' : 'justify-start'}`}>
                        <Clock className="w-2.5 h-2.5" />
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>

        {/* Controls Footer */}
        <footer className="module-clean-toolbar p-5 sm:p-6 border-t shrink-0">
          <div className="max-w-md mx-auto">
            {/* Progress Bar */}
            <div className="mb-6 flex items-center gap-4">
              <div className="flex-1 h-1.5 bg-foreground/5 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${((currentIndex + 1) / messages.length) * 100}%` }}
                />
              </div>
              <span className="text-[10px] font-black tabular-nums text-muted-foreground min-w-[40px]">
                {currentIndex + 1} / {messages.length}
              </span>
            </div>

            {/* Main Buttons */}
            <div className="flex items-center justify-center gap-4">
              <button 
                onClick={handleReset}
                className="module-clean-button-secondary w-12 h-12 flex items-center justify-center rounded-2xl transition-all"
                title="Reset"
              >
                <RotateCcw className="w-5 h-5" />
              </button>

              <button 
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="module-clean-button-secondary w-12 h-12 flex items-center justify-center rounded-2xl transition-all disabled:opacity-20"
                title="Previous"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>

              <button 
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-16 h-16 bg-primary text-white flex items-center justify-center rounded-[2rem] shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-7 h-7 fill-current" /> : <Play className="w-7 h-7 fill-current translate-x-0.5" />}
              </button>

              <button 
                onClick={handleNext}
                disabled={currentIndex === messages.length - 1}
                className="module-clean-button-secondary w-12 h-12 flex items-center justify-center rounded-2xl transition-all disabled:opacity-20"
                title="Next"
              >
                <ChevronRight className="w-6 h-6" />
              </button>

              <div className="w-12" /> {/* Spacer for symmetry */}
            </div>
            
            <p className="text-center mt-6 text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">
              Stepping through session replay
            </p>
          </div>
        </footer>
      </motion.div>
    </div>
  );
};
