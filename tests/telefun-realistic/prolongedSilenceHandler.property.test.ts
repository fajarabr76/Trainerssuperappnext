/**
 * Property-Based Tests for Prolonged Silence Handler
 *
 * Properties 8–10 plus UI Hold tests from the design document.
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8**
 *
 * Contract changes from v1:
 * - `lastClassification` removed from ProlongedSilenceInput (instruction
 *   phrases no longer affect silence thresholds)
 * - `holdSource` removed from ProlongedSilenceState (replaced with
 *   `uiHoldActive: boolean`)
 * - `activate_hold_nlp` removed from ProlongedSilenceAction
 * - NLP_HOLD_THRESHOLDS constant removed
 *
 * Feature: telefun-realistic
 * Library: fast-check with Vitest
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  evaluateProlongedSilence,
  type ProlongedSilenceState,
  type ProlongedSilenceInput,
} from '@/app/(main)/telefun/services/realisticMode/prolongedSilenceHandler';
import type { TelefunSessionState } from '@/app/(main)/telefun/services/realisticMode/types';

// ---------------------------------------------------------------------------
// Constants (mirrored from implementation for test assertions)
// ---------------------------------------------------------------------------

const NORMAL_CHECK_IN_MS = 8000;
const NORMAL_CLOSING_PROMPT_MS = 20000;
const NORMAL_SESSION_END_MS = 35000;

const AGENT_SPEECH_RESET_THRESHOLD_MS = 300;

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

const timestampArb: fc.Arbitrary<number> = fc.integer({ min: 100000, max: 1_000_000 });

const escalationLevelArb = fc.constantFrom<'none' | 'check_in' | 'closing_prompt' | 'session_end'>(
  'none',
  'check_in',
  'closing_prompt',
  'session_end'
);

const subEscalationLevelArb = fc.constantFrom<'none' | 'check_in' | 'closing_prompt'>(
  'none',
  'check_in',
  'closing_prompt'
);

/**
 * Builds a ProlongedSilenceState with uiHoldActive=false and a given
 * escalation level. Used for normal (non-hold) escalation tests.
 */
function stateWithoutUiHold(
  escalationLevel: 'none' | 'check_in' | 'closing_prompt',
  deadAirStartMs: number
): ProlongedSilenceState {
  return {
    deadAirStartMs,
    escalationLevel,
    uiHoldActive: false,
    uiHoldDetectedAt: null,
    uiTimerDurationMs: null,
    lastAgentAudioAt: null,
  };
}

// ---------------------------------------------------------------------------
// Property 8: Prolonged silence escalation follows threshold sequence
// ---------------------------------------------------------------------------

