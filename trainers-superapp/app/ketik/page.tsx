'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, History, Play, ArrowLeft, MessageSquare } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppSettings, ChatSession, SessionConfig, Scenario, ConsumerType, Identity } from '../types';
import { defaultSettings } from './data';
import { DEFAULT_SCENARIOS, DEFAULT_CONSUMER_TYPES, parseSettings } from './constants';
import { SettingsModal } from './components/SettingsModal';
import { HistoryModal } from './components/HistoryModal';
import { ChatInterface } from './components/ChatInterface';
import { createClient } from '../lib/supabase/client';
import { loadSettings, saveSettings } from './services/settingService';

const supabase = createClient();

export default function AppKetik() {
  const router = useRouter();
  const [view, setView] = useState<'home' | 'chat'>('home');
  const [user, setUser] = useState<any>(null);

  const [settings, setSettings] = useState<AppSettings>(defaultSettings);

  const [history, setHistory] = useState<ChatSession[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentConfig, setCurrentConfig] = useState<SessionConfig | null>(null);
  const [currentScenario, setCurrentScenario] = useState<Scenario | null>(null);
  const [reviewMessages, setReviewMessages] = useState<any[]>([]);

  // Get user on mount
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
      const loaded = await loadSettings();
      setSettings(loaded);
    };
    initSettings();
  }, [user]);

  // ── Load history dari Supabase ────────────────────────
  useEffect(() => {
    if (!user) return;

    const fetchHistory = async () => {
      const { data, error } = await supabase
        .from('ketik_history')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (error) { console.error('Error fetching history:', error); return; }

      if (data) {
        setHistory(data.map(item => ({
          id: item.id,
          date: new Date(item.date),
          scenarioTitle: item.scenario_title,
          consumerName: item.consumer_name,
          consumerPhone: item.consumer_phone,
          consumerCity: item.consumer_city,
          messages: item.messages,
        })));
      }
    };

    fetchHistory();
  }, [user]);

  // ── Simpan settings ke localStorage + Supabase ────────
  const handleSaveSettings = async (newSettings: AppSettings) => {
    setSettings(newSettings);
    await saveSettings(newSettings);
  };

  const handleClearHistory = async () => {
    if (!user) return;
    const { error } = await supabase.from('ketik_history').delete().eq('user_id', user.id);
    if (!error) setHistory([]);
    else alert('Gagal menghapus riwayat.');
  };

  const handleDeleteSession = async (id: string) => {
    const { error } = await supabase.from('ketik_history').delete().eq('id', id);
    if (!error) setHistory(prev => prev.filter(s => s.id !== id));
    else alert('Gagal menghapus sesi.');
  };

  const startSimulation = () => {
    const activeScenarios = settings.scenarios.filter(s => s.isActive);
    if (activeScenarios.length === 0) {
      alert('Pilih minimal satu skenario di Pengaturan.');
      setIsSettingsOpen(true);
      return;
    }
    const scenario = activeScenarios[Math.floor(Math.random() * activeScenarios.length)];

    let consumerType: ConsumerType;
    if (settings.activeConsumerTypeId === 'random') {
      consumerType = settings.consumerTypes[Math.floor(Math.random() * settings.consumerTypes.length)];
    } else {
      consumerType = settings.consumerTypes.find(c => c.id === settings.activeConsumerTypeId) || settings.consumerTypes[0];
    }

    const dummyNames = ['Budi Santoso','Siti Aminah','Agus Setiawan','Dewi Lestari','Rina Wati','Eko Prasetyo','Sri Wahyuni','Muhammad Rizky','Nurul Hidayah','Bambang Sutrisno','Ratna Sari','Dedi Kurniawan','Andi Wijaya','Sari Indah','Maya Putri','Doni Pratama','Indra Lesmana','Yulia Rachmawati','Fajar Nugraha','Diana Puspita'];
    const dummyCities = ['Jakarta Selatan','Jakarta Pusat','Jakarta Barat','Jakarta Timur','Jakarta Utara','Kota Bogor','Kab. Bogor','Kota Depok','Kota Tangerang','Kota Tangerang Selatan','Kab. Tangerang','Kota Bekasi','Kab. Bekasi','Kota Bandung','Kota Surabaya','Kota Medan','Kota Semarang','Kota Makassar','Kota Palembang','Kota Denpasar'];
    const phonePrefixes = ['0812','0813','0821','0852','0857','0858','0877','0878','0819','0896','0838'];

    const identity: Identity = {
      name: settings.identitySettings.displayName || dummyNames[Math.floor(Math.random() * dummyNames.length)],
      city: settings.identitySettings.city || dummyCities[Math.floor(Math.random() * dummyCities.length)],
      phone: settings.identitySettings.phoneNumber || `${phonePrefixes[Math.floor(Math.random() * phonePrefixes.length)]}${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`,
      signatureName: settings.identitySettings.signatureName,
    };

    const config: SessionConfig = {
      scenarios: activeScenarios,
      consumerType,
      identity,
      model: settings.selectedModel,
      simulationDuration: settings.simulationDuration || 5,
    };

    setCurrentConfig(config);
    setCurrentScenario(scenario);
    setReviewMessages([]);
    setIsLoading(true);
    setTimeout(() => { setIsLoading(false); setView('chat'); }, 500);
  };

  const endSession = async (messages: any[]) => {
    if (user && currentConfig && currentScenario && messages.length > 0 && currentScenario.id !== 'review') {
      setIsLoading(true);
      try {
        // 1. Generate Score via AI
        const { score, feedback } = await import('./services/geminiService').then(m => 
          m.generateScore(currentConfig, currentScenario, messages)
        );

        // 2. Save to ketik_history (existing)
        const sessionData = {
          user_id: user.id,
          date: new Date().toISOString(),
          scenario_title: currentScenario.title,
          consumer_name: currentConfig.identity.name,
          consumer_phone: currentConfig.identity.phone,
          consumer_city: currentConfig.identity.city,
          messages,
        };

        const { data: historyData, error: historyError } = await supabase.from('ketik_history').insert([sessionData]).select().single();

        if (historyData) {
          setHistory([{
            id: historyData.id,
            date: new Date(historyData.date),
            scenarioTitle: historyData.scenario_title,
            consumerName: historyData.consumer_name,
            consumerPhone: historyData.consumer_phone,
            consumerCity: historyData.consumer_city,
            messages: historyData.messages,
          }, ...history]);
        }

        // 3. Save to results table (new)
        const resultData = {
          user_id: user.id,
          module: 'ketik',
          score: score,
          details: {
            scenario: currentScenario.title,
            feedback: feedback,
            consumer: currentConfig.identity.name,
            messageCount: messages.length
          }
        };

        await supabase.from('results').insert([resultData]);

      } catch (err) {
        console.error('Error ending session:', err);
      } finally {
        setIsLoading(false);
      }
    }
    setView('home');
    setCurrentConfig(null);
    setCurrentScenario(null);
    setReviewMessages([]);
  };

  const handleReviewHistory = (session: ChatSession) => {
    setCurrentConfig({
      scenarios: settings.scenarios,
      consumerType: settings.consumerTypes[0],
      identity: { name: session.consumerName, city: session.consumerCity || '', phone: session.consumerPhone || '0812...' },
      model: settings.selectedModel,
      simulationDuration: 5,
    });
    setCurrentScenario({ id: 'review', title: session.scenarioTitle, description: '', category: 'Review', isActive: true });
    setReviewMessages(session.messages);
    setIsHistoryOpen(false);
    setView('chat');
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
                <MessageSquare className="w-14 h-14 text-primary-foreground" />
              </motion.div>
              <h1 className="text-4xl font-bold text-foreground mb-3 tracking-tighter">Ketik <span className="text-primary/60">V3</span></h1>
              <h2 className="text-[10px] font-bold text-primary uppercase tracking-[0.3em] mb-6">Kelas Etika & Trik Komunikasi</h2>
              <p className="text-foreground/50 text-sm leading-relaxed max-w-sm mx-auto font-light">
                Asah kemampuan penanganan chat Anda. Tingkatkan kualitas layanan melalui komunikasi tulis yang empatik, profesional, dan solutif.
              </p>
            </div>

            <div className="space-y-4">
              <motion.button 
                whileHover={{ scale: 1.02 }} 
                whileTap={{ scale: 0.98 }} 
                onClick={startSimulation} 
                disabled={isLoading} 
                className="w-full bg-primary text-primary-foreground h-16 rounded-2xl font-bold text-lg shadow-xl shadow-primary/20 flex items-center justify-center gap-3 transition-all hover:opacity-90"
              >
                {isLoading ? <div className="w-6 h-6 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : <><Play className="w-5 h-5 fill-current" /><span>Mulai Simulasi</span></>}
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
            key="chat" 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center p-0 md:p-8 overflow-hidden transition-colors duration-500"
          >
            <div className="w-full max-w-6xl h-full bg-card md:rounded-[3rem] shadow-2xl overflow-hidden relative border border-border flex flex-col">
              {currentConfig && currentScenario && (
                <ChatInterface 
                  config={currentConfig} 
                  scenario={currentScenario} 
                  onEndSession={endSession} 
                  isReviewMode={currentScenario.id === 'review'} 
                  initialMessages={reviewMessages} 
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={settings} onSave={handleSaveSettings} />
      <HistoryModal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} history={history} onClear={handleClearHistory} onDelete={handleDeleteSession} onReview={handleReviewHistory} />
    </div>
  );
}

