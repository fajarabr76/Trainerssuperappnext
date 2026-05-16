import { describe, expect, it, vi } from 'vitest';
import { ConsumerDifficulty, type SessionConfig } from '@/app/types';
import { LiveSession } from '@/app/(main)/telefun/services/geminiService';

vi.mock('@/app/actions/gemini', () => ({
  generateGeminiContent: vi.fn(),
}));

function createSessionConfig(): SessionConfig {
  return {
    scenarios: [
      {
        id: 'scenario-1',
        category: 'General',
        title: 'Testing Scenario',
        description: 'Scenario for Telefun test',
        isActive: true,
      },
    ],
    consumerType: {
      id: 'consumer-1',
      name: 'Netral',
      description: 'Netral',
      difficulty: ConsumerDifficulty.Easy,
    },
    identity: {
      name: 'Konsumen Uji',
      city: 'Jakarta',
      phone: '081234567890',
      gender: 'female',
    },
    selectedModel: 'gemini-3.1-flash-lite',
    simulationDuration: 10,
    responsePacingMode: 'realistic',
    maxCallDuration: 5,
    telefunTransport: 'gemini-live',
    telefunModelId: 'gemini-3.1-flash-live-preview',
  };
}

function createMockRealisticMode() {
  return {
    isEnabled: true,
    classifyAgentResponse: vi.fn(),
    onAgentStopSpeaking: vi.fn(),
    onModelTurnComplete: vi.fn().mockReturnValue({ type: 'none' }),
    onModelResponse: vi.fn(),
    onConsumerResponse: vi.fn(),
    evaluateAudioFrame: vi.fn().mockReturnValue({
      action: 'none',
      silenceThresholdMs: 1500,
      confidence: 0,
      responseDelayUntil: null,
    }),
    evaluateFallbackResponse: vi.fn().mockReturnValue({ type: 'none' }),
    onAgentStartSpeaking: vi.fn(),
  };
}

describe('handleMessage turnComplete transcription lifetime', () => {
  it('preserves currentTurnTranscription for onModelTurnComplete after user_speaking turnComplete resets it', () => {
    vi.spyOn(Date, 'now').mockReturnValue(10_000);

    const session = new LiveSession(createSessionConfig()) as unknown as {
      currentState: string;
      currentTurnTranscription: string | null;
      realisticMode: ReturnType<typeof createMockRealisticMode>;
      handleMessage: (message: Record<string, unknown>) => Promise<void>;
      transition: (state: string) => void;
      isAiSpeaking: boolean;
      onAiSpeaking?: (speaking: boolean) => void;
      userSpeechStartedAt: number | null;
      waitingForModelArmed: boolean;
      stalledResponseState: { waitingSince: number | null; consecutiveFailures: number; lastModelActivity: number };
      emitTimeline: (event: string, meta?: Record<string, unknown>) => void;
    };

    const mockRealistic = createMockRealisticMode();
    session.realisticMode = mockRealistic as ReturnType<typeof createMockRealisticMode>;

    const agentTranscript = 'Mohon ditunggu ya sebentar saya cek dulu';

    // Simulate: user has been speaking, transcription accumulated
    session.currentTurnTranscription = agentTranscript;
    session.currentState = 'user_speaking';
    session.userSpeechStartedAt = 8000;
    session.isAiSpeaking = false;
    session.waitingForModelArmed = false;
    session.stalledResponseState = {
      waitingSince: null,
      consecutiveFailures: 0,
      lastModelActivity: 0,
    };

    // First turnComplete: arrives while still in user_speaking
    session.handleMessage({ serverContent: { turnComplete: true } });

    // Verify classifyAgentResponse was called with the transcript
    expect(mockRealistic.classifyAgentResponse).toHaveBeenCalledWith(agentTranscript, expect.any(Number));

    // Simulate model response arriving, transitioning to ai_speaking
    session.currentState = 'ai_speaking';
    session.isAiSpeaking = true;

    // Second turnComplete: model audio finished, should evaluate disruptions
    session.handleMessage({ serverContent: { turnComplete: true } });

    // CRITICAL: onModelTurnComplete must still receive the agent transcript
    expect(mockRealistic.onModelTurnComplete).toHaveBeenCalledWith(agentTranscript);
  });

  it('clears currentTurnTranscription on interrupted to prevent stale text leak', () => {
    vi.spyOn(Date, 'now').mockReturnValue(10_000);

    const session = new LiveSession(createSessionConfig()) as unknown as {
      currentTurnTranscription: string | null;
      isAiSpeaking: boolean;
      onAiSpeaking?: (speaking: boolean) => void;
      handleMessage: (message: Record<string, unknown>) => Promise<void>;
      emitTimeline: (event: string, meta?: Record<string, unknown>) => void;
      stopAllAudio: () => void;
    };

    session.currentTurnTranscription = 'transkrip dari turn sebelumnya yang harus dibersihkan';
    session.isAiSpeaking = true;

    session.handleMessage({ serverContent: { interrupted: true } });

    expect(session.currentTurnTranscription).toBeNull();
  });
});
