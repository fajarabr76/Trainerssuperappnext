'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Phone, Calendar, Clock, Star, MessageSquare, Download, User, Mic2 } from 'lucide-react';
import { CallRecord } from '../types';
import { getTelefunSignedUrl } from '../actions';
import { VoiceAssessmentSection } from './VoiceAssessmentSection';
import { VoiceEvaluationDashboard } from './VoiceEvaluationDashboard';
import { ReplayAnnotator } from './ReplayAnnotator';
import { VoiceQualityAssessment } from '@/app/types/voiceAssessment';
import { computeVoiceDashboardMetrics } from '@/app/actions/voiceDashboard';
import { generateReplayAnnotations, addManualAnnotation } from '@/app/actions/replayAnnotation';
import type { VoiceDashboardMetrics, ReplayAnnotation, CoachingRecommendation } from '../services/realisticMode/types';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: CallRecord | null;
  onAssessmentComplete?: (sessionId: string, assessment: VoiceQualityAssessment) => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({ isOpen, onClose, record, onAssessmentComplete }) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'assessment' | 'voice_dashboard' | 'replay'>('details');

  // Voice Dashboard state
  const [voiceDashboardMetrics, setVoiceDashboardMetrics] = useState<VoiceDashboardMetrics | null>(null);
  const [voiceDashboardLoading, setVoiceDashboardLoading] = useState(false);
  const [voiceDashboardError, setVoiceDashboardError] = useState<string | undefined>();

  // Replay Annotator state
  const [replayAnnotations, setReplayAnnotations] = useState<ReplayAnnotation[]>([]);
  const [replayRecommendations, setReplayRecommendations] = useState<CoachingRecommendation[]>([]);
  const [replayLoading, setReplayLoading] = useState(false);
  const [replayError, setReplayError] = useState<string | undefined>();

  useEffect(() => {
    if (isOpen && record && record.id && !record.url.startsWith('blob:')) {
      const fetchUrl = async () => {
        setIsLoadingUrl(true);
        const result = await getTelefunSignedUrl({ sessionId: record.id, type: 'full_call' });
        if (result.success && result.signedUrl) {
          setSignedUrl(result.signedUrl);
        }
        setIsLoadingUrl(false);
      };
      fetchUrl();
    } else {
      setSignedUrl(null);
    }
  }, [isOpen, record]);

  // Reset state when modal opens with a new record
  useEffect(() => {
    if (isOpen && record) {
      setVoiceDashboardMetrics(record.voiceDashboardMetrics ?? null);
      setVoiceDashboardError(undefined);
      setVoiceDashboardLoading(false);
      setReplayAnnotations([]);
      setReplayRecommendations([]);
      setReplayError(undefined);
      setReplayLoading(false);
      setActiveTab('details');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, record?.id]);

  // Load voice dashboard metrics when tab is selected
  const loadVoiceDashboard = useCallback(async () => {
    if (!record?.id || voiceDashboardMetrics || voiceDashboardLoading) return;
    setVoiceDashboardLoading(true);
    setVoiceDashboardError(undefined);
    try {
      const result = await computeVoiceDashboardMetrics(record.id);
      if (result.success) {
        setVoiceDashboardMetrics(result.metrics ?? null);
        if (result.notice) setVoiceDashboardError(undefined); // notice is handled by empty state
      } else {
        setVoiceDashboardError(result.error || 'Gagal memuat metrik suara.');
      }
    } catch (_err) {
      setVoiceDashboardError('Gagal memuat metrik suara. Silakan coba lagi.');
    } finally {
      setVoiceDashboardLoading(false);
    }
  }, [record?.id, voiceDashboardMetrics, voiceDashboardLoading]);

  // Load replay annotations when tab is selected
  const loadReplayAnnotations = useCallback(async () => {
    if (!record?.id || replayAnnotations.length > 0 || replayLoading) return;
    setReplayLoading(true);
    setReplayError(undefined);
    try {
      const result = await generateReplayAnnotations(record.id);
      if (result.success && result.result) {
        setReplayAnnotations(result.result.annotations);
        setReplayRecommendations(result.result.summary);
      } else {
        setReplayError(result.error || 'Gagal menghasilkan anotasi.');
      }
    } catch (_err) {
      setReplayError('Gagal menghasilkan anotasi. Silakan coba lagi.');
    } finally {
      setReplayLoading(false);
    }
  }, [record?.id, replayAnnotations.length, replayLoading]);

  // Trigger loading when switching to voice_dashboard or replay tab
  useEffect(() => {
    if (activeTab === 'voice_dashboard' && record?.realisticModeEnabled) {
      loadVoiceDashboard();
    }
    if (activeTab === 'replay' && record?.realisticModeEnabled) {
      loadReplayAnnotations();
    }
  }, [activeTab, record?.realisticModeEnabled, loadVoiceDashboard, loadReplayAnnotations]);

  const handleRetryVoiceDashboard = useCallback(() => {
    setVoiceDashboardMetrics(null);
    setVoiceDashboardError(undefined);
    setVoiceDashboardLoading(false);
    // Will re-trigger via useEffect
    setTimeout(() => loadVoiceDashboard(), 0);
  }, [loadVoiceDashboard]);

  const handleRetryReplay = useCallback(() => {
    setReplayAnnotations([]);
    setReplayRecommendations([]);
    setReplayError(undefined);
    setReplayLoading(false);
    setTimeout(() => loadReplayAnnotations(), 0);
  }, [loadReplayAnnotations]);

  const handleAddAnnotation = useCallback(async (
    annotation: Omit<ReplayAnnotation, 'id' | 'isManual' | 'createdBy'>
  ) => {
    if (!record?.id) return;
    const result = await addManualAnnotation(record.id, annotation);
    if (result.success) {
      // Add to local state optimistically
      const newAnnotation: ReplayAnnotation = {
        id: crypto.randomUUID(),
        ...annotation,
        isManual: true,
      };
      setReplayAnnotations(prev => [...prev, newAnnotation]);
    } else {
      throw new Error(result.error || 'Gagal menyimpan anotasi.');
    }
  }, [record?.id]);

  const handleAssessmentUpdate = (newAssessment: VoiceQualityAssessment) => {
    if (record && onAssessmentComplete) {
      onAssessmentComplete(record.id, newAssessment);
    }
  };

  const showRealisticTabs = record?.realisticModeEnabled;

  return (
    <AnimatePresence>
      {isOpen && record && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 md:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="absolute inset-0 bg-background/80 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl bg-card border border-border rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
          >
            <div className="p-6 border-b border-border flex items-center justify-between shrink-0 bg-foreground/[0.02]">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20">
                  <Phone className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-foreground leading-tight">
                    {record.scenarioTitle}
                  </h2>
                  <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">
                    Detail Sesi
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-foreground/5 rounded-full transition-colors border border-border"
              >
                <X className="w-6 h-6 text-muted-foreground" />
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="px-6 pt-4 flex gap-4 border-b border-border bg-foreground/[0.01] overflow-x-auto">
              <button
                onClick={() => setActiveTab('details')}
                className={`pb-3 px-2 text-sm font-bold tracking-tight transition-all relative whitespace-nowrap ${activeTab === 'details' ? 'text-emerald-500' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Detail Sesi
                {activeTab === 'details' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500 rounded-t-full" />}
              </button>
              <button
                onClick={() => setActiveTab('assessment')}
                className={`pb-3 px-2 text-sm font-bold tracking-tight transition-all relative whitespace-nowrap ${activeTab === 'assessment' ? 'text-emerald-500' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Kualitas Suara Agen
                {activeTab === 'assessment' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500 rounded-t-full" />}
              </button>
              {showRealisticTabs && (
                <>
                  <button
                    onClick={() => setActiveTab('voice_dashboard')}
                    className={`pb-3 px-2 text-sm font-bold tracking-tight transition-all relative whitespace-nowrap ${activeTab === 'voice_dashboard' ? 'text-emerald-500' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    Evaluasi Suara
                    {activeTab === 'voice_dashboard' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500 rounded-t-full" />}
                  </button>
                  <button
                    onClick={() => setActiveTab('replay')}
                    className={`pb-3 px-2 text-sm font-bold tracking-tight transition-all relative whitespace-nowrap ${activeTab === 'replay' ? 'text-emerald-500' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    Anotasi Replay
                    {activeTab === 'replay' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500 rounded-t-full" />}
                  </button>
                </>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
              <AnimatePresence mode="wait">
                {activeTab === 'details' && (
                  <motion.div
                    key="details"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="space-y-6"
                  >
                    {/* Metadata Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-foreground/[0.02] border border-border rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <User className="w-4 h-4 text-emerald-600/60 dark:text-emerald-400/60" />
                          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Konsumen</span>
                        </div>
                        <p className="text-sm font-bold text-foreground">{record.consumerName}</p>
                      </div>

                      <div className="bg-foreground/[0.02] border border-border rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar className="w-4 h-4 text-emerald-600/60 dark:text-emerald-400/60" />
                          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Tanggal</span>
                        </div>
                        <p className="text-sm font-bold text-foreground">
                          {new Date(record.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(record.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>

                      <div className="bg-foreground/[0.02] border border-border rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="w-4 h-4 text-emerald-600/60 dark:text-emerald-400/60" />
                          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Durasi</span>
                        </div>
                        <p className="text-sm font-bold text-foreground">
                          {formatDuration(record.duration)}
                          {record.configuredDuration ? <span className="text-xs text-muted-foreground font-normal ml-1">/ limit {record.configuredDuration}m</span> : ''}
                        </p>
                      </div>

                      <div className="bg-foreground/[0.02] border border-border rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Star className="w-4 h-4 text-emerald-600/60 dark:text-emerald-400/60" />
                          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Skor</span>
                        </div>
                        <p className="text-sm font-bold text-foreground">
                          {record.score != null ? `${record.score}/100` : '—'}
                        </p>
                      </div>
                    </div>

                    {/* Feedback */}
                    {record.feedback && (
                      <div className="bg-foreground/[0.02] border border-border rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <MessageSquare className="w-4 h-4 text-emerald-600/60 dark:text-emerald-400/60" />
                          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Feedback</span>
                        </div>
                        <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                          {record.feedback}
                        </p>
                      </div>
                    )}

                    {/* Recording */}
                    <div className="bg-foreground/[0.02] border border-border rounded-2xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Mic2 className="w-4 h-4 text-emerald-600/60 dark:text-emerald-400/60" />
                          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Rekaman Sesi</span>
                        </div>
                        {isLoadingUrl && <div className="w-3 h-3 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />}
                      </div>

                      {signedUrl || (record.url && record.url.startsWith('blob:')) ? (
                        <div className="space-y-4">
                          <audio controls className="w-full h-10" src={signedUrl || record.url}>
                            Browser Anda tidak mendukung pemutaran audio.
                          </audio>
                          <div className="flex gap-2">
                            <a
                              href={signedUrl || record.url}
                              download={`Telefun_${record.consumerName}_${record.id}.webm`}
                              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10 rounded-xl border border-emerald-500/10 transition-all"
                            >
                              <Download className="w-3.5 h-3.5" />
                              Unduh Rekaman
                            </a>
                          </div>
                        </div>
                      ) : (
                        <div className="py-4 text-center border border-dashed border-border rounded-xl">
                          <p className="text-xs text-muted-foreground">Rekaman tidak tersedia atau telah dihapus.</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {activeTab === 'assessment' && (
                  <motion.div
                    key="assessment"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                  >
                    <VoiceAssessmentSection
                      sessionId={record.id}
                      initialAssessment={record.voiceAssessment}
                      hasAgentRecording={Boolean(record.agentRecordingPath)}
                      onAssessmentUpdate={handleAssessmentUpdate}
                    />
                  </motion.div>
                )}

                {activeTab === 'voice_dashboard' && showRealisticTabs && (
                  <motion.div
                    key="voice_dashboard"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                  >
                    <VoiceEvaluationDashboard
                      sessionId={record.id}
                      metrics={voiceDashboardMetrics}
                      isLoading={voiceDashboardLoading}
                      error={voiceDashboardError}
                      onRetry={handleRetryVoiceDashboard}
                    />
                  </motion.div>
                )}

                {activeTab === 'replay' && showRealisticTabs && (
                  <motion.div
                    key="replay"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                  >
                    <ReplayAnnotator
                      sessionId={record.id}
                      annotations={replayAnnotations}
                      recommendations={replayRecommendations}
                      isLoading={replayLoading}
                      error={replayError}
                      onRetry={handleRetryReplay}
                      onAddAnnotation={handleAddAnnotation}
                      sessionDurationMs={record.duration * 1000}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
