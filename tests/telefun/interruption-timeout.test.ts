import { describe, expect, it } from 'vitest';
import {
  getTelefunTimeCueThreshold,
  updateTelefunLongSpeechState,
  type TelefunLongSpeechState,
} from '../../app/(main)/telefun/services/timingGuards';

const baseState: TelefunLongSpeechState = {
  nonSilentStartTime: null,
  lastInterruptionTime: 0,
};

describe('Telefun long-speech interruption helper', () => {
  it('tracks non-silent speech and triggers at 60 seconds', () => {
    const started = updateTelefunLongSpeechState(baseState, {
      now: 0,
      isSilent: false,
      isDisconnected: false,
      isHeld: false,
      isMuted: false,
      isAiSpeaking: false,
      hasSession: true,
    });

    const result = updateTelefunLongSpeechState(started.state, {
      now: 60000,
      isSilent: false,
      isDisconnected: false,
      isHeld: false,
      isMuted: false,
      isAiSpeaking: false,
      hasSession: true,
    });

    expect(result.shouldInterrupt).toBe(true);
    expect(result.state).toEqual({
      nonSilentStartTime: null,
      lastInterruptionTime: 60000,
    });
  });

  it('resets tracking on silence', () => {
    const result = updateTelefunLongSpeechState(
      { nonSilentStartTime: 1000, lastInterruptionTime: 0 },
      {
        now: 2000,
        isSilent: true,
        isDisconnected: false,
        isHeld: false,
        isMuted: false,
        isAiSpeaking: false,
        hasSession: true,
      }
    );

    expect(result.shouldInterrupt).toBe(false);
    expect(result.state.nonSilentStartTime).toBeNull();
  });

  it('does not track while held, muted, disconnected, AI speaking, or without session', () => {
    const activeState = { nonSilentStartTime: 100000, lastInterruptionTime: 0 };
    const blockedCases = [
      { isDisconnected: true, isHeld: false, isMuted: false, isAiSpeaking: false, hasSession: true },
      { isDisconnected: false, isHeld: true, isMuted: false, isAiSpeaking: false, hasSession: true },
      { isDisconnected: false, isHeld: false, isMuted: true, isAiSpeaking: false, hasSession: true },
      { isDisconnected: false, isHeld: false, isMuted: false, isAiSpeaking: true, hasSession: true },
      { isDisconnected: false, isHeld: false, isMuted: false, isAiSpeaking: false, hasSession: false },
    ];

    for (const blocked of blockedCases) {
      const result = updateTelefunLongSpeechState(activeState, {
        ...blocked,
        now: 200000,
        isSilent: false,
      });
      expect(result.shouldInterrupt).toBe(false);
      expect(result.state.nonSilentStartTime).toBeNull();
    }
  });

  it('honors the 60 second cooldown before interrupting again', () => {
    const blocked = updateTelefunLongSpeechState(
      { nonSilentStartTime: 65000, lastInterruptionTime: 65000 },
      {
        now: 120000,
        isSilent: false,
        isDisconnected: false,
        isHeld: false,
        isMuted: false,
        isAiSpeaking: false,
        hasSession: true,
      }
    );

    const allowed = updateTelefunLongSpeechState(
      { nonSilentStartTime: 125000, lastInterruptionTime: 65000 },
      {
        now: 185000,
        isSilent: false,
        isDisconnected: false,
        isHeld: false,
        isMuted: false,
        isAiSpeaking: false,
        hasSession: true,
      }
    );

    expect(blocked.shouldInterrupt).toBe(false);
    expect(allowed.shouldInterrupt).toBe(true);
  });
});

describe('Telefun pre-timeout cue helper', () => {
  it('emits a 30 second cue once before the 20 second cue', () => {
    const cue30 = getTelefunTimeCueThreshold({
      totalSeconds: 300,
      elapsedSeconds: 270,
      cue30Sent: false,
      cue20Sent: false,
    });

    const skippedAfter30 = getTelefunTimeCueThreshold({
      totalSeconds: 300,
      elapsedSeconds: 271,
      cue30Sent: true,
      cue20Sent: false,
    });

    expect(cue30).toBe('30s');
    expect(skippedAfter30).toBeNull();
  });

  it('emits a 20 second reinforcement cue once', () => {
    const cue20 = getTelefunTimeCueThreshold({
      totalSeconds: 300,
      elapsedSeconds: 280,
      cue30Sent: true,
      cue20Sent: false,
    });

    const skippedAfter20 = getTelefunTimeCueThreshold({
      totalSeconds: 300,
      elapsedSeconds: 281,
      cue30Sent: true,
      cue20Sent: true,
    });

    expect(cue20).toBe('20s');
    expect(skippedAfter20).toBeNull();
  });

  it('does not emit cues for disabled or expired timers', () => {
    expect(getTelefunTimeCueThreshold({
      totalSeconds: 0,
      elapsedSeconds: 0,
      cue30Sent: false,
      cue20Sent: false,
    })).toBeNull();

    expect(getTelefunTimeCueThreshold({
      totalSeconds: 300,
      elapsedSeconds: 300,
      cue30Sent: false,
      cue20Sent: false,
    })).toBeNull();
  });
});
