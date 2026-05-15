/**
 * Property-Based Tests for Turn-Taking Engine
 *
 * Properties 4–7 from the design document, validating contextual
 * turn-taking detection behavior.
 *
 * Feature: telefun-realistic
 * Library: fast-check with Vitest
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  evaluateTurnTaking,
  createInitialTurnTakingState,
  type TurnTakingState,
  type TurnTakingInput,
  type ContextualSignals,
} from '@/app/(main)/telefun/services/realisticMode/turnTakingEngine';
import type { TelefunSessionState } from '@/app/(main)/telefun/types';

// ---------------------------------------------------------------------------
// Constants (mirrored from implementation for test assertions)
// ---------------------------------------------------------------------------

const DEFAULT_SILENCE_THRESHOLD_MS = 1500;
const EXTENDED_SILENCE_THRESHOLD_MS = 2000;
const RESPONSE_DELAY_MS = 400;
const NON_SPEECH_MAX_DURATION_MS = 300;
const SPEECH_RMS_THRESHOLD = 0.02;

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const sessionStateArb: fc.Arbitrary<TelefunSessionState> = fc.constantFrom(
  'idle',
  'connecting',
  'ready',
  'user_speaking',
  'ai_thinking',
  'ai_speaking',
  'interruption_candidate',
  'recovering',
  'ended'
);

/**
 * Generates contextual signals with NO completion signals
 * (no falling intonation, no sentence-final particle).
 * May or may not have continuation signals.
 */
const noCompletionSignalsArb: fc.Arbitrary<ContextualSignals> = fc.record({
  hasFallingIntonation: fc.constant(false),
  hasSentenceFinalParticle: fc.constant(false),
  hasConjunction: fc.boolean(),
  hasRisingIntonation: fc.boolean(),
  lastTranscriptionChunk: fc.string(),
});

/**
 * Generates a silence duration strictly less than 1500ms (the default threshold).
 */
const shortSilenceDurationArb: fc.Arbitrary<number> = fc.integer({
  min: 1,
  max: DEFAULT_SILENCE_THRESHOLD_MS - 1,
});

/**
 * Generates a base timestamp for `now`.
 */
const timestampArb: fc.Arbitrary<number> = fc.integer({ min: 10000, max: 1_000_000 });

/**
 * Generates RMS values below the speech threshold (non-speech).
 * Uses Math.fround to ensure 32-bit float compatibility with fast-check.
 */
const nonSpeechRmsArb: fc.Arbitrary<number> = fc.float({
  min: Math.fround(0.0001),
  max: Math.fround(SPEECH_RMS_THRESHOLD - 0.001),
  noNaN: true,
});

/**
 * Generates RMS values at or above the speech threshold (speech).
 */
const speechRmsArb: fc.Arbitrary<number> = fc.float({
  min: Math.fround(SPEECH_RMS_THRESHOLD),
  max: Math.fround(1.0),
  noNaN: true,
});

// ---------------------------------------------------------------------------
// Property 4: Mid-utterance pauses are not classified as end-of-turn
// ---------------------------------------------------------------------------

