import { describe, expect, it } from 'vitest';
import {
  createReplayAnnotationChecksum,
  hasCompleteAiAnnotationSet,
} from '@/app/actions/replayAnnotationHelpers';
import type { ReplayAnnotation } from '@/app/(main)/telefun/services/realisticMode/types';

const aiAnnotation: ReplayAnnotation = {
  id: 'ai-1',
  timestampMs: 1200,
  category: 'critical_moment',
  moment: 'interruption',
  text: 'Agen memotong penjelasan konsumen.',
  isManual: false,
};

const manualAnnotation: ReplayAnnotation = {
  id: 'manual-1',
  timestampMs: 700,
  category: 'strength',
  moment: 'good_de_escalation',
  text: 'Catatan manual trainer.',
  isManual: true,
};

describe('replay annotation completion metadata', () => {
  it('accepts a persisted AI set only when count and checksum match', () => {
    const annotations = [manualAnnotation, aiAnnotation];
    const checksum = createReplayAnnotationChecksum([aiAnnotation]);

    expect(
      hasCompleteAiAnnotationSet(annotations, {
        aiAnnotationCount: 1,
        aiAnnotationChecksum: checksum,
      })
    ).toBe(true);
  });

  it('rejects a persisted AI set when metadata is missing', () => {
    expect(
      hasCompleteAiAnnotationSet([aiAnnotation], {
        aiAnnotationCount: null,
        aiAnnotationChecksum: null,
      })
    ).toBe(false);
  });

  it('rejects a persisted AI set when count does not match current rows', () => {
    const checksum = createReplayAnnotationChecksum([aiAnnotation]);

    expect(
      hasCompleteAiAnnotationSet([aiAnnotation], {
        aiAnnotationCount: 2,
        aiAnnotationChecksum: checksum,
      })
    ).toBe(false);
  });

  it('rejects a persisted AI set when checksum does not match current rows', () => {
    expect(
      hasCompleteAiAnnotationSet([aiAnnotation], {
        aiAnnotationCount: 1,
        aiAnnotationChecksum: '0'.repeat(64),
      })
    ).toBe(false);
  });

  it('allows a completed zero-annotation AI result when metadata explicitly records zero rows', () => {
    const checksum = createReplayAnnotationChecksum([]);

    expect(
      hasCompleteAiAnnotationSet([manualAnnotation], {
        aiAnnotationCount: 0,
        aiAnnotationChecksum: checksum,
      })
    ).toBe(true);
  });
});
