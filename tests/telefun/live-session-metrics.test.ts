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
    selectedModel: 'gemini-3.1-flash-lite-preview',
    simulationDuration: 10,
    responsePacingMode: 'realistic',
    maxCallDuration: 5,
    telefunTransport: 'gemini-live',
    telefunModelId: 'gemini-3.1-flash-live-preview',
  };
}

describe('LiveSession metrics', () => {
  it('finalizes active speech segment in getSessionMetrics', () => {
    vi.spyOn(Date, 'now').mockReturnValue(2_000);
    const session = new LiveSession(createSessionConfig()) as unknown as {
      sessionStartTime: number;
      speechSegments: Array<{ startMs: number; endMs: number; durationMs: number }>;
      currentSpeechSegment: { startMs: number; endMs: number; durationMs: number } | null;
      totalSpeakingMs: number;
      getSessionMetrics: () => {
        totalSpeakingMs: number;
        sessionDurationMs: number;
        speechSegments: Array<{ startMs: number; endMs: number; durationMs: number }>;
      };
    };

    session.sessionStartTime = 1_000;
    session.speechSegments = [];
    session.currentSpeechSegment = { startMs: 1_500, endMs: 0, durationMs: 0 };
    session.totalSpeakingMs = 0;

    const metrics = session.getSessionMetrics();

    expect(metrics.totalSpeakingMs).toBe(500);
    expect(metrics.sessionDurationMs).toBe(1_000);
    expect(metrics.speechSegments).toHaveLength(1);
    expect(metrics.speechSegments[0]).toEqual({ startMs: 1_500, endMs: 2_000, durationMs: 500 });
  });

  it('computes silence as duration minus speaking time and clamps to zero', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_800);
    const session = new LiveSession(createSessionConfig()) as unknown as {
      sessionStartTime: number;
      totalSpeakingMs: number;
      getSessionMetrics: () => { totalSilenceMs: number };
    };

    session.sessionStartTime = 1_000;
    session.totalSpeakingMs = 1_200;

    const metrics = session.getSessionMetrics();
    expect(metrics.totalSilenceMs).toBe(0);
  });

  it('returns volumeConsistency 0 when there are no samples', () => {
    vi.spyOn(Date, 'now').mockReturnValue(2_000);
    const session = new LiveSession(createSessionConfig()) as unknown as {
      sessionStartTime: number;
      volumeSamples: number[];
      getSessionMetrics: () => { volumeConsistency: number };
    };

    session.sessionStartTime = 1_000;
    session.volumeSamples = [];

    const metrics = session.getSessionMetrics();
    expect(metrics.volumeConsistency).toBe(0);
  });

  it('calculates volumeConsistency from non-empty samples', () => {
    vi.spyOn(Date, 'now').mockReturnValue(2_000);
    const session = new LiveSession(createSessionConfig()) as unknown as {
      sessionStartTime: number;
      volumeSamples: number[];
      getSessionMetrics: () => { volumeConsistency: number };
    };

    session.sessionStartTime = 1_000;
    session.volumeSamples = [0.2, 0.2, 0.2];

    const metrics = session.getSessionMetrics();
    expect(metrics.volumeConsistency).toBeCloseTo(100, 8);
  });
});

describe('LiveSession recorder fallback', () => {
  it('rescues chunks via disconnect fallback timer and emits once', async () => {
    vi.useFakeTimers();
    const createObjectURLMock = vi.fn(() => 'blob:test-url');
    vi.stubGlobal('URL', { createObjectURL: createObjectURLMock });

    const chunkA = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/webm' });
    const chunkB = new Blob([new Uint8Array([4, 5, 6])], { type: 'audio/webm' });

    const onRecordingComplete = vi.fn();
    const session = new LiveSession(createSessionConfig()) as unknown as {
      recordedChunks: Blob[];
      agentRecordedChunks: Blob[];
      pendingFullCallBlob: Blob | null;
      pendingAgentBlob: Blob | null;
      recordingCompleteEmitted: boolean;
      recordingFallbackTimer: ReturnType<typeof setTimeout> | null;
      expectedRecorderStops: number;
      onRecordingComplete?: (
        fullCallUrl: string | null,
        fullCallBlob: Blob | null,
        agentOnlyBlob: Blob | null,
        metrics: unknown,
      ) => void;
      disconnect: (reason?: string) => Promise<void>;
      emitRecordingCompleteOnce: () => void;
    };

    session.recordedChunks = [chunkA];
    session.agentRecordedChunks = [chunkB];
    session.pendingFullCallBlob = null;
    session.pendingAgentBlob = null;
    session.recordingCompleteEmitted = false;
    session.expectedRecorderStops = 1;
    session.recordingFallbackTimer = null;
    session.onRecordingComplete = onRecordingComplete;

    await session.disconnect('test-fallback');
    await vi.advanceTimersByTimeAsync(1000);

    // Simulate late recorder callback after fallback already emitted.
    session.emitRecordingCompleteOnce();

    expect(onRecordingComplete).toHaveBeenCalledTimes(1);
    const [fullUrl, fullBlob, agentBlob] = onRecordingComplete.mock.calls[0];
    expect(fullUrl).toBe('blob:test-url');
    expect(fullBlob).toBeInstanceOf(Blob);
    expect(agentBlob).toBeInstanceOf(Blob);
    expect(createObjectURLMock).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});
