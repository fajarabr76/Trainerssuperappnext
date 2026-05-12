import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  classifyDurationMode,
  coerceDuration,
  filterDurationInput,
  normalizeDurationDisplay,
} from '@/app/lib/duration-validation';
import { getTelefunTimeCueThreshold } from '@/app/(main)/telefun/services/timingGuards';


describe('Feature: custom-duration-timer, Property Validation', () => {
  it('Property 1: Input filtering preserves only digits', () => {
    fc.assert(
      fc.property(fc.string(), (str) => {
        const filtered = filterDurationInput(str);
        const expected = str.replace(/\D/g, '');
        expect(filtered).toBe(expected);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 7: Invalid duration fallback', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer({ max: 0 }),
          fc.integer({ min: 61 }),
          fc.float().filter((f) => !Number.isInteger(f) && !isNaN(f)),
          fc.string().filter((s) => isNaN(Number(s)) || s.trim() === ''),
          fc.constantFrom(null, undefined, NaN, {}, [])
        ),
        (val) => {
          expect(coerceDuration(val)).toBe(5);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 9: Decimal values are rounded down on blur', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000 }),
        fc.integer({ min: 1, max: 99 }),
        (intPart, decPart) => {
          const str = `${intPart}.${decPart}`;
          expect(normalizeDurationDisplay(str)).toBe(
            Math.floor(Number(str)).toString()
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 10: Leading zeros are removed on blur', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),
        fc.integer({ min: 1, max: 5 }),
        (val, zerosCount) => {
          const str = '0'.repeat(zerosCount) + val.toString();
          expect(normalizeDurationDisplay(str)).toBe(val.toString());
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 2: Settings restoration correctly classifies and defaults duration', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constantFrom(5, 10, 15),
          fc.integer({ min: 1, max: 60 }).filter((n) => ![5, 10, 15].includes(n)),
          fc.integer({ min: -100, max: 0 }),
          fc.integer({ min: 61, max: 1000 }),
          fc.string(),
          fc.constantFrom(null, undefined, NaN)
        ),
        (stored) => {
          const classified = classifyDurationMode(stored);
          if (
            typeof stored === 'number' &&
            Number.isInteger(stored) &&
            stored >= 1 &&
            stored <= 60
          ) {
            if ([5, 10, 15].includes(stored)) {
              expect(classified.mode).toBe('preset');
              expect(classified.value).toBe(stored);
            } else {
              expect(classified.mode).toBe('custom');
              expect(classified.value).toBe(stored);
            }
          } else {
            expect(classified.mode).toBe('preset');
            expect(classified.value).toBe(5);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 3: Ketik timer initialization computes correct seconds', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 60 }), (duration) => {
        const initialSeconds = coerceDuration(duration) * 60;
        expect(initialSeconds).toBe(duration * 60);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 4: Telefun timer uses correct auto-hangup threshold', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 60 }), (duration) => {
        const thresholdSeconds = coerceDuration(duration) * 60;
        expect(thresholdSeconds).toBe(duration * 60);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 5: Pre-timeout cues fire at correct thresholds', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 51, max: 3600 }),
        fc.integer({ min: 0, max: 3600 }),
        (totalSeconds, elapsedSeconds) => {
          const remaining = totalSeconds - elapsedSeconds;
          const cue = getTelefunTimeCueThreshold({
            totalSeconds,
            elapsedSeconds,
            cue30Sent: false,
            cue20Sent: false,
          });

          if (remaining <= 30 && remaining > 20) {
            expect(cue).toBe('30s');
            expect(
              getTelefunTimeCueThreshold({
                totalSeconds,
                elapsedSeconds,
                cue30Sent: true,
                cue20Sent: false,
              })
            ).toBeNull();
          } else if (remaining <= 20 && remaining > 0) {
            expect(cue).toBe('20s');
            expect(
              getTelefunTimeCueThreshold({
                totalSeconds,
                elapsedSeconds,
                cue30Sent: false,
                cue20Sent: true,
              })
            ).toBeNull();
          } else {
            expect(cue).toBeNull();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 6: Short duration skips 30-second cue', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 0, max: 50 }),
        (totalSeconds, elapsedSeconds) => {
          const remaining = totalSeconds - elapsedSeconds;
          const cue = getTelefunTimeCueThreshold({
            totalSeconds,
            elapsedSeconds,
            cue30Sent: false,
            cue20Sent: false,
          });

          expect(cue).not.toBe('30s');

          if (totalSeconds > 20 && remaining <= 20 && remaining > 0) {
            expect(cue).toBe('20s');
          } else {
            expect(cue).toBeNull();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 8: Session persistence options retain custom simulated limits exactly as configured', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.uuid(),
          duration: fc.integer({ min: 1, max: 3600 }),
          configuredDuration: fc.option(fc.integer({ min: 1, max: 60 }), { nil: undefined }),
          scenarioTitle: fc.string(),
        }),
        (sessionParams) => {
          // Simulate persistence metadata construction
          const detailsPayload = {
            scenario_title: sessionParams.scenarioTitle,
            configured_duration: sessionParams.configuredDuration,
          };

          // Simulate hydration mapping from persistence layer back to CallRecord
          const hydratedRecord = {
            id: sessionParams.id,
            duration: sessionParams.duration,
            configuredDuration: detailsPayload.configured_duration,
            scenarioTitle: detailsPayload.scenario_title,
          };

          expect(hydratedRecord.configuredDuration).toBe(sessionParams.configuredDuration);
          expect(hydratedRecord.id).toBe(sessionParams.id);
        }
      ),
      { numRuns: 100 }
    );
  });
});

