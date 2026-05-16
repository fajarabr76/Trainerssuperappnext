import type {
  AnnotationCategory,
  AnnotationMoment,
  ReplayAnnotation,
  CoachingRecommendation,
} from '@/app/(main)/telefun/services/realisticMode/types';

export const MAX_ANNOTATIONS = 30;
export const MAX_RECOMMENDATIONS = 5;
export const MAX_RECOMMENDATION_CHARS = 200;
export const MAX_MANUAL_ANNOTATION_CHARS = 500;

export const CATEGORY_PRIORITY: AnnotationCategory[] = [
  'critical_moment',
  'improvement_area',
  'strength',
  'technique_used',
];

export const VALID_CATEGORIES: AnnotationCategory[] = [
  'strength',
  'improvement_area',
  'critical_moment',
  'technique_used',
];

export const VALID_MOMENTS: AnnotationMoment[] = [
  'missed_empathy',
  'good_de_escalation',
  'long_pause',
  'interruption',
  'technique_usage',
];

export function truncateAnnotationsByPriority(
  annotations: ReplayAnnotation[]
): ReplayAnnotation[] {
  if (annotations.length <= MAX_ANNOTATIONS) return annotations;

  const grouped = new Map<AnnotationCategory, ReplayAnnotation[]>();
  for (const cat of CATEGORY_PRIORITY) {
    grouped.set(cat, []);
  }
  for (const ann of annotations) {
    const list = grouped.get(ann.category);
    if (list) {
      list.push(ann);
    }
  }

  for (const cat of CATEGORY_PRIORITY) {
    const list = grouped.get(cat);
    if (list) {
      list.sort((a, b) => a.timestampMs - b.timestampMs);
    }
  }

  const result: ReplayAnnotation[] = [];
  for (const cat of CATEGORY_PRIORITY) {
    const list = grouped.get(cat) ?? [];
    for (const ann of list) {
      if (result.length >= MAX_ANNOTATIONS) break;
      result.push(ann);
    }
    if (result.length >= MAX_ANNOTATIONS) break;
  }

  return result.sort((a, b) => a.timestampMs - b.timestampMs);
}

export function validateRecommendations(
  recommendations: CoachingRecommendation[]
): CoachingRecommendation[] {
  return recommendations
    .slice(0, MAX_RECOMMENDATIONS)
    .map((rec) => {
      const rounded = Math.round(rec.priority);
      const safePriority = Number.isNaN(rounded) ? 1 : rounded;
      return {
        text: rec.text.slice(0, MAX_RECOMMENDATION_CHARS),
        priority: Math.max(1, Math.min(5, safePriority)),
      };
    });
}

export function isValidAnnotation(annotation: {
  category?: string;
  moment?: string;
  text?: string;
  timestampMs?: number;
}): boolean {
  if (!annotation.category || !VALID_CATEGORIES.includes(annotation.category as AnnotationCategory)) {
    return false;
  }
  if (!annotation.moment || !VALID_MOMENTS.includes(annotation.moment as AnnotationMoment)) {
    return false;
  }
  if (!annotation.text || typeof annotation.text !== 'string') {
    return false;
  }
  if (typeof annotation.timestampMs !== 'number' || annotation.timestampMs < 0) {
    return false;
  }
  return true;
}

export function isValidManualAnnotationText(text: string): boolean {
  return typeof text === 'string' && text.length > 0 && text.length <= MAX_MANUAL_ANNOTATION_CHARS;
}
