'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, History, Play, ArrowLeft, MessageSquare } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppSettings, ChatSession, SessionConfig, Scenario, ConsumerType, Identity } from '@/app/types';
import { defaultSettings } from './data';
import { DEFAULT_SCENARIOS, DEFAULT_CONSUMER_TYPES, parseSettings } from './constants';
import { SettingsModal } from './components/SettingsModal';
import { HistoryModal } from './components/HistoryModal';
import { ChatInterface } from './components/ChatInterface';
import { createClient } from '@/app/lib/supabase/client';
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
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) console.error('Error getting user:', error);
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

      if (error) { 
        console.error('Error fetching history:', {
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
            className="max-w-xl w-full bg-card/40 backdrop-blur-3xl rounded-[2rem] p-6 md:p-8 shadow-3xl border border-border/50 relative z-10 overflow-hidden"
          >
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full blur-[80px] -mr-24 -mt-24 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/5 rounded-full blur-[60px] -ml-16 -mb-16 pointer-events-none" />

            <div className="absolute top-8 left-8 z-20">
              <Link href="/dashboard" className="w-12 h-12 flex items-center justify-center rounded-2xl bg-foreground/5 text-foreground/40 hover:bg-foreground/10 hover:text-foreground transition-all border border-border/50">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </div>

            <div className="text-center mb-8 mt-4 relative z-10">
              <motion.div 
                initial={{ rotate: -10, scale: 0.8 }} 
                animate={{ rotate: 0, scale: 1 }} 
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }} 
                className="w-20 h-20 bg-primary rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-2xl shadow-primary/30 relative"
              >
                <MessageSquare className="w-10 h-10 text-white" />
                <div className="absolute inset-0 bg-white/20 rounded-2xl blur-xl opacity-0 hover:opacity-100 transition-opacity duration-500" />
              </motion.div>
              <h1 className="text-4xl font-black text-foreground mb-2 tracking-tighter text-center">Ketik</h1>
              <h2 className="text-[10px] font-black text-primary uppercase tracking-[0.4em] mb-4 opacity-80">Kelas Etika & Trik Komunikasi</h2>
              <p className="text-foreground/70 text-xs leading-relaxed max-w-sm mx-auto font-medium">
                Asah kemampuan penanganan chat Anda. Tingkatkan kualitas layanan melalui komunikasi tulis yang empatik, profesional, dan solutif.
              </p>
            </div>

            <div className="space-y-4 relative z-10">
              <motion.button 
                whileHover={{ scale: 1.02, y: -2 }} 
                whileTap={{ scale: 0.98 }} 
                onClick={startSimulation} 
                disabled={isLoading} 
                className="w-full bg-primary text-white h-20 rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-2xl shadow-primary/20 flex items-center justify-center gap-3 transition-all hover:bg-primary/90"
              >
                {isLoading ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Play className="w-4 h-4 fill-current" /><span>Mulai Simulasi</span></>}
              </motion.button>
              
              <div className="grid grid-cols-2 gap-4">
                <motion.button 
                  whileHover={{ scale: 1.02, y: -1 }} 
                  whileTap={{ scale: 0.98 }} 
                  onClick={() => setIsSettingsOpen(true)} 
                  className="bg-foreground/5 hover:bg-foreground/10 text-foreground/60 h-20 rounded-[2rem] font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 transition-all border border-border/50"
                >
                  <Settings className="w-4 h-4 opacity-40" /><span>Opsi</span>
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.02, y: -1 }} 
                  whileTap={{ scale: 0.98 }} 
                  onClick={() => setIsHistoryOpen(true)} 
                  className="bg-foreground/5 hover:bg-foreground/10 text-foreground/60 h-20 rounded-[2rem] font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 transition-all border border-border/50"
                >
                  <History className="w-4 h-4 opacity-40" /><span>Riwayat</span>
                </motion.button>
              </div>
            </div>

            <div className="mt-12 flex flex-col items-center gap-1.5">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-foreground/60">Powered by Google Gemini</p>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-foreground/40">Trainers SuperApp | Made by Fajar & Ratna</p>
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

