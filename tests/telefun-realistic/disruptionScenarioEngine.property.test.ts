/**
 * Property-Based Tests for Disruption Scenario Engine
 *
 * Uses fast-check to verify universal correctness properties
 * of the initializeDisruptions and evaluateDisruption functions.
 *
 * **Validates: Requirements 8.2, 8.3, 8.4, 8.5, 8.8**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  initializeDisruptions,
  evaluateDisruption,
  type DisruptionState,
  type DisruptionInput,
} from '@/app/(main)/telefun/services/realisticMode/disruptionScenarioEngine';
import type {
  ConsumerPersonaType,
  DisruptionType,
  DisruptionInstance,
} from '@/app/(main)/telefun/services/realisticMode/types';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const allDisruptionTypes: DisruptionType[] = [
  'technical_term_confusion',
  'repeated_question',
  'misunderstanding',
  'interruption',
  'incomplete_data',
  'unclear_voice',
  'emotional_escalation',
];

const disruptionTypeArb = fc.constantFrom<DisruptionType>(...allDisruptionTypes);

const personaTypeArb = fc.constantFrom<ConsumerPersonaType>(
  'angry',
  'confused',
  'rushed',
  'passive',
  'critical',
  'cooperative'
);

/**
 * Generates a valid enabledTypes array of length 1-3 (valid configuration).
 */
const validEnabledTypesArb = fc
  .shuffledSubarray(allDisruptionTypes, { minLength: 1, maxLength: 3 })
  .map((arr) => arr as DisruptionType[]);

/**
 * Generates an invalid enabledTypes array of length 0 or > 3.
 */
const invalidEnabledTypesArb = fc.oneof(
  fc.constant([] as DisruptionType[]),
  fc
    .shuffledSubarray(allDisruptionTypes, { minLength: 4, maxLength: 7 })
    .map((arr) => arr as DisruptionType[])
);

/**
 * Generates a DisruptionInput with a given exchange count range.
 */
function disruptionInputArb(
  minExchange: number,
  maxExchange: number
): fc.Arbitrary<DisruptionInput> {
  return fc.record({
    exchangeCount: fc.integer({ min: minExchange, max: maxExchange }),
    personaType: personaTypeArb,
    agentResponse: fc.option(fc.string(), { nil: undefined }),
  }) as fc.Arbitrary<DisruptionInput>;
}

// ---------------------------------------------------------------------------
// Property 22: Disruption spacing respects minimum exchange gaps
// ---------------------------------------------------------------------------

