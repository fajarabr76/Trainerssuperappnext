import { describe, expect, it } from 'vitest';
import { sortReplayAnnotationsByTimestamp } from '@/app/actions/replayAnnotationHelpers';
import type { ReplayAnnotation } from '@/app/(main)/telefun/services/realisticMode/types';

describe('sortReplayAnnotationsByTimestamp', () => {
  it('sorts annotations by timestampMs in ascending order', () => {
    const annotations: Partial<ReplayAnnotation>[] = [
      { timestampMs: 3000, text: 'Late' },
      { timestampMs: 1000, text: 'Early' },
      { timestampMs: 2000, text: 'Middle' },
    ];

    const sorted = sortReplayAnnotationsByTimestamp(annotations as ReplayAnnotation[]);

    expect(sorted.map(a => a.timestampMs)).toEqual([1000, 2000, 3000]);
    expect(sorted[0].text).toBe('Early');
    expect(sorted[2].text).toBe('Late');
  });

  it('performs stable sort for same timestampMs', () => {
    const annotations: Partial<ReplayAnnotation>[] = [
      { timestampMs: 1000, text: 'First' },
      { timestampMs: 1000, text: 'Second' },
      { timestampMs: 1000, text: 'Third' },
    ];

    const sorted = sortReplayAnnotationsByTimestamp(annotations as ReplayAnnotation[]);

    expect(sorted.map(a => a.text)).toEqual(['First', 'Second', 'Third']);
  });

  it('does not mutate the original array', () => {
    const annotations: Partial<ReplayAnnotation>[] = [
      { timestampMs: 2000 },
      { timestampMs: 1000 },
    ];
    const original = [...annotations];

    sortReplayAnnotationsByTimestamp(annotations as ReplayAnnotation[]);

    expect(annotations).toEqual(original);
  });
});
