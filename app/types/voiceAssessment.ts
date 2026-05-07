export interface SpeechSegment {
  startMs: number;
  endMs: number;
  durationMs: number;
}

export interface SessionMetrics {
  speechSegments: SpeechSegment[];
  totalSpeakingMs: number;
  totalSilenceMs: number;
  deadAirCount: number;
  interruptionCount: number;
  volumeSamples: number[];
  volumeConsistency: number;
  inputTranscriptionChunks: string[];
  sessionDurationMs: number;
}

export interface VoiceAspectScore {
  score: number;
  verdict: string;
  feedback: string;
}

export interface VoiceQualityAssessment {
  overallScore: number;
  speakingRate: VoiceAspectScore & { wordsPerMinute: number };
  intonation: VoiceAspectScore;
  articulation: VoiceAspectScore;
  fillerWords: VoiceAspectScore & { count: number; examples: string[] };
  emotionalTone: VoiceAspectScore & { dominant: string };
  transcript: string;
  highlights: string[];
  strengths: string[];
}
