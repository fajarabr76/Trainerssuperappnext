/**
 * Unit tests for Disruption Scenario Engine
 *
 * Validates core logic of initializeDisruptions and evaluateDisruption
 * following requirements 8.1-8.8.
 */

import { describe, it, expect } from 'vitest';
import {
  initializeDisruptions,
  evaluateDisruption,
  type DisruptionState,
  type DisruptionInput,
} from '@/app/(main)/telefun/services/realisticMode/disruptionScenarioEngine';
import type { DisruptionType } from '@/app/(main)/telefun/services/realisticMode/types';

describe('disruptionScenarioEngine', () => {
  describe('initializeDisruptions', () => {
    it('accepts 1 disruption type', () => {
      const state = initializeDisruptions(['technical_term_confusion']);
      expect(state.activeDisruptions).toEqual(['technical_term_confusion']);
      expect(state.disruptionHistory).toHaveLength(1);
      expect(state.exchangeCount).toBe(0);
      expect(state.nextDisruptionAfterExchange).toBe(2);
    });

    it('accepts 2 disruption types', () => {
      const state = initializeDisruptions(['technical_term_confusion', 'repeated_question']);
      expect(state.activeDisruptions).toHaveLength(2);
      expect(state.disruptionHistory).toHaveLength(2);
    });

    it('accepts 3 disruption types', () => {
      const types: DisruptionType[] = [
        'technical_term_confusion',
        'repeated_question',
        'misunderstanding',
      ];
      const state = initializeDisruptions(types);
      expect(state.activeDisruptions).toHaveLength(3);
      expect(state.disruptionHistory).toHaveLength(3);
    });

    it('throws error for 0 disruption types', () => {
      expect(() => initializeDisruptions([])).toThrow();
    });

    it('throws error for more than 3 disruption types', () => {
      const types: DisruptionType[] = [
        'technical_term_confusion',
        'repeated_question',
        'misunderstanding',
        'interruption',
      ];
      expect(() => initializeDisruptions(types)).toThrow();
    });

    it('initializes disruption history with 0 attempts and unresolved', () => {
      const state = initializeDisruptions(['technical_term_confusion']);
      expect(state.disruptionHistory[0].attempts).toBe(0);
      expect(state.disruptionHistory[0].resolved).toBe(false);
      expect(state.disruptionHistory[0].triggeredAtExchange).toBe(-1);
    });
  });

  describe('evaluateDisruption - spacing rules', () => {
    const baseInput: DisruptionInput = {
      exchangeCount: 0,
      personaType: 'cooperative',
    };

    it('returns none when exchangeCount < 2', () => {
      const state = initializeDisruptions(['technical_term_confusion']);
      const result = evaluateDisruption(state, { ...baseInput, exchangeCount: 0 });
      expect(result.action).toBe('none');

      const result1 = evaluateDisruption(state, { ...baseInput, exchangeCount: 1 });
      expect(result1.action).toBe('none');
    });

    it('triggers disruption at exchange 2', () => {
      const state = initializeDisruptions(['technical_term_confusion']);
      const result = evaluateDisruption(state, { ...baseInput, exchangeCount: 2 });
      expect(result.action).not.toBe('none');
      if (result.action !== 'none') {
        expect(result.action.type).toBe('trigger_disruption');
      }
    });

    it('enforces minimum 3 exchanges between disruptions', () => {
      const state = initializeDisruptions(['technical_term_confusion', 'repeated_question']);

      // Trigger first disruption at exchange 2
      const result1 = evaluateDisruption(state, { ...baseInput, exchangeCount: 2 });
      expect(result1.action).not.toBe('none');

      // Try at exchange 3 - should be blocked (need 3 gap → next at 5)
      const result2 = evaluateDisruption(result1.state, { ...baseInput, exchangeCount: 3 });
      expect(result2.action).toBe('none');

      // Try at exchange 4 - still blocked
      const result3 = evaluateDisruption(result1.state, { ...baseInput, exchangeCount: 4 });
      expect(result3.action).toBe('none');

      // At exchange 5 - should be allowed
      const result4 = evaluateDisruption(result1.state, { ...baseInput, exchangeCount: 5 });
      expect(result4.action).not.toBe('none');
    });
  });

  describe('evaluateDisruption - attempt limits', () => {
    const baseInput: DisruptionInput = {
      exchangeCount: 2,
      personaType: 'cooperative',
    };

    it('technical_term_confusion has max 2 attempts', () => {
      let state = initializeDisruptions(['technical_term_confusion']);

      // First attempt at exchange 2
      const r1 = evaluateDisruption(state, { ...baseInput, exchangeCount: 2 });
      expect(r1.action).not.toBe('none');
      state = r1.state;

      // Second attempt at exchange 5
      const r2 = evaluateDisruption(state, { ...baseInput, exchangeCount: 5 });
      expect(r2.action).not.toBe('none');
      state = r2.state;

      // Third attempt at exchange 8 - should be blocked (max 2)
      const r3 = evaluateDisruption(state, { ...baseInput, exchangeCount: 8 });
      expect(r3.action).toBe('none');
    });

    it('repeated_question has max 3 attempts', () => {
      let state = initializeDisruptions(['repeated_question']);

      // First attempt
      const r1 = evaluateDisruption(state, { ...baseInput, exchangeCount: 2 });
      expect(r1.action).not.toBe('none');
      state = r1.state;

      // Second attempt
      const r2 = evaluateDisruption(state, { ...baseInput, exchangeCount: 5 });
      expect(r2.action).not.toBe('none');
      state = r2.state;

      // Third attempt
      const r3 = evaluateDisruption(state, { ...baseInput, exchangeCount: 8 });
      expect(r3.action).not.toBe('none');
      state = r3.state;

      // Fourth attempt - should be blocked (max 3)
      const r4 = evaluateDisruption(state, { ...baseInput, exchangeCount: 11 });
      expect(r4.action).toBe('none');
    });
  });

  describe('evaluateDisruption - resolution', () => {
    const baseInput: DisruptionInput = {
      exchangeCount: 2,
      personaType: 'cooperative',
    };

    it('marks disruption as resolved when agent addresses it', () => {
      let state = initializeDisruptions(['technical_term_confusion']);

      // Trigger the disruption
      const r1 = evaluateDisruption(state, { ...baseInput, exchangeCount: 2 });
      state = r1.state;

      // Agent responds with explanation
      const r2 = evaluateDisruption(state, {
        ...baseInput,
        exchangeCount: 3,
        agentResponse: 'Jadi artinya adalah proses verifikasi data Anda.',
      });

      expect(r2.action).not.toBe('none');
      if (r2.action !== 'none') {
        expect(r2.action.type).toBe('mark_resolved');
      }
      expect(r2.state.disruptionHistory[0].resolved).toBe(true);
    });

    it('resolved disruptions never re-trigger', () => {
      let state = initializeDisruptions(['technical_term_confusion']);

      // Trigger the disruption
      const r1 = evaluateDisruption(state, { ...baseInput, exchangeCount: 2 });
      state = r1.state;

      // Resolve it
      const r2 = evaluateDisruption(state, {
        ...baseInput,
        exchangeCount: 3,
        agentResponse: 'Artinya adalah proses verifikasi.',
      });
      state = r2.state;

      // Try to trigger again at later exchanges - should always be 'none'
      for (let exchange = 5; exchange <= 20; exchange += 3) {
        const result = evaluateDisruption(state, {
          ...baseInput,
          exchangeCount: exchange,
        });
        expect(result.action).toBe('none');
      }
    });

    it('does not resolve disruption that has not been triggered', () => {
      const state = initializeDisruptions(['technical_term_confusion']);

      // Agent response with keywords but disruption not yet triggered
      const result = evaluateDisruption(state, {
        ...baseInput,
        exchangeCount: 0,
        agentResponse: 'Artinya adalah proses verifikasi.',
      });

      expect(result.action).toBe('none');
      expect(result.state.disruptionHistory[0].resolved).toBe(false);
    });
  });

  describe('evaluateDisruption - prompt generation', () => {
    it('generates a non-empty prompt string in Indonesian', () => {
      const state = initializeDisruptions(['technical_term_confusion']);
      const result = evaluateDisruption(state, {
        exchangeCount: 2,
        personaType: 'angry',
      });

      if (result.action !== 'none') {
        expect(result.action.type).toBe('trigger_disruption');
        if (result.action.type === 'trigger_disruption') {
          expect(result.action.prompt.length).toBeGreaterThan(0);
        }
      }
    });

    it('generates different prompts for different persona types', () => {
      const prompts: string[] = [];
      const personas: Array<'angry' | 'cooperative' | 'confused'> = ['angry', 'cooperative', 'confused'];

      for (const persona of personas) {
        const state = initializeDisruptions(['technical_term_confusion']);
        const result = evaluateDisruption(state, {
          exchangeCount: 2,
          personaType: persona,
        });
        if (result.action !== 'none' && result.action.type === 'trigger_disruption') {
          prompts.push(result.action.prompt);
        }
      }

      // At least some prompts should differ across personas
      const uniquePrompts = new Set(prompts);
      expect(uniquePrompts.size).toBeGreaterThan(1);
    });
  });
});
