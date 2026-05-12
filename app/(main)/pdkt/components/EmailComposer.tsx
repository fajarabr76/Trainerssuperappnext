'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ReplyComposer } from './ReplyComposer';

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
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="absolute bottom-0 left-0 right-0 z-30 bg-background border-t border-border/50 pt-3"
        >
          <ReplyComposer
            recipient={recipient}
            subject={subject}
            onSend={onSend}
            onClose={onClose}
            isLoading={isLoading}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};
