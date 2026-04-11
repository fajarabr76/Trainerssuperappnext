'use client';

import React, { useState, useEffect } from 'react';
import { SettingsModal } from './components/SettingsModal';
import { EmailInterface } from './components/EmailInterface';
import { HistoryModal } from './components/HistoryModal';
import { AppSettings, SessionConfig, Identity, ConsumerType, EmailMessage, EvaluationResult, SessionHistory } from './types';
import { DEFAULT_SCENARIOS, DEFAULT_CONSUMER_TYPES, DUMMY_CITIES, DUMMY_PROFILES } from './constants';
import { initializeEmailSession, evaluateAgentResponse } from './services/geminiService';
import { loadPdktSettings, savePdktSettings, defaultPdktSettings } from './services/settingService';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, History, Settings, Play, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { createClient } from '@/app/lib/supabase/client';
import { moduleTheme } from '@/app/components/ui/moduleTheme';

const supabase = createClient();

const PdktPage: React.FC = () => {
  const theme = moduleTheme.pdkt;
  const router = useRouter();
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
  const [history, setHistory] = useState<SessionHistory[]>([]);
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentConfig, setCurrentConfig] = useState<SessionConfig | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [timeTaken, setTimeTaken] = useState<number | null>(null);

  // ── Get User ──────────────────────────────────────────
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, [supabase.auth]);

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
  useEffect(() => {
    if (!user) return;

    const fetchHistory = async () => {
      const { data, error } = await supabase
        .from('pdkt_history')
        .select('*')
        .eq('user_id', user.id)
        .order('timestamp', { ascending: false });

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
        setHistory(data.map(item => ({
          id: item.id,
          timestamp: safeDate(item.timestamp),
          config: item.config,
          emails: item.emails,
          evaluation: item.evaluation,
          timeTaken: item.time_taken,
        })));
      }
    };

    fetchHistory();
  }, [user, supabase]);

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

    const config: SessionConfig = {
      scenarios: activeScenarios,
      consumerType: selectedConsumerType,
      identity,
      enableImageGeneration: settings.enableImageGeneration ?? true,
      model: settings.selectedModel || 'gemini-3-flash-preview',
    };

    setCurrentConfig(config);
    setView('email');
    setIsLoading(true);
    setEmails([]);
    setEvaluation(null);

    try {
      console.log('[PDKT] Starting session with config:', config);
      const initResult = await initializeEmailSession(config);
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
    const lastConsumerEmail = emails.filter(e => !e.isAgent).pop();
    const consumerContext = lastConsumerEmail ? lastConsumerEmail.body : 'Konteks tidak ditemukan.';

    const agentEmail: EmailMessage = {
      id: Date.now().toString(),
      from: 'cc.ojk@ojk.go.id',
      to: currentConfig?.identity.email || '',
      subject: emails.length > 0 ? `Re: ${emails[0].subject}` : 'Re: Ticket',
      body: text,
      timestamp: new Date(),
      isAgent: true,
    };

    const updatedEmails = [...emails, agentEmail];
    setEmails(updatedEmails);
    setIsLoading(true);

    try {
      const result = await evaluateAgentResponse(text, consumerContext);
      setEvaluation(result);

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
          evaluation: result,
          time_taken: duration,
        };

        const { data: historyData, error: historyError } = await supabase
          .from('pdkt_history')
          .insert([newHistoryItem])
          .select()
          .single();

        if (historyData) {
          setHistory(prev => [{
            id: historyData.id,
            timestamp: safeDate(historyData.timestamp),
            config: historyData.config,
            emails: historyData.emails,
            evaluation: historyData.evaluation,
            timeTaken: historyData.time_taken,
          }, ...prev]);
        }

        // 3. Save to results table (new)
        const resultData = {
          user_id: user.id,
          module: 'pdkt',
          score: result.score,
          details: {
            subject: updatedEmails.length > 0 ? updatedEmails[0].subject : 'No Subject',
            feedback: result.feedback,
            consumer: currentConfig.identity.name,
            timeTaken: duration
          }
        };

        await supabase.from('results').insert([resultData]);
      }
    } catch (e) {
      console.error(e);
      alert('Gagal mengevaluasi jawaban.');
    } finally {
      setIsLoading(false);
    }
  };

  const endSession = () => {
    setView('home');
    setEmails([]);
    setCurrentConfig(null);
    setEvaluation(null);
    setSessionStartTime(null);
    setTimeTaken(null);
  };

  const handleSelectSession = (session: SessionHistory) => {
    setCurrentConfig(session.config);
    setEmails(session.emails);
    setEvaluation(session.evaluation);
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
    <div data-module="pdkt" className={`${theme.root} h-full overflow-auto flex items-center justify-center p-6 transition-colors duration-500 font-sans selection:bg-primary/20 relative`}>

      <AnimatePresence mode="wait">
        {view === 'home' ? (
          <motion.div
            key="home"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="module-clean-shell max-w-xl w-full rounded-3xl p-6 md:p-8 relative z-10"
          >
            <div className="absolute top-8 left-8 z-20">
              <Link href="/dashboard"
                className="module-clean-button-secondary w-10 h-10 flex items-center justify-center rounded-xl
                           text-foreground/40 hover:text-foreground hover:bg-foreground/10
                           transition-all group">
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              </Link>
            </div>

            <div className="text-center mb-8 mt-4">
              <motion.div 
                initial={{ rotate: -15, scale: 0.8, opacity: 0 }} 
                animate={{ rotate: 0, scale: 1, opacity: 1 }} 
                transition={{ delay: 0.2, type: 'spring', stiffness: 150 }} 
                className="module-clean-hero-icon w-20 h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center relative group cursor-default"
              >
                <Mail className="h-10 w-10 text-primary-foreground relative z-10" />
              </motion.div>
              
              <h1 className="text-4xl font-black text-foreground mb-2 tracking-tighter">PDKT</h1>
              <div className="module-clean-chip inline-flex items-center gap-3 px-4 py-1.5 rounded-full mb-4">
                <span className="w-1.5 h-1.5 bg-module-pdkt rounded-full animate-pulse" />
                <h2 className="text-[10px] font-black uppercase tracking-[0.4em]">Paham Dulu Kasih Tanggapan</h2>
              </div>
              
              <p className="text-foreground/70 text-[13px] leading-relaxed max-w-sm mx-auto font-medium">
                Asah kemampuan penulisan komunikasi formal Anda melalui simulasi email yang cerdas dan responsif.
              </p>
            </div>

            <div className="relative z-10 mt-8 flex flex-col gap-3">
              <motion.button 
                whileHover={{ scale: 1.02, y: -1 }} 
                whileTap={{ scale: 0.98 }} 
                onClick={startSession} 
                disabled={isLoading} 
                className="module-clean-button-primary w-full h-14 px-6 rounded-2xl font-black text-[11px] uppercase tracking-[0.22em] flex items-center justify-center gap-3 transition-all hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>Mulai Simulasi</span>
                  </>
                )}
              </motion.button>

              <motion.button 
                whileHover={{ scale: 1.02, y: -1 }} 
                whileTap={{ scale: 0.98 }} 
                onClick={() => setIsSettingsOpen(true)} 
                className="module-clean-button-secondary w-full h-14 px-6 rounded-2xl font-black text-[11px] uppercase tracking-[0.22em] flex items-center justify-center gap-3 transition-all"
              >
                <Settings className="w-4 h-4 opacity-50" />
                <span>Pengaturan</span>
              </motion.button>

              <motion.button 
                whileHover={{ scale: 1.02, y: -1 }} 
                whileTap={{ scale: 0.98 }} 
                onClick={() => setIsHistoryOpen(true)} 
                className="module-clean-button-secondary w-full h-14 px-6 rounded-2xl font-black text-[11px] uppercase tracking-[0.22em] flex items-center justify-center gap-3 transition-all"
              >
                <History className="w-4 h-4 opacity-50" />
                <span>Riwayat</span>
              </motion.button>
            </div>

            <div className="mt-16 pt-8 border-t border-border/50 flex flex-col items-center gap-1.5">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-foreground/40">Trainers SuperApp | Made by Fajar & Ratna</p>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="email" 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 z-[100] module-clean-stage flex flex-col items-center justify-center p-0 md:p-8 overflow-hidden transition-colors duration-500"
          >
            {currentConfig && (
              <div data-module="pdkt" className="module-clean-app module-clean-shell w-full h-full md:rounded-[3rem] overflow-hidden relative flex flex-col">
                <EmailInterface emails={emails} onSendReply={handleSendReply} isLoading={isLoading} config={currentConfig} onEndSession={endSession} evaluation={evaluation} timeTaken={timeTaken} />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={settings} onSave={handleSaveSettings} />
      <HistoryModal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} history={history} onSelectSession={handleSelectSession} onDeleteSession={handleDeleteSession} onClearHistory={handleClearHistory} />
    </div>
  );
};

export default PdktPage;
