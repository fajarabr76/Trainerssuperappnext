/**
 * Unit tests for Fallback Response Manager
 *
 * Validates core logic of evaluateFallback and getFallbackUtterance
 * following requirements 1.1-1.6.
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateFallback,
  getFallbackUtterance,
  getUtterancePool,
  createInitialFallbackState,
  type FallbackState,
  type FallbackInput,
} from '@/app/(main)/telefun/services/realisticMode/fallbackResponseManager';
import type { ConsumerPersonaType, ConversationPhase } from '@/app/(main)/telefun/services/realisticMode/types';

describe('fallbackResponseManager', () => {
  describe('evaluateFallback', () => {
    const baseInput: FallbackInput = {
      now: 10000,
      sessionState: 'ai_thinking',
      agentStoppedSpeakingAt: 3000,
      personaType: 'cooperative',
      conversationPhase: 'greeting',
      timeoutMs: 5000,
      cooldownMs: 1000,
    };

    it('returns none when session is paused', () => {
      const state: FallbackState = {
        waitingSince: null,
        consecutiveFailures: 0,
        lastFallbackAt: null,
        sessionPaused: true,
      };
      const result = evaluateFallback(state, baseInput);
      expect(result.action).toBe('none');
    });

    it('returns reset_counter when model starts speaking after failures', () => {
      const state: FallbackState = {
        waitingSince: 5000,
        consecutiveFailures: 1,
        lastFallbackAt: 5000,
        sessionPaused: false,
      };
      const input: FallbackInput = {
        ...baseInput,
        sessionState: 'ai_speaking',
      };
      const result = evaluateFallback(state, input);
      expect(result.action).toBe('reset_counter');
      expect(result.state.consecutiveFailures).toBe(0);
    });

    it('returns none when agent is still speaking', () => {
      const state = createInitialFallbackState();
      const input: FallbackInput = {
        ...baseInput,
        sessionState: 'user_speaking',
      };
      const result = evaluateFallback(state, input);
      expect(result.action).toBe('none');
    });

    it('returns none when within cooldown period', () => {
      const state = createInitialFallbackState();
      const input: FallbackInput = {
        ...baseInput,
        now: 3500, // only 500ms after agent stopped
        agentStoppedSpeakingAt: 3000,
      };
      const result = evaluateFallback(state, input);
      expect(result.action).toBe('none');
    });

    it('starts waiting when cooldown passed but not yet waiting', () => {
      const state = createInitialFallbackState();
      const input: FallbackInput = {
        ...baseInput,
        now: 5000,
        agentStoppedSpeakingAt: 3000, // 2s ago, past cooldown
      };
      const result = evaluateFallback(state, input);
      expect(result.action).toBe('none');
      expect(result.state.waitingSince).toBe(5000);
    });

    it('returns none when waiting but timeout not reached', () => {
      const state: FallbackState = {
        waitingSince: 5000,
        consecutiveFailures: 0,
        lastFallbackAt: null,
        sessionPaused: false,
      };
      const input: FallbackInput = {
        ...baseInput,
        now: 8000, // only 3s since waiting started
        agentStoppedSpeakingAt: 3000,
      };
      const result = evaluateFallback(state, input);
      expect(result.action).toBe('none');
    });

    it('injects fallback when timeout reached and no prior failures', () => {
      const state: FallbackState = {
        waitingSince: 4000,
        consecutiveFailures: 0,
        lastFallbackAt: null,
        sessionPaused: false,
      };
      const input: FallbackInput = {
        ...baseInput,
        now: 10000, // 6s since waiting started (>= 5s timeout)
        agentStoppedSpeakingAt: 3000,
      };
      const result = evaluateFallback(state, input);
      expect(result.action).toBe('inject_fallback');
      expect(result.utterance).toBeDefined();
      expect(result.state.consecutiveFailures).toBe(1);
      expect(result.state.lastFallbackAt).toBe(10000);
    });

    it('triggers session_recovery after 2 consecutive failures', () => {
      const state: FallbackState = {
        waitingSince: 4000,
        consecutiveFailures: 2,
        lastFallbackAt: 8000,
        sessionPaused: false,
      };
      const input: FallbackInput = {
        ...baseInput,
        now: 10000,
        agentStoppedSpeakingAt: 3000,
      };
      const result = evaluateFallback(state, input);
      expect(result.action).toBe('session_recovery');
      expect(result.state.sessionPaused).toBe(true);
    });

    it('returns none when agentStoppedSpeakingAt is null', () => {
      const state = createInitialFallbackState();
      const input: FallbackInput = {
        ...baseInput,
        agentStoppedSpeakingAt: null,
      };
      const result = evaluateFallback(state, input);
      expect(result.action).toBe('none');
    });

    it('returns none when session state is not ai_thinking or ai_speaking', () => {
      const state = createInitialFallbackState();
      const input: FallbackInput = {
        ...baseInput,
        sessionState: 'idle',
      };
      const result = evaluateFallback(state, input);
      expect(result.action).toBe('none');
    });

    it('does not reset counter when ai_speaking but no prior failures', () => {
      const state: FallbackState = {
        waitingSince: null,
        consecutiveFailures: 0,
        lastFallbackAt: null,
        sessionPaused: false,
      };
      const input: FallbackInput = {
        ...baseInput,
        sessionState: 'ai_speaking',
      };
      const result = evaluateFallback(state, input);
      // With 0 failures, it should not trigger reset_counter
      expect(result.action).not.toBe('reset_counter');
    });
  });

  describe('getFallbackUtterance', () => {
    const personaTypes: ConsumerPersonaType[] = [
      'angry', 'confused', 'rushed', 'passive', 'critical', 'cooperative',
    ];
    const phases: ConversationPhase[] = [
      'greeting', 'problem_statement', 'explanation', 'negotiation', 'closing',
    ];

    it('returns a string for all persona-phase combinations', () => {
      for (const persona of personaTypes) {
        for (const phase of phases) {
          const utterance = getFallbackUtterance(persona, phase, 5);
          expect(typeof utterance).toBe('string');
          expect(utterance.length).toBeGreaterThan(0);
        }
      }
    });

    it('returns utterance from the correct pool', () => {
      for (const persona of personaTypes) {
        for (const phase of phases) {
          for (const intensity of [3, 5, 7, 9]) {
            const utterance = getFallbackUtterance(persona, phase, intensity);
            const pool = getUtterancePool(persona, phase, intensity);
            expect(pool).toContain(utterance);
          }
        }
      }
    });

    it('uses high-intensity pool for angry persona at intensity >= 7', () => {
      const utterance = getFallbackUtterance('angry', 'greeting', 8);
      const highPool = getUtterancePool('angry', 'greeting', 8);
      expect(highPool).toContain(utterance);
    });

    it('uses standard pool for cooperative persona regardless of intensity', () => {
      const utterance = getFallbackUtterance('cooperative', 'greeting', 9);
      const pool = getUtterancePool('cooperative', 'greeting', 9);
      expect(pool).toContain(utterance);
    });
  });

  describe('createInitialFallbackState', () => {
    it('creates a clean initial state', () => {
      const state = createInitialFallbackState();
      expect(state.waitingSince).toBeNull();
      expect(state.consecutiveFailures).toBe(0);
      expect(state.lastFallbackAt).toBeNull();
      expect(state.sessionPaused).toBe(false);
    });
  });
});