describe('Prolonged Silence Handler - Property Tests', () => {
  describe('Property 8: Normal escalation thresholds (R3.1, R3.2, R3.3)', () => {
    /**
     * **Validates: R3.1**
     *
     * At escalation level `none`, action becomes `check_in` when
     * deadAirDuration >= 8000ms.
     */
    it('8a: check_in triggers at >= 8000ms dead air from level none', () => {
      fc.assert(
        fc.property(
          timestampArb,
          fc.integer({ min: NORMAL_CHECK_IN_MS, max: NORMAL_CLOSING_PROMPT_MS - 1 }),
          sessionStateArb,
          (baseTime, deadAirDuration, sessionState) => {
            const deadAirStartMs = baseTime;
            const now = baseTime + deadAirDuration;

            const state = stateWithoutUiHold('none', deadAirStartMs);

            const input: ProlongedSilenceInput = {
              now,
              agentSpeaking: false,
              agentAudioDurationMs: 0,
              sessionState,
              uiHoldActive: false,
              uiHoldTimerExpired: false,
            };

            const result = evaluateProlongedSilence(state, input);

            expect(result.action).toBe('check_in');
            expect(result.state.escalationLevel).toBe('check_in');
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Validates: R3.1**
     *
     * No check_in before 8000ms of dead air.
     */
    it('8a (negative): no check_in before 8000ms dead air', () => {
      fc.assert(
        fc.property(
          timestampArb,
          fc.integer({ min: 1, max: NORMAL_CHECK_IN_MS - 1 }),
          sessionStateArb,
          (baseTime, deadAirDuration, sessionState) => {
            const deadAirStartMs = baseTime;
            const now = baseTime + deadAirDuration;

            const state = stateWithoutUiHold('none', deadAirStartMs);

            const input: ProlongedSilenceInput = {
              now,
              agentSpeaking: false,
              agentAudioDurationMs: 0,
              sessionState,
              uiHoldActive: false,
              uiHoldTimerExpired: false,
            };

            const result = evaluateProlongedSilence(state, input);

            expect(result.action).not.toBe('check_in');
            expect(result.action).not.toBe('closing_prompt');
            expect(result.action).not.toBe('end_session');
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Validates: R3.2**
     *
     * At level `check_in`, action becomes `closing_prompt` when
     * deadAirDuration >= 20000ms.
     */
    it('8b: closing_prompt triggers at >= 20000ms dead air from level check_in', () => {
      fc.assert(
        fc.property(
          timestampArb,
          fc.integer({ min: NORMAL_CLOSING_PROMPT_MS, max: NORMAL_SESSION_END_MS - 1 }),
          sessionStateArb,
          (baseTime, deadAirDuration, sessionState) => {
            const deadAirStartMs = baseTime;
            const now = baseTime + deadAirDuration;

            const state = stateWithoutUiHold('check_in', deadAirStartMs);

            const input: ProlongedSilenceInput = {
              now,
              agentSpeaking: false,
              agentAudioDurationMs: 0,
              sessionState,
              uiHoldActive: false,
              uiHoldTimerExpired: false,
            };

            const result = evaluateProlongedSilence(state, input);

            expect(result.action).toBe('closing_prompt');
            expect(result.state.escalationLevel).toBe('closing_prompt');
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Validates: R3.3**
     *
     * At level `closing_prompt`, action becomes `end_session` when
     * deadAirDuration >= 35000ms.
     */
    it('8c: end_session triggers at >= 35000ms dead air from level closing_prompt', () => {
      fc.assert(
        fc.property(
          timestampArb,
          fc.integer({ min: NORMAL_SESSION_END_MS, max: 60000 }),
          sessionStateArb,
          (baseTime, deadAirDuration, sessionState) => {
            const deadAirStartMs = baseTime;
            const now = baseTime + deadAirDuration;

            const state = stateWithoutUiHold('closing_prompt', deadAirStartMs);

            const input: ProlongedSilenceInput = {
              now,
              agentSpeaking: false,
              agentAudioDurationMs: 0,
              sessionState,
              uiHoldActive: false,
              uiHoldTimerExpired: false,
            };

            const result = evaluateProlongedSilence(state, input);

            expect(result.action).toBe('end_session');
            expect(result.state.escalationLevel).toBe('session_end');
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Validates: R3.1, R3.2, R3.3**
     *
     * Thresholds are always normal (8000/20000/35000) when uiHoldActive=false.
     */
    it('8d: thresholds are always normal (8000/20000/35000) when uiHoldActive=false', () => {
      fc.assert(
        fc.property(
          timestampArb,
          fc.integer({ min: 1, max: 60000 }),
          escalationLevelArb,
          sessionStateArb,
          (baseTime, deadAirDuration, escalationLevel, sessionState) => {
            const deadAirStartMs = baseTime;
            const now = baseTime + deadAirDuration;

            const state: ProlongedSilenceState = {
              deadAirStartMs,
              escalationLevel,
              uiHoldActive: false,
              uiHoldDetectedAt: null,
              uiTimerDurationMs: null,
              lastAgentAudioAt: null,
            };

            const input: ProlongedSilenceInput = {
              now,
              agentSpeaking: false,
              agentAudioDurationMs: 0,
              sessionState,
              uiHoldActive: false,
              uiHoldTimerExpired: false,
            };

            const result = evaluateProlongedSilence(state, input);

            expect(result.thresholds.checkInMs).toBe(NORMAL_CHECK_IN_MS);
            expect(result.thresholds.closingPromptMs).toBe(NORMAL_CLOSING_PROMPT_MS);
            expect(result.thresholds.sessionEndMs).toBe(NORMAL_SESSION_END_MS);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Property 9: Instruction phrases do not affect silence thresholds
  // ---------------------------------------------------------------------------

  describe('Property 9: Instruction phrases do not affect thresholds (R3.4)', () => {
    /**
     * **Validates: R3.4**
     *
     * `lastClassification` is not part of ProlongedSilenceInput. There is
     * no mechanism to inject instruction-phrase classification into the
     * prolonged silence handler. Normal thresholds always apply when
     * uiHoldActive=false.
     *
     * This test validates the contract change: the input type no longer
     * accepts classification data, so instruction phrases cannot influence
     * silence thresholds.
     */
    it('9a: lastClassification is removed from input — no classification influence on thresholds', () => {
      fc.assert(
        fc.property(
          timestampArb,
          fc.integer({ min: 1, max: 60000 }),
          escalationLevelArb,
          sessionStateArb,
          fc.boolean(),
          (baseTime, deadAirDuration, escalationLevel, sessionState, hasAudio) => {
            const now = baseTime + deadAirDuration;

            // Construct input WITHOUT lastClassification — it doesn't exist on the type
            const state: ProlongedSilenceState = {
              deadAirStartMs: baseTime,
              escalationLevel,
              uiHoldActive: false,
              uiHoldDetectedAt: null,
              uiTimerDurationMs: null,
              lastAgentAudioAt: hasAudio ? baseTime - 5000 : null,
            };

            const input: ProlongedSilenceInput = {
              now,
              agentSpeaking: false,
              agentAudioDurationMs: 0,
              sessionState,
              uiHoldActive: false,
              uiHoldTimerExpired: false,
            };

            const result = evaluateProlongedSilence(state, input);

            // No classification field → thresholds are always normal
            expect(result.thresholds.checkInMs).toBe(NORMAL_CHECK_IN_MS);
            expect(result.thresholds.closingPromptMs).toBe(NORMAL_CLOSING_PROMPT_MS);
            expect(result.thresholds.sessionEndMs).toBe(NORMAL_SESSION_END_MS);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Validates: R3.4**
     *
     * The 'instruction' category from ShortResponseCategory is never
     * referenced in any ProlongedSilenceInput. Normal escalation at
     * 8s/20s/35s applies regardless of any external classification.
     */
    it('9b: normal escalation (8s/20s/35s) applies regardless of external state', () => {
      fc.assert(
        fc.property(
          timestampArb,
          subEscalationLevelArb,
          sessionStateArb,
          (baseTime, escalationLevel, sessionState) => {
            const now = baseTime + 15000;

            const state: ProlongedSilenceState = {
              deadAirStartMs: baseTime,
              escalationLevel,
              uiHoldActive: false,
              uiHoldDetectedAt: null,
              uiTimerDurationMs: null,
              lastAgentAudioAt: baseTime - 30000,
            };

            const input: ProlongedSilenceInput = {
              now,
              agentSpeaking: false,
              agentAudioDurationMs: 0,
              sessionState,
              uiHoldActive: false,
              uiHoldTimerExpired: false,
            };

            const result = evaluateProlongedSilence(state, input);

            // At 15s dead air with normal thresholds:
            // - If level 'none', action should be 'check_in' (>= 8s)
            // - If level 'check_in' or 'closing_prompt', action stays 'none'
            //   (closing_prompt at 20s, end_session at 35s)
            expect(result.thresholds.checkInMs).toBe(NORMAL_CHECK_IN_MS);
            expect(result.thresholds.closingPromptMs).toBe(NORMAL_CLOSING_PROMPT_MS);
            expect(result.thresholds.sessionEndMs).toBe(NORMAL_SESSION_END_MS);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Property 10: Agent speech resets all dead air state
  // ---------------------------------------------------------------------------

  describe('Property 10: Agent speech resets dead air state (R3.5, R3.6)', () => {
    /**
     * **Validates: R3.5, R3.6**
     *
     * For any ProlongedSilenceState at any escalation level, when
     * agentSpeaking=true and agentAudioDurationMs > 300ms, the resulting
     * state must have deadAirStartMs=null and escalationLevel=`none`.
     */
    it('10a: agent speech > 300ms resets deadAirStartMs to null and escalationLevel to none', () => {
      fc.assert(
        fc.property(
          timestampArb,
          escalationLevelArb,
          fc.boolean(),
          fc.integer({ min: AGENT_SPEECH_RESET_THRESHOLD_MS + 1, max: 10000 }),
          sessionStateArb,
          fc.option(fc.integer({ min: 60000, max: 180000 }), { nil: null }),
          (
            baseTime,
            escalationLevel,
            uiHoldActive,
            agentAudioDurationMs,
            sessionState,
            uiTimerDurationMs
          ) => {
            const state: ProlongedSilenceState = {
              deadAirStartMs: baseTime - 5000,
              escalationLevel,
              uiHoldActive,
              uiHoldDetectedAt: uiHoldActive ? baseTime - 10000 : null,
              uiTimerDurationMs: uiHoldActive ? (uiTimerDurationMs ?? 60000) : null,
              lastAgentAudioAt: baseTime - 8000,
            };

            const input: ProlongedSilenceInput = {
              now: baseTime,
              agentSpeaking: true,
              agentAudioDurationMs,
              sessionState,
              uiHoldActive,
              uiHoldTimerExpired: false,
            };

            const result = evaluateProlongedSilence(state, input);

            // Agent speech > 300ms must reset dead air state
            expect(result.state.deadAirStartMs).toBeNull();
            expect(result.state.escalationLevel).toBe('none');
            expect(result.action).toBe('reset_timers');
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Validates: R3.5, R3.6**
     *
     * Agent speech at exactly 300ms or below does NOT trigger reset.
     */
    it('10b: agent speech <= 300ms does NOT reset dead air state', () => {
      fc.assert(
        fc.property(
          timestampArb,
          subEscalationLevelArb,
          fc.integer({ min: 1, max: AGENT_SPEECH_RESET_THRESHOLD_MS }),
          sessionStateArb,
          (baseTime, escalationLevel, agentAudioDurationMs, sessionState) => {
            const deadAirStartMs = baseTime - 5000;

            const state: ProlongedSilenceState = {
              deadAirStartMs,
              escalationLevel,
              uiHoldActive: false,
              uiHoldDetectedAt: null,
              uiTimerDurationMs: null,
              lastAgentAudioAt: baseTime - 8000,
            };

            const input: ProlongedSilenceInput = {
              now: baseTime,
              agentSpeaking: true,
              agentAudioDurationMs,
              sessionState,
              uiHoldActive: false,
              uiHoldTimerExpired: false,
            };

            const result = evaluateProlongedSilence(state, input);

            // Should NOT reset — agent speech is at or below threshold
            expect(result.action).not.toBe('reset_timers');
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Validates: R3.5, R3.6**
     *
     * Reset works regardless of current escalation level — even at session_end.
     */
    it('10c: reset works at all escalation levels including session_end', () => {
      fc.assert(
        fc.property(
          timestampArb,
          escalationLevelArb,
          fc.integer({ min: AGENT_SPEECH_RESET_THRESHOLD_MS + 1, max: 5000 }),
          sessionStateArb,
          (baseTime, escalationLevel, agentAudioDurationMs, sessionState) => {
            const state: ProlongedSilenceState = {
              deadAirStartMs: baseTime - 40000, // long dead air
              escalationLevel,
              uiHoldActive: false,
              uiHoldDetectedAt: null,
              uiTimerDurationMs: null,
              lastAgentAudioAt: baseTime - 50000,
            };

            const input: ProlongedSilenceInput = {
              now: baseTime,
              agentSpeaking: true,
              agentAudioDurationMs,
              sessionState,
              uiHoldActive: false,
              uiHoldTimerExpired: false,
            };

            const result = evaluateProlongedSilence(state, input);

            expect(result.state.deadAirStartMs).toBeNull();
            expect(result.state.escalationLevel).toBe('none');
            expect(result.action).toBe('reset_timers');
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Validates: R3.5, R3.6**
     *
     * Reset preserves uiHoldActive but clears uiHoldDetectedAt and
     * updates lastAgentAudioAt.
     */
    it('10d: agent speech reset preserves uiHoldActive but clears uiHoldDetectedAt', () => {
      fc.assert(
        fc.property(
          timestampArb,
          fc.boolean(),
          fc.integer({ min: AGENT_SPEECH_RESET_THRESHOLD_MS + 1, max: 5000 }),
          sessionStateArb,
          (baseTime, uiHoldActive, agentAudioDurationMs, sessionState) => {
            const state: ProlongedSilenceState = {
              deadAirStartMs: baseTime - 5000,
              escalationLevel: 'check_in',
              uiHoldActive,
              uiHoldDetectedAt: uiHoldActive ? baseTime - 10000 : null,
              uiTimerDurationMs: uiHoldActive ? 60000 : null,
              lastAgentAudioAt: baseTime - 8000,
            };

            const input: ProlongedSilenceInput = {
              now: baseTime,
              agentSpeaking: true,
              agentAudioDurationMs,
              sessionState,
              uiHoldActive,
              uiHoldTimerExpired: false,
            };

            const result = evaluateProlongedSilence(state, input);

            // uiHoldActive is preserved (not cleared on reset)
            expect(result.state.uiHoldActive).toBe(uiHoldActive);
            // uiHoldDetectedAt is always cleared on reset
            expect(result.state.uiHoldDetectedAt).toBeNull();
            // lastAgentAudioAt is updated to now
            expect(result.state.lastAgentAudioAt).toBe(baseTime);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // ---------------------------------------------------------------------------
  // UI Hold: Suppressed escalation and timer-based session-end
  // ---------------------------------------------------------------------------

  describe('UI Hold: Suppressed escalation and timer-based session-end (R3.7, R3.8)', () => {
    /**
     * **Validates: R3.7, R3.8**
     *
     * When uiHoldActive=true, check_in and closing_prompt thresholds are
     * Infinity (suppressed), and session_end uses uiTimerDurationMs.
     */
    it('11a: UI hold suppresses check_in and closing_prompt thresholds (Infinity)', () => {
      fc.assert(
        fc.property(
          timestampArb,
          fc.integer({ min: 60000, max: 180000 }),
          subEscalationLevelArb,
          sessionStateArb,
          (baseTime, uiTimerDurationMs, escalationLevel, sessionState) => {
            const state: ProlongedSilenceState = {
              deadAirStartMs: baseTime,
              escalationLevel,
              uiHoldActive: true,
              uiHoldDetectedAt: baseTime,
              uiTimerDurationMs,
              lastAgentAudioAt: null,
            };

            const input: ProlongedSilenceInput = {
              now: baseTime + 10000, // past normal 8s check_in threshold
              agentSpeaking: false,
              agentAudioDurationMs: 0,
              sessionState,
              uiHoldActive: true,
              uiHoldTimerExpired: false,
            };

            const result = evaluateProlongedSilence(state, input);

            // check_in and closing_prompt suppressed
            expect(result.thresholds.checkInMs).toBe(Infinity);
            expect(result.thresholds.closingPromptMs).toBe(Infinity);
            // session_end uses uiTimerDurationMs
            expect(result.thresholds.sessionEndMs).toBe(uiTimerDurationMs);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Validates: R3.7, R3.8**
     *
     * During UI hold, escalation only reaches session_end at
     * uiTimerDurationMs. check_in and closing_prompt are never
     * triggered regardless of dead air duration.
     */
    it('11b: UI hold only escalates to session_end at uiTimerDurationMs', () => {
      fc.assert(
        fc.property(
          timestampArb,
          fc.integer({ min: 60000, max: 180000 }),
          sessionStateArb,
          fc.boolean(),
          (baseTime, uiTimerDurationMs, sessionState, beyondTimer) => {
            const deadAirOffset = beyondTimer
              ? uiTimerDurationMs + 5000  // beyond timer → end_session
              : uiTimerDurationMs - 5000; // before timer → no escalation

            const state: ProlongedSilenceState = {
              deadAirStartMs: baseTime,
              escalationLevel: 'none',
              uiHoldActive: true,
              uiHoldDetectedAt: baseTime,
              uiTimerDurationMs,
              lastAgentAudioAt: null,
            };

            const input: ProlongedSilenceInput = {
              now: baseTime + deadAirOffset,
              agentSpeaking: false,
              agentAudioDurationMs: 0,
              sessionState,
              uiHoldActive: true,
              uiHoldTimerExpired: false,
            };

            const result = evaluateProlongedSilence(state, input);

            if (beyondTimer) {
              expect(result.action).toBe('end_session');
              expect(result.state.escalationLevel).toBe('session_end');
            } else {
              expect(result.action).not.toBe('end_session');
              expect(result.action).not.toBe('check_in');
              expect(result.action).not.toBe('closing_prompt');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Validates: R3.9**
     *
     * When uiHoldTimerExpired=true, the hold is deactivated and normal
     * thresholds are restored.
     */
    it('11c: UI hold timer expiry triggers deactivate_hold and restores normal thresholds', () => {
      fc.assert(
        fc.property(
          timestampArb,
          fc.integer({ min: 60000, max: 180000 }),
          sessionStateArb,
          (baseTime, uiTimerDurationMs, sessionState) => {
            const state: ProlongedSilenceState = {
              deadAirStartMs: baseTime,
              escalationLevel: 'none',
              uiHoldActive: true,
              uiHoldDetectedAt: baseTime,
              uiTimerDurationMs,
              lastAgentAudioAt: null,
            };

            const input: ProlongedSilenceInput = {
              now: baseTime + uiTimerDurationMs + 1000,
              agentSpeaking: false,
              agentAudioDurationMs: 0,
              sessionState,
              uiHoldActive: true,
              uiHoldTimerExpired: true,
            };

            const result = evaluateProlongedSilence(state, input);

            expect(result.action).toBe('deactivate_hold');
            expect(result.state.uiHoldActive).toBe(false);
            expect(result.state.uiHoldDetectedAt).toBeNull();
            expect(result.state.uiTimerDurationMs).toBeNull();
            // Back to normal thresholds
            expect(result.thresholds.checkInMs).toBe(NORMAL_CHECK_IN_MS);
            expect(result.thresholds.closingPromptMs).toBe(NORMAL_CLOSING_PROMPT_MS);
            expect(result.thresholds.sessionEndMs).toBe(NORMAL_SESSION_END_MS);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Validates: R3.9**
     *
     * When uiHoldActive transitions to false while in UI hold, the hold
     * is released and normal thresholds are restored.
     */
    it('11d: uiHoldActive=false while in UI hold releases and restores normal thresholds', () => {
      fc.assert(
        fc.property(
          timestampArb,
          fc.integer({ min: 60000, max: 180000 }),
          sessionStateArb,
          (baseTime, uiTimerDurationMs, sessionState) => {
            const state: ProlongedSilenceState = {
              deadAirStartMs: baseTime,
              escalationLevel: 'none',
              uiHoldActive: true,
              uiHoldDetectedAt: baseTime,
              uiTimerDurationMs,
              lastAgentAudioAt: null,
            };

            const input: ProlongedSilenceInput = {
              now: baseTime + 10000,
              agentSpeaking: false,
              agentAudioDurationMs: 0,
              sessionState,
              uiHoldActive: false,
              uiHoldTimerExpired: false,
            };

            const result = evaluateProlongedSilence(state, input);

            expect(result.action).toBe('deactivate_hold');
            expect(result.state.uiHoldActive).toBe(false);
            expect(result.state.uiHoldDetectedAt).toBeNull();
            expect(result.state.uiTimerDurationMs).toBeNull();
            expect(result.thresholds.checkInMs).toBe(NORMAL_CHECK_IN_MS);
            expect(result.thresholds.closingPromptMs).toBe(NORMAL_CLOSING_PROMPT_MS);
            expect(result.thresholds.sessionEndMs).toBe(NORMAL_SESSION_END_MS);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Validates: R3.7**
     *
     * When uiHoldActive transitions to true and state is not in UI hold,
     * UI hold is activated with extended thresholds.
     */
    it('11e: uiHoldActive=true activates UI hold with extended thresholds', () => {
      fc.assert(
        fc.property(
          timestampArb,
          fc.integer({ min: 60000, max: 180000 }),
          sessionStateArb,
          (baseTime, uiTimerDurationMs, sessionState) => {
            const state: ProlongedSilenceState = {
              deadAirStartMs: null,
              escalationLevel: 'none',
              uiHoldActive: false,
              uiHoldDetectedAt: null,
              uiTimerDurationMs: null,
              lastAgentAudioAt: null,
            };

            const input: ProlongedSilenceInput = {
              now: baseTime,
              agentSpeaking: false,
              agentAudioDurationMs: 0,
              sessionState,
              uiHoldActive: true,
              uiHoldTimerExpired: false,
              uiTimerDurationMs,
            };

            const result = evaluateProlongedSilence(state, input);

            expect(result.action).toBe('activate_hold_ui');
            expect(result.state.uiHoldActive).toBe(true);
            expect(result.state.uiHoldDetectedAt).toBe(baseTime);
            expect(result.state.uiTimerDurationMs).toBe(uiTimerDurationMs);
            expect(result.state.deadAirStartMs).toBe(baseTime);
            expect(result.thresholds.checkInMs).toBe(Infinity);
            expect(result.thresholds.closingPromptMs).toBe(Infinity);
            expect(result.thresholds.sessionEndMs).toBe(uiTimerDurationMs);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
