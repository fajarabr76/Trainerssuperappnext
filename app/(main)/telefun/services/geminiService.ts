import { LiveServerMessage } from "@google/genai";
import { generateGeminiContent } from '@/app/actions/gemini';
import { SessionConfig, Scenario } from '@/app/types';
import { updateTelefunLongSpeechState } from './timingGuards';

const _STABLE_VOICE_MAP = {
  male: 'Fenrir',
  female: 'Kore'
};

function normalizeTelefunWebSocketUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    if (url.protocol === 'https:') url.protocol = 'wss:';
    if (url.protocol === 'http:') url.protocol = 'ws:';
    if (url.protocol !== 'wss:' && url.protocol !== 'ws:') {
      throw new Error('Invalid WebSocket protocol');
    }
    return url.toString();
  } catch {
    throw new Error("NEXT_PUBLIC_TELEFUN_WS_URL harus berupa URL WebSocket yang valid.");
  }
}

/**
 * Kelas untuk menangani sesi Live Voice Gemini
 */
export class LiveSession {
  private config: SessionConfig;
  private session: { sendRealtimeInput: (params: { media: { mimeType: string, data: string } }) => void; close: () => void; sendClientMessage: (json: string) => void } | null = null;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private inputSource: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private analyser: AnalyserNode | null = null;
  private stream: MediaStream | null = null;
  private ws: WebSocket | null = null;
  private nextStartTime: number = 0;
  private activeSources: Set<AudioBufferSourceNode> = new Set();
  private isDisconnected: boolean = false;
  private isHeld: boolean = false;
  private isMuted: boolean = false;
  private isAiSpeaking: boolean = false;
  private playbackRate: number = 1.0;
  private lastVolumeUpdate: number = 0;
  private volumeAnimationFrameId: number | null = null;
  private previousSmoothedVolume: number = 0;

  // Calibration parameters for volume indicator
  private readonly VOLUME_NOISE_FLOOR = 0.005;
  private readonly VOLUME_SMOOTHING_ALPHA = 0.3; // Lower = smoother, higher = more responsive
  private readonly VOLUME_SENSITIVITY_SCALE = 500;

  // Dead-air detector state
  private deadAirStartTime: number | null = null;
  private lastDeadAirPromptTime: number = 0;
  private readonly DEAD_AIR_THRESHOLD_MS = 7000;
  private readonly DEAD_AIR_COOLDOWN_MS = 12000;
  private readonly DEAD_AIR_RMS_THRESHOLD = 0.01;

  // Long-speech interruption detector state
  private nonSilentStartTime: number | null = null;
  private lastInterruptionTime: number = 0;
  private readonly LONG_SPEECH_THRESHOLD_MS = 60000;
  private readonly LONG_SPEECH_COOLDOWN_MS = 60000;

  public onConnect?: () => void;
  public onDisconnect?: () => void;
  public onError?: (error: Error | unknown) => void;
  public onStatusChange?: (status: string) => void;
  public onAiSpeaking?: (isSpeaking: boolean) => void;
  public onVolumeChange?: (level: number) => void;
  public onRecordingComplete?: (url: string) => void;

  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private recordingDestination: MediaStreamAudioDestinationNode | null = null;
  private micSourceForRecording: MediaStreamAudioSourceNode | null = null;

  constructor(config: SessionConfig) {
    this.config = config;
  }

  public sendTimeCue(secondsLeft: number) {
    if (!this.session || this.isDisconnected) return;

    const c = this.config.consumerType;
    const lowerName = c.name.toLowerCase();

    let urgencyInstruction = "";
    let reasonHint = "";

    if (secondsLeft <= 20) {
      urgencyInstruction = "PRIORITAS TINGGI: Kamu HARUS menutup telepon sekarang juga.";
      if (lowerName.includes("marah") || lowerName.includes("ngeyel") || lowerName.includes("kesal") || lowerName.includes("emosi")) {
        reasonHint = "Nada: kesal karena masalah belum selesai, katakan mau tutup telepon.";
      } else if (lowerName.includes("sedih") || lowerName.includes("memelas")) {
        reasonHint = "Nada: pasrah, katakan akan tutup telepon.";
      } else {
        reasonHint = "Nada: sopan, katakan ingin menutup telepon karena ada urusan lain.";
      }
    } else {
      urgencyInstruction = "Bersiaplah untuk menutup telepon sebentar lagi secara natural.";
      if (lowerName.includes("marah") || lowerName.includes("ngeyel") || lowerName.includes("kesal") || lowerName.includes("emosi")) {
        reasonHint = "Nada: kesal. Mulai beri isyarat ingin tutup telepon.";
      } else if (lowerName.includes("gaptek") || lowerName.includes("bingung") || lowerName.includes("takut")) {
        reasonHint = "Nada: bingung/ragu. Mulai ingin tutup telepon.";
      } else if (lowerName.includes("sedih") || lowerName.includes("memelas")) {
        reasonHint = "Nada: sedih. Mulai isyarat ingin tutup telepon.";
      } else {
        reasonHint = "Nada: netral. Mulai isyarat akan menutup telepon sebentar lagi.";
      }
    }

    const payload = {
      clientContent: {
        turns: [
          {
            role: "user",
            parts: [
              { text: `[INSTRUKSI SISTEM - WAKTU HAMPIR HABIS] Waktu simulasi tersisa ${secondsLeft} detik. ${urgencyInstruction} ${reasonHint} Jangan sebutkan timer, waktu, atau angka. Langsung bicara sebagai konsumen secara natural.` }
            ]
          }
        ],
        turnComplete: true
      }
    };

    this.session.sendClientMessage(JSON.stringify(payload));
  }

