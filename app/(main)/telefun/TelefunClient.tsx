'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SettingsModal } from './components/SettingsModal';
import { HistoryModal } from './components/HistoryModal';
import { UsageModal } from './components/UsageModal';
import { PhoneInterface } from './components/PhoneInterface';
import { AppSettings, Scenario, SessionConfig } from '@/app/types';
import { Settings, PhoneCall, History, Play, BarChart3 } from 'lucide-react';
import { loadTelefunSettings, saveTelefunSettings } from './services/settingService';
import { defaultTelefunSettings } from './data';
import { resolveFinalIdentity } from './constants';
import { generateScore } from './services/geminiService';
import { persistTelefunSession, loadTelefunHistory, deleteTelefunSession, clearTelefunHistory } from './actions';
import { getMyModuleUsage } from '@/app/actions/usage';
import { type UsageSnapshot, computeUsageDelta, formatCompactIdr } from '@/app/lib/usage-snapshot';
import { createClient } from '@/app/lib/supabase/client';
import ModuleWorkspaceIntro from '@/app/components/ModuleWorkspaceIntro';

interface CallRecord {
  id: string;
  date: string;
  url: string;
  consumerName: string;
  scenarioTitle: string;
  duration: number;
  score?: number;
  feedback?: string;
}

export default function TelefunClient() {
  const [view, setView] = useState<'home' | 'chat'>('home');
  const [recordings, setRecordings] = useState<CallRecord[]>([]);
  const [settings, setSettings] = useState<AppSettings>(defaultTelefunSettings);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isUsageOpen, setIsUsageOpen] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [activeSessionConfig, setActiveSessionConfig] = useState<SessionConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [sessionDelta, setSessionDelta] = useState<ReturnType<typeof computeUsageDelta>>(null);
  const sessionBaselineRef = useRef<UsageSnapshot | null>(null);
  const sessionRunIdRef = useRef(0);
  const optimisticRecordIdRef = useRef<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const saved = await loadTelefunSettings();
      setSettings(saved);

      const historyResult = await loadTelefunHistory();
      if (historyResult.success && historyResult.records) {
        const mapped: CallRecord[] = historyResult.records.map(r => ({
          id: r.id,
          date: r.date,
          url: r.recording_url,
          consumerName: r.consumer_name,
          scenarioTitle: r.scenario_title,
          duration: r.duration,
          score: r.score,
          feedback: r.feedback ?? undefined,
        }));
        setRecordings(mapped);
      } else {
        const savedHistory = localStorage.getItem('telefun_history');
        if (savedHistory) {
          try {
            setRecordings(JSON.parse(savedHistory));
          } catch (e) {
            console.error("Failed to parse history", e);
          }
        }
      }

      const supabase = createClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (!userError && user) {
        setIsAuthReady(true);
      }

      setIsLoading(false);
    };
    init();
  }, []);

  const handleSaveSettings = async (newSettings: AppSettings) => {
    setSettings(newSettings);
    await saveTelefunSettings(newSettings);
  };

  const startCall = (scenario?: Scenario) => {
    if (!isAuthReady) {
      alert('Sesi autentikasi belum siap. Harap tunggu atau login ulang.');
      return;
    }

    const activeScenarios = settings.scenarios.filter(s => s.isActive);
    if (activeScenarios.length === 0) {
      alert('Pilih minimal satu skenario di Pengaturan.');
      setIsSettingsOpen(true);
      return;
    }
    const finalScenario = scenario || activeScenarios[Math.floor(Math.random() * activeScenarios.length)];
    setSelectedScenario(finalScenario);

    const consumerType = settings.preferredConsumerTypeId === 'random'
      ? settings.consumerTypes[Math.floor(Math.random() * settings.consumerTypes.length)]
      : (settings.consumerTypes.find(ct => ct.id === settings.preferredConsumerTypeId) || settings.consumerTypes[0]);
    const resolvedIdentity = resolveFinalIdentity(settings.identitySettings);

    const sessionConfig: SessionConfig = {
      scenarios: [finalScenario],
      consumerType,
      identity: resolvedIdentity,
      model: settings.selectedModel,
      simulationDuration: settings.maxCallDuration || 5,
      responsePacingMode: settings.responsePacingMode || 'realistic',
      maxCallDuration: settings.maxCallDuration,
    };
    setActiveSessionConfig(sessionConfig);

    setSessionDelta(null);
    sessionBaselineRef.current = null;
    const runId = ++sessionRunIdRef.current;

    void getMyModuleUsage('telefun').then((usage) => {
      if (usage && runId === sessionRunIdRef.current) {
        sessionBaselineRef.current = {
          total_calls: usage.total_calls,
          total_tokens: usage.total_tokens,
          total_cost_idr: usage.total_cost_idr,
          periodLabel: usage.periodLabel,
        };
      }
    });

    setView('chat');
  };

  const handleEndSessionOnly = () => {
    setView('home');
  };

  const handleEndCall = async (recordingUrl?: string, consumerName?: string) => {
    const sessionConfig = activeSessionConfig;
    const isValidUrl = recordingUrl && (recordingUrl.startsWith('blob:') || recordingUrl.startsWith('http'));
    
    if (isValidUrl && selectedScenario && sessionConfig) {
      let score = 0;
      let feedback = '';

      try {
        const scoring = await generateScore(sessionConfig, selectedScenario, 0);
        score = scoring.score;
        feedback = scoring.feedback;
      } catch (e) {
        console.error('[Telefun] Scoring error:', e);
      }

      const finalConsumerName = consumerName || sessionConfig.identity.name;

      const optimisticId = Date.now().toString();
      optimisticRecordIdRef.current = optimisticId;

      const newRecord: CallRecord = {
        id: optimisticId,
        date: new Date().toISOString(),
        url: recordingUrl,
        consumerName: finalConsumerName,
        scenarioTitle: selectedScenario?.title || 'Telepon Umum',
        duration: 0,
      };
      const updatedHistory = [newRecord, ...recordings];
      setRecordings(updatedHistory);
      localStorage.setItem('telefun_history', JSON.stringify(updatedHistory));

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const result = await persistTelefunSession({
          userId: user.id,
          scenarioTitle: selectedScenario.title,
          consumerName: finalConsumerName,
          consumerPhone: sessionConfig.identity.phone,
          consumerCity: sessionConfig.identity.city,
          duration: 0,
          recordingUrl,
          score,
          feedback,
        });

        if (result.success && result.session) {
          setRecordings(prev => {
            const withoutOptimistic = prev.filter(r => r.id !== optimisticId);
            const alreadyHasServerRecord = withoutOptimistic.some(r => r.id === result.session!.id);
            if (alreadyHasServerRecord) return withoutOptimistic;

            const serverRecord: CallRecord = {
              id: result.session!.id,
              date: result.session!.date,
              url: result.session!.recording_url,
              consumerName: result.session!.consumer_name,
              scenarioTitle: result.session!.scenario_title,
              duration: result.session!.duration,
              score: result.session!.score,
              feedback: result.session!.feedback || undefined,
            };
            const merged = [serverRecord, ...withoutOptimistic];
            localStorage.setItem('telefun_history', JSON.stringify(merged));
            return merged;
          });
        }
      }
    }

    const runId = sessionRunIdRef.current;
    try {
      const afterUsage = await getMyModuleUsage('telefun');
      if (afterUsage && runId === sessionRunIdRef.current) {
        const after: UsageSnapshot = {
          total_calls: afterUsage.total_calls,
          total_tokens: afterUsage.total_tokens,
          total_cost_idr: afterUsage.total_cost_idr,
          periodLabel: afterUsage.periodLabel,
        };
        const delta = computeUsageDelta(sessionBaselineRef.current, after);
        setSessionDelta(delta);
      }
    } catch (e) {
      console.warn('[Telefun] Failed to fetch post-session usage:', e);
    }

    sessionBaselineRef.current = null;
    setView('home');
  };

  const handleDeleteSession = async (id: string) => {
    const result = await deleteTelefunSession(id);
    if (!result.success) {
      alert('Gagal menghapus sesi.');
      return;
    }
    if (optimisticRecordIdRef.current === id) {
      optimisticRecordIdRef.current = null;
    }
    setRecordings(prev => prev.filter(r => r.id !== id));
    const savedHistory = localStorage.getItem('telefun_history');
    if (savedHistory) {
      try {
        const local: CallRecord[] = JSON.parse(savedHistory);
        const updated = local.filter(r => r.id !== id);
        localStorage.setItem('telefun_history', JSON.stringify(updated));
      } catch {
        // ignore local cache errors
      }
    }
  };

  const handleClearHistory = async () => {
    const result = await clearTelefunHistory();
    if (!result.success) {
      alert('Gagal menghapus riwayat.');
      return;
    }
    optimisticRecordIdRef.current = null;
    setRecordings([]);
    localStorage.removeItem('telefun_history');
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-background transition-colors duration-500 font-sans selection:bg-primary/30">
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
              eyebrow="Voice Simulation Trainer"
              title="Siapkan simulasi telepon dari workspace yang lebih terpadu."
              description="Simulasi panggilan telepon dengan konsumen AI untuk melatih kemampuan penanganan keluhan."
              accentClassName="text-module-telefun"
              accentSoftClassName="bg-module-telefun/10"
              icon={<PhoneCall className="h-8 w-8" />}
              actions={
                <>
                  <motion.button
                    whileHover={{ scale: 1.01, y: -1 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => startCall()}
                    disabled={isLoading || !isAuthReady}
                    className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-primary px-6 text-[11px] font-black uppercase tracking-[0.22em] text-primary-foreground shadow-xl shadow-primary/20 transition hover:opacity-90 disabled:opacity-70"
                  >
                    {isLoading || !isAuthReady ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground/20 border-t-primary-foreground" /> : <Play className="h-4 w-4 fill-current" />}
                    <span>Mulai Panggilan</span>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.01, y: -1 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => setIsSettingsOpen(true)}
                    className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-2xl border border-primary/20 bg-primary/10 px-6 text-[11px] font-black uppercase tracking-[0.22em] text-primary transition"
                  >
                    <Settings className="h-4 w-4 opacity-70" />
                    <span>Opsi</span>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.01, y: -1 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => setIsHistoryOpen(true)}
                    className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-2xl border border-primary/20 bg-primary/10 px-6 text-[11px] font-black uppercase tracking-[0.22em] text-primary transition"
                  >
                    <History className="h-4 w-4 opacity-70" />
                    <span>Riwayat</span>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.01, y: -1 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => setIsUsageOpen(true)}
                    className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-2xl border border-primary/20 bg-primary/10 px-6 text-[11px] font-black uppercase tracking-[0.22em] text-primary transition"
                  >
                    <BarChart3 className="h-4 w-4 opacity-70" />
                    <span>Usage</span>
                    {sessionDelta && sessionDelta.costIdr > 0 && (
                      <span className="ml-1 text-[9px] font-bold text-primary/70">
                        +{formatCompactIdr(sessionDelta.costIdr)}
                      </span>
                    )}
                  </motion.button>
                </>
              }
            />
          </motion.div>
        ) : (
          <motion.div
            key="chat"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col bg-background"
          >
            <PhoneInterface
              config={activeSessionConfig!}
              onEndSession={handleEndSessionOnly}
              onRecordingReady={(url, name) => handleEndCall(url, name)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />
      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={recordings}
        onDeleteSession={handleDeleteSession}
        onClearHistory={handleClearHistory}
      />
      <UsageModal
        isOpen={isUsageOpen}
        onClose={() => setIsUsageOpen(false)}
        sessionDelta={sessionDelta}
        sessionDeltaPending={false}
      />
    </div>
  );
}
