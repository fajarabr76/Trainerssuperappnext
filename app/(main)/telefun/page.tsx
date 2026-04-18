'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SettingsModal } from './components/SettingsModal';
import { HistoryModal } from './components/HistoryModal';
import { PhoneInterface } from './components/PhoneInterface';
import { AppSettings, Scenario } from './types';
import { Settings, PhoneCall, History, Play } from 'lucide-react';
import { loadTelefunSettings, saveTelefunSettings, defaultTelefunSettings } from './services/settingService';
import { createClient } from '@/app/lib/supabase/client';
import { MaintenanceModal } from './components/MaintenanceModal';
import ModuleWorkspaceIntro from '@/app/components/ModuleWorkspaceIntro';

interface CallRecord {
  id: string;
  date: string;
  url: string;
  consumerName: string;
  scenarioTitle: string;
  duration: number;
}

export default function TelefunPage() {
  const [view, setView] = useState<'home' | 'chat'>('home');
  const [recordings, setRecordings] = useState<CallRecord[]>([]);
  const [settings, setSettings] = useState<AppSettings>(defaultTelefunSettings);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isMaintenanceOpen] = useState(true);
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load Settings
  useEffect(() => {
    const init = async () => {
      const saved = await loadTelefunSettings();
      setSettings(saved);
      
      // Load History from localStorage
      const savedHistory = localStorage.getItem('telefun_history');
      if (savedHistory) {
        try {
          setRecordings(JSON.parse(savedHistory));
        } catch (e) {
          console.error("Failed to parse history", e);
        }
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
    const activeScenarios = settings.scenarios.filter(s => s.isActive);
    const finalScenario = scenario || activeScenarios[Math.floor(Math.random() * activeScenarios.length)];
    setSelectedScenario(finalScenario);
    setView('chat');
  };

  const handleEndCall = async (recordingUrl?: string, consumerName?: string) => {
    if (recordingUrl && selectedScenario) {
      // 1. Generate Score
      const { score, feedback } = await import('./services/geminiService').then(m => 
        m.generateScore(
          {
            scenarios: [selectedScenario],
            consumerType: settings.consumerTypes.find(ct => ct.id === settings.preferredConsumerTypeId) || settings.consumerTypes[0],
            identity: {
              name: settings.identitySettings.displayName,
              city: settings.identitySettings.city,
              phone: settings.identitySettings.phoneNumber,
              gender: settings.identitySettings.gender
            },
            model: settings.selectedModel,
            maxCallDuration: settings.maxCallDuration
          },
          selectedScenario,
          0 // Duration not easily tracked here yet
        )
      );

      // 2. Save to local history (existing)
      const newRecord: CallRecord = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        url: recordingUrl,
        consumerName: consumerName || settings.identitySettings.displayName || 'Konsumen',
        scenarioTitle: selectedScenario?.title || 'Telepon Umum',
        duration: 0
      };
      const updatedHistory = [newRecord, ...recordings];
      setRecordings(updatedHistory);
      localStorage.setItem('telefun_history', JSON.stringify(updatedHistory));

      // 3. Save to results table (new)
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const resultData = {
          user_id: user.id,
          module: 'telefun',
          score: score,
          details: {
            scenario: selectedScenario.title,
            feedback: feedback,
            consumer: consumerName || settings.identitySettings.displayName || 'Konsumen',
            recordingUrl: recordingUrl
          }
        };
        await supabase.from('results').insert([resultData]);
      }
    }
    setView('home');
  };

  const handleDeleteSession = (id: string) => {
    const updated = recordings.filter(r => r.id !== id);
    setRecordings(updated);
    localStorage.setItem('telefun_history', JSON.stringify(updated));
  };

  const handleClearHistory = () => {
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
              description="Meskipun modul ini masih berada dalam mode maintenance pada akses umum, struktur home-nya kini mengikuti pola unified platform yang sama untuk persiapan rollout berikutnya."
              accentClassName="text-module-telefun"
              accentSoftClassName="bg-module-telefun/10"
              icon={<PhoneCall className="h-8 w-8" />}
              actions={
                <>
                  <motion.button
                    whileHover={{ scale: 1.01, y: -1 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => startCall()}
                    disabled={isLoading}
                    className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-primary px-6 text-[11px] font-black uppercase tracking-[0.22em] text-primary-foreground shadow-xl shadow-primary/20 transition hover:opacity-90 disabled:opacity-70"
                  >
                    {isLoading ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground/20 border-t-primary-foreground" /> : <Play className="h-4 w-4 fill-current" />}
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
              config={{
                scenarios: [selectedScenario],
                consumerType: settings.consumerTypes.find(ct => ct.id === settings.preferredConsumerTypeId) || settings.consumerTypes[0],
                identity: {
                  name: settings.identitySettings.displayName,
                  city: settings.identitySettings.city,
                  phone: settings.identitySettings.phoneNumber,
                  gender: settings.identitySettings.gender
                },
                model: settings.selectedModel,
                maxCallDuration: settings.maxCallDuration
              }}
              onEndSession={handleEndCall}
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
      
      <MaintenanceModal 
        isOpen={isMaintenanceOpen}
      />

    </div>
  );
}
