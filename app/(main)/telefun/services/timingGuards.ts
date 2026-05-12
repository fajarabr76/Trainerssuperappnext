export interface TelefunLongSpeechState {
  nonSilentStartTime: number | null;
  lastInterruptionTime: number;
}

export interface TelefunLongSpeechInput {
  now: number;
  isSilent: boolean;
  isDisconnected: boolean;
  isHeld: boolean;
  isMuted: boolean;
  isAiSpeaking: boolean;
  hasSession: boolean;
  thresholdMs?: number;
  cooldownMs?: number;
}

export function updateTelefunLongSpeechState(
  state: TelefunLongSpeechState,
  input: TelefunLongSpeechInput
): { state: TelefunLongSpeechState; shouldInterrupt: boolean } {
  const thresholdMs = input.thresholdMs ?? 60000;
  const cooldownMs = input.cooldownMs ?? 60000;

  if (
    input.isDisconnected ||
    input.isHeld ||
    input.isMuted ||
    input.isAiSpeaking ||
    !input.hasSession
  ) {
    return {
      state: { ...state, nonSilentStartTime: null },
      shouldInterrupt: false,
    };
  }

  if (input.isSilent) {
    return {
      state: { ...state, nonSilentStartTime: null },
      shouldInterrupt: false,
    };
  }

  if (state.nonSilentStartTime === null) {
    return {
      state: { ...state, nonSilentStartTime: input.now },
      shouldInterrupt: false,
    };
  }

  const speechDuration = input.now - state.nonSilentStartTime;
  if (speechDuration >= thresholdMs && input.now - state.lastInterruptionTime >= cooldownMs) {
    return {
      state: {
        nonSilentStartTime: null,
        lastInterruptionTime: input.now,
      },
      shouldInterrupt: true,
    };
  }

  return { state, shouldInterrupt: false };
}

export function getTelefunTimeCueThreshold({
  totalSeconds,
  elapsedSeconds,
  cue30Sent,
  cue20Sent,
}: {
  totalSeconds: number;
  elapsedSeconds: number;
  cue30Sent: boolean;
  cue20Sent: boolean;
}): '30s' | '20s' | null {
  if (totalSeconds <= 0) return null;

  const remaining = totalSeconds - elapsedSeconds;
  if (totalSeconds > 50 && remaining <= 30 && remaining > 20 && !cue30Sent) return '30s';
  if (totalSeconds > 20 && remaining <= 20 && remaining > 0 && !cue20Sent) return '20s';
  return null;
}
