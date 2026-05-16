/**
 * Property-Based Tests for Replay Annotator Output Constraints
 *
 * Uses fast-check to verify universal correctness properties
 * of the truncateAnnotationsByPriority, validateRecommendations,
 * isValidAnnotation, and isValidManualAnnotationText functions.
 *
 * **Validates: Requirements 9.2, 9.3, 9.4, 9.5**
 */

import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';

// Mock server-only packages that are imported transitively
vi.mock('server-only', () => ({}));
vi.mock('@/app/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/app/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }));
vi.mock('@/app/actions/gemini', () => ({ generateGeminiContent: vi.fn() }));
vi.mock('@/app/actions/voiceAssessmentTimeout', () => ({ runWithVoiceAssessmentTimeout: vi.fn() }));
vi.mock('@/app/(main)/telefun/recordingPath', () => ({ isValidRecordingPath: vi.fn() }));

import {
  truncateAnnotationsByPriority,
  validateRecommendations,
  isValidAnnotation,
  isValidManualAnnotationText,
} from '@/app/actions/replayAnnotationHelpers';
import type {
  AnnotationCategory,
  AnnotationMoment,
  ReplayAnnotation,
  CoachingRecommendation,
} from '@/app/(main)/telefun/services/realisticMode/types';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const VALID_CATEGORIES: AnnotationCategory[] = [
  'strength',
  'improvement_area',
  'critical_moment',
  'technique_used',
];

const VALID_MOMENTS: AnnotationMoment[] = [
  'missed_empathy',
  'good_de_escalation',
  'long_pause',
  'interruption',
  'technique_usage',
];

const categoryArb = fc.constantFrom<AnnotationCategory>(...VALID_CATEGORIES);
const momentArb = fc.constantFrom<AnnotationMoment>(...VALID_MOMENTS);

/**
 * Generates a valid ReplayAnnotation with constrained fields.
 */
const replayAnnotationArb: fc.Arbitrary<ReplayAnnotation> = fc.record({
  id: fc.uuid(),
  timestampMs: fc.integer({ min: 0, max: 600_000 }), // up to 10 minutes
  category: categoryArb,
  moment: momentArb,
  text: fc.string({ minLength: 1, maxLength: 500 }),
  isManual: fc.boolean(),
});

/**
 * Generates an array of ReplayAnnotations with variable length.
 */
function annotationsArrayArb(
  minLength: number,
  maxLength: number
): fc.Arbitrary<ReplayAnnotation[]> {
  return fc.array(replayAnnotationArb, { minLength, maxLength });
}

/**
 * Generates a CoachingRecommendation with arbitrary text and priority.
 */
const recommendationArb: fc.Arbitrary<CoachingRecommendation> = fc.record({
  text: fc.string({ minLength: 1, maxLength: 400 }), // may exceed 200 to test truncation
  priority: fc.double({ min: -5, max: 15 }), // may exceed [1,5] to test clamping
});

/**
 * Generates an array of CoachingRecommendations with variable length.
 */
function recommendationsArrayArb(
  minLength: number,
  maxLength: number
): fc.Arbitrary<CoachingRecommendation[]> {
  return fc.array(recommendationArb, { minLength, maxLength });
}

// ---------------------------------------------------------------------------
// Property 26: Annotation output respects size constraints
// ---------------------------------------------------------------------------

describe('Property 26: Annotation output respects size constraints', () => {
  /**
   * **Validates: Requirements 9.2, 9.3, 9.4, 9.5**
   *
   * For any ReplayAnnotationResult:
   * (a) annotations.length <= 30
   * (b) each annotation.category is one of the four valid values
   * (c) summary.length <= 5
   * (d) each summary recommendation text.length <= 200
   * (e) manual annotations have text.length <= 500
   */

  it('(a) truncateAnnotationsByPriority always returns at most 30 annotations', async () => {
    await fc.assert(
      fc.asyncProperty(
        annotationsArrayArb(0, 80),
        async (annotations) => {
          const result = await truncateAnnotationsByPriority(annotations);
          expect(result.length).toBeLessThanOrEqual(30);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('(a) truncateAnnotationsByPriority preserves all annotations when count <= 30', async () => {
    await fc.assert(
      fc.asyncProperty(
        annotationsArrayArb(0, 30),
        async (annotations) => {
          const result = await truncateAnnotationsByPriority(annotations);
          expect(result.length).toBe(annotations.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('(b) each annotation.category in truncated output is one of the four valid values', async () => {
    await fc.assert(
      fc.asyncProperty(
        annotationsArrayArb(1, 60),
        async (annotations) => {
          const result = await truncateAnnotationsByPriority(annotations);
          for (const ann of result) {
            expect(VALID_CATEGORIES).toContain(ann.category);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('(c) validateRecommendations always returns at most 5 recommendations', async () => {
    await fc.assert(
      fc.asyncProperty(
        recommendationsArrayArb(0, 20),
        async (recommendations) => {
          const result = await validateRecommendations(recommendations);
          expect(result.length).toBeLessThanOrEqual(5);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('(d) each recommendation text.length <= 200 after validation', async () => {
    await fc.assert(
      fc.asyncProperty(
        recommendationsArrayArb(1, 15),
        async (recommendations) => {
          const result = await validateRecommendations(recommendations);
          for (const rec of result) {
            expect(rec.text.length).toBeLessThanOrEqual(200);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('(d) recommendation priority is clamped to [1, 5] after validation', async () => {
    await fc.assert(
      fc.asyncProperty(
        recommendationsArrayArb(1, 10),
        async (recommendations) => {
          const result = await validateRecommendations(recommendations);
          for (const rec of result) {
            expect(rec.priority).toBeGreaterThanOrEqual(1);
            expect(rec.priority).toBeLessThanOrEqual(5);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('(e) isValidManualAnnotationText rejects text longer than 500 characters', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 501, maxLength: 1000 }),
        async (longText) => {
          expect(await isValidManualAnnotationText(longText)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('(e) isValidManualAnnotationText accepts text between 1 and 500 characters', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 500 }),
        async (validText) => {
          expect(await isValidManualAnnotationText(validText)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('(e) isValidManualAnnotationText rejects empty string', async () => {
    expect(await isValidManualAnnotationText('')).toBe(false);
  });

  it('isValidAnnotation accepts annotations with valid category, moment, text, and timestampMs', async () => {
    await fc.assert(
      fc.asyncProperty(
        categoryArb,
        momentArb,
        fc.string({ minLength: 1, maxLength: 500 }),
        fc.integer({ min: 0, max: 600_000 }),
        async (category, moment, text, timestampMs) => {
          expect(
            await isValidAnnotation({ category, moment, text, timestampMs })
          ).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('isValidAnnotation rejects annotations with invalid category', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 30 }).filter(
          (s) => !VALID_CATEGORIES.includes(s as AnnotationCategory)
        ),
        momentArb,
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.integer({ min: 0, max: 600_000 }),
        async (invalidCategory, moment, text, timestampMs) => {
          expect(
            await isValidAnnotation({ category: invalidCategory, moment, text, timestampMs })
          ).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('isValidAnnotation rejects annotations with negative timestampMs', async () => {
    await fc.assert(
      fc.asyncProperty(
        categoryArb,
        momentArb,
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.integer({ min: -100_000, max: -1 }),
        async (category, moment, text, negativeTs) => {
          expect(
            await isValidAnnotation({ category, moment, text, timestampMs: negativeTs })
          ).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('truncateAnnotationsByPriority prioritizes critical_moment over other categories', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 31, max: 60 }),
        async (totalCount) => {
          const criticalAnnotations: ReplayAnnotation[] = Array.from(
            { length: Math.min(totalCount, 30) },
            (_, i) => ({
              id: `critical-${i}`,
              timestampMs: i * 1000,
              category: 'critical_moment' as AnnotationCategory,
              moment: 'missed_empathy' as AnnotationMoment,
              text: `Critical annotation ${i}`,
              isManual: false,
            })
          );

          const lowPriorityAnnotations: ReplayAnnotation[] = Array.from(
            { length: totalCount - criticalAnnotations.length },
            (_, i) => ({
              id: `technique-${i}`,
              timestampMs: (criticalAnnotations.length + i) * 1000,
              category: 'technique_used' as AnnotationCategory,
              moment: 'technique_usage' as AnnotationMoment,
              text: `Technique annotation ${i}`,
              isManual: false,
            })
          );

          const allAnnotations = [...criticalAnnotations, ...lowPriorityAnnotations];
          const result = await truncateAnnotationsByPriority(allAnnotations);

          expect(result.length).toBe(30);
          for (const ann of result) {
            expect(ann.category).toBe('critical_moment');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
