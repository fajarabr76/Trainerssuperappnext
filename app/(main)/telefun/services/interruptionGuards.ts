export type InterruptionClassification =
  | 'noise'
  | 'short_acknowledgment_candidate'
  | 'valid_interruption_candidate';

export interface InterruptionGuardState {
  aiSpeakingStartedAt: number | null;
  nonSilentStartedAt: number | null;
  cooldownUntil: number;
}

export interface InterruptionGuardInput {
  now: number;
  isAiSpeaking: boolean;
  isSilent: boolean;
  rms: number;
  noiseFloor?: number;
  minDurationMs?: number;
  aiGracePeriodMs?: number;
  cooldownMs?: number;
}

export interface InterruptionGuardResult {
  state: InterruptionGuardState;
  classification: InterruptionClassification;
  shouldInterrupt: boolean;
}

const DEFAULT_NOISE_FLOOR = 0.01;
const DEFAULT_MIN_DURATION_MS = 550;
const DEFAULT_AI_GRACE_PERIOD_MS = 350;
const DEFAULT_COOLDOWN_MS = 2000;

export function updateInterruptionGuard(
  state: InterruptionGuardState,
  input: InterruptionGuardInput
): InterruptionGuardResult {
  const noiseFloor = input.noiseFloor ?? DEFAULT_NOISE_FLOOR;
  const minDurationMs = input.minDurationMs ?? DEFAULT_MIN_DURATION_MS;
  const aiGracePeriodMs = input.aiGracePeriodMs ?? DEFAULT_AI_GRACE_PERIOD_MS;
  const cooldownMs = input.cooldownMs ?? DEFAULT_COOLDOWN_MS;

  let nextState: InterruptionGuardState = { ...state };

  if (input.isAiSpeaking) {
    if (nextState.aiSpeakingStartedAt === null) {
      nextState.aiSpeakingStartedAt = input.now;
    }
  } else {
    nextState.aiSpeakingStartedAt = null;
    nextState.nonSilentStartedAt = null;
    return {
      state: nextState,
      classification: 'noise',
      shouldInterrupt: false,
    };
  }

  if (input.now < nextState.cooldownUntil) {
    if (input.isSilent || input.rms <= noiseFloor) {
      nextState.nonSilentStartedAt = null;
      return { state: nextState, classification: 'noise', shouldInterrupt: false };
    }
    return {
      state: nextState,
      classification: 'short_acknowledgment_candidate',
      shouldInterrupt: false,
    };
  }

  if (input.isSilent || input.rms <= noiseFloor) {
    nextState.nonSilentStartedAt = null;
    return { state: nextState, classification: 'noise', shouldInterrupt: false };
  }

  if (nextState.aiSpeakingStartedAt !== null && input.now - nextState.aiSpeakingStartedAt < aiGracePeriodMs) {
    return {
      state: nextState,
      classification: 'short_acknowledgment_candidate',
      shouldInterrupt: false,
    };
  }

  if (nextState.nonSilentStartedAt === null) {
    nextState.nonSilentStartedAt = input.now;
    return {
      state: nextState,
      classification: 'short_acknowledgment_candidate',
      shouldInterrupt: false,
    };
  }

  const durationMs = input.now - nextState.nonSilentStartedAt;
  if (durationMs < minDurationMs) {
    return {
      state: nextState,
      classification: 'short_acknowledgment_candidate',
      shouldInterrupt: false,
    };
  }

  nextState = {
    ...nextState,
    nonSilentStartedAt: null,
    cooldownUntil: input.now + cooldownMs,
  };
  return {
    state: nextState,
    classification: 'valid_interruption_candidate',
    shouldInterrupt: true,
  };
}
