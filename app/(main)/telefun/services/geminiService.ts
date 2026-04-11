import { LiveServerMessage } from "@google/genai";
import { generateGeminiContent } from '@/app/actions/gemini';
import { SessionConfig, Scenario } from "../types";
import { createClient } from "@/app/lib/supabase/client";

const supabase = createClient();

const STABLE_VOICE_MAP = {
  male: 'Fenrir',
  female: 'Kore'
};

/**
 * Kelas untuk menangani sesi Live Voice Gemini
 */
export class LiveSession {
  private config: SessionConfig;
  private session: any = null;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private inputSource: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private analyser: AnalyserNode | null = null;
  private stream: MediaStream | null = null;
  private nextStartTime: number = 0;
  private activeSources: Set<AudioBufferSourceNode> = new Set();
  private isDisconnected: boolean = false;
  private isHeld: boolean = false;
  private isMuted: boolean = false;
  private playbackRate: number = 1.0;
  private lastVolumeUpdate: number = 0;

  public onConnect?: () => void;
  public onDisconnect?: () => void;
  public onError?: (error: any) => void;
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

  public setHold(active: boolean) {
    console.log(`[Telefun] setHold: ${active}`);
    this.isHeld = active;
    if (active) {
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
      
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;

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
      } catch (mediaErr: any) {
        console.error("[Telefun] Media error:", mediaErr);
        if (mediaErr.name === 'NotAllowedError' || mediaErr.name === 'PermissionDeniedError') {
          throw new Error("Izin Mikrofon Ditolak. Harap izinkan akses mikrofon di browser untuk memulai simulasi.");
        } else if (mediaErr.name === 'NotFoundError' || mediaErr.name === 'DevicesNotFoundError') {
          throw new Error("Mikrofon tidak ditemukan. Pastikan perangkat input terhubung.");
        } else {
          throw new Error(`Gagal mengakses mikrofon: ${mediaErr.message || "Unknown error"}`);
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

      // Input context matches microphone sample rate
      this.inputAudioContext = new AudioContextClass({ sampleRate: streamSampleRate });
      // Output context matches Gemini's 24kHz output
      this.outputAudioContext = new AudioContextClass({ sampleRate: 24000 });

      // Setup recording destination in the output context (which will have both AI and Mic)
      this.recordingDestination = this.outputAudioContext.createMediaStreamDestination();
      
      // Connect AI audio to recording destination (done in playAudioChunk)
      
      // Connect Microphone to recording destination
      // We need to bridge the stream to the outputAudioContext
      this.micSourceForRecording = this.outputAudioContext.createMediaStreamSource(this.stream);
      this.micSourceForRecording.connect(this.recordingDestination);

      try {
        // Use a standard mimeType that's widely supported
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
        
        this.mediaRecorder.start(1000); // Collect data every second
      } catch (e) {
        console.warn("[Telefun] MediaRecorder initialization failed:", e);
      }

      // Resume contexts if needed
      const resumeContexts = async () => {
        if (this.inputAudioContext?.state === 'suspended') await this.inputAudioContext.resume();
        if (this.outputAudioContext?.state === 'suspended') await this.outputAudioContext.resume();
      };
      await resumeContexts();

      if (this.isDisconnected) return;

      this.calculatePlaybackRate();

      currentStep = "Menghubungkan ke Gemini Live...";
      this.onStatusChange?.(currentStep);

      throw new Error(
        "Telefun Live dinonaktifkan sementara sampai proxy server-side untuk Gemini Live selesai dihardening."
      );

    } catch (err: any) {
      console.error("[Telefun] Connection setup failed:", err);
      this.onStatusChange?.(`Gagal: ${err.message || "Koneksi Terputus"}`);
      this.onError?.(err);
      this.disconnect();
    }
  }

  private startAudioInput() {
    if (!this.inputAudioContext || !this.stream || !this.session) return;

    this.inputSource = this.inputAudioContext.createMediaStreamSource(this.stream);
    this.analyser = this.inputAudioContext.createAnalyser();
    this.analyser.fftSize = 256;
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
    if (this.isDisconnected || !this.analyser) return;

    const now = Date.now();
    if (now - this.lastVolumeUpdate < 100) {
      requestAnimationFrame(() => this.analyzeVolume());
      return;
    }
    this.lastVolumeUpdate = now;

    if (this.isMuted) {
      this.onVolumeChange?.(0);
      requestAnimationFrame(() => this.analyzeVolume());
      return;
    }

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    try {
      this.analyser.getByteFrequencyData(dataArray);
    } catch (e) {
      return;
    }

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const average = sum / dataArray.length;
    const normalizedVolume = Math.min(100, Math.round((average / 128) * 100));
    this.onVolumeChange?.(normalizedVolume);

    requestAnimationFrame(() => this.analyzeVolume());
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
    if (modelTurn?.parts?.[0]?.inlineData?.data) {
      const base64Audio = modelTurn.parts[0].inlineData.data;
      this.playAudioChunk(base64Audio);
    }

    if (message.serverContent?.interrupted) {
      this.stopAllAudio();
      this.onAiSpeaking?.(false);
    }

    if (modelTurn) {
      this.onAiSpeaking?.(true);
    } else if (message.serverContent?.turnComplete) {
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
      try { source.stop(); } catch (e) {}
    });
    this.activeSources.clear();
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

    if (this.processor) { try { this.processor.disconnect(); } catch (e) {} }
    if (this.analyser) { try { this.analyser.disconnect(); } catch (e) {} }
    if (this.inputSource) { try { this.inputSource.disconnect(); } catch (e) {} }
    if (this.micSourceForRecording) { try { this.micSourceForRecording.disconnect(); } catch (e) {} }
    if (this.recordingDestination) { try { this.recordingDestination.disconnect(); } catch (e) {} }

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
    this.onDisconnect?.();
  }

