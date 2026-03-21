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
    <div className="min-h-screen bg-background flex items-center justify-center p-6 transition-colors duration-500 font-sans selection:bg-primary/30 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px] animate-pulse delay-700" />

      <AnimatePresence mode="wait">
        {view === 'home' ? (
          <motion.div
            key="home"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="max-w-xl w-full bg-card/40 backdrop-blur-3xl rounded-[3rem] p-12 md:p-16 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] border border-white/10 relative z-10"
          >
            <div className="absolute top-8 left-8 z-20">
              <Link href="/dashboard" className="w-14 h-14 flex items-center justify-center rounded-2xl bg-foreground/5 text-foreground/40 hover:text-foreground hover:bg-foreground/10 transition-all group border border-transparent hover:border-border/50">
                <ArrowLeft className="w-6 h-6 group-hover:-translate-x-1 transition-transform" />
              </Link>
            </div>

            <div className="text-center mb-16 mt-10">
              <motion.div 
                initial={{ rotate: -15, scale: 0.8, opacity: 0 }} 
                animate={{ rotate: 0, scale: 1, opacity: 1 }} 
                transition={{ delay: 0.2, type: 'spring', stiffness: 150 }} 
                className="w-32 h-32 bg-gradient-to-br from-primary to-primary/80 rounded-[3rem] mx-auto mb-12 flex items-center justify-center shadow-[0_20px_40px_-10px_rgba(var(--primary),0.3)] relative group cursor-default"
              >
                <div className="absolute inset-0 bg-white/20 rounded-[3rem] blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <Mail className="h-16 w-16 text-primary-foreground relative z-10" />
              </motion.div>
              
              <h1 className="text-6xl font-black text-foreground mb-4 tracking-tighter">PDKT</h1>
              <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-8">
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                <h2 className="text-[10px] font-black text-primary uppercase tracking-[0.4em]">Paham Dulu Kasih Tanggapan</h2>
              </div>
              
              <p className="text-foreground/40 text-base leading-relaxed max-w-sm mx-auto font-medium">
                Asah kemampuan penulisan komunikasi formal Anda melalui simulasi email yang cerdas dan responsif.
              </p>
            </div>

            <div className="space-y-6">
              <motion.button 
                whileHover={{ scale: 1.02, y: -2 }} 
                whileTap={{ scale: 0.98 }} 
                onClick={startSession} 
                disabled={isLoading} 
                className="w-full bg-primary text-primary-foreground h-20 rounded-[2rem] font-black text-xl shadow-[0_20px_40px_-12px_rgba(var(--primary),0.4)] flex items-center justify-center gap-4 transition-all hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                {isLoading ? (
                  <div className="w-7 h-7 border-3 border-primary-foreground/20 border-t-primary-foreground rounded-full animate-spin" />
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Play className="w-5 h-5 fill-current" />
                    </div>
                    <span>Mulai Simulasi Baru</span>
                  </>
                )}
              </motion.button>
              
              <div className="grid grid-cols-2 gap-6">
                <motion.button 
                  whileHover={{ scale: 1.02, y: -2 }} 
                  whileTap={{ scale: 0.98 }} 
                  onClick={() => setIsSettingsOpen(true)} 
                  className="bg-foreground/5 hover:bg-foreground/10 text-foreground/60 h-20 rounded-[1.5rem] font-extrabold flex items-center justify-center gap-3 transition-all border border-border/50 hover:border-border "
                >
                  <Settings className="w-5 h-5" />
                  <span className="text-[11px] uppercase tracking-widest">Pengaturan</span>
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.02, y: -2 }} 
                  whileTap={{ scale: 0.98 }} 
                  onClick={() => setIsHistoryOpen(true)} 
                  className="bg-foreground/5 hover:bg-foreground/10 text-foreground/60 h-20 rounded-[1.5rem] font-extrabold flex items-center justify-center gap-3 transition-all border border-border/50 hover:border-border "
                >
                  <History className="w-5 h-5" />
                  <span className="text-[11px] uppercase tracking-widest">Riwayat</span>
                </motion.button>
              </div>
            </div>

            <div className="mt-16 pt-8 border-t border-border/50 flex flex-col items-center gap-4">
              <div className="flex items-center gap-6 opacity-20 grayscale brightness-0 inversion-filter dark:invert transition-all hover:opacity-40">
                <div className="text-[10px] font-black tracking-[0.3em]">GOOGLE GEMINI</div>
                <div className="w-1.5 h-1.5 bg-foreground rounded-full" />
                <div className="text-[10px] font-black tracking-[0.3em]">KONTAK OJK 157</div>
              </div>
              <p className="text-[9px] font-bold text-foreground/20 uppercase tracking-[0.2em]">Trainers SuperApp · Simulation Module v2.0</p>
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