  public setHold(active: boolean) {
    console.log(`[Telefun] setHold: ${active}`);
    this.isHeld = active;
    if (active) {
      this.isAiSpeaking = false;
      this.stopAllAudio();
      this.onAiSpeaking?.(false);
    }
  }

  public setMute(muted: boolean) {
    console.log(`[Telefun] setMute: ${muted}`);
    this.isMuted = muted;
    if (this.stream) {
      this.stream.getAudioTracks().forEach(track => {
        track.enabled = !muted;
      });
    }
  }

  async connect() {
    this.isDisconnected = false;
    let currentStep = "Memulai koneksi...";

    try {
      this.onStatusChange?.(currentStep);
      
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      currentStep = "Meminta izin mikrofon...";
      this.onStatusChange?.(currentStep);

      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
          }
        });
      } catch (mediaErr: unknown) {
        console.error("[Telefun] Media error:", mediaErr);
        const err = mediaErr as Error;
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          throw new Error("Izin Mikrofon Ditolak. Harap izinkan akses mikrofon di browser untuk memulai simulasi.");
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          throw new Error("Mikrofon tidak ditemukan. Pastikan perangkat input terhubung.");
        } else {
          throw new Error(`Gagal mengakses mikrofon: ${err.message || "Unknown error"}`);
        }
      }

      if (this.isDisconnected) {
        this.stream.getTracks().forEach(t => t.stop());
        return;
      }

      currentStep = "Menyiapkan Audio Context...";
      this.onStatusChange?.(currentStep);

      const track = this.stream.getAudioTracks()[0];
      const trackSettings = track.getSettings();
      const streamSampleRate = trackSettings.sampleRate || 44100;

      this.inputAudioContext = new AudioContextClass({ sampleRate: streamSampleRate });
      this.outputAudioContext = new AudioContextClass({ sampleRate: 24000 });

      this.recordingDestination = this.outputAudioContext.createMediaStreamDestination();
      this.micSourceForRecording = this.outputAudioContext.createMediaStreamSource(this.stream);
      this.micSourceForRecording.connect(this.recordingDestination);

      try {
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
          ? 'audio/webm;codecs=opus' 
          : 'audio/webm';
          
        this.mediaRecorder = new MediaRecorder(this.recordingDestination.stream, { mimeType });
        this.recordedChunks = [];
        
        this.mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) this.recordedChunks.push(e.data);
        };
        
        this.mediaRecorder.onstop = () => {
          if (this.recordedChunks.length > 0) {
            const blob = new Blob(this.recordedChunks, { type: this.mediaRecorder?.mimeType || 'audio/webm' });
            const url = URL.createObjectURL(blob);
            this.onRecordingComplete?.(url);
            this.recordedChunks = [];
          }
        };
        
        this.mediaRecorder.start(1000);
      } catch (e) {
        console.warn("[Telefun] MediaRecorder initialization failed:", e);
      }

      const resumeContexts = async () => {
        if (this.inputAudioContext?.state === 'suspended') await this.inputAudioContext.resume();
        if (this.outputAudioContext?.state === 'suspended') await this.outputAudioContext.resume();
      };
      await resumeContexts();

      if (this.isDisconnected) return;

      this.calculatePlaybackRate();

      currentStep = "Menghubungkan ke Proxy Gemini...";
      this.onStatusChange?.(currentStep);

      // Get Supabase Session
      const { createClient } = await import('@/app/lib/supabase/client');
      const supabase = createClient();
      const { data: { session: sbSession } } = await supabase.auth.getSession();
      
      if (!sbSession) {
        throw new Error("Sesi tidak valid. Harap login ulang.");
      }

      const configuredWsUrl = process.env.NEXT_PUBLIC_TELEFUN_WS_URL;
      if (!configuredWsUrl) {
        throw new Error("NEXT_PUBLIC_TELEFUN_WS_URL tidak terkonfigurasi.");
      }
      
      const wsUrlBase = normalizeTelefunWebSocketUrl(configuredWsUrl);
      const wsUrlWithToken = new URL(wsUrlBase);
      wsUrlWithToken.searchParams.set('token', sbSession.access_token);
      const wsUrl = wsUrlWithToken.toString();

      // Connect to Railway WebSocket Proxy (No subprotocol to avoid handshake 1006)
      const ws = new WebSocket(wsUrl);
      this.ws = ws;

      this.session = {
        sendRealtimeInput: (params: { media: { mimeType: string, data: string } }) => {
          if (ws.readyState === WebSocket.OPEN) {
             ws.send(JSON.stringify({
              realtimeInput: {
                audio: params.media
              }
            }));
          }
        },
        close: () => {
          ws.close();
        },
        sendClientMessage: (json: string) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(json);
          }
        }
      };

      ws.onopen = () => {
        console.log("[Telefun] WebSocket Proxy connected");

        // Send Setup
        const voiceName = this.config.identity.gender === 'male' ? 'Fenrir' : 'Kore';

        const telefunTransport = this.config.telefunTransport || 'gemini-live';
        const telefunModelId = this.config.telefunModelId || 'gemini-3.1-flash-live-preview';

        // Guard: OpenAI audio transport not yet implemented
        if (telefunTransport === 'openai-audio') {
          ws.close();
          this.onError?.(new Error("OpenAI Audio transport belum diimplementasi. Gunakan Gemini Live."));
          return;
        }

        const setupMessage = {
          setup: {
            model: `models/${telefunModelId}`,
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName }
                }
              }
            },
            systemInstruction: {
              parts: [{ text: this.buildSystemInstruction() }]
            },
            realtimeInputConfig: {
              automaticActivityDetection: {
                disabled: false,
                startOfSpeechSensitivity: "START_SENSITIVITY_LOW",
                endOfSpeechSensitivity: "END_SENSITIVITY_LOW",
                prefixPaddingMs: 300,
                silenceDurationMs: 800
              }
            }
          }
        };
        ws.send(JSON.stringify(setupMessage));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.setupComplete) {
            console.log("[Telefun] Gemini Setup Complete");
            this.onConnect?.();
            this.onStatusChange?.("Tersambung");
            this.startAudioInput();
          }

          this.handleMessage(message);
        } catch (e) {
          console.error("[Telefun] Error parsing message:", e);
        }
      };

      ws.onerror = (e) => {
        console.error("[Telefun] WebSocket Error:", e);
        this.onError?.(new Error("Koneksi WebSocket Gagal"));
      };

      ws.onclose = (e) => {
        console.log("[Telefun] WebSocket Closed:", e.code, e.reason);
        if (!this.isDisconnected) {
          if (e.code === 4001) {
            this.onError?.(new Error("Koneksi WebSocket ditolak: sesi login tidak valid. Silakan login ulang."));
          } else if (e.code === 4003) {
            this.onError?.(new Error("Koneksi WebSocket ditolak: origin Vercel belum diizinkan di Railway."));
          } else if (e.code === 1006) {
            this.onError?.(new Error("Koneksi WebSocket terputus mendadak (1006). Pastikan server Telefun di Railway sedang aktif dan dapat dijangkau."));
          } else if (e.code === 1011) {
            this.onError?.(new Error("Koneksi WebSocket gagal: server Telefun tidak bisa terhubung ke Gemini."));
          } else if (e.reason) {
            this.onError?.(new Error(`Koneksi WebSocket ditutup: ${e.reason}`));
          }
          this.disconnect();
        }
      };

    } catch (err: unknown) {
      console.error("[Telefun] Connection setup failed:", err);
      this.onStatusChange?.(`Gagal: ${(err as Error).message || "Koneksi Terputus"}`);
      this.onError?.(err);
      this.disconnect();
    }
  }

  private startAudioInput() {
    if (!this.inputAudioContext || !this.stream || !this.session) return;

    this.inputSource = this.inputAudioContext.createMediaStreamSource(this.stream);
    this.analyser = this.inputAudioContext.createAnalyser();
    this.analyser.fftSize = 1024;
    this.inputSource.connect(this.analyser);
    this.analyzeVolume();

    this.processor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (e) => {
      if (this.isDisconnected || this.isHeld || this.isMuted || !this.session) return;

      const inputData = e.inputBuffer.getChannelData(0);
      const downsampledData = this.downsampleTo16k(inputData, this.inputAudioContext!.sampleRate);
      const pcmBlob = this.createPcmBlob(downsampledData);

      this.session.sendRealtimeInput({
        media: pcmBlob
      });
    };

    this.inputSource.connect(this.processor);
    this.processor.connect(this.inputAudioContext.destination);
  }

  private analyzeVolume() {
    if (this.isDisconnected || !this.analyser) {
      if (this.volumeAnimationFrameId) {
        cancelAnimationFrame(this.volumeAnimationFrameId);
        this.volumeAnimationFrameId = null;
      }
      return;
    }

    // Still use a light throttle to avoid excessive UI updates (60fps -> ~20fps is enough)
    const now = Date.now();
    if (now - this.lastVolumeUpdate < 50) {
      this.volumeAnimationFrameId = requestAnimationFrame(() => this.analyzeVolume());
      return;
    }
    this.lastVolumeUpdate = now;

    if (this.isMuted) {
      this.previousSmoothedVolume = 0;
      this.onVolumeChange?.(0);
      this.trackDeadAir(true);
      this.trackLongSpeech(true);
      this.volumeAnimationFrameId = requestAnimationFrame(() => this.analyzeVolume());
      return;
    }

    const bufferLength = this.analyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);
    try {
      this.analyser.getByteTimeDomainData(dataArray);
    } catch (_e) {
      this.volumeAnimationFrameId = requestAnimationFrame(() => this.analyzeVolume());
      return;
    }

    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      const x = (dataArray[i] - 128) / 128.0;
      sum += x * x;
    }
    
    // RMS Calculation
    const rawRms = Math.sqrt(sum / bufferLength);
    
    // 1. Noise Gate
    const gatedRms = rawRms < this.VOLUME_NOISE_FLOOR ? 0 : rawRms;
    
    // 2. EMA Smoothing (Smoothed = prev * (1-alpha) + current * alpha)
    const smoothedRms = (this.previousSmoothedVolume * (1 - this.VOLUME_SMOOTHING_ALPHA)) + (gatedRms * this.VOLUME_SMOOTHING_ALPHA);
    this.previousSmoothedVolume = smoothedRms;

    // 3. Normalization with calibrated scale
    const normalizedVolume = Math.min(100, Math.round(smoothedRms * this.VOLUME_SENSITIVITY_SCALE));
    
    this.onVolumeChange?.(normalizedVolume);
    this.trackDeadAir(rawRms < this.DEAD_AIR_RMS_THRESHOLD);
    this.trackLongSpeech(rawRms < this.DEAD_AIR_RMS_THRESHOLD);

    this.volumeAnimationFrameId = requestAnimationFrame(() => this.analyzeVolume());
  }

  private trackDeadAir(isSilent: boolean) {
    if (this.isDisconnected || this.isHeld || this.isAiSpeaking || !this.session) {
      this.deadAirStartTime = null;
      return;
    }

    const now = Date.now();

    if (!isSilent) {
      this.deadAirStartTime = null;
      return;
    }

    if (this.deadAirStartTime === null) {
      this.deadAirStartTime = now;
      return;
    }

    const silentDuration = now - this.deadAirStartTime;
    if (silentDuration >= this.DEAD_AIR_THRESHOLD_MS) {
      if (now - this.lastDeadAirPromptTime >= this.DEAD_AIR_COOLDOWN_MS) {
        this.sendDeadAirPrompt();
        this.lastDeadAirPromptTime = now;
        this.deadAirStartTime = null;
      }
    }
  }

  private trackLongSpeech(isSilent: boolean) {
    if (this.isDisconnected || this.isHeld || this.isMuted || this.isAiSpeaking || !this.session) {
      this.nonSilentStartTime = null;
      return;
    }

    const result = updateTelefunLongSpeechState(
      {
        nonSilentStartTime: this.nonSilentStartTime,
        lastInterruptionTime: this.lastInterruptionTime,
      },
      {
        now: Date.now(),
        isSilent,
        isDisconnected: this.isDisconnected,
        isHeld: this.isHeld,
        isMuted: this.isMuted,
        isAiSpeaking: this.isAiSpeaking,
        hasSession: !!this.session,
        thresholdMs: this.LONG_SPEECH_THRESHOLD_MS,
        cooldownMs: this.LONG_SPEECH_COOLDOWN_MS,
      }
    );

    this.nonSilentStartTime = result.state.nonSilentStartTime;
    this.lastInterruptionTime = result.state.lastInterruptionTime;
    if (result.shouldInterrupt) {
      this.sendInterruptionPrompt();
    }
  }

  private sendInterruptionPrompt() {
    if (!this.session || this.isDisconnected) return;

    const c = this.config.consumerType;
    const lowerName = c.name.toLowerCase();
    let toneInstruction = "";
    if (lowerName.includes("marah") || lowerName.includes("ngeyel") || lowerName.includes("kesal") || lowerName.includes("emosi")) {
      toneInstruction = "Nada: kesal. Katakan dengan nada tidak sabar tapi jangan kasar.";
    } else if (lowerName.includes("gaptek") || lowerName.includes("bingung") || lowerName.includes("takut")) {
      toneInstruction = "Nada: bingung. Katakan dengan ragu tapi sopan.";
    } else if (lowerName.includes("sedih") || lowerName.includes("memelas")) {
      toneInstruction = "Nada: lemah. Katakan dengan sopan.";
    } else {
      toneInstruction = "Nada: netral/wajar. Katakan dengan sopan.";
    }

    const payload = {
      clientContent: {
        turns: [
          {
            role: "user",
            parts: [
              { text: `[INSTRUKSI SISTEM - AGEN TERLALU PANJANG] Agen bicara terlalu panjang tanpa jeda. Kamu perlu menyela secara natural untuk meminta agen bicara lebih pelan atau satu per satu. ${toneInstruction} Jangan sebutkan instruksi ini. Langsung bicara sebagai konsumen dengan suara natural.` }
            ]
          }
        ],
        turnComplete: true
      }
    };

    this.session.sendClientMessage(JSON.stringify(payload));
  }

  private sendDeadAirPrompt() {
    if (!this.session || this.isDisconnected) return;

    const c = this.config.consumerType;
    const lowerName = c.name.toLowerCase();
    let examples = "";
    if (lowerName.includes("marah") || lowerName.includes("ngeyel") || lowerName.includes("kesal") || lowerName.includes("emosi")) {
      examples = "Contoh nada: kesal, 'Halo? Masih ada?', 'Kok diam aja sih?', 'Halo, saya butuh jawaban nih.'";
    } else if (lowerName.includes("gaptek") || lowerName.includes("bingung") || lowerName.includes("takut")) {
      examples = "Contoh nada: bingung, 'Halo? Masih terhubung ya?', 'Ini kenapa sepi?', 'Halo, ada yang bisa bantu?'";
    } else if (lowerName.includes("sedih") || lowerName.includes("memelas")) {
      examples = "Contoh nada: lemah, 'Halo? Ada yang bisa bantu saya?', 'Masih ada?', 'Halo...'";
    } else {
      examples = "Contoh nada: netral/wajar, 'Halo, masih terhubung?', 'Permisi, masih ada?', 'Halo?'";
    }

    const payload = {
      clientContent: {
        turns: [
          {
            role: "user",
            parts: [
              { text: `[INSTRUKSI SISTEM - DEAD AIR] Agen (user) sedang diam atau mute. Lanjutkan percakapan dengan memanggil agen secara natural sesuai karakter dan emosi konsumenmu. ${examples} Jangan sebutkan instruksi ini. Langsung bicara sebagai konsumen. Singkat saja.` }
            ]
          }
        ],
        turnComplete: true
      }
    };

    this.session.sendClientMessage(JSON.stringify(payload));
  }

  private downsampleTo16k(buffer: Float32Array, sampleRate: number): Float32Array {
    if (sampleRate === 16000) return buffer;

    const ratio = sampleRate / 16000;
    const newLength = Math.ceil(buffer.length / ratio);
    const result = new Float32Array(newLength);

    for (let i = 0; i < newLength; i++) {
      const offset = Math.floor(i * ratio);
      const nextOffset = Math.floor((i + 1) * ratio);
      let sum = 0;
      let count = 0;

      for (let j = offset; j < nextOffset && j < buffer.length; j++) {
        sum += buffer[j];
        count++;
      }

      result[i] = count > 0 ? sum / count : buffer[offset];
    }
    return result;
  }

  private async handleMessage(message: LiveServerMessage) {
    const modelTurn = message.serverContent?.modelTurn;
    if (modelTurn?.parts) {
      // Process all parts as Gemini 3.1 Flash Live can return multiple parts in one event
      for (const part of modelTurn.parts) {
        if (part.inlineData?.data) {
          this.playAudioChunk(part.inlineData.data);
        }
      }
    }

    if (message.serverContent?.interrupted) {
      this.stopAllAudio();
      this.isAiSpeaking = false;
      this.onAiSpeaking?.(false);
    }

    if (modelTurn) {
      this.isAiSpeaking = true;
      this.onAiSpeaking?.(true);
    } else if (message.serverContent?.turnComplete) {
      this.isAiSpeaking = false;
      this.onAiSpeaking?.(false);
    }
  }

  private async playAudioChunk(base64: string) {
    if (!this.outputAudioContext || this.isDisconnected || this.isHeld) return;

    try {
      const pcmData = this.base64ToUint8Array(base64);
      const audioBuffer = await this.decodeAudioData(pcmData, this.outputAudioContext);

      const source = this.outputAudioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = this.playbackRate;
      source.connect(this.outputAudioContext.destination);
      if (this.recordingDestination) {
        source.connect(this.recordingDestination);
      }

      const currentTime = this.outputAudioContext.currentTime;
      if (this.nextStartTime < currentTime) {
        this.nextStartTime = currentTime + 0.05;
      }

      source.start(this.nextStartTime);
      const effectiveDuration = audioBuffer.duration / this.playbackRate;
      this.nextStartTime += effectiveDuration;

      this.activeSources.add(source);

      source.onended = () => {
        this.activeSources.delete(source);
      };

    } catch (e) {
      console.error("Error playing audio chunk:", e);
    }
  }

  private stopAllAudio() {
    this.activeSources.forEach(source => {
      try { source.stop(); } catch (_e) {}
    });
    this.activeSources.clear();
    this.isAiSpeaking = false;
    if (this.outputAudioContext) {
      this.nextStartTime = this.outputAudioContext.currentTime + 0.05;
    } else {
      this.nextStartTime = 0;
    }
  }

  async disconnect() {
    if (this.isDisconnected) return;
    this.isDisconnected = true;

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    if (this.volumeAnimationFrameId) {
      cancelAnimationFrame(this.volumeAnimationFrameId);
      this.volumeAnimationFrameId = null;
    }
    this.previousSmoothedVolume = 0;
    this.lastVolumeUpdate = 0;

    this.stopAllAudio();

    if (this.session) {
      try {
        this.session.close();
      } catch (e) { console.warn("Error closing session:", e); }
      this.session = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }

    if (this.processor) { try { this.processor.disconnect(); } catch (_e) {} }
    if (this.analyser) { try { this.analyser.disconnect(); } catch (_e) {} }
    if (this.inputSource) { try { this.inputSource.disconnect(); } catch (_e) {} }
    if (this.micSourceForRecording) { try { this.micSourceForRecording.disconnect(); } catch (_e) {} }
    if (this.recordingDestination) { try { this.recordingDestination.disconnect(); } catch (_e) {} }

    const closeContext = async (ctx: AudioContext | null) => {
      if (ctx && ctx.state !== 'closed') {
        try { await ctx.close(); } catch (e) { console.warn("Error closing AudioContext:", e); }
      }
    };

    await Promise.all([
      closeContext(this.inputAudioContext),
      closeContext(this.outputAudioContext)
    ]);

    this.inputAudioContext = null;
    this.outputAudioContext = null;
    this.ws = null;
    this.isAiSpeaking = false;
    this.deadAirStartTime = null;
    this.nonSilentStartTime = null;
    this.lastInterruptionTime = 0;
    this.onDisconnect?.();
  }

  private createPcmBlob(data: Float32Array): { mimeType: string, data: string } {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      int16[i] = data[i] * 32768;
    }
    const uint8 = new Uint8Array(int16.buffer);
    const base64 = this.uint8ArrayToBase64(uint8);
    return { mimeType: 'audio/pcm;rate=16000', data: base64 };
  }

  private base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  private uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private async decodeAudioData(data: Uint8Array, ctx: AudioContext): Promise<AudioBuffer> {
    const sampleRate = 24000;
    const numChannels = 1;
    
    // Ensure we use the correct offset and length for the Int16Array
    const dataInt16 = new Int16Array(data.buffer, data.byteOffset, data.byteLength / 2);
    const frameCount = dataInt16.length / numChannels;

    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    const channelData = buffer.getChannelData(0);

    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i] / 32768.0;
    }
    return buffer;
  }

  private calculatePlaybackRate() {
    const s = this.config.scenarios[0];
    const c = this.config.consumerType;
    const pacingMode = this.config.responsePacingMode || 'realistic';
    const combinedText = (c.name + " " + c.description + " " + (s?.title || "") + " " + (s?.description || "")).toLowerCase();

    let baseRate = 1.0;
    if (combinedText.includes("marah") || combinedText.includes("panik") || combinedText.includes("ngeyel") || combinedText.includes("emosi") || combinedText.includes("kasar") || combinedText.includes("darurat") || combinedText.includes("tinggi")) {
      baseRate = 1.05;
    } else if (combinedText.includes("sedih") || combinedText.includes("memelas") || combinedText.includes("bingung") || combinedText.includes("gaptek") || combinedText.includes("ragu") || combinedText.includes("lemas") || combinedText.includes("takut")) {
      baseRate = 0.95;
    }

    if (pacingMode === 'realistic') {
      this.playbackRate = Math.max(0.90, baseRate - 0.03);
    } else {
      this.playbackRate = baseRate;
    }
  }

  private buildSystemInstruction(): string {
    const s = this.config.scenarios[0];
    const c = this.config.consumerType;
    const identity = this.config.identity;
    const pacingMode = this.config.responsePacingMode || 'realistic';

    let emotionInstruction = "";
    if (c.name.toLowerCase().includes("marah") || c.name.toLowerCase().includes("ngeyel")) {
      emotionInstruction = "EMOSI: MARAH/KESAL. Nada tinggi dan cepat. Jaga konsistensi suara.";
    } else if (c.name.toLowerCase().includes("gaptek")) {
      emotionInstruction = "EMOSI: BINGUNG/GAPTEK. Bicara lambat, banyak jeda 'eemm', 'anu'.";
    } else {
      emotionInstruction = `EMOSI: ${c.description}. Bicara natural.`;
    }

    const pacingInstruction = pacingMode === 'realistic'
      ? `
    TEMPO RESPONS (REALISTIS):
    1. Bicara dengan tempo natural seperti orang menelepon sungguhan. Beri jeda antar kalimat.
    2. Jangan langsung menumpahkan semua keluhan sekaligus. Sampaikan bertahap sesuai respon agen.
    3. Jangan memotong agen terlalu cepat. Dengarkan dulu penjelasan agen sebelum merespons.
    4. Gunakan gumaman natural seperti "hmm", "oh begitu", "iya..." saat agen sedang menjelaskan.
    5. Jika bingung atau perlu waktu berpikir, beri jeda sebelum menjawab. Jangan langsung bicara.
    6. Jangan mengajukan banyak pertanyaan sekaligus. Satu pertanyaan per giliran.`
      : `
    TEMPO RESPONS (LATIHAN CEPAT):
    1. Respons lebih cepat agar latihan lebih efisien.
    2. Tetap natural tapi jangan terlalu banyak jeda panjang.`;

    const genderInstruction = identity.gender === 'male'
      ? "SUARA: LAKI-LAKI (Bapak-bapak). Gunakan suara berat."
      : "SUARA: PEREMPUAN (Ibu-ibu). Gunakan suara wanita.";

    const timeLimitInstruction = this.config.maxCallDuration > 0
      ? `\nBATAS WAKTU: Simulasi ini dibatasi maksimal ${this.config.maxCallDuration} menit. Jika kamu merasa percakapan sudah mendekati batas waktu ini, kamu HARUS segera mengakhiri telepon (misalnya: "Ya sudah terima kasih, saya tutup", "Saya ada urusan lain", atau "Pulsa saya habis") MESKIPUN SKRIP BELUM SELESAI. Prioritaskan menutup telepon jika waktu habis.`
      : "";

    return `
    ROLEPLAY: Kamu adalah KONSUMEN/PELANGGAN (Bukan Agen, Bukan AI).
    
    IDENTITAS ANDA (WAJIB KONSISTEN):
    - NAMA: ${identity.name} (${identity.gender === 'male' ? 'Pria' : 'Wanita'})
    - LOKASI/DOMISILI: ${identity.city}
    - NOMOR HP: ${identity.phone}
    
    PENTING: Jika ditanya agen, sebutkan data di atas. JANGAN MENGARANG data identitas baru yang berbeda.
    
    MASALAH ANDA: ${s?.title || "Masalah Umum"}. ${s?.description || "Ingin bertanya sesuatu."}
    ${s?.script ? `\nSKRIP PERCAKAPAN (PANDUAN ALUR):
Gunakan skrip berikut sebagai panduan utama arah percakapan, informasi penting, dan urutan eskalasi masalah.
- Skrip bisa ditulis dalam DUA FORMAT, dan Anda harus bisa memahami keduanya:
  1. FORMAT DIALOG, mis. "Agent: ..." dan "Konsumen: ..."
  2. FORMAT POIN ALUR, mis. "Awal:", "Jika agen bertanya:", "Akhir:", dst.
- Jika skrip berbentuk FORMAT DIALOG:
  - Perlakukan bagian "Agent" sebagai contoh pemicu atau arah percakapan dari agen.
  - Perlakukan bagian "Konsumen" sebagai contoh respons, nada bicara, dan informasi yang perlu Anda keluarkan secara bertahap.
  - Jangan menyalin dialog mentah-mentah; adaptasikan dengan percakapan aktual.
- Jika skrip berbentuk FORMAT POIN ALUR:
  - Ikuti tahapan, kondisi, emosi, dan informasi penting yang tertulis sebagai panduan perilaku.
- IKUTI inti alur, fakta penting, emosi, dan konteks dari skrip ini semampunya.
- JANGAN menyalin skrip secara verbatim atau terdengar seperti membaca naskah.
- JANGAN berikan semua informasi sekaligus; buka informasi sedikit demi sedikit sesuai pertanyaan agen dan alur percakapan yang natural.
- BOLEH menyimpang dari urutan skrip bila diperlukan agar percakapan tetap realistis, menjawab pertanyaan agen dengan relevan, atau menutup percakapan secara natural.
- Jika ada konflik antara skrip, pertanyaan agen, dan kondisi percakapan aktual, prioritaskan respons yang paling natural namun tetap konsisten dengan inti masalah pada skrip.

Isi skrip:
${s.script}\n` : ''}
    ${timeLimitInstruction}
    ${pacingInstruction}
    
    ATURAN BICARA (SANGAT PENTING):
    1. JANGAN PERNAH BERHENTI MENDADAK DI TENGAH KALIMAT. Selesaikan pikiranmu.
    2. Abaikan suara bising kecil atau gumaman agen, teruskan bicara sampai kalimatmu selesai.
    3. Jika agen menyela panjang, barulah berhenti. Tapi jika hanya "hmm" atau suara kecil, LANJUTKAN.
     4. MENYELA KONDISIONAL: Jika agen berbicara terlalu panjang tanpa jeda, kamu BOLEH menyela secara sopan untuk meminta agen bicara lebih pelan atau satu per satu. Jangan menyela secara agresif. Jika agen hanya mengeluarkan suara kecil seperti 'hmm', 'oh', napas — lanjutkan bicara.
    5. JANGAN MENGAKHIRI PERCAKAPAN HANYA KARENA AGEN MERESPONS SINGKAT seperti "iya", "baik", "oke", "kemudian", "lanjut", "hmm", "ya", "sip", "betul". Respons singkat ini BUKAN tanda percakapan selesai.
    6. Jika agen memberi respons singkat (acknowledgment), LANJUTKAN eksposisi masalahmu atau ajukan pertanyaan baru. Jangan menutup telepon hanya karena agen merespons singkat.
    
    ATURAN ROLEPLAY:
    1. JANGAN PERNAH MENAWARKAN BANTUAN. Kamu pelanggan, kamu yang butuh bantuan.
    2. JANGAN MEMPERKENALKAN DIRI SEBAGAI AI.
    3. Gunakan Bahasa Indonesia lisan yang natural, boleh tidak baku.
    
    KONSISTENSI SUARA (CRITICAL):
    - ${genderInstruction}
    - JANGAN BERUBAH MENJADI LAWAN JENIS APAPUN YANG TERJADI.
    - Pertahankan pitch dan tone suara dari awal sampai akhir.
    - JANGAN meniru atau menyesuaikan suara dengan suara agen. Tetap pada karakter suaramu sendiri.
    - Jika suara mulai terdengar berubah, SEGERA kembalikan ke pitch dan tone asli.
    
    KARAKTER & EMOSI:
    - ${emotionInstruction}
    `;
  }
}

