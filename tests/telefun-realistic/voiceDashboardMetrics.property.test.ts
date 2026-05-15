/**
 * Property-Based Tests for Voice Dashboard Metrics Classification
 *
 * Uses fast-check to verify universal correctness properties
 * of the classifySpeakingSpeed, classifySpeakingDominance, and computeWpm
 * functions.
 *
 * **Validates: Requirements 7.2, 7.3**
 */

import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';

// Mock server-only packages that are imported transitively
vi.mock('server-only', () => ({}));
vi.mock('@/app/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/app/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }));
vi.mock('@/app/actions/gemini', () => ({ generateGeminiContent: vi.fn() }));
vi.mock('@/app/actions/voiceAssessmentTimeout', () => ({ runWithVoiceAssessmentTimeout: vi.fn() }));

import {
  classifySpeakingSpeed,
  classifySpeakingDominance,
  computeWpm,
} from '@/app/actions/voiceDashboard';

// ---------------------------------------------------------------------------
// Property 20: Speaking speed classification follows WPM thresholds
// ---------------------------------------------------------------------------

describe('Property 20: Speaking speed classification follows WPM thresholds', () => {
  it('classifies wpm < 120 as too_slow', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 119 }),
        async (wpm) => {
          expect(await classifySpeakingSpeed(wpm)).toBe('too_slow');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('classifies 120 <= wpm <= 160 as normal', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 120, max: 160 }),
        async (wpm) => {
          expect(await classifySpeakingSpeed(wpm)).toBe('normal');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('classifies wpm > 160 as too_fast', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 161, max: 300 }),
        async (wpm) => {
          expect(await classifySpeakingSpeed(wpm)).toBe('too_fast');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('covers the full WPM range [0, 300] with correct classification', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 300 }),
        async (wpm) => {
          const result = await classifySpeakingSpeed(wpm);
          if (wpm < 120) {
            expect(result).toBe('too_slow');
          } else if (wpm <= 160) {
            expect(result).toBe('normal');
          } else {
            expect(result).toBe('too_fast');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 21: Speaking dominance classification follows ratio thresholds
// ---------------------------------------------------------------------------

describe('Property 21: Speaking dominance classification follows ratio thresholds', () => {
  it('classifies ratio < 0.4 as passive', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.float({ min: 0, max: Math.fround(0.39), noNaN: true }),
        async (ratio) => {
          expect(await classifySpeakingDominance(ratio)).toBe('passive');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('classifies 0.4 <= ratio <= 0.7 as balanced', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.float({ min: Math.fround(0.4), max: Math.fround(0.7), noNaN: true }),
        async (ratio) => {
          expect(await classifySpeakingDominance(ratio)).toBe('balanced');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('classifies ratio > 0.7 as dominated', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.float({ min: Math.fround(0.71), max: 1, noNaN: true }),
        async (ratio) => {
          expect(await classifySpeakingDominance(ratio)).toBe('dominated');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('covers the full ratio range [0, 1] with correct classification', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.float({ min: 0, max: 1, noNaN: true }),
        async (ratio) => {
          const result = await classifySpeakingDominance(ratio);
          if (ratio < 0.4) {
            expect(result).toBe('passive');
          } else if (ratio <= 0.7) {
            expect(result).toBe('balanced');
          } else {
            expect(result).toBe('dominated');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 33: WPM computation invariance and fallback
// ---------------------------------------------------------------------------

describe('Property 33: WPM computation uses active speaking time with fallback', () => {
  /**
   * **Validates: Requirements 7.2**
   *
   * computeWpm uses totalSpeakingMs when available, falls back to
   * sessionDurationMs otherwise.
   */

  it('uses totalSpeakingMs when > 0, ignoring sessionDurationMs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 300000 }),
        fc.integer({ min: 50, max: 500 }),
        fc.integer({ min: 1000, max: 600000 }),
        async (totalSpeakingMs, wordCount, sessionDurationMs) => {
          const wpm = await computeWpm(wordCount, totalSpeakingMs, sessionDurationMs);
          const expected = Math.round(wordCount / (totalSpeakingMs / 60000));
          expect(wpm).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('falls back to sessionDurationMs when totalSpeakingMs is 0', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 600000 }),
        fc.integer({ min: 50, max: 500 }),
        async (sessionDurationMs, wordCount) => {
          const wpm = await computeWpm(wordCount, 0, sessionDurationMs);
          const expected = Math.round(wordCount / (sessionDurationMs / 60000));
          expect(wpm).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('falls back to sessionDurationMs when totalSpeakingMs is negative', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: -100000, max: -1 }),
        fc.integer({ min: 1, max: 600000 }),
        fc.integer({ min: 50, max: 500 }),
        async (totalSpeakingMs, sessionDurationMs, wordCount) => {
          const wpm = await computeWpm(wordCount, totalSpeakingMs, sessionDurationMs);
          const expected = Math.round(wordCount / (sessionDurationMs / 60000));
          expect(wpm).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns 0 when effective speaking time is 0 (division by zero guard)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 500 }),
        async (wordCount) => {
          const wpm = await computeWpm(wordCount, 0, 0);
          expect(wpm).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns 0 when estimatedWordCount is 0', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 300000 }),
        async (totalSpeakingMs) => {
          const wpm = await computeWpm(0, totalSpeakingMs, 60000);
          expect(wpm).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('WPM is invariant when totalSpeakingMs is fixed and sessionDurationMs varies', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 30000, max: 300000 }),
        fc.integer({ min: 50, max: 500 }),
        fc.integer({ min: 1, max: 60000 }),
        async (baseSessionDuration, wordCount, durationDelta) => {
          const fixedSpeakingMs = 120000;
          const wpm1 = await computeWpm(wordCount, fixedSpeakingMs, baseSessionDuration);
          const wpm2 = await computeWpm(wordCount, fixedSpeakingMs, baseSessionDuration + durationDelta);
          expect(wpm1).toBe(wpm2);
        }
      ),
      { numRuns: 100 }
    );
  });
});
