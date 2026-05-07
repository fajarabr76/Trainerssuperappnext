import { describe, expect, it } from 'vitest';
import { validateAssessment } from '@/app/lib/voiceAssessmentUtils';

const validPayload = {
  overallScore: 8,
  speakingRate: {
    score: 7,
    wordsPerMinute: 142,
    verdict: 'Good pace',
    feedback: 'Stabil untuk call support.',
  },
  intonation: {
    score: 8,
    verdict: 'Expressive',
    feedback: 'Variasi nada cukup jelas.',
  },
  articulation: {
    score: 9,
    verdict: 'Clear',
    feedback: 'Pengucapan sangat jelas.',
  },
  fillerWords: {
    score: 7,
    count: 4,
    examples: ['anu', 'hmm', 'jadi'],
    verdict: 'Acceptable',
    feedback: 'Masih ada filler ringan.',
  },
  emotionalTone: {
    score: 8,
    dominant: 'Empathetic',
    verdict: 'Warm',
    feedback: 'Nada empatik terjaga.',
  },
  transcript: 'Halo, saya bantu ya.',
  highlights: ['Empati jelas', 'Tutup call sopan'],
  strengths: ['Artikulasi bagus', 'Nada ramah'],
};

describe('validateAssessment', () => {
  it('returns null for non-object payload', () => {
    expect(validateAssessment(null)).toBeNull();
    expect(validateAssessment('invalid-json')).toBeNull();
  });

  it('returns null when required voice aspects are missing', () => {
    const invalid = {
      ...validPayload,
      emotionalTone: undefined,
    };
    expect(validateAssessment(invalid)).toBeNull();
  });

  it('returns null when required nested fields are invalid', () => {
    const invalid = {
      ...validPayload,
      speakingRate: {
        score: 7,
        wordsPerMinute: 142,
        verdict: 123,
        feedback: 'ok',
      },
    };
    expect(validateAssessment(invalid)).toBeNull();
  });

  it('returns null when required metric fields are invalid types', () => {
    const invalid = {
      ...validPayload,
      speakingRate: {
        ...validPayload.speakingRate,
        wordsPerMinute: 'fast',
      },
    };
    expect(validateAssessment(invalid)).toBeNull();
  });

  it('clamps overall and aspect scores to 0-10', () => {
    const result = validateAssessment({
      ...validPayload,
      overallScore: 99,
      intonation: { ...validPayload.intonation, score: -7 },
      articulation: { ...validPayload.articulation, score: 42 },
    });

    expect(result).not.toBeNull();
    expect(result?.overallScore).toBe(10);
    expect(result?.intonation.score).toBe(0);
    expect(result?.articulation.score).toBe(10);
  });

  it('filters non-string items and truncates list fields', () => {
    const result = validateAssessment({
      ...validPayload,
      highlights: ['a', 1, 'b', 'c', 'd', 'e', 'f'],
      strengths: ['s1', 's2', {}, 's3', 's4', 's5', 's6'],
      fillerWords: {
        ...validPayload.fillerWords,
        examples: ['x1', 'x2', 3, 'x3', 'x4', 'x5', 'x6', 'x7', 'x8', 'x9', 'x10', 'x11'],
      },
    });

    expect(result).not.toBeNull();
    expect(result?.highlights).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(result?.strengths).toEqual(['s1', 's2', 's3', 's4', 's5']);
    expect(result?.fillerWords.examples).toEqual(['x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7', 'x8', 'x9', 'x10']);
  });

  it('preserves valid payload values', () => {
    const result = validateAssessment(validPayload);
    expect(result).toEqual(validPayload);
  });

  it('fills safe defaults for optional malformed fields', () => {
    const result = validateAssessment({
      ...validPayload,
      transcript: 42,
      highlights: 'invalid',
      strengths: null,
    });

    expect(result).not.toBeNull();
    expect(result?.transcript).toBe('');
    expect(result?.highlights).toEqual([]);
    expect(result?.strengths).toEqual([]);
    expect(result?.speakingRate.wordsPerMinute).toBe(142);
  });
});
