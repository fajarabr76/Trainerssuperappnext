'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SessionConfig } from '@/app/types';
import { LiveSession } from '../services/geminiService';
import { Clock3, Mic, MicOff, Pause, PhoneOff, Play, UserRound } from 'lucide-react';

interface PhoneInterfaceProps {
  config: SessionConfig;
  onEndSession: (reason?: string) => void;
  onRecordingReady?: (url: string, consumerName: string) => void;
}

export const PhoneInterface: React.FC<PhoneInterfaceProps> = ({ 
  config,
  onEndSession,
  onRecordingReady
}) => {
  const [connectionState, setConnectionState] = useState("Memanggil...");
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isRinging, setIsRinging] = useState(true);
  
  // Audio Analysis State
  const [agentVolume, setAgentVolume] = useState(0);
  
  // Hold Feature States
  const [isOnHold, setIsOnHold] = useState(false);
  const [holdCount, setHoldCount] = useState(0);
  const [holdTimer, setHoldTimer] = useState(0);

  const sessionRef = useRef<LiveSession | null>(null);
  const mountedRef = useRef<boolean>(true); // Track mount status
  
  // Unified UI Audio Context to prevent leaks (Max 6 contexts limit)
  const uiAudioContextRef = useRef<AudioContext | null>(null);
  const holdMusicOscillators = useRef<OscillatorNode[]>([]);
  const holdMusicGain = useRef<GainNode | null>(null);

  // Stabilize callbacks/values used in mount effect to prevent re-connection on mute change
  const onRecordingReadyRef = useRef(onRecordingReady);
  onRecordingReadyRef.current = onRecordingReady;
  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;
  const onEndSessionRef = useRef(onEndSession);
  onEndSessionRef.current = onEndSession;

  // Helper to get or create the UI AudioContext
  const getUiContext = () => {
    if (!uiAudioContextRef.current || uiAudioContextRef.current.state === 'closed') {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        uiAudioContextRef.current = new AudioContextClass();
    }
    // Resume if suspended (browser autoplay policy)
    if (uiAudioContextRef.current.state === 'suspended') {
        uiAudioContextRef.current.resume().catch(console.warn);
    }
    return uiAudioContextRef.current;
  };

  // Function to simulate phone ring using Oscillator
  const playIncomingRing = useCallback(async () => {
    try {
        if (!mountedRef.current) return;
        const ctx = getUiContext();
        
        // Standard phone ring is often dual frequency 440Hz + 480Hz
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(440, ctx.currentTime);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(480, ctx.currentTime);

        // Connect
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        // Ring pattern: Ring (2s) -> Pause
        const now = ctx.currentTime;
        gain.gain.setValueAtTime(0, now);
        
        // Ring 1
        gain.gain.linearRampToValueAtTime(0.5, now + 0.1);
        gain.gain.setValueAtTime(0.5, now + 2.0);
        gain.gain.linearRampToValueAtTime(0, now + 2.1);

        osc1.start(now);
        osc2.start(now);
        
        // Stop after one ring cycle (approx 2.5s)
        osc1.stop(now + 2.5);
        osc2.stop(now + 2.5);

        // Clean up nodes after playing
        setTimeout(() => {
            try {
                osc1.disconnect();
                osc2.disconnect();
                gain.disconnect();
            } catch(_e) {}
        }, 2600);

        return new Promise(resolve => setTimeout(resolve, 2500));
    } catch (e) {
        console.error("Ringtone error", e);
        return Promise.resolve(); // Continue immediately if audio fails
    }
  }, []);

  const startHoldMusic = () => {
    try {
        const ctx = getUiContext();
        const gain = ctx.createGain();
        gain.gain.value = 0.1; // Low volume for hold music
        gain.connect(ctx.destination);
        holdMusicGain.current = gain;

        // Create a simple soothing arpeggio loop
        const notes = [329.63, 440, 554.37, 659.25]; // E major chord
        const oscillators: OscillatorNode[] = [];

        notes.forEach((freq, i) => {
             const osc = ctx.createOscillator();
             osc.type = 'sine';
             osc.frequency.value = freq;
             const oscGain = ctx.createGain();
             
             // Pulse effect
             const now = ctx.currentTime;
             oscGain.gain.setValueAtTime(0, now);
             oscGain.gain.linearRampToValueAtTime(0.1, now + 0.5 + (i * 0.5));
             oscGain.gain.exponentialRampToValueAtTime(0.01, now + 2.0 + (i * 0.5));
             
             osc.connect(oscGain);
             oscGain.connect(gain);
             osc.start();
             oscillators.push(osc);
        });
        
        // LFO to modulate volume for "waiting" feel
        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.5; // 0.5 Hz pulse
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.05;
        lfo.connect(lfoGain);
        lfoGain.connect(gain.gain);
        lfo.start();
        oscillators.push(lfo);

        holdMusicOscillators.current = oscillators;
    } catch (e) {
        console.error("Hold music error", e);
    }
  };

  const stopHoldMusic = useCallback(() => {
      holdMusicOscillators.current.forEach(osc => {
          try { 
              osc.stop(); 
              osc.disconnect(); 
          } catch(_e){}
      });
      holdMusicOscillators.current = [];
      if (holdMusicGain.current) {
          try { holdMusicGain.current.disconnect(); } catch(_e){}
          holdMusicGain.current = null;
      }
      // Note: We DO NOT close uiAudioContextRef here, we reuse it.
  }, []);

  // Sync Mute State with Service
  useEffect(() => {
    sessionRef.current?.setMute(isMuted);
  }, [isMuted]);

  // Initialize Sequence on Mount
  useEffect(() => {
    console.log("[Telefun] PhoneInterface mounted with config:", config);
    let isActive = true;
    mountedRef.current = true;

    const startCallSequence = async () => {
        // 1. Play Ringtone
        if (isActive) {
            console.log("[Telefun] Starting ringtone sequence");
            setIsRinging(true);
            setConnectionState("Memanggil...");
            await playIncomingRing();
        }

        // Check if still active after await
        if (!isActive) {
            console.log("[Telefun] Component unmounted during ringtone, aborting connection");
            return;
        }

        // 2. Connect to AI
        console.log("[Telefun] Ringtone finished, connecting to AI...");
        setIsRinging(false);
        setConnectionState("Menghubungkan...");

        try {
            const session = new LiveSession(config);
            sessionRef.current = session;
            // Apply initial mute state in case user clicked it during ringing
            session.setMute(isMutedRef.current);

            session.onStatusChange = (s) => {
                console.log("[Telefun] Session status changed:", s);
                if (isActive) setConnectionState(s);
            };
            session.onError = (e) => {
                console.error("[Telefun] Session error:", e);
                if (isActive) setConnectionState("Error: " + ((e as Error).message || "Network"));
            };
            session.onAiSpeaking = (speaking) => {
                // console.log("[Telefun] AI speaking state:", speaking); // Too noisy
                if (isActive) setIsAiSpeaking(speaking);
            };
            session.onVolumeChange = (vol) => {
                if (isActive) setAgentVolume(vol);
            };
            session.onRecordingComplete = (url) => {
                console.log("[Telefun] Recording complete, URL ready");
                onRecordingReadyRef.current?.(url, config.identity.name);
            };

            console.log("[Telefun] Calling session.connect()");
            session.connect();
        } catch (err: unknown) {
            console.error("[Telefun] Failed to initialize session:", err);
            if (isActive) setConnectionState("Error: " + ((err as Error).message || "Init Failed"));
        }
    };

    startCallSequence();

    return () => {
      console.log("[Telefun] PhoneInterface unmounting, cleaning up");
      isActive = false;
      mountedRef.current = false; // Mark unmounted
      stopHoldMusic();
      sessionRef.current?.disconnect();
      // Close UI Context on Unmount
      if (uiAudioContextRef.current && uiAudioContextRef.current.state !== 'closed') {
          uiAudioContextRef.current.close().catch(() => {});
          uiAudioContextRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]); // Only re-run when config changes (new call). Mute/callbacks must not trigger reconnect.

  // Call Duration Timer
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (!isRinging && connectionState === 'Tersambung') {
        timer = setInterval(() => setCallDuration(prev => prev + 1), 1000);
    }
    return () => { if (timer) clearInterval(timer); };
  }, [isRinging, connectionState]);

  // Hold Timer Logic
  useEffect(() => {
      let timer: NodeJS.Timeout | null = null;
      if (isOnHold && holdTimer > 0) {
          timer = setInterval(() => {
              setHoldTimer(prev => prev - 1);
          }, 1000);
      } else if (isOnHold && holdTimer <= 0) {
          // Timer finished
      }
      return () => { if (timer) clearInterval(timer); };
  }, [isOnHold, holdTimer]);

  const toggleHold = () => {
      if (isOnHold) {
          // RESUME
          setIsOnHold(false);
          stopHoldMusic();
          sessionRef.current?.setHold(false);
      } else {
          // START HOLD
          const isFirstHold = holdCount === 0;
          const duration = isFirstHold ? 60 : 180; // 1 min for 1st, 3 min for subsequent
          
          setHoldTimer(duration);
          setHoldCount(prev => prev + 1);
          setIsOnHold(true);
          
          // Mute AI input and play music
          sessionRef.current?.setHold(true);
          startHoldMusic();
      }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const displayName = config.identity.name;
  const displayPhone = config.identity.phone;
  const displayCity = config.identity.city;
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('');

  const handleEndCall = useCallback((reason?: string) => {
    stopHoldMusic();
    if (uiAudioContextRef.current && uiAudioContextRef.current.state !== 'closed') {
        try {
            uiAudioContextRef.current.close();
            uiAudioContextRef.current = null;
        } catch(_e){}
    }
    sessionRef.current?.disconnect();
    onEndSessionRef.current(reason);
  }, [stopHoldMusic]);

  // Auto Hangup on Timeout
  useEffect(() => {
      if (config.maxCallDuration > 0 && callDuration >= config.maxCallDuration * 60) {
          handleEndCall('timeout');
      }
  }, [callDuration, config.maxCallDuration, handleEndCall]);

  // Helper to get Color and Label based on Volume
  const getVolumeStatus = (volume: number) => {
      if (volume < 5) return { color: "bg-gray-700", label: "Senyap", width: "5%" };
      if (volume < 35) return { color: "bg-whatsapp-teal", label: "Tenang/Netral", width: `${Math.max(10, volume)}%` };
      if (volume < 65) return { color: "bg-yellow-500", label: "Tegas/Peringatan", width: `${volume}%` };
      return { color: "bg-red-500", label: "Tinggi/Urgensi", width: `${Math.min(100, volume)}%` };
  };

  const volStatus = getVolumeStatus(agentVolume);

  // Determine Status Text based on state
  let statusText = "Menghubungkan...";
  let statusBg = "bg-gray-800";
  let statusTextColor = "text-gray-400";
  let statusBorder = "border-white/5";

  if (isOnHold) {
      statusText = "Panggilan di-HOLD";
      statusBg = "bg-yellow-900/40";
      statusTextColor = "text-yellow-400";
      statusBorder = "border-yellow-500/30";
  } else if (isRinging) {
      statusText = "Memanggil...";
      statusBg = "bg-blue-900/40";
      statusTextColor = "text-blue-400";
      statusBorder = "border-blue-500/30";
  } else if (connectionState === "Tersambung") {
    if (isAiSpeaking) {
      statusText = "Konsumen sedang berbicara...";
      statusBg = "bg-green-900/40";
      statusTextColor = "text-green-400";
      statusBorder = "border-green-500/30";
    } else {
      statusText = "Konsumen sedang menunggu respon dari anda";
      statusBg = "bg-[#0f1e18]"; 
      statusTextColor = "text-[#4ade80]";
      statusBorder = "border-[#4ade80]/20";
    }
  } else if (connectionState.startsWith("Error")) {
    statusText = connectionState;
    statusBg = "bg-red-900/50";
    statusTextColor = "text-red-400";
    statusBorder = "border-red-500/30";
  } else {
    statusText = connectionState;
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#f7faf8] text-slate-950 transition-colors duration-300 dark:bg-[#06110d] dark:text-white md:flex-row">
      
      <div className="relative z-10 flex h-full w-full flex-1 flex-col">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(16,185,129,0.16),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.78),transparent_44%)] dark:bg-[radial-gradient(circle_at_50%_20%,rgba(16,185,129,0.18),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.05),transparent_44%)]" />
        
        <div className="relative flex shrink-0 items-center justify-between p-4 md:p-8">
            <div className="flex items-center gap-3 rounded-full border border-emerald-900/10 bg-white/80 px-4 py-2 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
                <div className={`h-2.5 w-2.5 rounded-full ${connectionState === 'Tersambung' ? 'animate-pulse bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]' : 'bg-rose-500'}`}></div>
                <Clock3 className="h-4 w-4 text-slate-500 dark:text-white/45" />
                <span className="font-mono text-sm font-semibold tracking-wide text-slate-700 dark:text-white/80">{formatTime(callDuration)}</span>
            </div>
        </div>

        <div className="relative mx-auto flex w-full flex-1 overflow-y-auto px-4 pb-10 md:px-12">
          <div className="flex min-h-full w-full flex-col items-center justify-center py-6">
            <div className="relative mb-8">
                {isRinging && (
                    <>
                    <div className="absolute inset-0 animate-ping rounded-full bg-emerald-500/20"></div>
                    <div className="absolute inset-0 animate-ping rounded-full bg-emerald-500/10 delay-150"></div>
                    </>
                )}
                
                {isOnHold && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center rounded-full border-4 border-amber-400 bg-black/65 backdrop-blur-sm">
                        <div className="text-center">
                            <Pause className="mx-auto h-7 w-7 fill-current text-amber-300" />
                            <span className="mt-1 block text-xs font-bold text-amber-300">HOLD</span>
                            <div className="text-xl font-mono font-bold text-white mt-1">{formatTime(holdTimer)}</div>
                        </div>
                    </div>
                )}
                
                <div className={`absolute inset-0 scale-110 rounded-full bg-emerald-500/20 transition-transform duration-300 ${isAiSpeaking && !isOnHold ? 'animate-ping opacity-40' : 'opacity-0'}`}></div>
                
                <div className={`relative z-10 flex h-48 w-48 items-center justify-center overflow-hidden rounded-full border border-emerald-950/10 bg-gradient-to-br from-emerald-50 via-white to-teal-100 shadow-[0_28px_90px_rgba(15,23,42,0.16)] transition-all dark:border-white/10 dark:from-emerald-950 dark:via-slate-950 dark:to-teal-950 md:h-72 md:w-72 ${isOnHold ? 'grayscale blur-[1px]' : ''}`}>
                    <div className="absolute inset-5 rounded-full border border-emerald-500/15" />
                    <div className="absolute bottom-0 h-2/5 w-4/5 rounded-t-full bg-emerald-900/10 dark:bg-white/5" />
                    <UserRound className="absolute top-10 h-20 w-20 text-emerald-700/30 dark:text-emerald-200/20 md:top-16 md:h-28 md:w-28" />
                    <span className="relative mt-14 text-5xl font-black tracking-normal text-emerald-900 dark:text-emerald-100 md:mt-20 md:text-7xl">
                      {initials}
                    </span>
                </div>
            </div>

            <h1 className="mb-2 text-center text-3xl font-bold tracking-normal text-slate-950 dark:text-white md:text-5xl">{displayName}</h1>
            <p className="mb-8 text-center text-base font-medium text-slate-500 dark:text-white/55 md:text-xl">{displayPhone} / {displayCity}</p>

            {!isOnHold && connectionState === "Tersambung" && (
                <div className="mb-8 flex w-full max-w-sm flex-col gap-1 md:max-w-md">
                    <div className="mb-1 flex justify-between text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-white/45">
                        <span>Indikator Input Suara Anda</span>
                        <span className={volStatus.color.replace('bg-', 'text-')}>{isMuted ? 'Mic Mute' : volStatus.label}</span>
                    </div>
                    <div className="relative h-2 overflow-hidden rounded-full border border-emerald-950/10 bg-slate-950/10 dark:border-white/10 dark:bg-white/10">
                        <div className="absolute bottom-0 left-[33%] top-0 w-px bg-white/25"></div>
                        <div className="absolute bottom-0 left-[66%] top-0 w-px bg-white/25"></div>

                        <div
                            className={`h-full rounded-full shadow-[0_0_14px_rgba(16,185,129,0.25)] transition-all duration-100 ease-out ${volStatus.color}`}
                            style={{ width: isMuted ? '5%' : volStatus.width }}
                        ></div>
                    </div>
                </div>
            )}

            <div className={`w-full max-w-md rounded-3xl border px-8 py-6 text-center shadow-lg backdrop-blur-md transition-all duration-300 md:max-w-2xl ${statusBg} ${statusBorder}`}>
                <p className={`text-base md:text-xl font-semibold ${statusTextColor} animate-pulse`}>
                    {statusText}
                </p>
            </div>
            
            {isOnHold && holdTimer <= 10 && holdTimer > 0 && (
                 <p className="text-red-400 mt-2 font-bold animate-bounce">Waktu hold hampir habis!</p>
            )}
             {isOnHold && holdTimer <= 0 && (
                 <p className="text-red-500 mt-2 font-bold uppercase tracking-wider bg-red-900/50 px-4 py-1 rounded">Batas Waktu Hold Habis</p>
            )}
          </div>
        </div>
      </div>

      <div className="
        shrink-0 z-20 
        bg-white/88 dark:bg-slate-950/82 backdrop-blur-md border-t border-slate-950/10 dark:border-white/10 md:border-t-0 md:border-l
        flex 
        flex-row justify-center items-center gap-6 md:gap-8 py-6 px-6  /* Mobile Styles */
        md:flex-col md:justify-center md:px-6 md:py-0 md:w-32 /* Desktop Styles */
      ">
         
          <div className="flex flex-col items-center gap-2">
            <button 
                onClick={toggleHold}
                disabled={isRinging}
                className={`rounded-full border p-4 shadow-lg transition-all duration-200 md:p-5 ${isOnHold ? 'border-amber-400 bg-amber-400 text-black hover:bg-amber-300' : 'border-slate-950/10 bg-slate-950/5 text-slate-900 hover:bg-slate-950/10 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10'}`}
                title={isOnHold ? "Resume Call" : "Put on Hold"}
            >
                {isOnHold ? <Play className="h-6 w-6 fill-current md:h-7 md:w-7" /> : <Pause className="h-6 w-6 md:h-7 md:w-7" />}
            </button>
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground hidden md:block">Hold</span>
         </div>

         <div className="flex flex-col items-center gap-2">
            <button 
                onClick={() => setIsMuted(!isMuted)}
                disabled={isOnHold || isRinging}
                className={`rounded-full border p-4 shadow-lg transition-all duration-200 md:p-5 ${isMuted ? 'border-slate-950 bg-slate-950 text-white hover:opacity-90 dark:border-white dark:bg-white dark:text-slate-950' : 'border-slate-950/10 bg-slate-950/5 text-slate-900 hover:bg-slate-950/10 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10'}`}
                title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
            >
                {isMuted ? <MicOff className="h-6 w-6 md:h-7 md:w-7" /> : <Mic className="h-6 w-6 md:h-7 md:w-7" />}
            </button>
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground hidden md:block">Mic</span>
         </div>

         <div className="flex flex-col items-center gap-2">
             <button 
                onClick={() => handleEndCall()}
                className="rounded-full border border-red-500 bg-red-600 p-5 text-white shadow-xl shadow-red-900/30 transition-all hover:scale-105 hover:bg-red-700 md:p-6"
                title="End Call"
            >
                <PhoneOff className="h-8 w-8 md:h-9 md:w-9" />
            </button>
            <span className="text-[10px] uppercase font-bold tracking-wider text-red-500/70 hidden md:block">Hangup</span>
         </div>
      </div>
    </div>
  );
}
