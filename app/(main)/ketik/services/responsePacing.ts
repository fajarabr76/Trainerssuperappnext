import { PacingMeta } from '@/app/types';

export type PacingMode = 'realistic' | 'training_fast';
export type PacingBand = 'short' | 'normal' | 'long' | 'slow' | 'follow_up';

interface PacingBandRange {
  minMs: number;
  maxMs: number;
}

const REALISTIC_RANGES: Record<PacingBand, PacingBandRange> = {
  short: { minMs: 1000, maxMs: 3000 },
  normal: { minMs: 5000, maxMs: 10000 },
  long: { minMs: 10000, maxMs: 20000 },
  slow: { minMs: 20000, maxMs: 30000 },
  follow_up: { minMs: 1200, maxMs: 2500 },
};

const TRAINING_FAST_RANGES: Record<PacingBand, PacingBandRange> = {
  short: { minMs: 800, maxMs: 1500 },
  normal: { minMs: 2000, maxMs: 4000 },
  long: { minMs: 4000, maxMs: 7000 },
  slow: { minMs: 800, maxMs: 1500 },
  follow_up: { minMs: 800, maxMs: 1500 },
};

function boundedRandom(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function classifyTextBand(textLength: number): 'short' | 'normal' | 'long' {
  if (textLength <= 25) return 'short';
  if (textLength <= 90) return 'normal';
  return 'long';
}

export function isAgentGivingSolution(lastAgentText: string | undefined): boolean {
  if (!lastAgentText) return false;
  return lastAgentText.length > 90;
}

interface SlowEligibilityParams {
  consumerTurnIndex: number;
  consecutiveSlowCount: number;
  totalSlowCount: number;
  sessionDurationMinutes: number;
  remainingSeconds: number;
}

export function isSlowEligible(params: SlowEligibilityParams): boolean {
  const { consumerTurnIndex, consecutiveSlowCount, totalSlowCount, sessionDurationMinutes, remainingSeconds } = params;

  if (consumerTurnIndex < 3) return false;
  if (consecutiveSlowCount >= 1) return false;
  if (remainingSeconds < 45) return false;

  const maxSlow = sessionDurationMinutes <= 5 ? 1 : sessionDurationMinutes <= 15 ? 2 : 2;
  if (totalSlowCount >= maxSlow) return false;

  return Math.random() < 0.15;
}

interface PacingDelayParams {
  mode: PacingMode;
  band: PacingBand;
  remainingSeconds: number;
  isClosingByTimeout: boolean;
  minDelayMs?: number;
}

export function calculatePacingDelay(params: PacingDelayParams): { delayMs: number; meta: PacingMeta } {
  const { mode, band, remainingSeconds, isClosingByTimeout, minDelayMs } = params;

  const ranges = mode === 'realistic' ? REALISTIC_RANGES : TRAINING_FAST_RANGES;
  const range = ranges[band];

  let plannedDelay = boundedRandom(range.minMs, range.maxMs);
  let timerClamped = false;

  if (isClosingByTimeout) {
    plannedDelay = boundedRandom(1000, 3000);
    timerClamped = true;
  } else if (remainingSeconds < 20) {
    plannedDelay = boundedRandom(1000, 3000);
    timerClamped = true;
  } else {
    if (minDelayMs !== undefined && plannedDelay < minDelayMs) {
      plannedDelay = boundedRandom(minDelayMs, range.maxMs > minDelayMs ? range.maxMs : minDelayMs + 5000);
    }

    const remainingMs = remainingSeconds * 1000;
    const maxAllowed = remainingMs - 5000;
    if (plannedDelay > maxAllowed && maxAllowed > 0) {
      const clampedMin = minDelayMs !== undefined ? Math.min(minDelayMs, maxAllowed) : 1000;
      plannedDelay = boundedRandom(Math.max(1000, clampedMin), Math.max(1000, maxAllowed));
      timerClamped = true;
    } else if (maxAllowed <= 0) {
      plannedDelay = boundedRandom(1000, 3000);
      timerClamped = true;
    }
  }

  return {
    delayMs: plannedDelay,
    meta: {
      mode,
      band,
      plannedDelayMs: plannedDelay,
      timerClamped,
    },
  };
}

interface FollowUpPacingParams {
  mode: PacingMode;
  followUpIndex: number;
  remainingSeconds: number;
  isClosingByTimeout: boolean;
}

export function calculateFollowUpDelay(params: FollowUpPacingParams): { delayMs: number; meta: PacingMeta } {
  const { mode, remainingSeconds, isClosingByTimeout } = params;

  if (isClosingByTimeout) {
    const delay = boundedRandom(1200, 2500);
    return {
      delayMs: delay,
      meta: { mode, band: 'follow_up', plannedDelayMs: delay, timerClamped: true },
    };
  }

  if (remainingSeconds < 20) {
    const delay = boundedRandom(1000, 3000);
    return {
      delayMs: delay,
      meta: { mode, band: 'follow_up', plannedDelayMs: delay, timerClamped: true },
    };
  }

  return calculatePacingDelay({
    mode,
    band: 'follow_up',
    remainingSeconds,
    isClosingByTimeout,
  });
}
