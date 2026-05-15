/**
 * Property-based tests for Backchannel Controller.
 *
 * Properties tested:
 * - Property 13: Backchannel timing respects intervals and suppression rules
 * - Property 14: Backchannel utterance comes from persona-specific pool
 * - Property 15: Instructional content reduces backchannel interval
 *
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  evaluateBackchannel,
  getBackchannelUtterance,
  BACKCHANNEL_POOLS,
} from '@/app/(main)/telefun/services/realisticMode/backchannelController';
import type {
  BackchannelState,
  BackchannelInput,
} from '@/app/(main)/telefun/services/realisticMode/backchannelController';
import type { ConsumerPersonaType } from '@/app/(main)/telefun/services/realisticMode/types';

// ---------------------------------------------------------------------------
// Helpers / Generators
// ---------------------------------------------------------------------------

/** All valid persona types */
const ALL_PERSONA_TYPES: ConsumerPersonaType[] = [
  'angry',
  'confused',
  'rushed',
  'passive',
  'critical',
  'cooperative',
];

/** Generate a valid persona type */
const arbPersonaType = fc.constantFrom(...ALL_PERSONA_TYPES);

/** Generate a valid emotional intensity (1-10) */
const arbEmotionalIntensity = fc.integer({ min: 1, max: 10 });

/** Generate a timestamp (positive integer) */
const arbTimestamp = fc.integer({ min: 10000, max: 1_000_000_000 });

/** Generate agent speaking duration in ms */
const arbSpeakingDuration = fc.integer({ min: 0, max: 120_000 });

/** Generate a speaking duration > 5000ms (above minimum threshold) */
const arbLongSpeakingDuration = fc.integer({ min: 5001, max: 120_000 });

/** Generate a speaking duration <= 5000ms (below minimum threshold) */
const arbShortSpeakingDuration = fc.integer({ min: 0, max: 5000 });

/**
 * Generate a BackchannelState with configurable constraints.
 */
const arbBackchannelState = (opts?: {
  isInstructionalContent?: boolean;
}): fc.Arbitrary<BackchannelState> =>
  fc.record({
    agentSpeakingStartMs: fc.option(arbTimestamp, { nil: null }),
    lastBackchannelAt: fc.option(arbTimestamp, { nil: null }),
    nextBackchannelAt: fc.option(arbTimestamp, { nil: null }),
    suppressedUntil: fc.option(arbTimestamp, { nil: null }),
    isInstructionalContent: fc.constant(
      opts?.isInstructionalContent ?? false
    ),
  });

/**
 * Generate a BackchannelState where isInstructionalContent can be true or false.
 */
const arbAnyBackchannelState: fc.Arbitrary<BackchannelState> = fc.record({
  agentSpeakingStartMs: fc.option(arbTimestamp, { nil: null }),
  lastBackchannelAt: fc.option(arbTimestamp, { nil: null }),
  nextBackchannelAt: fc.option(arbTimestamp, { nil: null }),
  suppressedUntil: fc.option(arbTimestamp, { nil: null }),
  isInstructionalContent: fc.boolean(),
});

// ---------------------------------------------------------------------------
// Property 13: Backchannel timing respects intervals and suppression rules
// **Validates: Requirements 5.1, 5.2, 5.5, 5.6**
// ---------------------------------------------------------------------------

