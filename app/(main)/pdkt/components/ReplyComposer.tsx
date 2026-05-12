'use client';

import React, { useState } from 'react';
import { Send, X, Loader2, Reply } from 'lucide-react';

interface ReplyComposerProps {
  recipient: string;
  subject: string;
  onSend: (text: string) => void;
  onClose: () => void;
  isLoading: boolean;
}

export const ReplyComposer: React.FC<ReplyComposerProps> = ({
  recipient,
  subject,
  onSend,
  onClose,
  isLoading,
}) => {
  const [replyText, setReplyText] = useState('');

  const handleSend = () => {
    if (!replyText.trim() || isLoading) return;
    onSend(replyText);
    setReplyText('');
  };

  return (
    <div className="mx-3 mb-3 bg-foreground/[0.02] border border-border/60 rounded-xl shadow-sm overflow-hidden">
      {/* Header Section */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-border/50 border-l-2 border-l-module-pdkt bg-module-pdkt/5">
        <div className="flex items-center gap-2">
          <Reply className="w-4 h-4 text-module-pdkt" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Balas
          </span>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center hover:bg-foreground/5 rounded-lg transition-all"
          aria-label="Tutup form balasan"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Field Section */}
      <div className="px-4 md:px-6 py-2.5 space-y-2 border-b border-border/50">
        <div className="flex items-center">
          <span className="text-xs text-muted-foreground/70 w-14 shrink-0">Kepada</span>
          <span className="text-[13px] text-foreground truncate">{recipient}</span>
        </div>
        <div className="flex items-center">
          <span className="text-xs text-muted-foreground/70 w-14 shrink-0">Cc</span>
          <span className="text-[13px] text-muted-foreground/40 truncate">-</span>
        </div>
        <div className="flex items-center">
          <span className="text-xs text-muted-foreground/70 w-14 shrink-0">Subjek</span>
          <span className={subject ? 'text-[13px] text-foreground truncate' : 'text-[13px] text-muted-foreground/40 truncate'}>
            {subject || 'Tanpa Subjek'}
          </span>
        </div>
      </div>

      {/* Textarea Section */}
      <textarea
        value={replyText}
        onChange={(e) => setReplyText(e.target.value)}
        className="w-full h-32 md:h-48 p-4 md:p-5 outline-none text-foreground bg-foreground/[0.01] resize-none font-sans text-sm leading-relaxed placeholder:text-muted-foreground/40 focus:ring-1 focus:ring-module-pdkt/20 focus:ring-inset"
        placeholder="Tulis balasan Anda..."
        autoFocus
      />

      {/* Footer Section */}
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
  );
};