  private createPcmBlob(data: Float32Array): any {
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
    const combinedText = (c.name + " " + c.description + " " + (s?.title || "") + " " + (s?.description || "")).toLowerCase();

    if (combinedText.includes("marah") || combinedText.includes("panik") || combinedText.includes("ngeyel") || combinedText.includes("emosi") || combinedText.includes("kasar") || combinedText.includes("darurat") || combinedText.includes("tinggi")) {
      this.playbackRate = 1.05;
    } else if (combinedText.includes("sedih") || combinedText.includes("memelas") || combinedText.includes("bingung") || combinedText.includes("gaptek") || combinedText.includes("ragu") || combinedText.includes("lemas") || combinedText.includes("takut")) {
      this.playbackRate = 0.95;
    } else {
      this.playbackRate = 1.0;
    }
  }

  private buildSystemInstruction(): string {
    const s = this.config.scenarios[0];
    const c = this.config.consumerType;
    const identity = this.config.identity;

    let emotionInstruction = "";
    if (c.name.toLowerCase().includes("marah") || c.name.toLowerCase().includes("ngeyel")) {
      emotionInstruction = "EMOSI: MARAH/KESAL. Nada tinggi dan cepat. Jaga konsistensi suara.";
    } else if (c.name.toLowerCase().includes("gaptek")) {
      emotionInstruction = "EMOSI: BINGUNG/GAPTEK. Bicara lambat, banyak jeda 'eemm', 'anu'.";
    } else {
      emotionInstruction = `EMOSI: ${c.description}. Bicara natural.`;
    }

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
    ${s?.script ? `\nSKRIP/ALUR PERCAKAPAN (PANDUAN): ${s.script}\nIkuti alur informasi di atas secara bertahap sesuai respon agen.` : ''}
    ${timeLimitInstruction}
    
    ATURAN BICARA (SANGAT PENTING):
    1. JANGAN PERNAH BERHENTI MENDADAK DI TENGAH KALIMAT. Selesaikan pikiranmu.
    2. Abaikan suara bising kecil atau gumaman agen, teruskan bicara sampai kalimatmu selesai.
    3. Jika agen menyela panjang, barulah berhenti. Tapi jika hanya "hmm" atau suara kecil, LANJUTKAN.
    4. TAHAN INTERUPSI: Jika kamu mendengar suara napas, batuk, atau 'hmm', JANGAN BERHENTI. Terus bicara sampai poinmu selesai.
    
    ATURAN ROLEPLAY:
    1. JANGAN PERNAH MENAWARKAN BANTUAN. Kamu pelanggan, kamu yang butuh bantuan.
    2. JANGAN MEMPERKENALKAN DIRI SEBAGAI AI.
    3. Gunakan Bahasa Indonesia lisan yang natural, boleh tidak baku.
    
    KONSISTENSI SUARA (CRITICAL):
    - ${genderInstruction}
    - JANGAN BERUBAH MENJADI LAWAN JENIS APAPUN YANG TERJADI.
    - Pertahankan pitch dan tone suara dari awal sampai akhir.
    
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
  prompt: string
): Promise<string | undefined> => {
  try {
    const voiceName = config.consumerType.id === 'marah' ? 'Fenrir' : 'Kore';
    
    const response = await generateGeminiContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: prompt }] }],
      responseModalities: ["AUDIO"] as any, // Modality.AUDIO
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName },
        },
      } as any,
    });

    return (response as any).audioData; // Need to update Server Action to return audio data
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
  history: { role: 'agent' | 'consumer'; text: string }[]
): Promise<string> => {
  const systemInstruction = `
    Anda berperan sebagai konsumen Kontak OJK 157 melalui TELEPON.
    IDENTITAS ANDA:
    - Nama: ${config.identity.name}
    - Kota: ${config.identity.city}
    
    Sifat Anda: ${config.consumerType.description}.
    Masalah Anda: ${scenario.description}.
    
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
      model: config.model || "gemini-3-flash-preview",
      contents: contents,
      systemInstruction,
      temperature: 0.7,
    });

    return response.text || "Halo?";
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
  scenario: Scenario
): Promise<string> => {
  const systemInstruction = `
    Anda berperan sebagai konsumen Kontak OJK 157 melalui TELEPON.
    IDENTITAS ANDA:
    - Nama: ${config.identity.name}
    - Kota: ${config.identity.city}
    
    Sifat Anda: ${config.consumerType.description}.
    Masalah Anda: ${scenario.description}.
    
    TUGAS:
    Berikan pesan pembuka telepon yang singkat dan natural (misal: "Halo, selamat siang", "Halo, dengan OJK?", "Halo, saya mau tanya...").
    JANGAN mengakui Anda adalah AI.
  `;

  try {
    const response = await generateGeminiContent({
      model: config.model || "gemini-3-flash-preview",
      contents: [{ role: 'user', parts: [{ text: "Berikan pesan pembuka telepon." }] }],
      systemInstruction,
      temperature: 0.7,
    });

    return response.text || "Halo?";
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
  duration: number
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
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts: [{ text: "Berikan penilaian untuk simulasi telepon." }] }],
      systemInstruction,
      responseMimeType: "application/json",
    });

    const result = JSON.parse(response.text || "{}");
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