/**
 * Menghasilkan respon suara konsumen menggunakan Gemini 2.5 Flash TTS
 */
export const generateConsumerVoice = async (
  config: SessionConfig,
  scenario: Scenario,
  prompt: string,
  userId?: string
): Promise<string | undefined> => {
  try {
    const voiceName = config.identity.gender === 'male' ? 'Fenrir' : 'Kore';

    const response = await generateGeminiContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: prompt }] }],
      responseModalities: ["AUDIO"] as unknown as string[],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName },
        },
      } as unknown as Record<string, unknown>,
      usageContext: { module: 'telefun', action: 'voice_tts' },
      userId,
    });

    return (response as { audioData?: string }).audioData; // Need to update Server Action to return audio data
  } catch (error) {
    console.error("[Telefun] Voice generation error:", error);
    return undefined;
  }
};

/**
 * Menghasilkan teks respon konsumen berdasarkan konteks percakapan
 */
export const generateConsumerResponse = async (
  config: SessionConfig,
  scenario: Scenario,
  history: { role: 'agent' | 'consumer'; text: string }[],
  userId?: string
): Promise<string> => {
  const scriptInstruction = scenario.script
    ? `SKRIP PERCAKAPAN (PANDUAN ALUR):
Gunakan skrip berikut sebagai panduan utama arah percakapan, informasi penting, dan urutan eskalasi masalah.
- Skrip bisa ditulis dalam DUA FORMAT, dan Anda harus bisa memahami keduanya:
  1. FORMAT DIALOG, mis. "Agent: ..." dan "Konsumen: ..."
  2. FORMAT POIN ALUR, mis. "Awal:", "Jika agen bertanya:", "Akhir:", dst.
- Jika skrip berbentuk FORMAT DIALOG:
  - Perlakukan bagian "Agent" sebagai contoh pemicu atau arah percakapan dari agen.
  - Perlakukan bagian "Konsumen" sebagai contoh respons, nada bicara, dan informasi yang perlu Anda keluarkan secara bertahap.
  - Jangan menyalin dialog mentah-mentah; adaptasikan dengan percakapan aktual.
- Jika skrip berbentuk FORMAT POIN ALUR:
  - Ikuti tahapan, kondisi, emosi, dan informasi penting yang tertulis sebagai panduan perilaku.
- IKUTI inti alur, fakta penting, emosi, dan konteks dari skrip ini semampunya.
- JANGAN menyalin skrip secara verbatim atau terdengar seperti membaca naskah.
- JANGAN berikan semua informasi sekaligus; buka informasi sedikit demi sedikit sesuai pertanyaan agen dan alur percakapan yang natural.
- BOLEH menyimpang dari urutan skrip bila diperlukan agar percakapan tetap realistis, menjawab pertanyaan agen dengan relevan, atau menutup percakapan secara natural.
- Jika ada konflik antara skrip, pertanyaan agen, dan kondisi percakapan aktual, prioritaskan respons yang paling natural namun tetap konsisten dengan inti masalah pada skrip.

Isi skrip:
${scenario.script}`
    : '';

  const systemInstruction = `
    Anda berperan sebagai konsumen Kontak OJK 157 melalui TELEPON.
    IDENTITAS ANDA:
    - Nama: ${config.identity.name}
    - Kota: ${config.identity.city}
    
    Sifat Anda: ${config.consumerType.description}.
    Masalah Anda: ${scenario.description}.
    
    ${scriptInstruction}
    
    ATURAN PERCAKAPAN TELEPON:
    1. Berikan respon yang sangat singkat dan natural layaknya orang berbicara di telepon.
    2. Jangan gunakan format teks formal atau bullet points.
    3. Jika agen menanyakan data diri, berikan data di atas.
    4. Jika masalah selesai, ucapkan terima kasih dan tutup pembicaraan.
    5. JANGAN mengakui Anda adalah AI.
  `;

  const contents = history.map(msg => ({
    role: msg.role === 'agent' ? 'user' : 'model',
    parts: [{ text: msg.text }]
  }));

  try {
    const response = await generateGeminiContent({
      model: config.model || "gemini-3.1-flash-lite-preview",
      contents: contents,
      systemInstruction,
      temperature: 0.7,
      usageContext: { module: 'telefun', action: 'chat_response' },
      userId,
    });

    return typeof response.text === 'string' ? response.text : "Halo?";
  } catch (error) {
    console.error("[Telefun] Response generation error:", error);
    return "Maaf, bisa diulangi?";
  }
};

