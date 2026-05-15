/**
 * Property-Based Tests for Fallback Response Manager
 *
 * Uses fast-check to verify universal correctness properties
 * of the evaluateFallback and getFallbackUtterance functions.
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  evaluateFallback,
  getFallbackUtterance,
  getUtterancePool,
  createInitialFallbackState,
  type FallbackState,
  type FallbackInput,
} from '@/app/(main)/telefun/services/realisticMode/fallbackResponseManager';
import type {
  ConsumerPersonaType,
  ConversationPhase,
} from '@/app/(main)/telefun/services/realisticMode/types';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const personaTypeArb = fc.constantFrom<ConsumerPersonaType>(
  'angry',
  'confused',
  'rushed',
  'passive',
  'critical',
  'cooperative'
);

const conversationPhaseArb = fc.constantFrom<ConversationPhase>(
  'greeting',
  'problem_statement',
  'explanation',
  'negotiation',
  'closing'
);

const emotionalIntensityArb = fc.integer({ min: 1, max: 10 });

// ---------------------------------------------------------------------------
// Property 1: Fallback triggers only after timeout and cooldown
// ---------------------------------------------------------------------------

describe('Property 1: Fallback triggers only after timeout and cooldown', () => {
  /**
   * **Validates: Requirements 1.1, 1.6**
   *
   * For any FallbackInput where the session is in `ai_thinking` state,
   * the Fallback_Response_Manager SHALL return action `inject_fallback`
   * if and only if:
   * - (now - agentStoppedSpeakingAt) >= cooldownMs (1000ms)
   * - (now - waitingSince) >= timeoutMs (5000ms)
   * - the agent is not currently speaking
   */

  it('inject_fallback only when both cooldown AND timeout are satisfied', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100000 }), // agentStoppedSpeakingAt
        fc.integer({ min: 0, max: 100000 }), // waitingSince offset from agentStopped
        fc.integer({ min: 0, max: 100000 }), // now offset from waitingSince
        personaTypeArb,
        conversationPhaseArb,
        (agentStoppedAt, waitingOffset, nowOffset, persona, phase) => {
          const cooldownMs = 1000;
          const timeoutMs = 5000;

          // Construct a state where we're already waiting
          const waitingSince = agentStoppedAt + waitingOffset;
          const now = waitingSince + nowOffset;

          const state: FallbackState = {
            waitingSince,
            consecutiveFailures: 0,
            lastFallbackAt: null,
            sessionPaused: false,
          };

          const input: FallbackInput = {
            now,
            sessionState: 'ai_thinking',
            agentStoppedSpeakingAt: agentStoppedAt,
            personaType: persona,
            conversationPhase: phase,
            timeoutMs,
            cooldownMs,
          };

          const result = evaluateFallback(state, input);

          const cooldownSatisfied = now - agentStoppedAt >= cooldownMs;
          const timeoutSatisfied = now - waitingSince >= timeoutMs;

          if (result.action === 'inject_fallback') {
            // If fallback was injected, both conditions MUST be satisfied
            expect(cooldownSatisfied).toBe(true);
            expect(timeoutSatisfied).toBe(true);
          }

          if (cooldownSatisfied && timeoutSatisfied) {
            // When both conditions are met, action should be inject_fallback
            // (since consecutiveFailures is 0, not >= 2)
            expect(result.action).toBe('inject_fallback');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('never injects fallback when agent is speaking (user_speaking state)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100000 }),
        fc.integer({ min: 0, max: 100000 }),
        personaTypeArb,
        conversationPhaseArb,
        (now, agentStoppedAt, persona, phase) => {
          const state: FallbackState = {
            waitingSince: 0,
            consecutiveFailures: 0,
            lastFallbackAt: null,
            sessionPaused: false,
          };

          const input: FallbackInput = {
            now,
            sessionState: 'user_speaking',
            agentStoppedSpeakingAt: agentStoppedAt,
            personaType: persona,
            conversationPhase: phase,
          };

          const result = evaluateFallback(state, input);
          expect(result.action).not.toBe('inject_fallback');
          expect(result.action).not.toBe('session_recovery');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('never injects fallback when cooldown has not elapsed', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 100000 }), // agentStoppedAt
        fc.integer({ min: 0, max: 999 }), // timeSinceAgentStopped (< cooldown)
        personaTypeArb,
        conversationPhaseArb,
        (agentStoppedAt, timeSinceStop, persona, phase) => {
          const now = agentStoppedAt + timeSinceStop;

          const state: FallbackState = {
            waitingSince: agentStoppedAt,
            consecutiveFailures: 0,
            lastFallbackAt: null,
            sessionPaused: false,
          };

          const input: FallbackInput = {
            now,
            sessionState: 'ai_thinking',
            agentStoppedSpeakingAt: agentStoppedAt,
            personaType: persona,
            conversationPhase: phase,
            cooldownMs: 1000,
            timeoutMs: 5000,
          };

          const result = evaluateFallback(state, input);
          expect(result.action).not.toBe('inject_fallback');
          expect(result.action).not.toBe('session_recovery');
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2: Fallback counter lifecycle is consistent
// ---------------------------------------------------------------------------

describe('Property 2: Fallback counter lifecycle is consistent', () => {
  /**
   * **Validates: Requirements 1.3, 1.4, 1.5**
   *
   * For any sequence of FallbackState transitions:
   * (a) when a fallback is injected, consecutiveFailures increments by exactly 1
   * (b) when consecutiveFailures reaches 2, the action must be `session_recovery`
   * (c) when the model produces a valid response, consecutiveFailures resets to 0
   */

  it('(a) inject_fallback increments consecutiveFailures by exactly 1', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1 }), // consecutiveFailures (0 or 1, since 2 triggers recovery)
        fc.integer({ min: 1000, max: 50000 }), // agentStoppedAt
        personaTypeArb,
        conversationPhaseArb,
        (failures, agentStoppedAt, persona, phase) => {
          const waitingSince = agentStoppedAt + 1500; // past cooldown
          const now = waitingSince + 6000; // past timeout

          const state: FallbackState = {
            waitingSince,
            consecutiveFailures: failures,
            lastFallbackAt: null,
            sessionPaused: false,
          };

          const input: FallbackInput = {
            now,
            sessionState: 'ai_thinking',
            agentStoppedSpeakingAt: agentStoppedAt,
            personaType: persona,
            conversationPhase: phase,
            timeoutMs: 5000,
            cooldownMs: 1000,
          };

          const result = evaluateFallback(state, input);

          if (result.action === 'inject_fallback') {
            expect(result.state.consecutiveFailures).toBe(failures + 1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('(b) session_recovery when consecutiveFailures reaches 2', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 50000 }), // agentStoppedAt
        personaTypeArb,
        conversationPhaseArb,
        (agentStoppedAt, persona, phase) => {
          const waitingSince = agentStoppedAt + 1500;
          const now = waitingSince + 6000;

          const state: FallbackState = {
            waitingSince,
            consecutiveFailures: 2, // already at max
            lastFallbackAt: now - 6000,
            sessionPaused: false,
          };

          const input: FallbackInput = {
            now,
            sessionState: 'ai_thinking',
            agentStoppedSpeakingAt: agentStoppedAt,
            personaType: persona,
            conversationPhase: phase,
            timeoutMs: 5000,
            cooldownMs: 1000,
          };

          const result = evaluateFallback(state, input);
          expect(result.action).toBe('session_recovery');
          expect(result.state.sessionPaused).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('(c) reset_counter when model produces valid response after failures', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }), // consecutiveFailures > 0
        fc.integer({ min: 0, max: 100000 }), // now
        personaTypeArb,
        conversationPhaseArb,
        (failures, now, persona, phase) => {
          const state: FallbackState = {
            waitingSince: now - 3000,
            consecutiveFailures: failures,
            lastFallbackAt: now - 2000,
            sessionPaused: false,
          };

          const input: FallbackInput = {
            now,
            sessionState: 'ai_speaking', // model is now speaking (valid response)
            agentStoppedSpeakingAt: now - 8000,
            personaType: persona,
            conversationPhase: phase,
          };

          const result = evaluateFallback(state, input);
          expect(result.action).toBe('reset_counter');
          expect(result.state.consecutiveFailures).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 3: Fallback utterance matches persona and phase
// ---------------------------------------------------------------------------

describe('Property 3: Fallback utterance matches persona and phase', () => {
  /**
   * **Validates: Requirements 1.2**
   *
   * For any ConsumerPersonaType and ConversationPhase, the utterance
   * returned by `getFallbackUtterance` must be a member of the predefined
   * utterance pool for that specific persona-phase combination.
   */

  it('utterance is always a member of the persona-phase pool', () => {
    fc.assert(
      fc.property(
        personaTypeArb,
        conversationPhaseArb,
        emotionalIntensityArb,
        (persona, phase, intensity) => {
          const utterance = getFallbackUtterance(persona, phase, intensity);
          const pool = getUtterancePool(persona, phase, intensity);

          expect(pool).toContain(utterance);
          expect(typeof utterance).toBe('string');
          expect(utterance.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('utterance pool is non-empty for all persona-phase combinations', () => {
    fc.assert(
      fc.property(
        personaTypeArb,
        conversationPhaseArb,
        emotionalIntensityArb,
        (persona, phase, intensity) => {
          const pool = getUtterancePool(persona, phase, intensity);
          expect(pool.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('high-intensity utterances come from high-intensity pool when available', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<ConsumerPersonaType>('angry', 'critical'), // personas with high-intensity overrides
        conversationPhaseArb,
        fc.integer({ min: 7, max: 10 }), // high intensity
        (persona, phase, intensity) => {
          const utterance = getFallbackUtterance(persona, phase, intensity);
          const highPool = getUtterancePool(persona, phase, intensity);

          // The utterance must come from the high-intensity pool
          expect(highPool).toContain(utterance);
        }
      ),
      { numRuns: 100 }
    );
  });
});
