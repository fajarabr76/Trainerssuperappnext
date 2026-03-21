'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Phone, 
  PhoneOff, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  User, 
  Clock,
  MoreHorizontal,
  MessageCircle,
  Activity,
  ShieldAlert
} from 'lucide-react';
import { generateConsumerVoice, generateConsumerResponse, generateFirstCallMessage } from '../services/geminiService';
import { AppSettings } from '../types';

interface CallInterfaceProps {
  scenario: any;
  settings: AppSettings;
  onEndCall: (recordingUrl?: string) => void;
}



export const CallInterface: React.FC<CallInterfaceProps> = ({ scenario, settings, onEndCall }) => {
  const [status, setStatus] = useState<'calling' | 'connected' | 'ended'>('calling');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(true);
  const [transcript, setTranscript] = useState<{ role: 'agent' | 'consumer', text: string }[]>([]);
  const [isAITyping, setIsAITyping] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);

  const formatDuration = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Timer for call duration
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status === 'connected') {
      interval = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [status]);

  const handleAIConsumerResponse = useCallback(async (text: string) => {
    setIsAITyping(true);
    try {
      const sessionConfig = {
        scenarios: settings.scenarios,
        consumerType: settings.consumerTypes.find(t => t.id === settings.preferredConsumerTypeId) || settings.consumerTypes[0],
        identity: {
          name: settings.identitySettings.displayName,
          city: settings.identitySettings.city,
          phone: settings.identitySettings.phoneNumber,
          gender: settings.identitySettings.gender
        },
        model: settings.selectedModel,
        maxCallDuration: settings.maxCallDuration
      };

      const audioData = await generateConsumerVoice(sessionConfig, scenario, text);
      
      if (audioData) {
        const audioBlob = await fetch(`data:audio/wav;base64,${audioData}`).then(r => r.blob());
        const audioUrl = URL.createObjectURL(audioBlob);
        
        if (audioRef.current) {
          audioRef.current.src = audioUrl;
          audioRef.current.play();
        }
        
        setTranscript(prev => [...prev, { role: 'consumer', text }]);
      }
    } catch (error) {
      console.error("Voice error", error);
    } finally {
      setIsAITyping(false);
    }
  }, [scenario, settings]);

  const handleAgentSpeech = useCallback(async (text: string) => {
    setTranscript(prev => [...prev, { role: 'agent', text }]);
    
    const sessionConfig = {
      scenarios: settings.scenarios,
      consumerType: settings.consumerTypes.find(t => t.id === settings.preferredConsumerTypeId) || settings.consumerTypes[0],
      identity: {
        name: settings.identitySettings.displayName,
        city: settings.identitySettings.city,
        phone: settings.identitySettings.phoneNumber,
        gender: settings.identitySettings.gender
      },
      model: settings.selectedModel,
      maxCallDuration: settings.maxCallDuration
    };

    // Generate AI Response
    setIsAITyping(true);
    const history = [...transcript, { role: 'agent' as const, text }];
    const aiText = await generateConsumerResponse(sessionConfig, scenario, history);
    handleAIConsumerResponse(aiText);
  }, [scenario, settings, transcript, handleAIConsumerResponse]);

  // Speech Recognition Setup
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'id-ID';

      recognitionRef.current.onresult = (event: any) => {
        const last = event.results.length - 1;
        const text = event.results[last][0].transcript;
        
        if (text.trim()) {
          handleAgentSpeech(text);
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [handleAgentSpeech]);

  // Start recognition when connected
  useEffect(() => {
    if (status === 'connected' && recognitionRef.current && !isMuted) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error("Failed to start recognition", e);
      }
    } else if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, [status, isMuted]);

  // Simulate connecting
  useEffect(() => {
    const timer = setTimeout(async () => {
      setStatus('connected');
      
      const sessionConfig = {
        scenarios: settings.scenarios,
        consumerType: settings.consumerTypes.find(t => t.id === settings.preferredConsumerTypeId) || settings.consumerTypes[0],
        identity: {
          name: settings.identitySettings.displayName,
          city: settings.identitySettings.city,
          phone: settings.identitySettings.phoneNumber,
          gender: settings.identitySettings.gender
        },
        model: settings.selectedModel,
        maxCallDuration: settings.maxCallDuration
      };

      const firstMsg = await generateFirstCallMessage(sessionConfig, scenario);
      handleAIConsumerResponse(firstMsg);
    }, 3000);
    return () => clearTimeout(timer);
  }, [scenario, settings, handleAIConsumerResponse]);


  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-[#050505] p-8 relative overflow-hidden font-sans">
      {/* Background Animation */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <motion.div 
          animate={{ 
            scale: status === 'connected' ? [1, 1.2, 1] : 1,
            opacity: status === 'connected' ? [0.1, 0.2, 0.1] : 0.05
          }}
          transition={{ duration: 4, repeat: Infinity }}
          className="w-[800px] h-[800px] bg-emerald-500/10 blur-[150px] rounded-full"
        />
      </div>

      <audio ref={audioRef} className="hidden" />

      <div className="relative z-10 w-full max-w-md flex flex-col items-center">
        {/* Caller Info */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center mb-16 w-full"
        >
          <div className="relative w-32 h-32 mx-auto mb-8">
            {status === 'connected' && (
              <motion.div 
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 bg-emerald-500/20 rounded-full"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/20 to-emerald-600/20 rounded-[3rem] flex items-center justify-center border border-emerald-500/30 shadow-[0_0_60px_rgba(52,211,153,0.2)] backdrop-blur-xl">
              <User className="w-16 h-16 text-emerald-400" />
            </div>
          </div>
          
          <h2 className="text-4xl font-bold tracking-tighter mb-3">Konsumen OJK</h2>
          
          <div className="flex items-center justify-center gap-2 text-emerald-400/80 font-mono text-xs uppercase tracking-[0.2em]">
            {status === 'calling' ? (
              <span className="flex items-center gap-3">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
                Menghubungkan...
              </span>
            ) : (
              <span className="flex items-center gap-3 bg-emerald-500/10 px-4 py-1.5 rounded-full border border-emerald-500/20">
                <Activity className="w-4 h-4 animate-pulse" />
                {formatDuration(duration)}
              </span>
            )}
          </div>
        </motion.div>

        {/* Transcript Preview */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="w-full bg-white/[0.02] border border-white/5 rounded-[2rem] p-6 mb-12 min-h-[160px] backdrop-blur-xl relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
          


          <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-6 flex items-center gap-2">
            <MessageCircle className="w-4 h-4" /> Live Transcript
          </div>
          
          <div className="space-y-4 max-h-32 overflow-y-auto scrollbar-hide">
            {transcript.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-white/20 space-y-2">
                <Activity className="w-6 h-6 opacity-40" />
                <p className="text-xs font-medium">Menunggu percakapan dimulai...</p>
              </div>
            ) : (
              transcript.map((t, i) => (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={i} 
                  className={`text-sm leading-relaxed ${t.role === 'consumer' ? 'text-emerald-400' : 'text-white/80'}`}
                >
                  <span className="font-mono uppercase text-[9px] mr-3 opacity-40 tracking-widest">{t.role}:</span>
                  {t.text}
                </motion.div>
              ))
            )}
            {isAITyping && (
              <div className="flex gap-1.5 items-center mt-4">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            )}
          </div>
        </motion.div>

        {/* Controls */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex items-center justify-center gap-6 w-full"
        >
          <button 
            onClick={() => setIsMuted(!isMuted)}
            className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center transition-all duration-300 ${
              isMuted 
                ? 'bg-white text-black shadow-[0_0_30px_rgba(255,255,255,0.2)] scale-105' 
                : 'bg-white/5 text-white hover:bg-white/10 border border-white/10'
            }`}
          >
            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>

          <button 
            onClick={() => onEndCall()}
            className="w-20 h-20 bg-red-500 text-white rounded-[2rem] flex items-center justify-center shadow-[0_0_40px_rgba(239,68,68,0.4)] hover:bg-red-400 hover:scale-105 active:scale-95 transition-all duration-300 border border-red-400/50"
          >
            <PhoneOff className="w-8 h-8" />
          </button>

          <button 
            onClick={() => setIsSpeaker(!isSpeaker)}
            className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center transition-all duration-300 ${
              isSpeaker 
                ? 'bg-white text-black shadow-[0_0_30px_rgba(255,255,255,0.2)] scale-105' 
                : 'bg-white/5 text-white hover:bg-white/10 border border-white/10'
            }`}
          >
            {isSpeaker ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
          </button>
        </motion.div>
      </div>

      {/* Footer Info */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[9px] font-mono text-white/20 uppercase tracking-[0.3em] text-center w-full">
        Secure Encrypted Line • OJK CC Simulation
      </div>
    </div>
  );
};