/**
 * Menghasilkan pesan pembuka telepon
 */
export const generateFirstCallMessage = async (
  config: SessionConfig,
  scenario: Scenario,
  userId?: string
): Promise<string> => {
  const scriptInstruction = scenario.script
    ? `SKRIP PERCAKAPAN (PANDUAN ALUR):
Gunakan skrip berikut sebagai panduan utama arah percakapan, informasi penting, dan urutan eskalasi masalah.
- IKUTI inti alur, fakta penting, emosi, dan konteks dari skrip ini semampunya.
- JANGAN menyalin skrip secara verbatim atau terdengar seperti membaca naskah.
- JANGAN berikan semua informasi sekaligus; buka informasi sedikit demi sedikit sesuai pertanyaan agen dan alur percakapan yang natural.

Isi skrip:
${scenario.script}`
    : '';

  const systemInstruction = `
    Anda berperan sebagai konsumen Kontak OJK 157 melalui TELEPON.
    IDENTITAS ANDA:
    - Nama: ${config.identity.name}
    - Kota: ${config.identity.city}
    
    Sifat Anda: ${config.consumerType.description}.
    Masalah Anda: ${scenario.description}.
    
    ${scriptInstruction}
    
    TUGAS:
    Berikan pesan pembuka telepon yang singkat dan natural (misal: "Halo, selamat siang", "Halo, dengan OJK?", "Halo, saya mau tanya...").
    JANGAN mengakui Anda adalah AI.
  `;

  try {
    const response = await generateGeminiContent({
      model: config.model || "gemini-3.1-flash-lite-preview",
      contents: [{ role: 'user', parts: [{ text: "Berikan pesan pembuka telepon." }] }],
      systemInstruction,
      temperature: 0.7,
      usageContext: { module: 'telefun', action: 'first_message' },
      userId,
    });

    return typeof response.text === 'string' ? response.text : "Halo?";
  } catch (error) {
    console.error("[Telefun] First call message generation error:", error);
    return "Halo?";
  }
};

