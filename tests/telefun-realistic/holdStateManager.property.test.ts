/**
 * Property-Based Tests for Hold State Manager
 *
 * Properties 27–32 from the design document, validating hold state
 * coordination from the UI button (exclusive hold source) with consent
 * context for rude hold detection.
 *
 * **Validates: Requirements 10.1, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 10.10**
 *
 * Feature: telefun-realistic
 * Library: fast-check with Vitest
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  evaluateHoldState,
  initializeHoldState,
  validateHoldConsent,
  createInitialConsentContext,
  type HoldState,
  type HoldInput,
  type HoldSource,
  type ConsentContext,
  type RudeHoldReason,
} from '@/app/(main)/telefun/services/realisticMode/holdStateManager';

// ---------------------------------------------------------------------------
// Constants (mirrored from implementation for test assertions)
// ---------------------------------------------------------------------------

const FIRST_HOLD_TIMER_MS = 60000;
const SUBSEQUENT_HOLD_TIMER_MS = 180000;
const CONSENT_REQUEST_TTL_MS = 15000;

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const holdSourceArb: fc.Arbitrary<HoldSource> = fc.constantFrom('none', 'ui');

const timestampArb: fc.Arbitrary<number> = fc.integer({ min: 1000, max: 1_000_000 });

const holdCountArb: fc.Arbitrary<number> = fc.integer({ min: 0, max: 20 });

const consentContextArb: fc.Arbitrary<ConsentContext> = fc.record({
  lastHoldRequestAt: fc.option(timestampArb, { nil: null }),
  lastConsumerResponseAt: fc.option(timestampArb, { nil: null }),
});

/**
 * Generates a valid HoldState with consistent internal constraints.
 */
const holdStateArb: fc.Arbitrary<HoldState> = fc.record({
  source: holdSourceArb,
  activeSince: fc.option(timestampArb, { nil: null }),
  uiTimerDurationMs: fc.option(
    fc.constantFrom(FIRST_HOLD_TIMER_MS, SUBSEQUENT_HOLD_TIMER_MS),
    { nil: null }
  ),
  holdCount: holdCountArb,
}).map((s) => {
  if (s.source === 'none') {
    return { ...s, activeSince: null, uiTimerDurationMs: null };
  }
  return {
    ...s,
    activeSince: s.activeSince ?? 5000,
    uiTimerDurationMs: s.uiTimerDurationMs ?? FIRST_HOLD_TIMER_MS,
  };
});

/**
 * Generates a HoldInput with all event flags false (no events).
 */
const noEventInputArb: fc.Arbitrary<HoldInput> = fc.record({
  now: timestampArb,
  uiButtonPressed: fc.constant(false),
  uiButtonReleased: fc.constant(false),
  consentContext: consentContextArb,
  currentHoldActive: fc.boolean(),
  uiTimerExpired: fc.constant(false),
});

// ---------------------------------------------------------------------------
// Property 27: UI hold button immediately activates hold regardless of consent
// ---------------------------------------------------------------------------

