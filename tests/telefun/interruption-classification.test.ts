import { describe, expect, it } from 'vitest';
import {
  updateInterruptionGuard,
  type InterruptionGuardState,
} from '../../app/(main)/telefun/services/interruptionGuards';

const baseState: InterruptionGuardState = {
  aiSpeakingStartedAt: null,
  nonSilentStartedAt: null,
  cooldownUntil: 0,
};

describe('Telefun interruption classification guard', () => {
  it('rejects low-amplitude noise as noise', () => {
    const result = updateInterruptionGuard(baseState, {
      now: 1000,
      isAiSpeaking: true,
      isSilent: false,
      rms: 0.004,
      noiseFloor: 0.01,
    });
    expect(result.classification).toBe('noise');
    expect(result.shouldInterrupt).toBe(false);
  });

  it('rejects short acknowledgment under minimum duration', () => {
    const started = updateInterruptionGuard(baseState, {
      now: 1000,
      isAiSpeaking: true,
      isSilent: false,
      rms: 0.03,
      minDurationMs: 600,
      aiGracePeriodMs: 0,
    });
    const shortResult = updateInterruptionGuard(started.state, {
      now: 1400,
      isAiSpeaking: true,
      isSilent: false,
      rms: 0.03,
      minDurationMs: 600,
      aiGracePeriodMs: 0,
    });
    expect(shortResult.classification).toBe('short_acknowledgment_candidate');
    expect(shortResult.shouldInterrupt).toBe(false);
  });

  it('requires minimum duration before valid interruption', () => {
    const started = updateInterruptionGuard(baseState, {
      now: 1000,
      isAiSpeaking: true,
      isSilent: false,
      rms: 0.03,
      minDurationMs: 500,
      aiGracePeriodMs: 0,
    });
    const valid = updateInterruptionGuard(started.state, {
      now: 1600,
      isAiSpeaking: true,
      isSilent: false,
      rms: 0.03,
      minDurationMs: 500,
      aiGracePeriodMs: 0,
    });
    expect(valid.classification).toBe('valid_interruption_candidate');
    expect(valid.shouldInterrupt).toBe(true);
  });

  it('enforces AI grace period to prevent early stop', () => {
    const first = updateInterruptionGuard(baseState, {
      now: 1000,
      isAiSpeaking: true,
      isSilent: false,
      rms: 0.03,
      aiGracePeriodMs: 500,
      minDurationMs: 200,
    });
    const duringGrace = updateInterruptionGuard(first.state, {
      now: 1200,
      isAiSpeaking: true,
      isSilent: false,
      rms: 0.03,
      aiGracePeriodMs: 500,
      minDurationMs: 200,
    });
    expect(duringGrace.shouldInterrupt).toBe(false);
    expect(duringGrace.classification).toBe('short_acknowledgment_candidate');
  });
});