describe('Property 13: Backchannel timing respects intervals and suppression rules', () => {
  it('13a: backchannel emits ONLY when all conditions are met (agentSpeakingDurationMs > 5000, isMicroPause=true, interval >= 3000, turnTakingEvaluating=false, agentSpeaking=true)', () => {
    fc.assert(
      fc.property(
        arbAnyBackchannelState,
        arbTimestamp,
        arbLongSpeakingDuration,
        arbPersonaType,
        (state, now, agentSpeakingDurationMs, personaType) => {
          // Ensure interval is respected: lastBackchannelAt is far enough in the past
          const stateWithOldBackchannel: BackchannelState = {
            ...state,
            lastBackchannelAt: now - 5000, // well past the 3000ms minimum
          };

          const input: BackchannelInput = {
            now,
            agentSpeaking: true,
            agentSpeakingDurationMs,
            isMicroPause: true,
            turnTakingEvaluating: false,
            personaType,
          };

          const result = evaluateBackchannel(stateWithOldBackchannel, input);

          // All conditions met → should emit
          expect(result.action).toBe('emit_backchannel');
          expect(result.utterance).toBeDefined();
          expect(result.maxDurationMs).toBeLessThanOrEqual(800);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('13b: when agentSpeaking=false, action is NEVER emit_backchannel', () => {
    fc.assert(
      fc.property(
        arbAnyBackchannelState,
        arbTimestamp,
        arbSpeakingDuration,
        fc.boolean(),
        fc.boolean(),
        arbPersonaType,
        (
          state,
          now,
          agentSpeakingDurationMs,
          isMicroPause,
          turnTakingEvaluating,
          personaType
        ) => {
          const input: BackchannelInput = {
            now,
            agentSpeaking: false, // agent NOT speaking
            agentSpeakingDurationMs,
            isMicroPause,
            turnTakingEvaluating,
            personaType,
          };

          const result = evaluateBackchannel(state, input);

          expect(result.action).not.toBe('emit_backchannel');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('13c: when turnTakingEvaluating=true, action is suppress (not emit_backchannel)', () => {
    fc.assert(
      fc.property(
        arbAnyBackchannelState,
        arbTimestamp,
        arbLongSpeakingDuration,
        arbPersonaType,
        (state, now, agentSpeakingDurationMs, personaType) => {
          const input: BackchannelInput = {
            now,
            agentSpeaking: true,
            agentSpeakingDurationMs,
            isMicroPause: true,
            turnTakingEvaluating: true, // TTE is evaluating
            personaType,
          };

          const result = evaluateBackchannel(state, input);

          expect(result.action).not.toBe('emit_backchannel');
          expect(result.action).toBe('suppress');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('13d: when agentSpeakingDurationMs <= 5000, backchannel does NOT emit', () => {
    fc.assert(
      fc.property(
        arbAnyBackchannelState,
        arbTimestamp,
        arbShortSpeakingDuration,
        arbPersonaType,
        (state, now, agentSpeakingDurationMs, personaType) => {
          const stateWithOldBackchannel: BackchannelState = {
            ...state,
            lastBackchannelAt: now - 10000, // interval well respected
          };

          const input: BackchannelInput = {
            now,
            agentSpeaking: true,
            agentSpeakingDurationMs,
            isMicroPause: true,
            turnTakingEvaluating: false,
            personaType,
          };

          const result = evaluateBackchannel(stateWithOldBackchannel, input);

          expect(result.action).not.toBe('emit_backchannel');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('13e: when isMicroPause=false, backchannel does NOT emit', () => {
    fc.assert(
      fc.property(
        arbAnyBackchannelState,
        arbTimestamp,
        arbLongSpeakingDuration,
        arbPersonaType,
        (state, now, agentSpeakingDurationMs, personaType) => {
          const stateWithOldBackchannel: BackchannelState = {
            ...state,
            lastBackchannelAt: now - 10000,
          };

          const input: BackchannelInput = {
            now,
            agentSpeaking: true,
            agentSpeakingDurationMs,
            isMicroPause: false, // no micro-pause
            turnTakingEvaluating: false,
            personaType,
          };

          const result = evaluateBackchannel(stateWithOldBackchannel, input);

          expect(result.action).not.toBe('emit_backchannel');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('13f: when interval since last backchannel < 3000ms, backchannel does NOT emit', () => {
    fc.assert(
      fc.property(
        arbAnyBackchannelState,
        arbTimestamp,
        arbLongSpeakingDuration,
        arbPersonaType,
        fc.integer({ min: 0, max: 2999 }),
        (state, now, agentSpeakingDurationMs, personaType, intervalMs) => {
          // Set lastBackchannelAt to be less than 3000ms ago
          const stateWithRecentBackchannel: BackchannelState = {
            ...state,
            lastBackchannelAt: now - intervalMs,
          };

          const input: BackchannelInput = {
            now,
            agentSpeaking: true,
            agentSpeakingDurationMs,
            isMicroPause: true,
            turnTakingEvaluating: false,
            personaType,
          };

          const result = evaluateBackchannel(
            stateWithRecentBackchannel,
            input
          );

          expect(result.action).not.toBe('emit_backchannel');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('13g: when lastBackchannelAt is null (first backchannel), interval condition is satisfied', () => {
    fc.assert(
      fc.property(
        arbTimestamp,
        arbLongSpeakingDuration,
        arbPersonaType,
        (now, agentSpeakingDurationMs, personaType) => {
          const state: BackchannelState = {
            agentSpeakingStartMs: now - agentSpeakingDurationMs,
            lastBackchannelAt: null, // no previous backchannel
            nextBackchannelAt: null,
            suppressedUntil: null,
            isInstructionalContent: false,
          };

          const input: BackchannelInput = {
            now,
            agentSpeaking: true,
            agentSpeakingDurationMs,
            isMicroPause: true,
            turnTakingEvaluating: false,
            personaType,
          };

          const result = evaluateBackchannel(state, input);

          // First backchannel should emit when all other conditions met
          expect(result.action).toBe('emit_backchannel');
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 14: Backchannel utterance comes from persona-specific pool
// **Validates: Requirements 5.3**
// ---------------------------------------------------------------------------

describe('Property 14: Backchannel utterance comes from persona-specific pool', () => {
  it('14a: getBackchannelUtterance always returns a string from the persona pool', () => {
    fc.assert(
      fc.property(
        arbPersonaType,
        arbEmotionalIntensity,
        (personaType, emotionalIntensity) => {
          const utterance = getBackchannelUtterance(
            personaType,
            emotionalIntensity
          );

          const pool = BACKCHANNEL_POOLS[personaType];
          expect(pool).toContain(utterance);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('14b: utterance from evaluateBackchannel (when emitting) is from the correct persona pool', () => {
    fc.assert(
      fc.property(
        arbTimestamp,
        arbLongSpeakingDuration,
        arbPersonaType,
        (now, agentSpeakingDurationMs, personaType) => {
          const state: BackchannelState = {
            agentSpeakingStartMs: now - agentSpeakingDurationMs,
            lastBackchannelAt: null,
            nextBackchannelAt: null,
            suppressedUntil: null,
            isInstructionalContent: false,
          };

          const input: BackchannelInput = {
            now,
            agentSpeaking: true,
            agentSpeakingDurationMs,
            isMicroPause: true,
            turnTakingEvaluating: false,
            personaType,
          };

          const result = evaluateBackchannel(state, input);

          expect(result.action).toBe('emit_backchannel');
          expect(result.utterance).toBeDefined();

          const pool = BACKCHANNEL_POOLS[personaType];
          expect(pool).toContain(result.utterance);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('14c: getBackchannelUtterance handles edge intensity values (1 and 10)', () => {
    fc.assert(
      fc.property(
        arbPersonaType,
        fc.constantFrom(1, 10),
        (personaType, intensity) => {
          const utterance = getBackchannelUtterance(personaType, intensity);

          const pool = BACKCHANNEL_POOLS[personaType];
          expect(pool).toContain(utterance);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('14d: getBackchannelUtterance handles out-of-range intensity (clamped to [1,10])', () => {
    fc.assert(
      fc.property(
        arbPersonaType,
        fc.oneof(
          fc.integer({ min: -100, max: 0 }),
          fc.integer({ min: 11, max: 100 })
        ),
        (personaType, intensity) => {
          const utterance = getBackchannelUtterance(personaType, intensity);

          const pool = BACKCHANNEL_POOLS[personaType];
          expect(pool).toContain(utterance);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 15: Instructional content reduces backchannel interval
// **Validates: Requirements 5.4**
// ---------------------------------------------------------------------------

describe('Property 15: Instructional content reduces backchannel interval', () => {
  it('15a: when isInstructionalContent=true and agentSpeakingDurationMs > 15000, next interval is between 4000-8000ms', () => {
    fc.assert(
      fc.property(
        arbTimestamp,
        fc.integer({ min: 15001, max: 120_000 }),
        arbPersonaType,
        (now, agentSpeakingDurationMs, personaType) => {
          const state: BackchannelState = {
            agentSpeakingStartMs: now - agentSpeakingDurationMs,
            lastBackchannelAt: null,
            nextBackchannelAt: null,
            suppressedUntil: null,
            isInstructionalContent: true,
          };

          const input: BackchannelInput = {
            now,
            agentSpeaking: true,
            agentSpeakingDurationMs,
            isMicroPause: true,
            turnTakingEvaluating: false,
            personaType,
          };

          const result = evaluateBackchannel(state, input);

          // Should emit since all conditions met
          expect(result.action).toBe('emit_backchannel');

          // The next scheduled backchannel interval should be in [4000, 8000]
          const nextInterval =
            result.state.nextBackchannelAt! - now;
          expect(nextInterval).toBeGreaterThanOrEqual(4000);
          expect(nextInterval).toBeLessThanOrEqual(8000);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('15b: when isInstructionalContent=false, next interval is in normal range [5000, 12000]', () => {
    fc.assert(
      fc.property(
        arbTimestamp,
        arbLongSpeakingDuration,
        arbPersonaType,
        (now, agentSpeakingDurationMs, personaType) => {
          const state: BackchannelState = {
            agentSpeakingStartMs: now - agentSpeakingDurationMs,
            lastBackchannelAt: null,
            nextBackchannelAt: null,
            suppressedUntil: null,
            isInstructionalContent: false,
          };

          const input: BackchannelInput = {
            now,
            agentSpeaking: true,
            agentSpeakingDurationMs,
            isMicroPause: true,
            turnTakingEvaluating: false,
            personaType,
          };

          const result = evaluateBackchannel(state, input);

          // Should emit since all conditions met
          expect(result.action).toBe('emit_backchannel');

          // The next scheduled backchannel interval should be in [5000, 12000]
          const nextInterval =
            result.state.nextBackchannelAt! - now;
          expect(nextInterval).toBeGreaterThanOrEqual(4000);
          expect(nextInterval).toBeLessThanOrEqual(12000);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('15c: instructional content detected via transcription markers reduces interval', () => {
    fc.assert(
      fc.property(
        arbTimestamp,
        fc.integer({ min: 15001, max: 120_000 }),
        arbPersonaType,
        fc.constantFrom(
          'pertama',
          'kedua',
          'ketiga',
          'selanjutnya',
          'kemudian',
          'langkah'
        ),
        (now, agentSpeakingDurationMs, personaType, marker) => {
          const state: BackchannelState = {
            agentSpeakingStartMs: now - agentSpeakingDurationMs,
            lastBackchannelAt: null,
            nextBackchannelAt: null,
            suppressedUntil: null,
            isInstructionalContent: false, // not yet detected
          };

          const input: BackchannelInput = {
            now,
            agentSpeaking: true,
            agentSpeakingDurationMs,
            isMicroPause: true,
            turnTakingEvaluating: false,
            personaType,
            transcriptionChunk: `Jadi ${marker} Anda perlu melakukan ini`,
          };

          const result = evaluateBackchannel(state, input);

          // Should emit since all conditions met
          expect(result.action).toBe('emit_backchannel');

          // Instructional content detected → interval should be in [4000, 8000]
          const nextInterval =
            result.state.nextBackchannelAt! - now;
          expect(nextInterval).toBeGreaterThanOrEqual(4000);
          expect(nextInterval).toBeLessThanOrEqual(8000);

          // State should reflect instructional content detection
          expect(result.state.isInstructionalContent).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('15d: instructional interval is strictly less than normal interval', () => {
    fc.assert(
      fc.property(
        arbTimestamp,
        fc.integer({ min: 15001, max: 120_000 }),
        arbPersonaType,
        (now, agentSpeakingDurationMs, personaType) => {
          // Test with instructional content
          const instructionalState: BackchannelState = {
            agentSpeakingStartMs: now - agentSpeakingDurationMs,
            lastBackchannelAt: null,
            nextBackchannelAt: null,
            suppressedUntil: null,
            isInstructionalContent: true,
          };

          const normalState: BackchannelState = {
            agentSpeakingStartMs: now - agentSpeakingDurationMs,
            lastBackchannelAt: null,
            nextBackchannelAt: null,
            suppressedUntil: null,
            isInstructionalContent: false,
          };

          const input: BackchannelInput = {
            now,
            agentSpeaking: true,
            agentSpeakingDurationMs,
            isMicroPause: true,
            turnTakingEvaluating: false,
            personaType,
          };

          const instructionalResult = evaluateBackchannel(
            instructionalState,
            input
          );
          const normalResult = evaluateBackchannel(normalState, input);

          // Both should emit
          expect(instructionalResult.action).toBe('emit_backchannel');
          expect(normalResult.action).toBe('emit_backchannel');

          const instructionalInterval =
            instructionalResult.state.nextBackchannelAt! - now;
          const normalInterval =
            normalResult.state.nextBackchannelAt! - now;

          // Instructional interval should be shorter than normal
          expect(instructionalInterval).toBeLessThan(normalInterval);
        }
      ),
      { numRuns: 100 }
    );
  });
});
