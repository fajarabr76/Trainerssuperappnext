'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MailboxSidebar } from './MailboxSidebar';
import { EmailDetailPane } from './EmailDetailPane';
import { EmailComposer } from './EmailComposer';
import { CreateEmailModal } from './CreateEmailModal';
import { PdktMailboxItem, AppSettings, EmailMessage, EvaluationResult, EvaluationStatus, Scenario } from '../types';
import { fetchMailboxItems, createMailboxItem, softDeleteMailboxItem, submitMailboxReply, fetchEvaluationState, retryEvaluation } from '../actions';
import { generateSessionConfig } from '../services/settingService';
import { getMyModuleUsage } from '@/app/actions/usage';
import { type UsageSnapshot } from '@/app/lib/usage-snapshot';
import { ArrowLeft, Inbox, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MailboxInterfaceProps {
  settings: AppSettings;
  onBack: () => void;
  onActivityComplete?: (baseline?: UsageSnapshot) => void;
}

export const MailboxInterface: React.FC<MailboxInterfaceProps> = ({
  settings,
  onBack,
  onActivityComplete
}) => {
  const [items, setItems] = useState<PdktMailboxItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  
  const lastActivityBaselineRef = useRef<UsageSnapshot | null>(null);

  const captureBaseline = async () => {
    try {
      const usage = await getMyModuleUsage('pdkt');
      if (usage) {
        lastActivityBaselineRef.current = {
          total_calls: usage.total_calls,
          total_tokens: usage.total_tokens,
          total_cost_idr: usage.total_cost_idr,
          periodLabel: usage.periodLabel,
        };
      }
    } catch (e) {
      console.warn('[PDKT Mailbox] Failed to capture baseline:', e);
    }
  };

  // Evaluation tracking
  const [evaluations, setEvaluations] = useState<Record<string, {
    result: EvaluationResult | null;
    status: EvaluationStatus;
    error: string | null;
    timeTaken: number | null;
  }>>({});

  const sessionStartTimeRef = useRef<Record<string, number>>({});

  const selectedItem = items.find(item => item.id === selectedId);

  const loadItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchMailboxItems();
      setItems(data);
      
      // Initialize evaluation state for replied items
      const initialEvals: typeof evaluations = {};
      data.forEach(item => {
        if (item.status === 'replied' && item.history_id) {
          // We'll poll for these if they are still 'processing'
          // For now, mark as processing if we don't know
          initialEvals[item.id] = {
            result: null,
            status: 'processing',
            error: null,
            timeTaken: null
          };
        }
      });
      setEvaluations(prev => ({ ...initialEvals, ...prev }));

    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Polling for evaluations
  useEffect(() => {
    const processingItems = items.filter(item => 
      item.status === 'replied' && 
      item.history_id && 
      (!evaluations[item.id] || evaluations[item.id].status === 'processing')
    );

    if (processingItems.length === 0) return;

    const timer = setInterval(async () => {
      for (const item of processingItems) {
        if (!item.history_id) continue;
        const state = await fetchEvaluationState(item.history_id);
        if (state) {
          const oldStatus = evaluations[item.id]?.status;
          const newStatus = state.evaluation_status;

          setEvaluations(prev => ({
            ...prev,
            [item.id]: {
              result: state.evaluation,
              status: state.evaluation_status,
              error: state.evaluation_error,
              timeTaken: state.time_taken
            }
          }));

          // If it just finished, trigger usage update
          if (oldStatus === 'processing' && (newStatus === 'completed' || newStatus === 'failed')) {
            onActivityComplete?.(lastActivityBaselineRef.current || undefined);
          }
        }
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [items, evaluations, onActivityComplete]);

  const handleSelectItem = (id: string) => {
    setSelectedId(id);
    // Start session timer if opening an 'open' item for the first time in this view
    const item = items.find(i => i.id === id);
    if (item?.status === 'open' && !sessionStartTimeRef.current[id]) {
      sessionStartTimeRef.current[id] = Date.now();
    }
  };

  const handleRetryEvaluation = async () => {
    if (!selectedItem?.history_id) return;
    
    await captureBaseline();
    setEvaluations(prev => ({
      ...prev,
      [selectedItem.id]: {
        ...prev[selectedItem.id],
        status: 'processing',
        error: null
      }
    }));

    try {
      const res = await retryEvaluation(selectedItem.history_id);
      if (!res.success) {
        alert(`Gagal memicu evaluasi: ${res.error}`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateEmail = async (scenario: Scenario) => {
    setIsCreating(true);
    await captureBaseline();
    try {
      const config = generateSessionConfig(settings, scenario);
      const clientRequestId = `req-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const newItem = await createMailboxItem(config, scenario, clientRequestId);
      setItems(prev => [newItem, ...prev]);
      setSelectedId(newItem.id);
      setIsCreateModalOpen(false);
      sessionStartTimeRef.current[newItem.id] = Date.now();
      onActivityComplete?.(lastActivityBaselineRef.current || undefined);
    } catch (e) {
      console.error(e);
      alert('Gagal membuat email baru.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleSendReply = async (text: string) => {
    if (!selectedItem) return;

    const startTime = sessionStartTimeRef.current[selectedItem.id] || Date.now();
    const timeTaken = Math.floor((Date.now() - startTime) / 1000);

    const agentReply: EmailMessage = {
      id: Date.now().toString(),
      from: 'cc.ojk@ojk.go.id',
      to: selectedItem.sender_email,
      subject: selectedItem.subject ? `Re: ${selectedItem.subject}` : '',
      body: text,
      timestamp: new Date(),
      isAgent: true
    };

    setIsComposerOpen(false);
    setIsLoading(true);
    await captureBaseline();

    try {
      const historyId = await submitMailboxReply(selectedItem.id, agentReply, timeTaken);
      
      // Update local state
      setItems(prev => prev.map(item => 
        item.id === selectedItem.id 
          ? { ...item, status: 'replied', history_id: historyId, emails_thread: [...item.emails_thread, agentReply] } 
          : item
      ));

      setEvaluations(prev => ({
        ...prev,
        [selectedItem.id]: {
          result: null,
          status: 'processing',
          error: null,
          timeTaken
        }
      }));

      onActivityComplete?.(lastActivityBaselineRef.current || undefined);

    } catch (e) {
      console.error(e);
      alert('Gagal mengirim balasan.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!selectedId) return;
    if (!confirm('Yakin ingin menghapus email ini?')) return;

    try {
      await softDeleteMailboxItem(selectedId);
      setItems(prev => prev.filter(item => item.id !== selectedId));
      setSelectedId(null);
    } catch (e) {
      console.error(e);
      alert('Gagal menghapus email.');
    }
  };

  const currentEval = selectedId ? evaluations[selectedId] : null;

  return (
    <div className="flex flex-col h-full bg-background relative overflow-hidden">
      {/* Top Header */}
      <header className="module-clean-toolbar px-4 py-3 border-b flex items-center justify-between z-50 shrink-0">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="module-clean-button-secondary w-9 h-9 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex flex-col">
            <h1 className="text-sm font-semibold text-foreground flex items-center gap-2">
              Workspace PDKT
            </h1>
            <span className="text-xs font-medium text-muted-foreground">Manual Mailbox Flow</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="module-clean-button-primary px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Email</span>
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <MailboxSidebar 
          items={items}
          selectedId={selectedId}
          onSelect={handleSelectItem}
          onNew={() => setIsCreateModalOpen(true)}
        />

        {/* Detail Pane */}
        <div className="flex-1 min-w-0 bg-background/50 relative">
          <AnimatePresence mode="wait">
            {selectedItem ? (
              <motion.div
                key={selectedItem.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="h-full"
              >
                <EmailDetailPane 
                  item={selectedItem}
                  onReply={() => setIsComposerOpen(true)}
                  onDelete={handleDeleteItem}
                  onRetryEval={handleRetryEvaluation}
                  evaluation={currentEval?.result || null}
                  evaluationStatus={currentEval?.status || null}
                  evaluationError={currentEval?.error || null}
                  timeTaken={currentEval?.timeTaken || null}
                  isLoading={isLoading}
                  isComposerOpen={isComposerOpen}
                />
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full flex flex-col items-center justify-center p-12 text-center"
              >
                <div className="w-20 h-20 rounded-3xl bg-foreground/5 flex items-center justify-center mb-6">
                  <Inbox className="w-10 h-10 text-muted-foreground/20" />
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-2">Pilih Email</h3>
                <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                  Pilih email dari daftar di samping untuk mulai menelaah masalah konsumen dan memberikan tanggapan.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Composer Overlay */}
          <EmailComposer 
            isOpen={isComposerOpen}
            onClose={() => setIsComposerOpen(false)}
            onSend={handleSendReply}
            isLoading={isLoading}
            recipient={selectedItem?.sender_email || ''}
            subject={selectedItem?.subject || ''}
          />
        </div>
      </div>

      {/* Create Modal */}
      <CreateEmailModal 
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        scenarios={settings.scenarios}
        onCreate={handleCreateEmail}
        isLoading={isCreating}
      />
    </div>
  );
};