describe('Property 27 (R10.1): UI hold button always activates hold regardless of consent context', () => {
  /**
   * **Validates: Requirements 10.1, 10.9**
   *
   * For any HoldState and any ConsentContext, when uiButtonPressed=true,
   * the result must have action='activate_ui_hold' and state.source='ui'.
   */

  it('UI button press always produces activate_ui_hold with source=ui', () => {
    fc.assert(
      fc.property(
        holdStateArb,
        timestampArb,
        consentContextArb,
        fc.boolean(),
        (state, now, consentContext, currentHoldActive) => {
          const input: HoldInput = {
            now,
            uiButtonPressed: true,
            uiButtonReleased: false,
            consentContext,
            currentHoldActive,
            uiTimerExpired: false,
          };

          const result = evaluateHoldState(state, input);

          expect(result.action).toBe('activate_ui_hold');
          expect(result.state.source).toBe('ui');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('UI button press when no hold is active activates UI hold', () => {
    fc.assert(
      fc.property(
        holdCountArb,
        timestampArb,
        consentContextArb,
        (holdCount, now, consentContext) => {
          const state: HoldState = {
            source: 'none',
            activeSince: null,
            uiTimerDurationMs: null,
            holdCount,
          };

          const input: HoldInput = {
            now,
            uiButtonPressed: true,
            uiButtonReleased: false,
            consentContext,
            currentHoldActive: false,
            uiTimerExpired: false,
          };

          const result = evaluateHoldState(state, input);

          expect(result.action).toBe('activate_ui_hold');
          expect(result.state.source).toBe('ui');
          expect(result.state.activeSince).toBe(now);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('UI button press when already on hold re-activates with same source', () => {
    fc.assert(
      fc.property(
        timestampArb,
        holdCountArb,
        timestampArb,
        consentContextArb,
        (activeSince, holdCount, now, consentContext) => {
          const state: HoldState = {
            source: 'ui',
            activeSince,
            uiTimerDurationMs: FIRST_HOLD_TIMER_MS,
            holdCount,
          };

          const input: HoldInput = {
            now,
            uiButtonPressed: true,
            uiButtonReleased: false,
            consentContext,
            currentHoldActive: true,
            uiTimerExpired: false,
          };

          const result = evaluateHoldState(state, input);

          expect(result.action).toBe('activate_ui_hold');
          expect(result.state.source).toBe('ui');
          expect(result.state.activeSince).toBe(now);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 28: UI-initiated hold uses UI timer duration as session-end threshold
// ---------------------------------------------------------------------------

describe('Property 28 (R10.3): First hold uses 60s, subsequent holds use 180s', () => {
  /**
   * **Validates: Requirement 10.3**
   *
   * For holdCount=0 → becomes 1 → uiTimerDurationMs=60000.
   * For holdCount>=1 → becomes holdCount+1 → uiTimerDurationMs=180000.
   */

  it('first hold (holdCount becomes 1) uses 60000ms timer', () => {
    fc.assert(
      fc.property(
        timestampArb,
        consentContextArb,
        (now, consentContext) => {
          const state: HoldState = {
            source: 'none',
            activeSince: null,
            uiTimerDurationMs: null,
            holdCount: 0,
          };

          const input: HoldInput = {
            now,
            uiButtonPressed: true,
            uiButtonReleased: false,
            consentContext,
            currentHoldActive: false,
            uiTimerExpired: false,
          };

          const result = evaluateHoldState(state, input);

          expect(result.state.source).toBe('ui');
          expect(result.state.holdCount).toBe(1);
          expect(result.state.uiTimerDurationMs).toBe(FIRST_HOLD_TIMER_MS);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('subsequent holds (holdCount>=1) use 180000ms timer', () => {
    fc.assert(
      fc.property(
        timestampArb,
        fc.integer({ min: 1, max: 20 }),
        consentContextArb,
        (now, holdCount, consentContext) => {
          const state: HoldState = {
            source: 'none',
            activeSince: null,
            uiTimerDurationMs: null,
            holdCount,
          };

          const input: HoldInput = {
            now,
            uiButtonPressed: true,
            uiButtonReleased: false,
            consentContext,
            currentHoldActive: false,
            uiTimerExpired: false,
          };

          const result = evaluateHoldState(state, input);

          expect(result.state.source).toBe('ui');
          expect(result.state.holdCount).toBe(holdCount + 1);
          expect(result.state.uiTimerDurationMs).toBe(SUBSEQUENT_HOLD_TIMER_MS);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('timer duration is always either 60000 or 180000 for UI holds', () => {
    fc.assert(
      fc.property(
        holdCountArb,
        timestampArb,
        consentContextArb,
        (holdCount, now, consentContext) => {
          const state: HoldState = {
            source: 'none',
            activeSince: null,
            uiTimerDurationMs: null,
            holdCount,
          };

          const input: HoldInput = {
            now,
            uiButtonPressed: true,
            uiButtonReleased: false,
            consentContext,
            currentHoldActive: false,
            uiTimerExpired: false,
          };

          const result = evaluateHoldState(state, input);

          expect(result.state.uiTimerDurationMs).toBeOneOf([
            FIRST_HOLD_TIMER_MS,
            SUBSEQUENT_HOLD_TIMER_MS,
          ]);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 29: All engines suspend during any active hold state
// ---------------------------------------------------------------------------

describe('Property 29 (R10.4, R10.5, R10.6): All engines suspend during active hold', () => {
  /**
   * **Validates: Requirements 10.4, 10.5, 10.6**
   *
   * For any HoldResult where state.source !== 'none', suppressMicAudio,
   * suppressGeminiAudio, and suspendEngines must all be true.
   */

  it('active UI hold suspends all engines and suppresses audio', () => {
    fc.assert(
      fc.property(
        timestampArb,
        holdCountArb,
        timestampArb,
        (activeSince, holdCount, now) => {
          const state: HoldState = {
            source: 'ui',
            activeSince,
            uiTimerDurationMs: holdCount === 0 ? FIRST_HOLD_TIMER_MS : SUBSEQUENT_HOLD_TIMER_MS,
            holdCount: Math.max(1, holdCount),
          };

          const input: HoldInput = {
            now,
            uiButtonPressed: false,
            uiButtonReleased: false,
            consentContext: createInitialConsentContext(),
            currentHoldActive: true,
            uiTimerExpired: false,
          };

          const result = evaluateHoldState(state, input);

          expect(result.state.source).not.toBe('none');
          expect(result.suppressMicAudio).toBe(true);
          expect(result.suppressGeminiAudio).toBe(true);
          expect(result.suspendEngines).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('newly activated hold (UI press) immediately sets all suppress flags', () => {
    fc.assert(
      fc.property(
        holdStateArb,
        timestampArb,
        consentContextArb,
        (state, now, consentContext) => {
          const input: HoldInput = {
            now,
            uiButtonPressed: true,
            uiButtonReleased: false,
            consentContext,
            currentHoldActive: false,
            uiTimerExpired: false,
          };

          const result = evaluateHoldState(state, input);

          expect(result.suppressMicAudio).toBe(true);
          expect(result.suppressGeminiAudio).toBe(true);
          expect(result.suspendEngines).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('inactive hold (source=none) does NOT suppress engines', () => {
    fc.assert(
      fc.property(
        holdCountArb,
        timestampArb,
        (holdCount, now) => {
          const state: HoldState = {
            source: 'none',
            activeSince: null,
            uiTimerDurationMs: null,
            holdCount,
          };

          const input: HoldInput = {
            now,
            uiButtonPressed: false,
            uiButtonReleased: false,
            consentContext: createInitialConsentContext(),
            currentHoldActive: false,
            uiTimerExpired: false,
          };

          const result = evaluateHoldState(state, input);

          expect(result.suppressMicAudio).toBe(false);
          expect(result.suppressGeminiAudio).toBe(false);
          expect(result.suspendEngines).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 30: Hold music and Gemini audio are mutually exclusive
// ---------------------------------------------------------------------------

describe('Property 30 (R10.7): Hold music and Gemini audio are mutually exclusive', () => {
  /**
   * **Validates: Requirement 10.7**
   *
   * When suppressGeminiAudio=true (hold active), no Gemini audio should play.
   * When suppressGeminiAudio=false (hold inactive), hold music should not play.
   */

  it('when hold is active, suppressGeminiAudio is always true', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<HoldSource>('ui'),
        timestampArb,
        holdCountArb,
        timestampArb,
        (source, activeSince, holdCount, now) => {
          const state: HoldState = {
            source,
            activeSince,
            uiTimerDurationMs: FIRST_HOLD_TIMER_MS,
            holdCount: Math.max(1, holdCount),
          };

          const input: HoldInput = {
            now,
            uiButtonPressed: false,
            uiButtonReleased: false,
            consentContext: createInitialConsentContext(),
            currentHoldActive: true,
            uiTimerExpired: false,
          };

          const result = evaluateHoldState(state, input);

          expect(result.suppressGeminiAudio).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('when hold is inactive, suppressGeminiAudio is false', () => {
    fc.assert(
      fc.property(
        holdCountArb,
        timestampArb,
        (holdCount, now) => {
          const state: HoldState = {
            source: 'none',
            activeSince: null,
            uiTimerDurationMs: null,
            holdCount,
          };

          const input: HoldInput = {
            now,
            uiButtonPressed: false,
            uiButtonReleased: false,
            consentContext: createInitialConsentContext(),
            currentHoldActive: false,
            uiTimerExpired: false,
          };

          const result = evaluateHoldState(state, input);

          expect(result.suppressGeminiAudio).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('suppressGeminiAudio and hold source are always consistent', () => {
    fc.assert(
      fc.property(
        holdStateArb,
        noEventInputArb,
        (state, input) => {
          const result = evaluateHoldState(state, input);

          if (result.state.source !== 'none') {
            expect(result.suppressGeminiAudio).toBe(true);
          } else {
            expect(result.suppressGeminiAudio).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 31: Hold deactivation resets state correctly
// ---------------------------------------------------------------------------

describe('Property 31 (R10.8, R10.10): Hold deactivation resets state correctly', () => {
  /**
   * **Validates: Requirements 10.8, 10.10**
   *
   * For any hold state with source !== 'none', when uiButtonReleased=true
   * or uiTimerExpired=true, the resulting state must have source='none',
   * activeSince=null, uiTimerDurationMs=null, and all suppress flags=false.
   */

  it('UI button release deactivates hold and resets all state', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<HoldSource>('ui'),
        timestampArb,
        holdCountArb,
        timestampArb,
        (source, activeSince, holdCount, now) => {
          const state: HoldState = {
            source,
            activeSince,
            uiTimerDurationMs: FIRST_HOLD_TIMER_MS,
            holdCount: Math.max(1, holdCount),
          };

          const input: HoldInput = {
            now,
            uiButtonPressed: false,
            uiButtonReleased: true,
            consentContext: createInitialConsentContext(),
            currentHoldActive: true,
            uiTimerExpired: false,
          };

          const result = evaluateHoldState(state, input);

          expect(result.action).toBe('deactivate_hold');
          expect(result.state.source).toBe('none');
          expect(result.state.activeSince).toBeNull();
          expect(result.state.uiTimerDurationMs).toBeNull();
          expect(result.suppressMicAudio).toBe(false);
          expect(result.suppressGeminiAudio).toBe(false);
          expect(result.suspendEngines).toBe(false);
          expect(result.isRudeHold).toBe(false);
          expect(result.rudeHoldReason).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('UI timer expiry deactivates UI hold and resets all state', () => {
    fc.assert(
      fc.property(
        timestampArb,
        holdCountArb,
        timestampArb,
        (activeSince, holdCount, now) => {
          const state: HoldState = {
            source: 'ui',
            activeSince,
            uiTimerDurationMs: holdCount === 0 ? FIRST_HOLD_TIMER_MS : SUBSEQUENT_HOLD_TIMER_MS,
            holdCount: Math.max(1, holdCount),
          };

          const input: HoldInput = {
            now,
            uiButtonPressed: false,
            uiButtonReleased: false,
            consentContext: createInitialConsentContext(),
            currentHoldActive: true,
            uiTimerExpired: true,
          };

          const result = evaluateHoldState(state, input);

          expect(result.action).toBe('deactivate_hold');
          expect(result.state.source).toBe('none');
          expect(result.state.activeSince).toBeNull();
          expect(result.state.uiTimerDurationMs).toBeNull();
          expect(result.suppressMicAudio).toBe(false);
          expect(result.suppressGeminiAudio).toBe(false);
          expect(result.suspendEngines).toBe(false);
          expect(result.isRudeHold).toBe(false);
          expect(result.rudeHoldReason).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('hold deactivation preserves holdCount (never decrements)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<HoldSource>('ui'),
        timestampArb,
        fc.integer({ min: 1, max: 20 }),
        timestampArb,
        (source, activeSince, holdCount, now) => {
          const state: HoldState = {
            source,
            activeSince,
            uiTimerDurationMs: FIRST_HOLD_TIMER_MS,
            holdCount,
          };

          const input: HoldInput = {
            now,
            uiButtonPressed: false,
            uiButtonReleased: true,
            consentContext: createInitialConsentContext(),
            currentHoldActive: true,
            uiTimerExpired: false,
          };

          const result = evaluateHoldState(state, input);

          expect(result.state.holdCount).toBe(holdCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('initializeHoldState returns correct initial state', () => {
    const initial = initializeHoldState();

    expect(initial.source).toBe('none');
    expect(initial.activeSince).toBeNull();
    expect(initial.uiTimerDurationMs).toBeNull();
    expect(initial.holdCount).toBe(0);
  });

  it('createInitialConsentContext returns null fields', () => {
    const ctx = createInitialConsentContext();

    expect(ctx.lastHoldRequestAt).toBeNull();
    expect(ctx.lastConsumerResponseAt).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Property 32: Rude hold detection (R10.9)
// ---------------------------------------------------------------------------

describe('Property 32 (R10.9): Rude hold detection via consent context', () => {
  /**
   * **Validates: Requirement 10.9**
   *
   * validateHoldConsent determines rude hold based on consent context:
   * - No request → rude, reason='no_request'
   * - Request > 15s old → rude, reason='stale_request'
   * - No consumer response after request → rude, reason='no_consumer_response'
   * - Valid consent → not rude, reason=null
   *
   * In ALL cases, hold still activates with action='activate_ui_hold'.
   */

  it('no hold request -> isRudeHold=true, rudeHoldReason=no_request', () => {
    fc.assert(
      fc.property(
        timestampArb,
        holdCountArb,
        timestampArb,
        (now, holdCount, _unused) => {
          const consent: ConsentContext = {
            lastHoldRequestAt: null,
            lastConsumerResponseAt: null,
          };

          const { isRudeHold, rudeHoldReason } = validateHoldConsent(now, consent);

          expect(isRudeHold).toBe(true);
          expect(rudeHoldReason).toBe('no_request');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('no request + UI press still activates hold with isRudeHold=true', () => {
    fc.assert(
      fc.property(
        timestampArb,
        holdCountArb,
        (now, holdCount) => {
          const state: HoldState = {
            source: 'none',
            activeSince: null,
            uiTimerDurationMs: null,
            holdCount,
          };

          const consent: ConsentContext = {
            lastHoldRequestAt: null,
            lastConsumerResponseAt: null,
          };

          const input: HoldInput = {
            now,
            uiButtonPressed: true,
            uiButtonReleased: false,
            consentContext: consent,
            currentHoldActive: false,
            uiTimerExpired: false,
          };

          const result = evaluateHoldState(state, input);

          expect(result.action).toBe('activate_ui_hold');
          expect(result.state.source).toBe('ui');
          expect(result.isRudeHold).toBe(true);
          expect(result.rudeHoldReason).toBe('no_request');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('stale request (>15s old) -> isRudeHold=true, rudeHoldReason=stale_request', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100000 }),
        holdCountArb,
        (offset, _holdCount) => {
          // now is far enough past the request to exceed TTL
          const lastHoldRequestAt = 100000;
          const now = lastHoldRequestAt + CONSENT_REQUEST_TTL_MS + 1 + offset;

          const consent: ConsentContext = {
            lastHoldRequestAt,
            lastConsumerResponseAt: lastHoldRequestAt + 1,
          };

          const { isRudeHold, rudeHoldReason } = validateHoldConsent(now, consent);

          expect(isRudeHold).toBe(true);
          expect(rudeHoldReason).toBe('stale_request');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('stale request + UI press still activates hold with isRudeHold=true', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }),
        holdCountArb,
        (excess, holdCount) => {
          const lastHoldRequestAt = 50000;
          const now = lastHoldRequestAt + CONSENT_REQUEST_TTL_MS + excess;

          const state: HoldState = {
            source: 'none',
            activeSince: null,
            uiTimerDurationMs: null,
            holdCount,
          };

          const consent: ConsentContext = {
            lastHoldRequestAt,
            lastConsumerResponseAt: lastHoldRequestAt + 1,
          };

          const input: HoldInput = {
            now,
            uiButtonPressed: true,
            uiButtonReleased: false,
            consentContext: consent,
            currentHoldActive: false,
            uiTimerExpired: false,
          };

          const result = evaluateHoldState(state, input);

          expect(result.action).toBe('activate_ui_hold');
          expect(result.state.source).toBe('ui');
          expect(result.isRudeHold).toBe(true);
          expect(result.rudeHoldReason).toBe('stale_request');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('no consumer response -> isRudeHold=true, rudeHoldReason=no_consumer_response', () => {
    fc.assert(
      fc.property(
        timestampArb,
        holdCountArb,
        (now, _holdCount) => {
          const lastHoldRequestAt = now;
          const consent: ConsentContext = {
            lastHoldRequestAt,
            lastConsumerResponseAt: null,
          };

          const { isRudeHold, rudeHoldReason } = validateHoldConsent(now, consent);

          expect(isRudeHold).toBe(true);
          expect(rudeHoldReason).toBe('no_consumer_response');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('response before request -> isRudeHold=true, rudeHoldReason=no_consumer_response', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: CONSENT_REQUEST_TTL_MS }),
        holdCountArb,
        timestampArb,
        (responseDelay, _holdCount, lastHoldRequestAt) => {
          // now must be within TTL to avoid stale_request taking priority
          const now = lastHoldRequestAt + responseDelay;
          const consent: ConsentContext = {
            lastHoldRequestAt,
            lastConsumerResponseAt: lastHoldRequestAt - 1,
          };

          const { isRudeHold, rudeHoldReason } = validateHoldConsent(now, consent);

          expect(isRudeHold).toBe(true);
          expect(rudeHoldReason).toBe('no_consumer_response');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('no consumer response + UI press still activates hold', () => {
    fc.assert(
      fc.property(
        timestampArb,
        holdCountArb,
        (now, holdCount) => {
          const state: HoldState = {
            source: 'none',
            activeSince: null,
            uiTimerDurationMs: null,
            holdCount,
          };

          const consent: ConsentContext = {
            lastHoldRequestAt: now,
            lastConsumerResponseAt: null,
          };

          const input: HoldInput = {
            now,
            uiButtonPressed: true,
            uiButtonReleased: false,
            consentContext: consent,
            currentHoldActive: false,
            uiTimerExpired: false,
          };

          const result = evaluateHoldState(state, input);

          expect(result.action).toBe('activate_ui_hold');
          expect(result.state.source).toBe('ui');
          expect(result.isRudeHold).toBe(true);
          expect(result.rudeHoldReason).toBe('no_consumer_response');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('valid consent -> isRudeHold=false, rudeHoldReason=null', () => {
    fc.assert(
      fc.property(
        timestampArb,
        holdCountArb,
        (now, _holdCount) => {
          const consent: ConsentContext = {
            lastHoldRequestAt: now,
            lastConsumerResponseAt: now + 1,
          };

          const { isRudeHold, rudeHoldReason } = validateHoldConsent(now, consent);

          expect(isRudeHold).toBe(false);
          expect(rudeHoldReason).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('valid consent + UI press activates hold with isRudeHold=false', () => {
    fc.assert(
      fc.property(
        timestampArb,
        holdCountArb,
        (now, holdCount) => {
          const state: HoldState = {
            source: 'none',
            activeSince: null,
            uiTimerDurationMs: null,
            holdCount,
          };

          const consent: ConsentContext = {
            lastHoldRequestAt: now,
            lastConsumerResponseAt: now + 1,
          };

          const input: HoldInput = {
            now,
            uiButtonPressed: true,
            uiButtonReleased: false,
            consentContext: consent,
            currentHoldActive: false,
            uiTimerExpired: false,
          };

          const result = evaluateHoldState(state, input);

          expect(result.action).toBe('activate_ui_hold');
          expect(result.state.source).toBe('ui');
          expect(result.isRudeHold).toBe(false);
          expect(result.rudeHoldReason).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('valid consent with response shortly after request is not rude', () => {
    fc.assert(
      fc.property(
        timestampArb,
        fc.integer({ min: 1, max: CONSENT_REQUEST_TTL_MS }),
        holdCountArb,
        (lastHoldRequestAt, responseDelay, _holdCount) => {
          const now = lastHoldRequestAt + responseDelay;
          const consent: ConsentContext = {
            lastHoldRequestAt,
            lastConsumerResponseAt: lastHoldRequestAt + responseDelay,
          };

          const { isRudeHold, rudeHoldReason } = validateHoldConsent(now, consent);

          expect(isRudeHold).toBe(false);
          expect(rudeHoldReason).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('response must be strictly after request for valid consent', () => {
    fc.assert(
      fc.property(
        timestampArb,
        (now) => {
          // Response at same time as request → considered no_consumer_response
          const consent: ConsentContext = {
            lastHoldRequestAt: now,
            lastConsumerResponseAt: now,
          };

          const { isRudeHold, rudeHoldReason } = validateHoldConsent(now, consent);

          expect(isRudeHold).toBe(true);
          expect(rudeHoldReason).toBe('no_consumer_response');
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 34: Boundary edge cases for consent validation
// ---------------------------------------------------------------------------

describe('Property 34: Boundary edge cases for consent validation', () => {
  it('request exactly at TTL boundary (now === lastHoldRequestAt + 15000) is still valid', () => {
    fc.assert(
      fc.property(
        timestampArb,
        (baseTime) => {
          const lastHoldRequestAt = baseTime;
          const now = lastHoldRequestAt + CONSENT_REQUEST_TTL_MS;
          const consent: ConsentContext = {
            lastHoldRequestAt,
            lastConsumerResponseAt: now,
          };

          const { isRudeHold, rudeHoldReason } = validateHoldConsent(now, consent);
          expect(isRudeHold).toBe(false);
          expect(rudeHoldReason).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('request just past TTL boundary (now === lastHoldRequestAt + 15001) is stale', () => {
    fc.assert(
      fc.property(
        timestampArb,
        (baseTime) => {
          const lastHoldRequestAt = baseTime;
          const now = lastHoldRequestAt + CONSENT_REQUEST_TTL_MS + 1;
          const consent: ConsentContext = {
            lastHoldRequestAt,
            lastConsumerResponseAt: now,
          };

          const { isRudeHold, rudeHoldReason } = validateHoldConsent(now, consent);
          expect(isRudeHold).toBe(true);
          expect(rudeHoldReason).toBe('stale_request');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('double quick press: second press uses updated consent context', () => {
    fc.assert(
      fc.property(
        timestampArb,
        holdCountArb,
        (now, holdCount) => {
          const state: HoldState = { source: 'none', activeSince: null, uiTimerDurationMs: null, holdCount };
          const consent: ConsentContext = { lastHoldRequestAt: now, lastConsumerResponseAt: now + 1 };

          // First press — activates hold
          const firstResult = evaluateHoldState(state, {
            now,
            uiButtonPressed: true,
            uiButtonReleased: false,
            consentContext: consent,
            currentHoldActive: false,
            uiTimerExpired: false,
          });
          expect(firstResult.action).toBe('activate_ui_hold');
          expect(firstResult.isRudeHold).toBe(false);

          // Release
          const releaseResult = evaluateHoldState(firstResult.state, {
            now: now + 100,
            uiButtonPressed: false,
            uiButtonReleased: true,
            consentContext: consent,
            currentHoldActive: true,
            uiTimerExpired: false,
          });
          expect(releaseResult.action).toBe('deactivate_hold');

          // Second press — activates hold again, increments count
          const secondResult = evaluateHoldState(releaseResult.state, {
            now: now + 200,
            uiButtonPressed: true,
            uiButtonReleased: false,
            consentContext: consent,
            currentHoldActive: false,
            uiTimerExpired: false,
          });
          expect(secondResult.action).toBe('activate_ui_hold');
          expect(secondResult.state.holdCount).toBe(holdCount + 2);
          expect(secondResult.state.uiTimerDurationMs).toBe(SUBSEQUENT_HOLD_TIMER_MS);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('multiple instruction classifications update lastHoldRequestAt (most recent wins)', () => {
    const consent: ConsentContext = { lastHoldRequestAt: null, lastConsumerResponseAt: null };

    // First instruction at t=1000
    consent.lastHoldRequestAt = 1000;
    // Second instruction at t=2000 (more recent)
    consent.lastHoldRequestAt = 2000;
    // Consumer responds at t=2500
    consent.lastConsumerResponseAt = 2500;

    // At t=3000, the recent request (2000) should be used — less than 15s ago
    const result1 = validateHoldConsent(3000, consent);
    expect(result1.isRudeHold).toBe(false);

    // A very stale request (consumer responds before second request)
    const staleConsent: ConsentContext = {
      lastHoldRequestAt: 2000,
      lastConsumerResponseAt: 1500, // before last request!
    };
    const result2 = validateHoldConsent(3000, staleConsent);
    expect(result2.isRudeHold).toBe(true);
    expect(result2.rudeHoldReason).toBe('no_consumer_response');
  });
});
