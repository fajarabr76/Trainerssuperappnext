'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, History, Play, MessageSquare } from 'lucide-react';
import { AppSettings, ChatSession, SessionConfig, Scenario, ConsumerType, Identity, ChatMessage } from '@/app/types';
import { defaultSettings } from './data';
import { SettingsModal } from './components/SettingsModal';
import { HistoryModal } from './components/HistoryModal';
import { ChatInterface } from './components/ChatInterface';
import { createClient } from '@/app/lib/supabase/client';
import { loadSettings, saveSettings } from './services/settingService';
import { moduleTheme } from '@/app/components/ui/moduleTheme';
import ModuleWorkspaceIntro from '@/app/components/ModuleWorkspaceIntro';
import { User } from '@supabase/supabase-js';

const supabase = createClient();

function safeDate(value: unknown): Date {
  if (!value) return new Date();
  const d = new Date(value as string);
  return isNaN(d.getTime()) ? new Date() : d;
}

export default function AppKetik() {
  const theme = moduleTheme.ketik;
  const [view, setView] = useState<'home' | 'chat'>('home');
  const [user, setUser] = useState<User | null>(null);

  const [settings, setSettings] = useState<AppSettings>(defaultSettings);

  const [history, setHistory] = useState<ChatSession[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentConfig, setCurrentConfig] = useState<SessionConfig | null>(null);
  const [currentScenario, setCurrentScenario] = useState<Scenario | null>(null);
  const [reviewMessages, setReviewMessages] = useState<ChatMessage[]>([]);

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
      if (!user?.id) return;
      const { data, error } = await supabase
        .from('ketik_history')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (error) {
        console.error('Error fetching ketik_history:', error);
        return;
      }

      setHistory((data || []).map((item) => ({
        id: item.id,
        date: safeDate(item.date ?? item.created_at),
        scenarioTitle: item.scenario_title || 'Simulation Chat',
        consumerName: item.consumer_name || 'Consumer',
        consumerPhone: item.consumer_phone,
        consumerCity: item.consumer_city,
        messages: Array.isArray(item.messages) ? item.messages : [],
      })));
    };

    fetchHistory();
  }, [user]);

  // ── Simpan settings ke localStorage + Supabase ────────
  const handleSaveSettings = async (newSettings: AppSettings) => {
    setSettings(newSettings);
    await saveSettings(newSettings);
  };

  const handleClearHistory = async () => {
    if (!user?.id) return;
    const [res1, res2] = await Promise.all([
      supabase.from('ketik_history').delete().eq('user_id', user.id),
      supabase.from('results').delete().eq('user_id', user.id).eq('module', 'ketik')
    ]);

    if (res1.error || res2.error) {
      console.error('Error clearing history:', res1.error, res2.error);
      alert('Gagal menghapus riwayat.');
      return;
    }

    setHistory([]);
  };

  const handleDeleteSession = async (id: string) => {
    const [res1, res2] = await Promise.all([
      supabase.from('ketik_history').delete().eq('id', id),
      supabase
        .from('results')
        .delete()
        .eq('user_id', user?.id ?? '')
        .eq('module', 'ketik')
        .contains('details', { legacy_history_id: id })
    ]);

    if (res1.error || res2.error) {
      console.error('Error deleting session:', res1.error, res2.error);
      alert('Gagal menghapus sesi.');
      return;
    }

    setHistory(prev => prev.filter(s => s.id !== id));
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

  const endSession = async (messages: ChatMessage[]) => {
    if (user && currentConfig && currentScenario && messages.length > 0 && currentScenario.id !== 'review') {
      setIsLoading(true);
      try {
        const sessionData = {
          user_id: user.id,
          date: new Date().toISOString(),
          scenario_title: currentScenario.title,
          consumer_name: currentConfig.identity.name,
          consumer_phone: currentConfig.identity.phone,
          consumer_city: currentConfig.identity.city,
          messages,
        };

        const { data: historyData, error: historyError } = await supabase
          .from('ketik_history')
          .insert([sessionData])
          .select()
          .single();

        if (historyError || !historyData) {
          throw historyError || new Error('Gagal menyimpan riwayat Ketik.');
        }

        const resultData = {
          user_id: user.id,
          module: 'ketik',
          score: 0,
          details: {
            legacy_history_id: historyData.id,
            scenario_title: currentScenario.title,
            consumer_name: currentConfig.identity.name,
            consumer_phone: currentConfig.identity.phone,
            consumer_city: currentConfig.identity.city,
            messages,
          }
        };

        const { error: resultsError } = await supabase.from('results').insert([resultData]);
        if (resultsError) {
          console.error('Error saving to results:', JSON.stringify(resultsError, null, 2));
        }

        setHistory(prev => [{
          id: historyData.id,
          date: safeDate(historyData.date ?? historyData.created_at),
          scenarioTitle: historyData.scenario_title,
          consumerName: historyData.consumer_name,
          consumerPhone: historyData.consumer_phone,
          consumerCity: historyData.consumer_city,
          messages: historyData.messages,
        }, ...prev]);
      } catch (error) {
        console.error('Error ending session:', error);
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
    const matchingScenario = settings.scenarios.find((scenario) => scenario.title === session.scenarioTitle);

    setCurrentConfig({
      scenarios: settings.scenarios,
      consumerType: settings.consumerTypes[0],
      identity: { name: session.consumerName, city: session.consumerCity || '', phone: session.consumerPhone || '0812...' },
      model: settings.selectedModel,
      simulationDuration: 5,
    });
    setCurrentScenario(
      matchingScenario
        ? { ...matchingScenario, id: 'review' }
        : { id: 'review', title: session.scenarioTitle, description: '', category: 'Review', isActive: true }
    );
    setReviewMessages(session.messages);
    setIsHistoryOpen(false);
    setView('chat');
  };

  return (
    <div data-module="ketik" className={`${theme.root} min-h-screen transition-colors duration-500 font-sans selection:bg-primary/20`}>
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
              eyebrow="Kelas Etika & Trik Komunikasi"
              title="Latih komunikasi chat dalam satu workspace yang fokus."
              description="Mulai simulasi, buka pengaturan, dan tinjau riwayat percakapan dari satu alur kerja yang konsisten dengan modul lain."
              accentClassName={theme.accentText}
              accentSoftClassName={theme.accentSoftBg}
              icon={<MessageSquare className="h-8 w-8" />}
              actions={
                <>
                  <motion.button
                    whileHover={{ scale: 1.01, y: -1 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={startSimulation}
                    disabled={isLoading}
                    className="module-clean-button-primary flex h-12 w-full items-center justify-center gap-2.5 rounded-xl px-5 text-[10px] font-black uppercase tracking-[0.18em] transition-all hover:opacity-95"
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
                    onClick={() => setIsHistoryOpen(true)}
                    className="module-clean-button-secondary flex h-12 w-full items-center justify-center gap-2.5 rounded-xl px-5 text-[10px] font-black uppercase tracking-[0.18em] transition-all"
                  >
                    <History className="h-4 w-4 opacity-60" />
                    <span>Riwayat</span>
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
            className="fixed inset-0 z-[100] module-clean-stage flex flex-col items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden transition-colors duration-500"
          >
            <div data-module="ketik" className="module-clean-app module-clean-shell w-full max-w-5xl h-full md:max-h-[92vh] md:rounded-[2rem] overflow-hidden relative flex flex-col shadow-2xl shadow-black/10">
              {currentConfig && currentScenario && (
                <ChatInterface 
                  config={currentConfig} 
                  scenario={currentScenario} 
                  onEndSession={endSession} 
                  isReviewMode={currentScenario.id === 'review'} 
                  initialMessages={reviewMessages} 
                  isEnding={isLoading}
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