/**
 * Menghasilkan skor simulasi
 */
export const generateScore = async (
  config: SessionConfig,
  scenario: Scenario,
  duration: number,
  userId?: string
): Promise<{ score: number; feedback: string }> => {
  const systemInstruction = `
    Anda adalah seorang Asisten Penilai (Assessor) OJK yang bertugas mengevaluasi kinerja agen contact center dalam menangani keluhan konsumen melalui TELEPON.
    Identitas Konsumen: ${config.identity.name}
    Skenario: ${scenario.title} - ${scenario.description}
    Durasi Telepon: ${duration} detik
    
    TUGAS:
    Berikan penilaian simulasi telepon ini. Karena ini adalah simulasi suara, berikan skor berdasarkan tingkat kesulitan skenario dan durasi yang dihabiskan.
    
    OUTPUT: Berikan respon dalam format JSON:
    {
      "score": 85,
      "feedback": "Simulasi telepon berjalan dengan durasi yang cukup..."
    }
  `;

  try {
    const response = await generateGeminiContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: [{ role: 'user', parts: [{ text: "Berikan penilaian untuk simulasi telepon." }] }],
      systemInstruction,
      responseMimeType: "application/json",
      usageContext: { module: 'telefun', action: 'score_generation' },
      userId,
    });

    const responseText = typeof response.text === 'string' ? response.text : "{}";
    const result = JSON.parse(responseText);
    return {
      score: result.score || 0,
      feedback: result.feedback || "Gagal menghasilkan penilaian."
    };
  } catch (error) {
    console.error("Scoring error:", error);
    return {
      score: 0,
      feedback: "Terjadi kesalahan sistem saat melakukan penilaian."
    };
  }
};
