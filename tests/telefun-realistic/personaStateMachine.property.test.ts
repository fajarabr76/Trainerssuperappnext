/**
 * Property-Based Tests for Persona State Machine
 *
 * Uses fast-check to verify universal correctness properties
 * of the initializePersona, reducePersonaState, and getInitialIntensityRange functions.
 *
 * **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  initializePersona,
  reducePersonaState,
  getInitialIntensityRange,
  type PersonaState,
  type PersonaEvent,
} from '@/app/(main)/telefun/services/realisticMode/personaStateMachine';
import type { ConsumerPersonaType } from '@/app/(main)/telefun/services/realisticMode/types';

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

const deEscalationTriggerArb = fc.constantFrom<'empathy' | 'solution' | 'apology'>(
  'empathy',
  'solution',
  'apology'
);

const escalationTriggerArb = fc.constantFrom<'dismissive' | 'ignored_concern'>(
  'dismissive',
  'ignored_concern'
);

const personaEventArb: fc.Arbitrary<PersonaEvent> = fc.oneof(
  deEscalationTriggerArb.map((trigger) => ({ type: 'de_escalation' as const, trigger })),
  escalationTriggerArb.map((trigger) => ({ type: 'escalation' as const, trigger })),
  fc.constant({ type: 'exchange_complete' as const }),
  fc.boolean().map((addressesConcern) => ({ type: 'resolution_offered' as const, addressesConcern }))
);

const emotionalIntensityArb = fc.integer({ min: 1, max: 10 });

const personaStateArb: fc.Arbitrary<PersonaState> = fc.record({
  personaType: personaTypeArb,
  emotionalIntensity: emotionalIntensityArb,
  exchangeCount: fc.integer({ min: 0, max: 100 }),
  lastDeEscalationAt: fc.oneof(fc.constant(null), fc.integer({ min: 0, max: 100 })),
  lastEscalationAt: fc.oneof(fc.constant(null), fc.integer({ min: 0, max: 100 })),
});

// ---------------------------------------------------------------------------
// Property 16: Persona type is immutable throughout session
// ---------------------------------------------------------------------------

describe('Property 16: Persona type is immutable throughout session', () => {
  /**
   * **Validates: Requirements 6.1, 6.2**
   *
   * For any PersonaState and any PersonaEvent, the personaType field
   * in the resulting state from `reducePersonaState` must equal the
   * input state's personaType.
   */

  it('personaType never changes after any event', () => {
    fc.assert(
      fc.property(
        personaStateArb,
        personaEventArb,
        (state, event) => {
          const result = reducePersonaState(state, event);
          expect(result.state.personaType).toBe(state.personaType);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('personaType remains stable across a sequence of events', () => {
    fc.assert(
      fc.property(
        personaStateArb,
        fc.array(personaEventArb, { minLength: 1, maxLength: 20 }),
        (initialState, events) => {
          let currentState = initialState;
          for (const event of events) {
            const result = reducePersonaState(currentState, event);
            expect(result.state.personaType).toBe(initialState.personaType);
            currentState = result.state;
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 17: Emotional intensity change is bounded per exchange
// ---------------------------------------------------------------------------

describe('Property 17: Emotional intensity change is bounded per exchange', () => {
  /**
   * **Validates: Requirements 6.3, 6.4, 6.5**
   *
   * For any PersonaState and PersonaEvent:
   * (a) for de-escalation events, intensityDelta is in [-2, 0]
   * (b) for escalation events on angry/critical personas, intensityDelta is in [2, 3]
   * (c) for escalation events on passive/cooperative personas, intensityDelta is in [1, 2]
   * (d) for escalation events on confused/rushed personas, intensityDelta is in [1, 2]
   */

  it('(a) de-escalation events produce intensityDelta in [-2, 0]', () => {
    fc.assert(
      fc.property(
        personaStateArb,
        deEscalationTriggerArb,
        (state, trigger) => {
          const event: PersonaEvent = { type: 'de_escalation', trigger };
          const result = reducePersonaState(state, event);

          expect(result.intensityDelta).toBeGreaterThanOrEqual(-2);
          expect(result.intensityDelta).toBeLessThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('(b) escalation events on angry/critical personas produce intensityDelta in [2, 3]', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<ConsumerPersonaType>('angry', 'critical'),
        emotionalIntensityArb,
        fc.integer({ min: 0, max: 100 }),
        escalationTriggerArb,
        (personaType, intensity, exchangeCount, trigger) => {
          const state: PersonaState = {
            personaType,
            emotionalIntensity: intensity,
            exchangeCount,
            lastDeEscalationAt: null,
            lastEscalationAt: null,
          };
          const event: PersonaEvent = { type: 'escalation', trigger };
          const result = reducePersonaState(state, event);

          expect(result.intensityDelta).toBeGreaterThanOrEqual(2);
          expect(result.intensityDelta).toBeLessThanOrEqual(3);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('(c) escalation events on passive/cooperative personas produce intensityDelta in [1, 2]', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<ConsumerPersonaType>('passive', 'cooperative'),
        emotionalIntensityArb,
        fc.integer({ min: 0, max: 100 }),
        escalationTriggerArb,
        (personaType, intensity, exchangeCount, trigger) => {
          const state: PersonaState = {
            personaType,
            emotionalIntensity: intensity,
            exchangeCount,
            lastDeEscalationAt: null,
            lastEscalationAt: null,
          };
          const event: PersonaEvent = { type: 'escalation', trigger };
          const result = reducePersonaState(state, event);

          expect(result.intensityDelta).toBeGreaterThanOrEqual(1);
          expect(result.intensityDelta).toBeLessThanOrEqual(2);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('(d) escalation events on confused/rushed personas produce intensityDelta in [1, 2]', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<ConsumerPersonaType>('confused', 'rushed'),
        emotionalIntensityArb,
        fc.integer({ min: 0, max: 100 }),
        escalationTriggerArb,
        (personaType, intensity, exchangeCount, trigger) => {
          const state: PersonaState = {
            personaType,
            emotionalIntensity: intensity,
            exchangeCount,
            lastDeEscalationAt: null,
            lastEscalationAt: null,
          };
          const event: PersonaEvent = { type: 'escalation', trigger };
          const result = reducePersonaState(state, event);

          expect(result.intensityDelta).toBeGreaterThanOrEqual(1);
          expect(result.intensityDelta).toBeLessThanOrEqual(2);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('exchange_complete and non-addressing resolution produce zero delta', () => {
    fc.assert(
      fc.property(
        personaStateArb,
        fc.constantFrom<PersonaEvent>(
          { type: 'exchange_complete' },
          { type: 'resolution_offered', addressesConcern: false }
        ),
        (state, event) => {
          const result = reducePersonaState(state, event);
          expect(result.intensityDelta).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('resolution_offered with addressesConcern=true produces delta in [-2, 0]', () => {
    fc.assert(
      fc.property(
        personaStateArb,
        (state) => {
          const event: PersonaEvent = { type: 'resolution_offered', addressesConcern: true };
          const result = reducePersonaState(state, event);

          expect(result.intensityDelta).toBeGreaterThanOrEqual(-2);
          expect(result.intensityDelta).toBeLessThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 18: Persona initialization sets intensity within defined range
// ---------------------------------------------------------------------------

describe('Property 18: Persona initialization sets intensity within defined range', () => {
  /**
   * **Validates: Requirements 6.6**
   *
   * For any ConsumerPersonaType, `initializePersona` must set
   * emotionalIntensity within:
   * angry=[7,8], critical=[6,7], confused=[4,5],
   * rushed=[5,6], passive=[3,4], cooperative=[2,3].
   */

  it('initializePersona sets intensity within the defined range for each persona', () => {
    fc.assert(
      fc.property(
        personaTypeArb,
        (personaType) => {
          const state = initializePersona(personaType);
          const range = getInitialIntensityRange(personaType);

          expect(state.emotionalIntensity).toBeGreaterThanOrEqual(range.min);
          expect(state.emotionalIntensity).toBeLessThanOrEqual(range.max);
          expect(state.personaType).toBe(personaType);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('angry persona initializes with intensity in [7, 8]', () => {
    const state = initializePersona('angry');
    expect(state.emotionalIntensity).toBeGreaterThanOrEqual(7);
    expect(state.emotionalIntensity).toBeLessThanOrEqual(8);
  });

  it('critical persona initializes with intensity in [6, 7]', () => {
    const state = initializePersona('critical');
    expect(state.emotionalIntensity).toBeGreaterThanOrEqual(6);
    expect(state.emotionalIntensity).toBeLessThanOrEqual(7);
  });

  it('confused persona initializes with intensity in [4, 5]', () => {
    const state = initializePersona('confused');
    expect(state.emotionalIntensity).toBeGreaterThanOrEqual(4);
    expect(state.emotionalIntensity).toBeLessThanOrEqual(5);
  });

  it('rushed persona initializes with intensity in [5, 6]', () => {
    const state = initializePersona('rushed');
    expect(state.emotionalIntensity).toBeGreaterThanOrEqual(5);
    expect(state.emotionalIntensity).toBeLessThanOrEqual(6);
  });

  it('passive persona initializes with intensity in [3, 4]', () => {
    const state = initializePersona('passive');
    expect(state.emotionalIntensity).toBeGreaterThanOrEqual(3);
    expect(state.emotionalIntensity).toBeLessThanOrEqual(4);
  });

  it('cooperative persona initializes with intensity in [2, 3]', () => {
    const state = initializePersona('cooperative');
    expect(state.emotionalIntensity).toBeGreaterThanOrEqual(2);
    expect(state.emotionalIntensity).toBeLessThanOrEqual(3);
  });

  it('getInitialIntensityRange returns correct ranges for all persona types', () => {
    fc.assert(
      fc.property(
        personaTypeArb,
        (personaType) => {
          const range = getInitialIntensityRange(personaType);
          expect(range.min).toBeLessThanOrEqual(range.max);
          expect(range.min).toBeGreaterThanOrEqual(1);
          expect(range.max).toBeLessThanOrEqual(10);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 19: Emotional intensity is clamped to [1, 10]
// ---------------------------------------------------------------------------

describe('Property 19: Emotional intensity is clamped to [1, 10]', () => {
  /**
   * **Validates: Requirements 6.7, 6.8**
   *
   * For any PersonaState and any PersonaEvent, the resulting
   * emotionalIntensity must be >= 1 and <= 10.
   * When intensity is already 10 and a non-de-escalation event occurs,
   * it remains 10.
   * When intensity is already 1 and a de-escalation event occurs,
   * it remains 1.
   */

  it('resulting emotionalIntensity is always in [1, 10]', () => {
    fc.assert(
      fc.property(
        personaStateArb,
        personaEventArb,
        (state, event) => {
          const result = reducePersonaState(state, event);
          expect(result.state.emotionalIntensity).toBeGreaterThanOrEqual(1);
          expect(result.state.emotionalIntensity).toBeLessThanOrEqual(10);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('intensity at 10 remains 10 on escalation events', () => {
    fc.assert(
      fc.property(
        personaTypeArb,
        escalationTriggerArb,
        (personaType, trigger) => {
          const state: PersonaState = {
            personaType,
            emotionalIntensity: 10,
            exchangeCount: 5,
            lastDeEscalationAt: null,
            lastEscalationAt: null,
          };
          const event: PersonaEvent = { type: 'escalation', trigger };
          const result = reducePersonaState(state, event);

          expect(result.state.emotionalIntensity).toBe(10);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('intensity at 1 remains 1 on de-escalation events', () => {
    fc.assert(
      fc.property(
        personaTypeArb,
        deEscalationTriggerArb,
        (personaType, trigger) => {
          const state: PersonaState = {
            personaType,
            emotionalIntensity: 1,
            exchangeCount: 5,
            lastDeEscalationAt: null,
            lastEscalationAt: null,
          };
          const event: PersonaEvent = { type: 'de_escalation', trigger };
          const result = reducePersonaState(state, event);

          expect(result.state.emotionalIntensity).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('intensity at 1 remains 1 on resolution_offered with addressesConcern=true', () => {
    fc.assert(
      fc.property(
        personaTypeArb,
        (personaType) => {
          const state: PersonaState = {
            personaType,
            emotionalIntensity: 1,
            exchangeCount: 5,
            lastDeEscalationAt: null,
            lastEscalationAt: null,
          };
          const event: PersonaEvent = { type: 'resolution_offered', addressesConcern: true };
          const result = reducePersonaState(state, event);

          expect(result.state.emotionalIntensity).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('intensity remains clamped after a sequence of escalation events', () => {
    fc.assert(
      fc.property(
        personaTypeArb,
        fc.array(escalationTriggerArb, { minLength: 1, maxLength: 20 }),
        (personaType, triggers) => {
          let currentState: PersonaState = {
            personaType,
            emotionalIntensity: 8, // start high
            exchangeCount: 0,
            lastDeEscalationAt: null,
            lastEscalationAt: null,
          };

          for (const trigger of triggers) {
            const event: PersonaEvent = { type: 'escalation', trigger };
            const result = reducePersonaState(currentState, event);
            expect(result.state.emotionalIntensity).toBeLessThanOrEqual(10);
            expect(result.state.emotionalIntensity).toBeGreaterThanOrEqual(1);
            currentState = result.state;
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('intensity remains clamped after a sequence of de-escalation events', () => {
    fc.assert(
      fc.property(
        personaTypeArb,
        fc.array(deEscalationTriggerArb, { minLength: 1, maxLength: 20 }),
        (personaType, triggers) => {
          let currentState: PersonaState = {
            personaType,
            emotionalIntensity: 3, // start low
            exchangeCount: 0,
            lastDeEscalationAt: null,
            lastEscalationAt: null,
          };

          for (const trigger of triggers) {
            const event: PersonaEvent = { type: 'de_escalation', trigger };
            const result = reducePersonaState(currentState, event);
            expect(result.state.emotionalIntensity).toBeLessThanOrEqual(10);
            expect(result.state.emotionalIntensity).toBeGreaterThanOrEqual(1);
            currentState = result.state;
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
