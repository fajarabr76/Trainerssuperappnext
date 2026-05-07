import { VoiceQualityAssessment, VoiceAspectScore } from '@/app/types/voiceAssessment';

/**
 * Clamps a number between min and max.
 */
function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasRequiredAspectFields(data: unknown): data is VoiceAspectScore {
  return (
    isRecord(data) &&
    typeof data.score === 'number' &&
    typeof data.verdict === 'string' &&
    typeof data.feedback === 'string'
  );
}

/**
 * Validates and sanitizes a VoiceAspectScore object.
 */
function validateAspectScore(data: unknown, defaultVerdict = 'Neutral'): VoiceAspectScore {
  const safeData = isRecord(data) ? data : {};
  return {
    score: typeof safeData.score === 'number' ? clamp(safeData.score, 0, 10) : 0,
    verdict: typeof safeData.verdict === 'string' ? safeData.verdict : defaultVerdict,
    feedback: typeof safeData.feedback === 'string' ? safeData.feedback : 'No feedback provided.',
  };
}

/**
 * Validates and sanitizes a VoiceQualityAssessment object from potentially untrusted AI output.
 */
export function validateAssessment(data: unknown): VoiceQualityAssessment | null {
  if (!isRecord(data)) {
    return null;
  }

  if (typeof data.overallScore !== 'number') {
    return null;
  }

  if (!hasRequiredAspectFields(data.speakingRate)) return null;
  if (!hasRequiredAspectFields(data.intonation)) return null;
  if (!hasRequiredAspectFields(data.articulation)) return null;
  if (!hasRequiredAspectFields(data.fillerWords)) return null;
  if (!hasRequiredAspectFields(data.emotionalTone)) return null;

  const speakingRate = data.speakingRate as unknown as Record<string, unknown>;
  const fillerWords = data.fillerWords as unknown as Record<string, unknown>;
  const emotionalTone = data.emotionalTone as unknown as Record<string, unknown>;

  if (typeof speakingRate.wordsPerMinute !== 'number') {
    return null;
  }
  if (typeof fillerWords.count !== 'number' || !Array.isArray(fillerWords.examples)) {
    return null;
  }
  if (typeof emotionalTone.dominant !== 'string') {
    return null;
  }

  const safeAspect = (aspect: unknown) => validateAspectScore(aspect);

  return {
    overallScore: clamp(data.overallScore, 0, 10),
    speakingRate: {
      ...safeAspect(speakingRate),
      wordsPerMinute: typeof speakingRate.wordsPerMinute === 'number' ? speakingRate.wordsPerMinute : 0,
    },
    intonation: safeAspect(data.intonation),
    articulation: safeAspect(data.articulation),
    fillerWords: {
      ...safeAspect(fillerWords),
      count: typeof fillerWords.count === 'number' ? fillerWords.count : 0,
      examples: Array.isArray(fillerWords.examples)
        ? fillerWords.examples.filter((e): e is string => typeof e === 'string').slice(0, 10)
        : [],
    },
    emotionalTone: {
      ...safeAspect(emotionalTone),
      dominant: typeof emotionalTone.dominant === 'string' ? emotionalTone.dominant : 'Unknown',
    },
    transcript: typeof data.transcript === 'string' ? data.transcript : '',
    highlights: Array.isArray(data.highlights)
      ? data.highlights.filter((h): h is string => typeof h === 'string').slice(0, 5)
      : [],
    strengths: Array.isArray(data.strengths)
      ? data.strengths.filter((s): s is string => typeof s === 'string').slice(0, 5)
      : [],
  };
}
