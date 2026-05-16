import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ReplayAnnotator } from '@/app/(main)/telefun/components/ReplayAnnotator';

describe('ReplayAnnotator error state', () => {
  it('keeps persisted recommendations visible while showing a regeneration error', () => {
    const html = renderToStaticMarkup(
      <ReplayAnnotator
        sessionId="session-1"
        annotations={[
          {
            id: 'ann-1',
            timestampMs: 300,
            category: 'strength',
            moment: 'good_de_escalation',
            text: 'User added this manually',
            isManual: true,
          },
        ]}
        recommendations={[{ text: 'Recommendation', priority: 1 }]}
        isLoading={false}
        error="Gagal mengunduh rekaman. Silakan coba lagi."
        onRetry={() => undefined}
        onAddAnnotation={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(html).toContain('Recommendation');
    expect(html).toContain('User added this manually');
    expect(html).toContain('Gagal mengunduh rekaman. Silakan coba lagi.');
  });
});

describe('ReplayAnnotator loading state with partial data', () => {
  it('shows persisted recommendations during loading when annotations are empty', () => {
    const html = renderToStaticMarkup(
      <ReplayAnnotator
        sessionId="session-1"
        annotations={[]}
        recommendations={[{ text: 'Persisted rec', priority: 1 }]}
        isLoading={true}
        onRetry={() => undefined}
        onAddAnnotation={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(html).toContain('Persisted rec');
  });

  it('hides partial content when both annotations and recommendations are empty during loading', () => {
    const html = renderToStaticMarkup(
      <ReplayAnnotator
        sessionId="session-1"
        annotations={[]}
        recommendations={[]}
        isLoading={true}
        onRetry={() => undefined}
        onAddAnnotation={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(html).not.toContain('CoachingRecommendationsSection');
    expect(html).not.toContain('Timeline anotasi');
  });
});