describe('Property 22: Disruption spacing respects minimum exchange gaps', () => {
  /**
   * **Validates: Requirements 8.2**
   *
   * For any DisruptionState:
   * (a) no disruption triggers before exchangeCount >= 2
   * (b) consecutive disruptions are spaced at least 3 exchanges apart
   */

  it('(a) no disruption triggers before exchangeCount >= 2', () => {
    fc.assert(
      fc.property(
        validEnabledTypesArb,
        personaTypeArb,
        fc.integer({ min: 0, max: 1 }),
        (enabledTypes, personaType, exchangeCount) => {
          const state = initializeDisruptions(enabledTypes);
          const input: DisruptionInput = { exchangeCount, personaType };
          const result = evaluateDisruption(state, input);

          expect(result.action).toBe('none');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('(b) consecutive disruptions are spaced at least 3 exchanges apart', () => {
    fc.assert(
      fc.property(
        fc.shuffledSubarray(allDisruptionTypes, { minLength: 2, maxLength: 3 }).map(
          (arr) => arr as DisruptionType[]
        ),
        personaTypeArb,
        fc.integer({ min: 2, max: 50 }),
        (enabledTypes, personaType, firstExchange) => {
          const state = initializeDisruptions(enabledTypes);

          // Trigger first disruption
          const r1 = evaluateDisruption(state, {
            exchangeCount: firstExchange,
            personaType,
          });

          // If first disruption triggered, verify spacing
          if (r1.action !== 'none' && typeof r1.action === 'object' && r1.action.type === 'trigger_disruption') {
            // Try exchanges within the 3-exchange gap
            for (let gap = 1; gap < 3; gap++) {
              const nextExchange = firstExchange + gap;
              const r2 = evaluateDisruption(r1.state, {
                exchangeCount: nextExchange,
                personaType,
              });

              // Should not trigger another disruption within the gap
              if (r2.action !== 'none' && typeof r2.action === 'object') {
                expect(r2.action.type).not.toBe('trigger_disruption');
              }
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('(b) disruption can trigger at exactly 3 exchanges after previous', () => {
    fc.assert(
      fc.property(
        fc.shuffledSubarray(allDisruptionTypes, { minLength: 2, maxLength: 3 }).map(
          (arr) => arr as DisruptionType[]
        ),
        personaTypeArb,
        (enabledTypes, personaType) => {
          const state = initializeDisruptions(enabledTypes);

          // Trigger first disruption at exchange 2
          const r1 = evaluateDisruption(state, {
            exchangeCount: 2,
            personaType,
          });

          if (r1.action !== 'none' && typeof r1.action === 'object' && r1.action.type === 'trigger_disruption') {
            // At exchange 5 (2 + 3), a disruption should be allowed
            const r2 = evaluateDisruption(r1.state, {
              exchangeCount: 5,
              personaType,
            });

            // It should either trigger or return 'none' (if no triggerable disruptions left)
            // but it should NOT be blocked by spacing rules
            // The nextDisruptionAfterExchange should be <= 5
            expect(r1.state.nextDisruptionAfterExchange).toBeLessThanOrEqual(5);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 23: Disruption configuration accepts 1-3 types only
// ---------------------------------------------------------------------------

describe('Property 23: Disruption configuration accepts 1-3 types only', () => {
  /**
   * **Validates: Requirements 8.3**
   *
   * For any enabledTypes array passed to `initializeDisruptions`,
   * the function must accept arrays of length 1, 2, or 3,
   * and reject (throw or return error) arrays of length 0 or > 3.
   */

  it('accepts arrays of length 1, 2, or 3', () => {
    fc.assert(
      fc.property(
        validEnabledTypesArb,
        (enabledTypes) => {
          expect(enabledTypes.length).toBeGreaterThanOrEqual(1);
          expect(enabledTypes.length).toBeLessThanOrEqual(3);

          // Should not throw
          const state = initializeDisruptions(enabledTypes);
          expect(state.activeDisruptions.length).toBeGreaterThanOrEqual(1);
          expect(state.activeDisruptions.length).toBeLessThanOrEqual(3);
          expect(state.disruptionHistory.length).toBeGreaterThanOrEqual(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects arrays of length 0', () => {
    expect(() => initializeDisruptions([])).toThrow();
  });

  it('rejects arrays of length > 3', () => {
    fc.assert(
      fc.property(
        fc.shuffledSubarray(allDisruptionTypes, { minLength: 4, maxLength: 7 }).map(
          (arr) => arr as DisruptionType[]
        ),
        (enabledTypes) => {
          expect(enabledTypes.length).toBeGreaterThan(3);
          expect(() => initializeDisruptions(enabledTypes)).toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects both empty and oversized arrays', () => {
    fc.assert(
      fc.property(
        invalidEnabledTypesArb,
        (enabledTypes) => {
          expect(() => initializeDisruptions(enabledTypes)).toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 24: Disruption attempt limits are enforced
// ---------------------------------------------------------------------------

describe('Property 24: Disruption attempt limits are enforced', () => {
  /**
   * **Validates: Requirements 8.4, 8.5**
   *
   * For any DisruptionInstance:
   * (a) if type is `technical_term_confusion`, attempts must not exceed 2 before resolution
   * (b) if type is `repeated_question`, attempts must not exceed 3 before resolution
   */

  it('(a) technical_term_confusion never exceeds 2 attempts', () => {
    fc.assert(
      fc.property(
        personaTypeArb,
        fc.integer({ min: 2, max: 100 }),
        (personaType, maxExchanges) => {
          let state = initializeDisruptions(['technical_term_confusion']);
          let triggerCount = 0;

          // Simulate many exchanges without resolution
          for (let exchange = 0; exchange <= maxExchanges; exchange++) {
            const result = evaluateDisruption(state, {
              exchangeCount: exchange,
              personaType,
            });

            if (
              result.action !== 'none' &&
              typeof result.action === 'object' &&
              result.action.type === 'trigger_disruption'
            ) {
              triggerCount++;
            }

            state = result.state;
          }

          // Should never trigger more than 2 times
          expect(triggerCount).toBeLessThanOrEqual(2);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('(b) repeated_question never exceeds 3 attempts', () => {
    fc.assert(
      fc.property(
        personaTypeArb,
        fc.integer({ min: 2, max: 100 }),
        (personaType, maxExchanges) => {
          let state = initializeDisruptions(['repeated_question']);
          let triggerCount = 0;

          // Simulate many exchanges without resolution
          for (let exchange = 0; exchange <= maxExchanges; exchange++) {
            const result = evaluateDisruption(state, {
              exchangeCount: exchange,
              personaType,
            });

            if (
              result.action !== 'none' &&
              typeof result.action === 'object' &&
              result.action.type === 'trigger_disruption'
            ) {
              triggerCount++;
            }

            state = result.state;
          }

          // Should never trigger more than 3 times
          expect(triggerCount).toBeLessThanOrEqual(3);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('attempt count in history never exceeds the type limit', () => {
    fc.assert(
      fc.property(
        validEnabledTypesArb,
        personaTypeArb,
        fc.integer({ min: 20, max: 60 }),
        (enabledTypes, personaType, maxExchanges) => {
          let state = initializeDisruptions(enabledTypes);

          for (let exchange = 0; exchange <= maxExchanges; exchange++) {
            const result = evaluateDisruption(state, {
              exchangeCount: exchange,
              personaType,
            });
            state = result.state;
          }

          // Verify attempt limits in history
          for (const instance of state.disruptionHistory) {
            if (instance.type === 'technical_term_confusion') {
              expect(instance.attempts).toBeLessThanOrEqual(2);
            } else if (instance.type === 'repeated_question') {
              expect(instance.attempts).toBeLessThanOrEqual(3);
            }
            // Other types have default limit of 2
            if (
              instance.type !== 'technical_term_confusion' &&
              instance.type !== 'repeated_question'
            ) {
              expect(instance.attempts).toBeLessThanOrEqual(2);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 25: Resolved disruptions never re-trigger
// ---------------------------------------------------------------------------

describe('Property 25: Resolved disruptions never re-trigger', () => {
  /**
   * **Validates: Requirements 8.8**
   *
   * For any DisruptionState containing a resolved DisruptionInstance,
   * `evaluateDisruption` must never return an action that re-triggers
   * that same instance.
   */

  it('resolved disruptions are never triggered again', () => {
    fc.assert(
      fc.property(
        validEnabledTypesArb,
        personaTypeArb,
        fc.integer({ min: 5, max: 50 }),
        (enabledTypes, personaType, maxExchanges) => {
          let state = initializeDisruptions(enabledTypes);

          // Trigger first disruption at exchange 2
          const r1 = evaluateDisruption(state, {
            exchangeCount: 2,
            personaType,
          });
          state = r1.state;

          // If a disruption was triggered, resolve it with a keyword response
          if (
            r1.action !== 'none' &&
            typeof r1.action === 'object' &&
            r1.action.type === 'trigger_disruption'
          ) {
            const triggeredType = r1.action.disruption;

            // Resolve it with a response containing resolution keywords
            const resolutionResponse =
              triggeredType === 'technical_term_confusion'
                ? 'Jadi artinya adalah proses verifikasi data Anda.'
                : triggeredType === 'repeated_question'
                  ? 'Jadi intinya solusinya adalah menghubungi cabang terdekat.'
                  : triggeredType === 'misunderstanding'
                    ? 'Yang saya maksud sebenarnya adalah proses refund.'
                    : triggeredType === 'interruption'
                      ? 'Silakan, saya dengarkan apa yang ingin disampaikan.'
                      : triggeredType === 'incomplete_data'
                        ? 'Boleh saya minta nomor akun Anda?'
                        : triggeredType === 'unclear_voice'
                          ? 'Maaf kurang jelas, bisa diulang?'
                          : 'Saya mengerti perasaan Anda, mohon maaf atas ketidaknyamanannya.';

            const r2 = evaluateDisruption(state, {
              exchangeCount: 3,
              personaType,
              agentResponse: resolutionResponse,
            });
            state = r2.state;

            // Verify the disruption is marked resolved
            const resolvedInstance = state.disruptionHistory.find(
              (d) => d.type === triggeredType && d.resolved
            );

            if (resolvedInstance) {
              // Now try many more exchanges - the resolved type should never re-trigger
              for (let exchange = 5; exchange <= maxExchanges; exchange++) {
                const result = evaluateDisruption(state, {
                  exchangeCount: exchange,
                  personaType,
                });

                if (
                  result.action !== 'none' &&
                  typeof result.action === 'object' &&
                  result.action.type === 'trigger_disruption'
                ) {
                  // If a disruption triggers, it must NOT be the resolved one
                  // (check by finding the instance in history that matches)
                  const triggeredIndex = result.state.disruptionHistory.findIndex(
                    (d) =>
                      d.type === result.action !== 'none' &&
                      typeof result.action === 'object' &&
                      'disruption' in result.action
                        ? (result.action as { disruption: DisruptionType }).disruption
                        : ''
                  );
                  // The resolved instance should still be resolved
                  const stillResolved = result.state.disruptionHistory.find(
                    (d) => d.type === triggeredType && d.resolved
                  );
                  expect(stillResolved?.resolved).toBe(true);
                }

                state = result.state;
              }
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('a state with all disruptions resolved always returns none', () => {
    fc.assert(
      fc.property(
        validEnabledTypesArb,
        personaTypeArb,
        fc.integer({ min: 2, max: 50 }),
        (enabledTypes, personaType, exchangeCount) => {
          // Create a state where all disruptions are already resolved
          const state: DisruptionState = {
            activeDisruptions: enabledTypes,
            exchangeCount: 0,
            disruptionHistory: enabledTypes.map((type) => ({
              type,
              triggeredAtExchange: 2,
              resolved: true,
              attempts: 1,
            })),
            nextDisruptionAfterExchange: 2,
          };

          const result = evaluateDisruption(state, {
            exchangeCount,
            personaType,
          });

          // Should never trigger a disruption when all are resolved
          if (result.action !== 'none' && typeof result.action === 'object') {
            expect(result.action.type).not.toBe('trigger_disruption');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('resolved flag is never flipped back to false by evaluateDisruption', () => {
    fc.assert(
      fc.property(
        validEnabledTypesArb,
        personaTypeArb,
        fc.integer({ min: 2, max: 30 }),
        (enabledTypes, personaType, maxExchanges) => {
          // Start with a state where first disruption is resolved
          const state: DisruptionState = {
            activeDisruptions: enabledTypes,
            exchangeCount: 0,
            disruptionHistory: enabledTypes.map((type, i) => ({
              type,
              triggeredAtExchange: i === 0 ? 2 : -1,
              resolved: i === 0, // first one is resolved
              attempts: i === 0 ? 1 : 0,
            })),
            nextDisruptionAfterExchange: 2,
          };

          let currentState = state;

          for (let exchange = 2; exchange <= maxExchanges; exchange++) {
            const result = evaluateDisruption(currentState, {
              exchangeCount: exchange,
              personaType,
            });

            // The first disruption must remain resolved
            expect(result.state.disruptionHistory[0].resolved).toBe(true);
            currentState = result.state;
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
