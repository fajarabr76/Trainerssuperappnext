'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, X, Loader2 } from 'lucide-react';

interface EmailComposerProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (text: string) => void;
  isLoading: boolean;
  recipient: string;
  subject: string;
}

export const EmailComposer: React.FC<EmailComposerProps> = ({
  isOpen,
  onClose,
  onSend,
  isLoading,
  recipient,
  subject
}) => {
  const [replyText, setReplyText] = useState('');

  const handleSend = () => {
    if (!replyText.trim() || isLoading) return;
    onSend(replyText);
    setReplyText('');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="module-clean-toolbar border-t z-30 shrink-0 absolute bottom-0 left-0 right-0 bg-background"
        >
          <div className="max-w-3xl mx-auto">
            {/* Composer Header */}
            <div className="flex items-center justify-between px-4 md:px-6 py-2.5 border-b border-border/50">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-module-pdkt rounded-full" />
                <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide">
                  Balas
                </span>
              </div>
              <button 
                onClick={onClose} 
                className="w-7 h-7 flex items-center justify-center hover:bg-foreground/5 rounded-lg transition-all"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Composer Fields */}
            <div className="px-4 md:px-6 py-2 space-y-1.5 border-b border-border/50">
              <div className="flex items-center text-xs">
                <span className="text-muted-foreground/60 w-12 shrink-0">Kepada</span>
                <span className="text-foreground truncate">{recipient}</span>
              </div>
              <div className="flex items-center text-xs">
                <span className="text-muted-foreground/60 w-12 shrink-0">Cc</span>
                <span className="text-muted-foreground truncate">-</span>
              </div>
              <div className="flex items-center text-xs">
                <span className="text-muted-foreground/60 w-12 shrink-0">Subjek</span>
                <span className={subject ? 'text-foreground truncate' : 'text-muted-foreground/60 truncate'}>
                  {subject || 'Tanpa Subjek'}
                </span>
              </div>
            </div>

            {/* Textarea */}
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              className="w-full h-40 md:h-48 p-4 md:p-5 outline-none text-foreground bg-transparent resize-none font-sans text-sm leading-relaxed placeholder:text-muted-foreground/40"
              placeholder="Tulis balasan Anda..."
              autoFocus
            />

            {/* Send Button */}
            <div className="px-4 md:px-6 py-3 flex justify-end items-center border-t border-border/50">
              <button 
                onClick={handleSend}
                disabled={!replyText.trim() || isLoading}
                className="bg-module-pdkt hover:bg-module-pdkt/90 text-white px-5 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Mengirim...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Kirim</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
