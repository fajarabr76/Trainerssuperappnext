'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { SessionConfig } from '../types';
import { LiveSession } from '../services/geminiService';

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

  // Helper to get or create the UI AudioContext
  const getUiContext = () => {
    if (!uiAudioContextRef.current || uiAudioContextRef.current.state === 'closed') {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
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
            } catch(e) {}
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
          } catch(e){}
      });
      holdMusicOscillators.current = [];
      if (holdMusicGain.current) {
          try { holdMusicGain.current.disconnect(); } catch(e){}
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
            session.setMute(isMuted);

            session.onStatusChange = (s) => {
                console.log("[Telefun] Session status changed:", s);
                if (isActive) setConnectionState(s);
            };
            session.onError = (e) => {
                console.error("[Telefun] Session error:", e);
                if (isActive) setConnectionState("Error: " + (e.message || "Network"));
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
                onRecordingReady?.(url, config.identity.name);
            };
            
            console.log("[Telefun] Calling session.connect()");
            session.connect();
        } catch (err: any) {
            console.error("[Telefun] Failed to initialize session:", err);
            if (isActive) setConnectionState("Error: " + (err.message || "Init Failed"));
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
  }, [config, isMuted, onRecordingReady, playIncomingRing, stopHoldMusic]); // Run once on mount

  // Call Duration Timer
  useEffect(() => {
    let timer: any;
    if (!isRinging && connectionState === 'Tersambung') {
        timer = setInterval(() => setCallDuration(prev => prev + 1), 1000);
    }
    return () => clearInterval(timer);
  }, [isRinging, connectionState]);

  // Hold Timer Logic
  useEffect(() => {
      let timer: any;
      if (isOnHold && holdTimer > 0) {
          timer = setInterval(() => {
              setHoldTimer(prev => prev - 1);
          }, 1000);
      } else if (isOnHold && holdTimer <= 0) {
          // Timer finished
      }
      return () => clearInterval(timer);
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

  const handleEndCall = useCallback((reason?: string) => {
    stopHoldMusic();
    if (uiAudioContextRef.current && uiAudioContextRef.current.state !== 'closed') {
        try { 
            uiAudioContextRef.current.close(); 
            uiAudioContextRef.current = null;
        } catch(e){}
    }
    sessionRef.current?.disconnect();
    onEndSession(reason);
  }, [onEndSession, stopHoldMusic]);

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
    // MAIN CONTAINER: Flex Column for Mobile, Flex Row for Desktop
    <div className="flex flex-col md:flex-row h-full w-full bg-background relative text-foreground overflow-hidden font-sans transition-colors duration-300">
      
      {/* --- SECTION 1: MAIN INFO (Avatar, Name, Status) --- */}
      <div className="flex-1 flex flex-col relative z-10 w-full h-full">
        
        {/* Header (Time) - Positioned at top of Main Info */}
        <div className="flex justify-between items-center p-4 md:p-8 shrink-0">
            <div className="flex items-center gap-3 bg-foreground/5 px-4 py-2 rounded-full backdrop-blur-sm border border-border shadow-sm">
                <div className={`w-2.5 h-2.5 rounded-full ${connectionState === 'Tersambung' ? 'bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500'}`}></div>
                <span className="text-sm font-medium tracking-wide text-foreground/80 font-mono">{formatTime(callDuration)}</span>
            </div>
        </div>

        {/* Center Content - Wrapped in scrollable container */}
        <div className="flex-1 overflow-y-auto px-4 md:px-12 w-full mx-auto pb-12">
          <div className="flex flex-col items-center justify-center min-h-full py-8">
             {/* Avatar Container */}
            <div className="relative mb-8">
                {/* Ring Animation (White Ripple when Ringing) */}
                {isRinging && (
                    <>
                    <div className="absolute inset-0 rounded-full bg-foreground/10 animate-ping"></div>
                    <div className="absolute inset-0 rounded-full bg-foreground/5 animate-ping delay-150"></div>
                    </>
                )}
                
                {/* Hold Overlay */}
                {isOnHold && (
                    <div className="absolute inset-0 z-20 rounded-full bg-black/60 flex items-center justify-center backdrop-blur-sm animate-pulse border-4 border-yellow-500">
                        <div className="text-center">
                            <span className="block text-2xl">⏸</span>
                            <span className="text-xs font-bold text-yellow-400 mt-1">HOLD</span>
                            <div className="text-xl font-mono font-bold text-white mt-1">{formatTime(holdTimer)}</div>
                        </div>
                    </div>
                )}
                
                {/* Voice Visualizer Ring */}
                <div className={`absolute inset-0 rounded-full bg-foreground/5 scale-110 transition-transform duration-300 ${isAiSpeaking && !isOnHold ? 'animate-ping opacity-30' : 'opacity-0'}`}></div>
                
                <div className="w-48 h-48 md:w-72 md:h-72 rounded-full overflow-hidden bg-foreground/5 shadow-2xl border border-border relative z-10">
                    <div className="relative w-full h-full">
                        <Image 
                            src={`https://picsum.photos/seed/${config.identity.name}/500`} 
                            alt="Avatar" 
                            fill
                            className={`object-cover transition-all ${isOnHold ? 'grayscale blur-sm' : 'grayscale-[0.2]'}`} 
                            referrerPolicy="no-referrer"
                        />
                    </div>
                </div>
            </div>

            {/* Info Text */}
            <h1 className="text-3xl md:text-5xl font-bold mb-2 tracking-tight text-foreground text-center">{config.identity.name}</h1>
            <p className="text-base md:text-xl text-muted-foreground mb-8 font-medium text-center">{config.identity.phone} • {config.identity.city}</p>

            {/* AGENT VOICE INDICATOR */}
            {!isOnHold && connectionState === "Tersambung" && (
                <div className="w-full max-w-sm md:max-w-md mb-8 flex flex-col gap-1">
                    <div className="flex justify-between text-[10px] uppercase font-bold tracking-widest text-muted-foreground mb-1">
                        <span>Indikator Nada Suara Anda</span>
                        <span className={volStatus.color.replace('bg-', 'text-')}>{volStatus.label}</span>
                    </div>
                    <div className="h-2 bg-foreground/10 rounded-full overflow-hidden border border-border relative">
                        {/* Background Markers */}
                        <div className="absolute left-[33%] top-0 bottom-0 w-px bg-foreground/10"></div>
                        <div className="absolute left-[66%] top-0 bottom-0 w-px bg-foreground/10"></div>
                        
                        {/* Active Bar */}
                        <div 
                            className={`h-full rounded-full transition-all duration-100 ease-out shadow-[0_0_10px_rgba(255,255,255,0.2)] ${volStatus.color}`}
                            style={{ width: volStatus.width }}
                        ></div>
                    </div>
                </div>
            )}

            {/* Status Pill */}
            <div className={`px-8 py-6 rounded-3xl border transition-all duration-300 ${statusBg} ${statusBorder} max-w-md md:max-w-2xl w-full text-center shadow-lg backdrop-blur-md`}>
                <p className={`text-base md:text-xl font-semibold ${statusTextColor} animate-pulse`}>
                    {statusText}
                </p>
            </div>
            
            {/* Hold Warning text */}
            {isOnHold && holdTimer <= 10 && holdTimer > 0 && (
                 <p className="text-red-400 mt-2 font-bold animate-bounce">Waktu hold hampir habis!</p>
            )}
             {isOnHold && holdTimer <= 0 && (
                 <p className="text-red-500 mt-2 font-bold uppercase tracking-wider bg-red-900/50 px-4 py-1 rounded">Batas Waktu Hold Habis</p>
            )}
          </div>
        </div>
      </div>

      {/* --- SECTION 2: CONTROLS SIDEBAR (Desktop) / BOTTOM BAR (Mobile) --- */}
      <div className="
        shrink-0 z-20 
        bg-card/80 backdrop-blur-md border-t border-border md:border-t-0 md:border-l
        flex 
        flex-row justify-center items-center gap-6 md:gap-8 py-6 px-6  /* Mobile Styles */
        md:flex-col md:justify-center md:px-6 md:py-0 md:w-32 /* Desktop Styles */
      ">
         
         {/* Hold Button */}
          <div className="flex flex-col items-center gap-2">
            <button 
                onClick={toggleHold}
                disabled={isRinging}
                className={`p-4 md:p-5 rounded-full transition-all duration-200 border shadow-lg ${isOnHold ? 'bg-yellow-400 text-black border-yellow-400 hover:bg-yellow-300' : 'bg-foreground/5 text-foreground border-border hover:bg-foreground/10 disabled:opacity-50 disabled:cursor-not-allowed'}`}
                title={isOnHold ? "Resume Call" : "Put on Hold"}
            >
                {isOnHold ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 md:h-7 md:w-7" viewBox="0 0 24 24" fill="currentColor">
                        <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
                    </svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 md:h-7 md:w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                )}
            </button>
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground hidden md:block">Hold</span>
         </div>

         {/* Mute Button */}
         <div className="flex flex-col items-center gap-2">
            <button 
                onClick={() => setIsMuted(!isMuted)}
                disabled={isOnHold || isRinging}
                className={`p-4 md:p-5 rounded-full transition-all duration-200 border shadow-lg ${isMuted ? 'bg-foreground text-background border-foreground hover:opacity-90' : 'bg-foreground/5 text-foreground border-border hover:bg-foreground/10 disabled:opacity-50'}`}
                title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
            >
                {isMuted ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 md:h-7 md:w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                    </svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 md:h-7 md:w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                )}
            </button>
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground hidden md:block">Mic</span>
         </div>

         {/* End Call Button */}
         <div className="flex flex-col items-center gap-2">
             <button 
                onClick={() => handleEndCall()}
                className="p-5 md:p-6 bg-red-600 text-white rounded-full hover:bg-red-700 shadow-xl shadow-red-900/30 transform hover:scale-105 transition-all border border-red-500"
                title="End Call"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 md:h-9 md:w-9" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
                </svg>
            </button>
            <span className="text-[10px] uppercase font-bold tracking-wider text-red-500/70 hidden md:block">Hangup</span>
         </div>
      </div>
    </div>
  );
}
