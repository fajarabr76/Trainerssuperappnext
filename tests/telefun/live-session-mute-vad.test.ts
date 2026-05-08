import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConsumerDifficulty, type SessionConfig } from '../../app/types';
import { LiveSession, buildTelefunLiveSetupMessage } from '../../app/(main)/telefun/services/geminiService';

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
    selectedModel: 'gemini-2.0-flash-lite',
    simulationDuration: 10,
    responsePacingMode: 'realistic',
    maxCallDuration: 5,
    telefunTransport: 'gemini-live',
    telefunModelId: 'gemini-3.1-flash-live-preview',
  };
}

describe('LiveSession mute and VAD semantics', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('builds Live setup with high end sensitivity and activity-only turn coverage', () => {
    const setup = buildTelefunLiveSetupMessage({
      modelId: 'gemini-3.1-flash-live-preview',
      voiceName: 'Kore',
      systemInstruction: 'test',
    });

    expect(setup.setup.realtimeInputConfig.automaticActivityDetection.disabled).toBe(false);
    expect(setup.setup.realtimeInputConfig.automaticActivityDetection.startOfSpeechSensitivity).toBe('START_SENSITIVITY_LOW');
    expect(setup.setup.realtimeInputConfig.automaticActivityDetection.endOfSpeechSensitivity).toBe('END_SENSITIVITY_HIGH');
    expect(setup.setup.realtimeInputConfig.automaticActivityDetection.silenceDurationMs).toBe(950);
    expect(setup.setup.realtimeInputConfig.turnCoverage).toBe('TURN_INCLUDES_ONLY_ACTIVITY');
    expect(setup.setup.inputAudioTranscription).toEqual({});
  });

  it('sends audioStreamEnd once on mute transition and does not send clientContent nudge', () => {
    const session = new LiveSession(createSessionConfig());
    const sendRealtimeInputAudioStreamEnd = vi.fn();
    const sendClientMessage = vi.fn();
    const track = { enabled: true };

    (session as unknown as {
      session: {
        sendRealtimeInput: () => void;
        sendRealtimeInputAudioStreamEnd: () => void;
        close: () => void;
        sendClientMessage: (json: string) => void;
      };
      stream: { getAudioTracks: () => Array<{ enabled: boolean }> };
    }).session = {
      sendRealtimeInput: () => undefined,
      sendRealtimeInputAudioStreamEnd,
      close: () => undefined,
      sendClientMessage,
    };
    (session as unknown as { stream: { getAudioTracks: () => Array<{ enabled: boolean }> } }).stream = {
      getAudioTracks: () => [track],
    };

    session.setMute(true);
    session.setMute(true);

    expect(sendRealtimeInputAudioStreamEnd).toHaveBeenCalledTimes(1);
    expect(sendClientMessage).not.toHaveBeenCalled();
    expect(track.enabled).toBe(false);
  });

  it('emits audio_stream_resumed once after unmute when audio resumes', () => {
    const session = new LiveSession(createSessionConfig());
    vi.spyOn(Date, 'now').mockReturnValue(5000);
    const timelineSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const state = session as unknown as {
      pendingAudioResumeLog: boolean;
      audioStreamEndSentAt: number | null;
      markAudioStreamResumedIfNeeded: (now: number) => void;
    };
    state.pendingAudioResumeLog = true;
    state.audioStreamEndSentAt = 4500;

    state.markAudioStreamResumedIfNeeded(Date.now());
    state.markAudioStreamResumedIfNeeded(5200);

    const events = timelineSpy.mock.calls
      .filter((call) => call[0] === '[Telefun][Timeline]')
      .map((call) => (call[1] as { event?: string }).event);

    expect(events.filter((event) => event === 'audio_stream_resumed')).toHaveLength(1);
  });

  it('local silence completion does not send clientContent nudge', () => {
    const session = new LiveSession(createSessionConfig());
    const sendClientMessage = vi.fn();

    const state = session as unknown as {
      isAiSpeaking: boolean;
      userSpeechActive: boolean;
      lastUserNonSilentAt: number | null;
      userSpeechStartedAt: number | null;
      currentState: 'user_speaking';
      waitingForModelArmed: boolean;
      stalledResponseState: { waitingForModelSince: number | null; lastModelEventAt: number | null; recoveryLevel: 0 | 1 | 2 | 3 };
      session: {
        sendRealtimeInput: () => void;
        sendRealtimeInputAudioStreamEnd: () => void;
        close: () => void;
        sendClientMessage: (json: string) => void;
      };
      completeLocalUserTurn: (now: number, trigger: 'silence', silenceMs?: number) => void;
    };

    state.session = {
      sendRealtimeInput: () => undefined,
      sendRealtimeInputAudioStreamEnd: () => undefined,
      close: () => undefined,
      sendClientMessage,
    };
    state.isAiSpeaking = false;
    state.userSpeechActive = true;
    state.lastUserNonSilentAt = 2000;
    state.userSpeechStartedAt = 1000;
    state.currentState = 'user_speaking';
    state.waitingForModelArmed = false;
    state.stalledResponseState = { waitingForModelSince: null, lastModelEventAt: null, recoveryLevel: 0 };

    state.completeLocalUserTurn(2500, 'silence', 1000);

    expect(sendClientMessage).not.toHaveBeenCalled();
    expect(state.waitingForModelArmed).toBe(true);
  });
});
