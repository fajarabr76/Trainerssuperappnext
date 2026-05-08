'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SettingsModal } from './components/SettingsModal';
import { EmailInterface } from './components/EmailInterface';
import { HistoryModal } from './components/HistoryModal';
import { UsageModal } from './components/UsageModal';
import { AppSettings, SessionConfig, Identity, ConsumerType, EmailMessage, EvaluationResult, SessionHistory, EvaluationStatus } from './types';
import { DUMMY_CITIES, DUMMY_PROFILES } from './constants';
import { initializeEmailSession } from './services/geminiService';
import { loadPdktSettings, savePdktSettings, defaultPdktSettings, resolveConsumerNameMentionPattern } from './services/settingService';

import { History, Settings, Play, Mail, BarChart3 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { createClient } from '@/app/lib/supabase/client';
import { moduleTheme } from '@/app/components/ui/moduleTheme';
import ModuleWorkspaceIntro from '@/app/components/ModuleWorkspaceIntro';
import { normalizeModelId } from '@/app/lib/ai-models';
import { getMyModuleUsage } from '@/app/actions/usage';
import { type UsageSnapshot, computeUsageDelta, formatUsageDeltaLabel } from '@/app/lib/usage-snapshot';

const supabase = createClient();

const PdktPage: React.FC = () => {
  const theme = moduleTheme.pdkt;
  const [user, setUser] = useState<any>(null);
  const [view, setView] = useState<'home' | 'email'>('home');

  // ── Helper aman untuk konversi date ──────────────────────
  const safeDate = (val: any): Date => {
    if (!val) return new Date();
    const d = new Date(val);
    return isNaN(d.getTime()) ? new Date() : d;
  };

  const [settings, setSettings] = useState<AppSettings>(defaultPdktSettings);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isUsageOpen, setIsUsageOpen] = useState(false);
  const [history, setHistory] = useState<SessionHistory[]>([]);
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentConfig, setCurrentConfig] = useState<SessionConfig | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [evaluationStatus, setEvaluationStatus] = useState<EvaluationStatus | null>(null);
  const [evaluationError, setEvaluationError] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [timeTaken, setTimeTaken] = useState<number | null>(null);
  const [sessionDelta, setSessionDelta] = useState<ReturnType<typeof computeUsageDelta>>(null);
  const [sessionDeltaPending, setSessionDeltaPending] = useState(false);
  const [closedSessionId, setClosedSessionId] = useState<string | null>(null);
  const [closedSessionBaseline, setClosedSessionBaseline] = useState<UsageSnapshot | null>(null);
  const sessionBaselineRef = useRef<UsageSnapshot | null>(null);
  const sessionRunIdRef = useRef(0);

  const mapSessionHistory = useCallback((item: any): SessionHistory => ({
    id: item.id,
    timestamp: safeDate(item.timestamp),
    config: item.config,
    emails: item.emails,
    evaluation: item.evaluation,
    evaluationStatus: item.evaluation_status || (item.evaluation ? 'completed' : 'processing'),
    evaluationError: item.evaluation_error,
    evaluationStartedAt: item.evaluation_started_at,
    evaluationCompletedAt: item.evaluation_completed_at,
    timeTaken: item.time_taken,
  }), []);

  // ── Get User ──────────────────────────────────────────
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, []);

  // ── Load settings saat mount ──────────────────────────
  useEffect(() => {
    const initSettings = async () => {
      const loaded = await loadPdktSettings();
      setSettings(loaded);
      setIsLoading(false);
    };
    initSettings();
  }, [user]);

  // ── Load history dari Supabase ────────────────────────
  const fetchHistory = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('pdkt_history')
      .select('id, user_id, timestamp, config, emails, evaluation, evaluation_status, evaluation_error, evaluation_started_at, evaluation_completed_at, time_taken')
      .eq('user_id', user.id)
      .order('timestamp', { ascending: false })
      .limit(50);

    if (error) { 
      console.error('Error fetching PDKT history:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      }); 
      return; 
    }

    if (data) {
      setHistory(data.map(mapSessionHistory));
    }
  }, [mapSessionHistory, user]);

  useEffect(() => {
    if (!user) return;

    const run = async () => {
      await fetchHistory();
    };

    run();
  }, [fetchHistory, user]);

  const refreshCurrentSession = useCallback(async (sessionId: string) => {
    if (!user) return;

    const { data, error } = await supabase
      .from('pdkt_history')
      .select('id, user_id, timestamp, config, emails, evaluation, evaluation_status, evaluation_error, evaluation_started_at, evaluation_completed_at, time_taken')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (error || !data) {
      if (error) {
        console.error('Error refreshing current PDKT session:', error);
      }
      return;
    }

    const mapped = mapSessionHistory(data);
    setHistory(prev => {
      const next = prev.filter(item => item.id !== mapped.id);
      return [mapped, ...next];
    });
    setCurrentConfig(mapped.config);
    setEmails(mapped.emails);
    setEvaluation(mapped.evaluation);
    setEvaluationStatus(mapped.evaluationStatus);
    setEvaluationError(mapped.evaluationError || null);
    setTimeTaken(mapped.timeTaken);
  }, [mapSessionHistory, user]);

  useEffect(() => {
    if (!currentSessionId || evaluationStatus !== 'processing' || view !== 'email') return;

    const timer = window.setInterval(() => {
      void refreshCurrentSession(currentSessionId);
    }, 10000);

    return () => window.clearInterval(timer);
  }, [currentSessionId, evaluationStatus, refreshCurrentSession, view]);

  // ── Post-close polling untuk delta usage saat evaluasi async ──
  useEffect(() => {
    if (!closedSessionId || !closedSessionBaseline || !user) return;

    const runId = sessionRunIdRef.current;
    let attempts = 0;
    const maxAttempts = 18;
    let aborted = false;

    const timer = window.setInterval(async () => {
      attempts++;

      try {
        const { data, error } = await supabase
          .from('pdkt_history')
          .select('evaluation_status')
          .eq('id', closedSessionId)
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.warn('[PDKT] Post-close polling error:', error);
        }

        if (data && data.evaluation_status !== 'processing') {
          window.clearInterval(timer);

          // Deterministic retry loop
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          let retryCount = 0;
          const maxRetries = 5;
          const retryInterval = 1000;

          while (retryCount <= maxRetries) {
            if (aborted || runId !== sessionRunIdRef.current) break;

            try {
              const usage = await getMyModuleUsage('pdkt');
              if (usage) {
                const after: UsageSnapshot = {
                  total_calls: usage.total_calls,
                  total_tokens: usage.total_tokens,
                  total_cost_idr: usage.total_cost_idr,
                  periodLabel: usage.periodLabel,
                };
                const delta = computeUsageDelta(closedSessionBaseline, after);
                
                if (delta.totalCalls > 0 || retryCount === maxRetries) {
                  if (!aborted && runId === sessionRunIdRef.current) {
                    setSessionDelta(delta);
                    setSessionDeltaPending(false);
                    setClosedSessionId(null);
                    setClosedSessionBaseline(null);
                  }
                  break;
                }
              }
            } catch (e) {
              console.warn(`[PDKT] Usage fetch retry ${retryCount} failed:`, e);
            }

            retryCount++;
            if (retryCount <= maxRetries) {
              await new Promise(resolve => setTimeout(resolve, retryInterval));
            }
          }
        } else if (attempts >= maxAttempts) {
          if (!aborted && runId === sessionRunIdRef.current) {
            setSessionDeltaPending(false);
            setClosedSessionId(null);
            setClosedSessionBaseline(null);
          }
          window.clearInterval(timer);
        }
      } catch (e) {
        console.warn('[PDKT] Post-close polling exception:', e);
      }
    }, 10000);

    return () => {
      aborted = true;
      window.clearInterval(timer);
    };
  }, [closedSessionId, closedSessionBaseline, user]);

  // ── Simpan settings ke localStorage + Supabase ────────
  const handleSaveSettings = async (newSettings: AppSettings) => {
    setSettings(newSettings);
    await savePdktSettings(newSettings);
  };

  const startSession = async () => {
    const activeScenarios = settings.scenarios.filter(s => s.isActive);
    if (activeScenarios.length === 0) {
      alert('Harap aktifkan minimal satu skenario di pengaturan.');
      return;
    }

    let selectedConsumerType: ConsumerType;
    if (settings.globalConsumerTypeId && settings.globalConsumerTypeId !== 'random') {
      selectedConsumerType = settings.consumerTypes.find(t => t.id === settings.globalConsumerTypeId)
        || settings.consumerTypes[Math.floor(Math.random() * settings.consumerTypes.length)];
    } else {
      selectedConsumerType = settings.consumerTypes[Math.floor(Math.random() * settings.consumerTypes.length)];
    }

    const randomProfile = DUMMY_PROFILES[Math.floor(Math.random() * DUMMY_PROFILES.length)];
    const randomCity = DUMMY_CITIES[Math.floor(Math.random() * DUMMY_CITIES.length)];
    const customIdentity = settings.customIdentity;

    const identity: Identity = {
      name: customIdentity?.senderName || randomProfile.name,
      email: customIdentity?.email || randomProfile.email,
      city: customIdentity?.city || randomCity,
      bodyName: customIdentity?.bodyName || (customIdentity?.senderName || randomProfile.name),
    };

    const resolvedConsumerNameMentionPattern =
      resolveConsumerNameMentionPattern(settings.consumerNameMentionPattern);

    const config: SessionConfig = {
      scenarios: activeScenarios,
      consumerType: selectedConsumerType,
      identity,
      enableImageGeneration: settings.enableImageGeneration ?? true,
      selectedModel: normalizeModelId(settings.selectedModel),
      resolvedConsumerNameMentionPattern,
    };

    setCurrentConfig(config);
    setView('email');
    setIsLoading(true);
    setEmails([]);
    setEvaluation(null);
    setEvaluationStatus(null);
    setEvaluationError(null);
    setCurrentSessionId(null);
    setSessionDelta(null);
    setSessionDeltaPending(false);
    setClosedSessionId(null);
    setClosedSessionBaseline(null);
    sessionBaselineRef.current = null;
    const runId = ++sessionRunIdRef.current;

    try {
      const usage = await getMyModuleUsage('pdkt');
      if (usage && runId === sessionRunIdRef.current) {
        sessionBaselineRef.current = {
          total_calls: usage.total_calls,
          total_tokens: usage.total_tokens,
          total_cost_idr: usage.total_cost_idr,
          periodLabel: usage.periodLabel,
        };
      }
    } catch (e) {
      console.warn('[PDKT] Failed to fetch usage baseline (best-effort):', e);
    }

    try {
      console.log('[PDKT] Starting session with config:', config);
      const initResult = await initializeEmailSession(config, user?.id);
      if (!initResult.success) {
        const err = 'error' in initResult ? initResult.error : 'Gagal memulai sesi.';
        console.warn('[PDKT] Failed to start session:', err);
        alert(err);
        setView('home');
        return;
      }
      console.log('[PDKT] First email received:', initResult.message);
      setEmails([initResult.message]);
      setSessionStartTime(Date.now());
    } catch (e) {
      console.warn('[PDKT] Failed to start session:', e);
      alert(
        e instanceof Error
          ? e.message
          : 'Gagal memulai sesi email. Periksa API Key atau koneksi.'
      );
      setView('home');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendReply = async (text: string) => {
    const agentEmail: EmailMessage = {
      id: Date.now().toString(),
      from: 'cc.ojk@ojk.go.id',
      to: currentConfig?.identity.email || '',
      subject: emails.length > 0 && emails[0].subject ? `Re: ${emails[0].subject}` : '',
      body: text,
      timestamp: new Date(),
      isAgent: true,
    };

    const updatedEmails = [...emails, agentEmail];
    setEmails(updatedEmails);
    setIsLoading(true);

    try {
      let duration = 0;
      if (sessionStartTime) {
        duration = Math.floor((Date.now() - sessionStartTime) / 1000);
        setTimeTaken(duration);
      }

      if (user && currentConfig) {
        const newHistoryItem = {
          user_id: user.id,
          timestamp: new Date().toISOString(),
          config: currentConfig,
          emails: updatedEmails,
          evaluation: null,
          evaluation_status: 'processing',
          evaluation_error: null,
          time_taken: duration,
        };

        const { data: historyData } = await supabase
          .from('pdkt_history')
          .insert([newHistoryItem])
          .select()
          .single();

        if (historyData) {
          const mapped = mapSessionHistory(historyData);
          setHistory(prev => [mapped, ...prev]);
          setCurrentSessionId(mapped.id);
          setEvaluation(null);
          setEvaluationStatus(mapped.evaluationStatus);
          setEvaluationError(mapped.evaluationError || null);

          void fetch('/api/pdkt/evaluate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ historyId: mapped.id }),
            keepalive: true,
          });
        }
      }
    } catch (e) {
      console.error(e);
      alert('Gagal menyimpan tanggapan.');
    } finally {
      setIsLoading(false);
    }
  };

  const endSession = () => {
    const exitingSessionId = currentSessionId;
    const exitingEvaluationStatus = evaluationStatus;
    const baseline = sessionBaselineRef.current;
    const runId = sessionRunIdRef.current;

    if (exitingSessionId && exitingEvaluationStatus === 'processing' && baseline) {
      setClosedSessionId(exitingSessionId);
      setClosedSessionBaseline(baseline);

      void (async () => {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        let retryCount = 0;
        const maxRetries = 5;
        const retryInterval = 1000;

        while (retryCount <= maxRetries) {
          if (runId !== sessionRunIdRef.current) break;

          try {
            const usage = await getMyModuleUsage('pdkt');
            if (usage) {
              const after: UsageSnapshot = {
                total_calls: usage.total_calls,
                total_tokens: usage.total_tokens,
                total_cost_idr: usage.total_cost_idr,
                periodLabel: usage.periodLabel,
              };
              const delta = computeUsageDelta(baseline, after);
              
              if (delta.totalCalls > 0 || retryCount === maxRetries) {
                if (runId === sessionRunIdRef.current) {
                  setSessionDelta(delta);
                  setSessionDeltaPending(true);
                }
                break;
              }
            }
          } catch (e) {
            console.warn(`[PDKT] Usage fetch retry ${retryCount} failed:`, e);
          }

          retryCount++;
          if (retryCount <= maxRetries) {
            await new Promise(resolve => setTimeout(resolve, retryInterval));
          }
        }
      })();
    } else if (baseline) {
      void (async () => {
        await new Promise(resolve => setTimeout(resolve, 2000));

        let retryCount = 0;
        const maxRetries = 5;
        const retryInterval = 1000;

        while (retryCount <= maxRetries) {
          if (runId !== sessionRunIdRef.current) break;

          try {
            const usage = await getMyModuleUsage('pdkt');
            if (usage) {
              const after: UsageSnapshot = {
                total_calls: usage.total_calls,
                total_tokens: usage.total_tokens,
                total_cost_idr: usage.total_cost_idr,
                periodLabel: usage.periodLabel,
              };
              const delta = computeUsageDelta(baseline, after);
              
              if (delta.totalCalls > 0 || retryCount === maxRetries) {
                if (runId === sessionRunIdRef.current) {
                  setSessionDelta(delta);
                  setSessionDeltaPending(false);
                }
                break;
              }
            }
          } catch (e) {
            console.warn(`[PDKT] Usage fetch retry ${retryCount} failed:`, e);
          }

          retryCount++;
          if (retryCount <= maxRetries) {
            await new Promise(resolve => setTimeout(resolve, retryInterval));
          }
        }
      })();
    }

    sessionBaselineRef.current = null;
    setView('home');
    setEmails([]);
    setCurrentConfig(null);
    setEvaluation(null);
    setEvaluationStatus(null);
    setEvaluationError(null);
    setCurrentSessionId(null);
    setSessionStartTime(null);
    setTimeTaken(null);
  };

  const handleSelectSession = (session: SessionHistory) => {
    setCurrentConfig(session.config);
    setEmails(session.emails);
    setEvaluation(session.evaluation);
    setEvaluationStatus(session.evaluationStatus);
    setEvaluationError(session.evaluationError || null);
    setCurrentSessionId(session.id);
    setTimeTaken(session.timeTaken);
    setView('email');
    setIsHistoryOpen(false);
  };

  const handleDeleteSession = async (id: string) => {
    const { error } = await supabase.from('pdkt_history').delete().eq('id', id);
    if (!error) setHistory(prev => prev.filter(h => h.id !== id));
    else alert('Gagal menghapus sesi.');
  };

  const handleClearHistory = async () => {
    if (!user) return;
    const { error } = await supabase.from('pdkt_history').delete().eq('user_id', user.id);
    if (!error) setHistory([]);
    else alert('Gagal menghapus riwayat.');
  };

  return (
    <div data-module="pdkt" className={`${theme.root} h-full overflow-auto transition-colors duration-500 font-sans selection:bg-primary/20 relative`}>

      <AnimatePresence mode="wait">
        {view === 'home' ? (
          <motion.div
            key="home"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="relative z-10 py-6"
          >
            <ModuleWorkspaceIntro
              eyebrow="Paham Dulu Kasih Tanggapan"
              title="Buka simulasi email dengan pengalaman workspace yang seragam."
              description="Atur skenario, telaah riwayat evaluasi, lalu lanjutkan respons email dalam satu workspace terpadu yang konsisten dengan modul lain."
              accentClassName={theme.accentText}
              accentSoftClassName={theme.accentSoftBg}
              icon={<Mail className="h-8 w-8" />}
              actions={
                <>
                  <motion.button
                    whileHover={{ scale: 1.01, y: -1 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={startSession}
                    disabled={isLoading}
                    className="module-clean-button-primary flex h-12 w-full items-center justify-center gap-2.5 rounded-xl px-5 text-[10px] font-black uppercase tracking-[0.18em] transition-all hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isLoading ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <Play className="h-4 w-4 fill-current" />}
                    <span>Mulai Simulasi</span>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.01, y: -1 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => setIsSettingsOpen(true)}
                    className="module-clean-button-secondary flex h-12 w-full items-center justify-center gap-2.5 rounded-xl px-5 text-[10px] font-black uppercase tracking-[0.18em] transition-all"
                  >
                    <Settings className="h-4 w-4 opacity-60" />
                    <span>Pengaturan</span>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.01, y: -1 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={async () => { await fetchHistory(); setIsHistoryOpen(true); }}
                    className="module-clean-button-secondary flex h-12 w-full items-center justify-center gap-2.5 rounded-xl px-5 text-[10px] font-black uppercase tracking-[0.18em] transition-all"
                  >
                    <History className="h-4 w-4 opacity-60" />
                    <span>Riwayat</span>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.01, y: -1 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => setIsUsageOpen(true)}
                    className="module-clean-button-secondary flex h-12 w-full items-center justify-center gap-2.5 rounded-xl px-5 text-[10px] font-black uppercase tracking-[0.18em] transition-all"
                  >
                    <BarChart3 className="h-4 w-4 opacity-60" />
                    <span>Usage Bulan Ini</span>
                    {sessionDelta && (sessionDelta.costIdr > 0 || sessionDelta.totalTokens > 0 || sessionDelta.totalCalls > 0) && (
                      <span className="ml-auto text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                        {formatUsageDeltaLabel(sessionDelta)} sesi terakhir
                      </span>
                    )}
                  </motion.button>
                </>
              }
            />
          </motion.div>
        ) : (
          <motion.div 
            key="email" 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 z-[100] module-clean-stage flex flex-col items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden transition-colors duration-500"
          >
            {currentConfig && (
              <div data-module="pdkt" className="module-clean-app module-clean-shell w-full max-w-5xl h-full md:max-h-[92vh] md:rounded-[2rem] overflow-hidden relative flex flex-col shadow-2xl shadow-black/10">
                <EmailInterface
                  emails={emails}
                  onSendReply={handleSendReply}
                  isLoading={isLoading}
                  config={currentConfig}
                  onEndSession={endSession}
                  evaluation={evaluation}
                  evaluationStatus={evaluationStatus}
                  evaluationError={evaluationError}
                  timeTaken={timeTaken}
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={settings} onSave={handleSaveSettings} />
      <HistoryModal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} history={history} onSelectSession={handleSelectSession} onDeleteSession={handleDeleteSession} onClearHistory={handleClearHistory} />
      <UsageModal isOpen={isUsageOpen} onClose={() => setIsUsageOpen(false)} module="pdkt" sessionDelta={sessionDelta} sessionDeltaPending={sessionDeltaPending} />
    </div>
  );
};

export default PdktPage;
