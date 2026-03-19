'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { SettingsModal } from './components/SettingsModal';
import { HistoryModal } from './components/HistoryModal';
import { PhoneInterface } from './components/PhoneInterface';
import { AppSettings } from './types';
import { DEFAULT_SCENARIOS } from './constants';
import { ArrowLeft, Phone, Settings, Download, PhoneCall, History, Play } from 'lucide-react';
import { loadTelefunSettings, saveTelefunSettings, defaultTelefunSettings } from './services/settingService';
import { createClient } from '../lib/supabase/client';

interface CallRecord {
  id: string;
  date: string;
  url: string;
  consumerName: string;
  scenarioTitle: string;
  duration: number;
}

export default function TelefunPage() {
  const router = useRouter();
  const [view, setView] = useState<'home' | 'chat'>('home');
  const [recordings, setRecordings] = useState<CallRecord[]>([]);
  const [settings, setSettings] = useState<AppSettings>(defaultTelefunSettings);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<any>(null);
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

  const startCall = (scenario?: any) => {
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
      <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

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
                <PhoneCall className="h-14 w-14 text-primary-foreground" />
              </motion.div>
              <h1 className="text-4xl font-bold text-foreground mb-3 tracking-tighter">Telefun</h1>
              <h2 className="text-[10px] font-bold text-primary uppercase tracking-[0.3em] mb-6">Voice Simulation Trainer</h2>
              <p className="text-foreground/50 text-sm leading-relaxed max-w-sm mx-auto font-light">
                Asah kemampuan komunikasi lisan Anda. Siap hadapi berbagai skenario panggilan konsumen dengan respon yang tepat, profesional, dan empatik.
              </p>
            </div>

            <div className="space-y-4">
              <motion.button 
                whileHover={{ scale: 1.02 }} 
                whileTap={{ scale: 0.98 }} 
                onClick={() => startCall()} 
                disabled={isLoading} 
                className="w-full bg-primary text-primary-foreground h-16 rounded-2xl font-bold text-lg shadow-xl shadow-primary/20 flex items-center justify-center gap-3 transition-all hover:opacity-90 disabled:opacity-70"
              >
                {isLoading ? (
                  <div className="w-6 h-6 border-2 border-primary-foreground/20 border-t-primary-foreground rounded-full animate-spin" />
                ) : (
                  <>
                    <Play className="w-5 h-5 fill-current" /><span>Mulai Panggilan</span>
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
    </div>
  );
}
