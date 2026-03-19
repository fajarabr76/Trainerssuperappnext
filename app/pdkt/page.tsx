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
import { createClient } from '../lib/supabase/client';

const PdktPage: React.FC = () => {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [view, setView] = useState<'home' | 'email'>('home');
  const supabase = createClient();

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

      if (error) { console.error('Error fetching PDKT history:', error); return; }

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
    };

    setCurrentConfig(config);
    setView('email');
    setIsLoading(true);
    setEmails([]);
    setEvaluation(null);

    try {
      console.log('[PDKT] Starting session with config:', config);
      const firstEmail = await initializeEmailSession(config);
      console.log('[PDKT] First email received:', firstEmail);
      setEmails([firstEmail]);
      setSessionStartTime(Date.now());
    } catch (e) {
      console.error('[PDKT] Failed to start session:', e);
      alert('Gagal memulai sesi email. Periksa API Key atau koneksi.');
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
    <div className="min-h-screen bg-background flex items-center justify-center p-4 transition-colors duration-500 font-sans selection:bg-primary/30">
      <AnimatePresence mode="wait">
        {view === 'home' ? (
          <motion.div
            key="home"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="max-w-md w-full bg-card/80 backdrop-blur-2xl rounded-[3rem] p-10 md:p-12 shadow-2xl border border-border relative z-10"
          >
            <div className="absolute top-8 left-8 z-20">
              <Link href="/dashboard" className="w-12 h-12 flex items-center justify-center rounded-2xl bg-foreground/5 text-foreground/60 hover:bg-foreground/10 transition-all">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </div>

            <div className="text-center mb-12 mt-8">
              <motion.div 
                initial={{ rotate: -10, scale: 0.8 }} 
                animate={{ rotate: 0, scale: 1 }} 
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }} 
                className="w-28 h-28 bg-primary rounded-[2.5rem] mx-auto mb-10 flex items-center justify-center shadow-2xl shadow-primary/20"
              >
                <Mail className="h-14 w-14 text-primary-foreground" />
              </motion.div>
              <h1 className="text-4xl font-bold text-foreground mb-3 tracking-tighter">PDKT</h1>
              <h2 className="text-[10px] font-bold text-primary uppercase tracking-[0.3em] mb-6">Paham Dulu Kasih Tanggapan</h2>
              <p className="text-foreground/50 text-sm leading-relaxed max-w-sm mx-auto font-light">
                Asah kemampuan penanganan email Anda. Siap hadapi berbagai keluhan konsumen dengan respon yang tepat, profesional, dan empatik.
              </p>
            </div>

            <div className="space-y-4">
              <motion.button 
                whileHover={{ scale: 1.02 }} 
                whileTap={{ scale: 0.98 }} 
                onClick={startSession} 
                disabled={isLoading} 
                className="w-full bg-primary text-primary-foreground h-16 rounded-2xl font-bold text-lg shadow-xl shadow-primary/20 flex items-center justify-center gap-3 transition-all hover:opacity-90 disabled:opacity-70"
              >
                {isLoading ? (
                  <div className="w-6 h-6 border-2 border-primary-foreground/20 border-t-primary-foreground rounded-full animate-spin" />
                ) : (
                  <>
                    <Play className="w-5 h-5 fill-current" /><span>Mulai Tiket Baru</span>
                  </>
                )}
              </motion.button>
              
              <div className="grid grid-cols-2 gap-4">
                <motion.button 
                  whileHover={{ scale: 1.02 }} 
                  whileTap={{ scale: 0.98 }} 
                  onClick={() => setIsSettingsOpen(true)} 
                  className="bg-primary/10 hover:bg-primary/20 text-primary h-16 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all border border-primary/20"
                >
                  <Settings className="w-5 h-5 opacity-70" /><span>Opsi</span>
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.02 }} 
                  whileTap={{ scale: 0.98 }} 
                  onClick={() => setIsHistoryOpen(true)} 
                  className="bg-primary/10 hover:bg-primary/20 text-primary h-16 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all border border-primary/20"
                >
                  <History className="w-5 h-5 opacity-70" /><span>Riwayat</span>
                </motion.button>
              </div>
            </div>

            <div className="mt-12 flex flex-col items-center gap-2">
              <div className="text-[9px] text-foreground/20 font-bold uppercase tracking-[0.2em] flex flex-col gap-1 items-center text-center">
                <span className="text-foreground/20 font-bold tracking-widest">POWERED BY GOOGLE GEMINI</span>
                <span>TRAINERS SUPERAPP · KONTAK OJK 157 EDITION</span>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="email" 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center p-0 md:p-8 overflow-hidden transition-colors duration-500"
          >
            {currentConfig && (
              <div className="w-full h-full bg-card md:rounded-[3rem] overflow-hidden relative shadow-2xl border border-border flex flex-col">
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
