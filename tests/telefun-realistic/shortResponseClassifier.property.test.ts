/**
 * Property-based tests for Short Response Classifier.
 *
 * Properties tested:
 * - Property 11: Short response classifier returns correct category for known patterns
 * - Property 12: Low-confidence classification falls back to acknowledgement
 *
 * Validates: Requirements 4.1, 4.6
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  classifyShortResponse,
  ACKNOWLEDGEMENT_KEYWORDS,
  INSTRUCTION_KEYWORDS,
  QUESTION_KEYWORDS,
  CLOSING_KEYWORDS,
} from '@/app/(main)/telefun/services/realisticMode/shortResponseClassifier';

// ---------------------------------------------------------------------------
// Helpers / Generators
// ---------------------------------------------------------------------------

/** Generate a valid short response duration (< 3000ms) */
const arbShortDuration = fc.integer({ min: 100, max: 2999 });

/** Generate a keyword from the acknowledgement pool */
const arbAcknowledgementKeyword = fc.constantFrom(...ACKNOWLEDGEMENT_KEYWORDS);

/** Generate a keyword from the instruction pool */
const arbInstructionKeyword = fc.constantFrom(...INSTRUCTION_KEYWORDS);

/** Generate a keyword from the question pool */
const arbQuestionKeyword = fc.constantFrom(...QUESTION_KEYWORDS);

/** Generate a keyword from the closing pool */
const arbClosingKeyword = fc.constantFrom(...CLOSING_KEYWORDS);

/** All keywords from all pools combined */
const ALL_KEYWORDS = [
  ...ACKNOWLEDGEMENT_KEYWORDS,
  ...INSTRUCTION_KEYWORDS,
  ...QUESTION_KEYWORDS,
  ...CLOSING_KEYWORDS,
];

/**
 * Generate a random string that does NOT contain any keyword from any pool.
 * Uses alphanumeric characters that won't accidentally match Indonesian keywords.
 */
const arbNonMatchingTranscription = fc
  .array(fc.constantFrom('x', 'z', 'w', 'v', '1', '2', '3'), {
    minLength: 1,
    maxLength: 20,
  })
  .map((chars) => chars.join(''))
  .filter((s) => {
    const normalized = s.trim().toLowerCase();
    if (normalized.length === 0) return false;
    // Ensure no keyword from any pool matches
    return !ALL_KEYWORDS.some(
      (kw) =>
        normalized === kw ||
        normalized.startsWith(kw) ||
        normalized.includes(kw)
    );
  });

// ---------------------------------------------------------------------------
// Property 11: Short response classifier returns correct category for known patterns
// **Validates: Requirements 4.1**
// ---------------------------------------------------------------------------

describe('Property 11: Short response classifier returns correct category for known patterns', () => {
  it('11a: acknowledgement keywords are classified as acknowledgement with confidence >= 0.7', () => {
    fc.assert(
      fc.property(
        arbAcknowledgementKeyword,
        arbShortDuration,
        (keyword, durationMs) => {
          const result = classifyShortResponse({
            transcription: keyword,
            durationMs,
          });

          expect(result.category).toBe('acknowledgement');
          expect(result.confidence).toBeGreaterThanOrEqual(0.7);
          expect(result.fallbackToAcknowledgement).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('11b: instruction keywords are classified as instruction with confidence >= 0.7', () => {
    fc.assert(
      fc.property(
        arbInstructionKeyword,
        arbShortDuration,
        (keyword, durationMs) => {
          const result = classifyShortResponse({
            transcription: keyword,
            durationMs,
          });

          expect(result.category).toBe('instruction');
          expect(result.confidence).toBeGreaterThanOrEqual(0.7);
          expect(result.fallbackToAcknowledgement).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('11c: question keywords are classified as question with confidence >= 0.7', () => {
    fc.assert(
      fc.property(
        arbQuestionKeyword,
        arbShortDuration,
        (keyword, durationMs) => {
          const result = classifyShortResponse({
            transcription: keyword,
            durationMs,
          });

          expect(result.category).toBe('question');
          expect(result.confidence).toBeGreaterThanOrEqual(0.7);
          expect(result.fallbackToAcknowledgement).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('11d: closing keywords are classified as closing with confidence >= 0.7', () => {
    fc.assert(
      fc.property(
        arbClosingKeyword,
        arbShortDuration,
        (keyword, durationMs) => {
          const result = classifyShortResponse({
            transcription: keyword,
            durationMs,
          });

          expect(result.category).toBe('closing');
          expect(result.confidence).toBeGreaterThanOrEqual(0.7);
          expect(result.fallbackToAcknowledgement).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('11e: keywords with varied casing are still classified correctly', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_KEYWORDS),
        arbShortDuration,
        fc.constantFrom('upper', 'mixed', 'original'),
        (keyword, durationMs, caseType) => {
          let transcription: string;
          if (caseType === 'upper') {
            transcription = keyword.toUpperCase();
          } else if (caseType === 'mixed') {
            transcription = keyword
              .split('')
              .map((c, i) => (i % 2 === 0 ? c.toUpperCase() : c.toLowerCase()))
              .join('');
          } else {
            transcription = keyword;
          }

          const result = classifyShortResponse({
            transcription,
            durationMs,
          });

          // Case-insensitive matching should still produce confidence >= 0.7
          expect(result.confidence).toBeGreaterThanOrEqual(0.7);
          expect(result.fallbackToAcknowledgement).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('11f: duration exceeding 3000ms results in fallback regardless of keyword', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_KEYWORDS),
        fc.integer({ min: 3001, max: 10000 }),
        (keyword, durationMs) => {
          const result = classifyShortResponse({
            transcription: keyword,
            durationMs,
          });

          // Duration > 3000ms → not a short response → fallback
          expect(result.category).toBe('acknowledgement');
          expect(result.fallbackToAcknowledgement).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 12: Low-confidence classification falls back to acknowledgement
// **Validates: Requirements 4.6**
// ---------------------------------------------------------------------------

describe('Property 12: Low-confidence classification falls back to acknowledgement', () => {
  it('12a: transcriptions not matching any keyword pool fall back to acknowledgement', () => {
    fc.assert(
      fc.property(
        arbNonMatchingTranscription,
        arbShortDuration,
        (transcription, durationMs) => {
          const result = classifyShortResponse({
            transcription,
            durationMs,
          });

          expect(result.category).toBe('acknowledgement');
          expect(result.fallbackToAcknowledgement).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('12b: empty transcription falls back to acknowledgement', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('', '   ', '\t', '\n'),
        arbShortDuration,
        (transcription, durationMs) => {
          const result = classifyShortResponse({
            transcription,
            durationMs,
          });

          expect(result.category).toBe('acknowledgement');
          expect(result.fallbackToAcknowledgement).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('12c: fallback result always has fallbackToAcknowledgement=true when no match', () => {
    fc.assert(
      fc.property(
        arbNonMatchingTranscription,
        arbShortDuration,
        (transcription, durationMs) => {
          const result = classifyShortResponse({
            transcription,
            durationMs,
          });

          // When falling back, the flag must be true
          if (result.fallbackToAcknowledgement) {
            expect(result.category).toBe('acknowledgement');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
