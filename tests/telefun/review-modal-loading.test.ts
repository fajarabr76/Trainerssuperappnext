import { describe, expect, it } from 'vitest';

import {
  resolveReplayLoadResult,
  resolveVoiceDashboardResult,
  shouldAutoLoadReviewPanel,
} from '@/app/(main)/telefun/components/reviewModalLoadState';

describe('ReviewModal load gating', () => {
  it('does not auto-retry after a failed load until retry clears the error', () => {
    expect(
      shouldAutoLoadReviewPanel({
        activeTab: 'voice_dashboard',
        panelTab: 'voice_dashboard',
        realisticModeEnabled: true,
        loaded: false,
        loading: false,
        error: 'boom',
      })
    ).toBe(false);
  });

  it('allows loading again once retry resets the error state', () => {
    expect(
      shouldAutoLoadReviewPanel({
        activeTab: 'voice_dashboard',
        panelTab: 'voice_dashboard',
        realisticModeEnabled: true,
        loaded: false,
        loading: false,
      })
    ).toBe(true);
  });

  it('does not refetch when data is already loaded (cached)', () => {
    expect(
      shouldAutoLoadReviewPanel({
        activeTab: 'voice_dashboard',
        panelTab: 'voice_dashboard',
        realisticModeEnabled: true,
        loaded: true,
        loading: false,
      })
    ).toBe(false);
  });

  it('does not load when realistic mode is disabled', () => {
    expect(
      shouldAutoLoadReviewPanel({
        activeTab: 'voice_dashboard',
        panelTab: 'voice_dashboard',
        realisticModeEnabled: false,
        loaded: false,
        loading: false,
      })
    ).toBe(false);
  });

  it('does not load for replay tab when on voice_dashboard', () => {
    expect(
      shouldAutoLoadReviewPanel({
        activeTab: 'details',
        panelTab: 'voice_dashboard',
        realisticModeEnabled: true,
        loaded: false,
        loading: false,
      })
    ).toBe(false);
  });

  it('allows retry for replay tab when error cleared', () => {
    expect(
      shouldAutoLoadReviewPanel({
        activeTab: 'replay',
        panelTab: 'replay',
        realisticModeEnabled: true,
        loaded: false,
        loading: false,
      })
    ).toBe(true);
  });

  it('retry click: state transition — error + loading cleared enables reload', () => {
    // Simulates: error state → user clicks retry → clears error/loading, loaded=false
    expect(
      shouldAutoLoadReviewPanel({
        activeTab: 'voice_dashboard',
        panelTab: 'voice_dashboard',
        realisticModeEnabled: true,
        loaded: false,
        loading: false,
        error: undefined,
      })
    ).toBe(true);
  });

  it('marks replay panel as loaded only for full success', () => {
    expect(
      resolveReplayLoadResult({
        success: true,
        result: {
          annotations: [],
          summary: [{ text: 'Recommendation', priority: 1 }],
        },
      })
    ).toEqual({
      annotations: [],
      recommendations: [{ text: 'Recommendation', priority: 1 }],
      loaded: true,
      error: undefined,
    });
  });

  it('preserves partial replay data while surfacing the regeneration error', () => {
    expect(
      resolveReplayLoadResult({
        success: false,
        error: 'Gagal mengunduh rekaman. Silakan coba lagi.',
        result: {
          annotations: [
            {
              id: 'ann-1',
              timestampMs: 300,
              category: 'strength',
              moment: 'good_de_escalation',
              text: 'User added this manually',
              isManual: true,
            },
          ],
          summary: [{ text: 'Recommendation', priority: 1 }],
        },
      })
    ).toEqual({
      annotations: [
        {
          id: 'ann-1',
          timestampMs: 300,
          category: 'strength',
          moment: 'good_de_escalation',
          text: 'User added this manually',
          isManual: true,
        },
      ],
      recommendations: [{ text: 'Recommendation', priority: 1 }],
      loaded: false,
      error: 'Gagal mengunduh rekaman. Silakan coba lagi.',
    });
  });

  it('treats success-without-result as retryable error to avoid silent loaded state', () => {
    expect(
      resolveReplayLoadResult({
        success: true,
      })
    ).toEqual({
      annotations: [],
      recommendations: [],
      loaded: false,
      error: 'Gagal menghasilkan anotasi.',
    });
  });

  describe('resolveVoiceDashboardResult', () => {
    it('marks loaded=true when metrics are returned', () => {
      expect(
        resolveVoiceDashboardResult({
          success: true,
          metrics: { speechClarity: 8, speakingSpeed: { wpm: 150, classification: 'normal' }, speakingDominance: { ratio: 0.5, classification: 'balanced' }, intonationVariability: 7 },
        })
      ).toEqual({
        metrics: expect.objectContaining({ speechClarity: 8 }),
        error: undefined,
        loaded: true,
      });
    });

    it('marks loaded=false with error when notice contains "Silakan coba lagi"', () => {
      expect(
        resolveVoiceDashboardResult({
          success: true,
          metrics: null,
          notice: 'Gagal mengunduh rekaman audio. Silakan coba lagi.',
        })
      ).toEqual({
        metrics: null,
        error: 'Gagal mengunduh rekaman audio. Silakan coba lagi.',
        loaded: false,
      });
    });

    it('marks loaded=true with notice for permanent conditions (short session)', () => {
      expect(
        resolveVoiceDashboardResult({
          success: true,
          metrics: null,
          notice: 'Sesi terlalu singkat (kurang dari 15 detik) untuk menghasilkan metrik suara.',
        })
      ).toEqual({
        metrics: null,
        notice: 'Sesi terlalu singkat (kurang dari 15 detik) untuk menghasilkan metrik suara.',
        error: undefined,
        loaded: true,
      });
    });

    it('marks loaded=false with error when success=false', () => {
      expect(
        resolveVoiceDashboardResult({
          success: false,
          error: 'Session not found',
        })
      ).toEqual({
        metrics: null,
        error: 'Session not found',
        loaded: false,
      });
    });
  });
});