describe('Turn-Taking Engine - Property Tests', () => {
  /**
   * **Validates: Requirements 2.2**
   *
   * Property 4: For any TurnTakingInput where silence duration < 1500ms
   * AND contextualSignals has no falling intonation AND no sentence-final
   * particle, the TurnTakingResult action must NOT be `end_of_turn`.
   */
  it('Property 4: Mid-utterance pauses are not classified as end-of-turn', () => {
    fc.assert(
      fc.property(
        timestampArb,
        shortSilenceDurationArb,
        noCompletionSignalsArb,
        speechRmsArb,
        sessionStateArb,
        (baseTime, silenceDuration, signals, rms, sessionState) => {
          // Set up state with silence already started
          const silenceStartMs = baseTime;
          const now = baseTime + silenceDuration;

          const state: TurnTakingState = {
            silenceStartMs,
            lastAudioRms: rms,
            isMultiClause: signals.hasConjunction || signals.hasRisingIntonation,
            contextualSignals: signals,
            pendingEndOfTurn: false,
            responseDelayUntil: null,
          };

          const input: TurnTakingInput = {
            now,
            isSilent: true,
            rms: 0, // silent
            sessionState,
          };

          const result = evaluateTurnTaking(state, input);

          // The action must NOT be end_of_turn for short silence without completion signals
          expect(result.action).not.toBe('end_of_turn');
        }
      ),
      { numRuns: 100 }
    );
  });

  // ---------------------------------------------------------------------------
  // Property 5: Non-speech sounds are suppressed
  // ---------------------------------------------------------------------------

  /**
   * **Validates: Requirements 2.3**
   *
   * Property 5: For any TurnTakingInput where the audio event duration is
   * less than 300ms and RMS is below the speech threshold, the action must
   * be `suppress_non_speech`.
   */
  it('Property 5: Non-speech sounds are suppressed', () => {
    fc.assert(
      fc.property(
        timestampArb,
        fc.integer({ min: 1, max: NON_SPEECH_MAX_DURATION_MS - 1 }),
        nonSpeechRmsArb,
        sessionStateArb,
        (baseTime, eventDuration, rms, sessionState) => {
          // State: silence was being tracked (silenceStartMs set)
          // The non-speech event occurs within the duration window
          const silenceStartMs = baseTime;
          const now = baseTime + eventDuration;

          const state: TurnTakingState = {
            silenceStartMs,
            lastAudioRms: 0,
            isMultiClause: false,
            contextualSignals: {
              hasFallingIntonation: false,
              hasSentenceFinalParticle: false,
              hasConjunction: false,
              hasRisingIntonation: false,
              lastTranscriptionChunk: '',
            },
            pendingEndOfTurn: false,
            responseDelayUntil: null,
          };

          const input: TurnTakingInput = {
            now,
            isSilent: false, // audio event (not silence)
            rms, // below speech threshold
            sessionState,
          };

          const result = evaluateTurnTaking(state, input);

          expect(result.action).toBe('suppress_non_speech');
        }
      ),
      { numRuns: 100 }
    );
  });

  // ---------------------------------------------------------------------------
  // Property 6: Response delay is always applied after end-of-turn
  // ---------------------------------------------------------------------------

  /**
   * **Validates: Requirements 2.4**
   *
   * Property 6: For any TurnTakingResult where action is `end_of_turn`,
   * the resulting state.responseDelayUntil must equal input.now + 400.
   */
  it('Property 6: Response delay is always applied after end-of-turn', () => {
    fc.assert(
      fc.property(
        timestampArb,
        fc.integer({ min: EXTENDED_SILENCE_THRESHOLD_MS, max: 10000 }),
        fc.boolean(),
        sessionStateArb,
        (baseTime, silenceDuration, isMultiClause, sessionState) => {
          // Create a state where silence has exceeded the threshold
          // and there's a completeness signal to ensure end_of_turn fires
          const silenceStartMs = baseTime;
          const now = baseTime + silenceDuration;

          const signals: ContextualSignals = {
            hasFallingIntonation: true, // completeness signal
            hasSentenceFinalParticle: false,
            hasConjunction: false,
            hasRisingIntonation: false,
            lastTranscriptionChunk: '',
          };

          const state: TurnTakingState = {
            silenceStartMs,
            lastAudioRms: 0.05,
            isMultiClause,
            contextualSignals: signals,
            pendingEndOfTurn: false,
            responseDelayUntil: null,
          };

          const input: TurnTakingInput = {
            now,
            isSilent: true,
            rms: 0,
            sessionState,
          };

          const result = evaluateTurnTaking(state, input);

          // Only check the property when end_of_turn is actually triggered
          if (result.action === 'end_of_turn') {
            expect(result.state.responseDelayUntil).toBe(now + RESPONSE_DELAY_MS);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.4** (stronger variant)
   *
   * Ensures that whenever we construct a scenario that MUST produce
   * end_of_turn, the response delay is correctly set.
   */
  it('Property 6 (strong): end_of_turn always sets responseDelayUntil = now + 400', () => {
    fc.assert(
      fc.property(
        timestampArb,
        sessionStateArb,
        (baseTime, sessionState) => {
          // Force end_of_turn: silence >= 2000ms with falling intonation
          const silenceStartMs = baseTime;
          const now = baseTime + EXTENDED_SILENCE_THRESHOLD_MS + 100;

          const signals: ContextualSignals = {
            hasFallingIntonation: true,
            hasSentenceFinalParticle: false,
            hasConjunction: false,
            hasRisingIntonation: false,
            lastTranscriptionChunk: '',
          };

          const state: TurnTakingState = {
            silenceStartMs,
            lastAudioRms: 0.05,
            isMultiClause: false,
            contextualSignals: signals,
            pendingEndOfTurn: false,
            responseDelayUntil: null,
          };

          const input: TurnTakingInput = {
            now,
            isSilent: true,
            rms: 0,
            sessionState,
          };

          const result = evaluateTurnTaking(state, input);

          // With silence > 2000ms and falling intonation, this must be end_of_turn
          expect(result.action).toBe('end_of_turn');
          expect(result.state.responseDelayUntil).toBe(now + RESPONSE_DELAY_MS);
        }
      ),
      { numRuns: 100 }
    );
  });

  // ---------------------------------------------------------------------------
  // Property 7: Silence threshold selection follows multi-clause and ambiguity rules
  // ---------------------------------------------------------------------------

  /**
   * **Validates: Requirements 2.5, 2.6, 2.7**
   *
   * Property 7: For any TurnTakingState:
   * (a) if isMultiClause is true, silenceThresholdMs must be 2000;
   * (b) if isMultiClause is false and signals are clear, silenceThresholdMs
   *     must be 1500 with at least one completeness signal required;
   * (c) if signals are ambiguous, silenceThresholdMs must be 2000.
   */
  describe('Property 7: Silence threshold selection follows multi-clause and ambiguity rules', () => {
    /**
     * (a) Multi-clause → threshold = 2000ms
     */
    it('7a: Multi-clause extends threshold to 2000ms', () => {
      fc.assert(
        fc.property(
          timestampArb,
          fc.integer({ min: 1, max: 3000 }),
          sessionStateArb,
          fc.boolean(),
          (baseTime, silenceDuration, sessionState, hasParticle) => {
            const silenceStartMs = baseTime;
            const now = baseTime + silenceDuration;

            // Multi-clause: conjunction or rising intonation present
            const signals: ContextualSignals = {
              hasFallingIntonation: false,
              hasSentenceFinalParticle: hasParticle,
              hasConjunction: true, // multi-clause indicator
              hasRisingIntonation: false,
              lastTranscriptionChunk: '',
            };

            const state: TurnTakingState = {
              silenceStartMs,
              lastAudioRms: 0.05,
              isMultiClause: true,
              contextualSignals: signals,
              pendingEndOfTurn: false,
              responseDelayUntil: null,
            };

            const input: TurnTakingInput = {
              now,
              isSilent: true,
              rms: 0,
              sessionState,
            };

            const result = evaluateTurnTaking(state, input);

            expect(result.silenceThresholdMs).toBe(EXTENDED_SILENCE_THRESHOLD_MS);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * (b) Non-multi-clause with clear signals → threshold = 1500ms
     * Clear signals means: has at least one completeness signal (falling intonation
     * or sentence-final particle) and no continuation signals.
     *
     * Note: The implementation updates contextual signals from the current input
     * (pitchHz and transcriptionChunk). To maintain falling intonation, we must
     * provide a pitchHz <= 150. For sentence-final particles, we provide a
     * transcription chunk ending with a particle.
     */
    it('7b: Non-multi-clause with clear completion signals uses 1500ms threshold', () => {
      fc.assert(
        fc.property(
          timestampArb,
          fc.integer({ min: 1, max: DEFAULT_SILENCE_THRESHOLD_MS - 1 }),
          sessionStateArb,
          fc.constantFrom(
            // Clear completion via falling intonation (pitchHz <= 150)
            { pitchHz: 100, transcriptionChunk: undefined as string | undefined },
            { pitchHz: 120, transcriptionChunk: undefined as string | undefined },
            { pitchHz: 150, transcriptionChunk: undefined as string | undefined },
            // Clear completion via sentence-final particle
            { pitchHz: undefined as number | undefined, transcriptionChunk: 'baik ya' },
            { pitchHz: undefined as number | undefined, transcriptionChunk: 'itu kan' },
            { pitchHz: undefined as number | undefined, transcriptionChunk: 'begitu lho' },
            { pitchHz: undefined as number | undefined, transcriptionChunk: 'iya sih' },
            // Both: falling intonation + particle
            { pitchHz: 130, transcriptionChunk: 'sudah ya' }
          ),
          (baseTime, silenceDuration, sessionState, completionInput) => {
            const silenceStartMs = baseTime;
            const now = baseTime + silenceDuration;

            // Start with neutral signals; the implementation will update them
            // from the input's pitchHz and transcriptionChunk
            const signals: ContextualSignals = {
              hasFallingIntonation: false,
              hasSentenceFinalParticle: false,
              hasConjunction: false,
              hasRisingIntonation: false,
              lastTranscriptionChunk: '',
            };

            const state: TurnTakingState = {
              silenceStartMs,
              lastAudioRms: 0.05,
              isMultiClause: false,
              contextualSignals: signals,
              pendingEndOfTurn: false,
              responseDelayUntil: null,
            };

            const input: TurnTakingInput = {
              now,
              isSilent: true,
              rms: 0,
              pitchHz: completionInput.pitchHz,
              transcriptionChunk: completionInput.transcriptionChunk,
              sessionState,
            };

            const result = evaluateTurnTaking(state, input);

            // With clear completion signals and no multi-clause, threshold should be 1500ms
            expect(result.silenceThresholdMs).toBe(DEFAULT_SILENCE_THRESHOLD_MS);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * (c) Ambiguous signals → threshold = 2000ms
     * Ambiguous means: no completion signals AND no continuation signals.
     */
    it('7c: Ambiguous signals extend threshold to 2000ms', () => {
      fc.assert(
        fc.property(
          timestampArb,
          fc.integer({ min: 1, max: 3000 }),
          sessionStateArb,
          (baseTime, silenceDuration, sessionState) => {
            const silenceStartMs = baseTime;
            const now = baseTime + silenceDuration;

            // Ambiguous: no completion, no continuation
            const signals: ContextualSignals = {
              hasFallingIntonation: false,
              hasSentenceFinalParticle: false,
              hasConjunction: false,
              hasRisingIntonation: false,
              lastTranscriptionChunk: '',
            };

            const state: TurnTakingState = {
              silenceStartMs,
              lastAudioRms: 0.05,
              isMultiClause: false,
              contextualSignals: signals,
              pendingEndOfTurn: false,
              responseDelayUntil: null,
            };

            const input: TurnTakingInput = {
              now,
              isSilent: true,
              rms: 0,
              sessionState,
            };

            const result = evaluateTurnTaking(state, input);

            expect(result.silenceThresholdMs).toBe(EXTENDED_SILENCE_THRESHOLD_MS);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
