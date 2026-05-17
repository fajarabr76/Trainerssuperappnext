import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ReviewModal } from '@/app/(main)/telefun/components/ReviewModal';
import { computeVoiceDashboardMetrics } from '@/app/actions/voiceDashboard';
import { generateReplayAnnotations } from '@/app/actions/replayAnnotation';

// Mock Server Actions
vi.mock('@/app/actions/voiceDashboard', () => ({
  computeVoiceDashboardMetrics: vi.fn(),
}));

vi.mock('@/app/actions/replayAnnotation', () => ({
  generateReplayAnnotations: vi.fn(),
  addManualAnnotation: vi.fn(),
}));

vi.mock('@/app/(main)/telefun/actions', () => ({
  getTelefunSignedUrl: vi.fn().mockResolvedValue({ success: true, signedUrl: 'https://example.com/signed-audio.webm' }),
}));

// Mock ResizeObserver for framer-motion/recharts
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('ReviewModal Integration', () => {
  const mockRecord = {
    id: 'test-session-1',
    scenarioTitle: 'Test Scenario',
    consumerName: 'John Doe',
    date: new Date().toISOString(),
    duration: 120,
    url: 'https://example.com/audio.webm',
    realisticModeEnabled: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles voice dashboard transient error and successful retry', async () => {
    const user = userEvent.setup();

    // 1. Initial Failure Mock
    vi.mocked(computeVoiceDashboardMetrics).mockResolvedValueOnce({
      success: true,
      metrics: null,
      notice: 'Gagal mengunduh rekaman audio. Silakan coba lagi.',
    });

    render(
      <ReviewModal
        isOpen={true}
        onClose={vi.fn()}
        record={mockRecord as any}
      />
    );

    // 2. Click Voice Evaluation Tab
    const voiceTab = screen.getByText(/Evaluasi Suara/i);
    await user.click(voiceTab);

    // 3. Assert Error State
    await waitFor(() => {
      expect(screen.getByText('Analisis Gagal')).toBeInTheDocument();
      expect(screen.getByText('Gagal mengunduh rekaman audio. Silakan coba lagi.')).toBeInTheDocument();
    });

    // 4. Setup Success Mock for Retry
    vi.mocked(computeVoiceDashboardMetrics).mockResolvedValueOnce({
      success: true,
      metrics: {
        speechClarity: 8,
        speakingSpeed: { wpm: 150, classification: 'normal' },
        speakingDominance: { ratio: 0.5, classification: 'balanced' },
      },
    });

    // 5. Click Retry Button
    const retryButton = screen.getByRole('button', { name: /Coba Lagi/i });
    await user.click(retryButton);

    // 6. Assert Success State (Dashboard Metrics Rendered)
    await waitFor(() => {
      expect(screen.queryByText('Analisis Gagal')).not.toBeInTheDocument();
      expect(screen.getByText('Kejelasan Bicara')).toBeInTheDocument();
      expect(screen.getByText('8.0/10')).toBeInTheDocument();
    });
  });

  it('preserves partial replay data while showing regeneration error, then recovers on retry', async () => {
    const user = userEvent.setup();

    // 1. Initial Partial Failure Mock
    vi.mocked(generateReplayAnnotations).mockResolvedValueOnce({
      success: false,
      error: 'Gagal mengunduh rekaman. Silakan coba lagi.',
      result: {
        annotations: [],
        summary: [{ text: 'This is a persisted recommendation', priority: 1 }],
      },
    } as any);

    render(
      <ReviewModal
        isOpen={true}
        onClose={vi.fn()}
        record={mockRecord as any}
      />
    );

    // 2. Click Replay Tab
    const replayTab = screen.getByText(/Anotasi Replay/i);
    await user.click(replayTab);

    // 3. Assert Partial State (Error + Recommendation shown)
    await waitFor(() => {
      // Error message is visible
      expect(screen.getByText('Gagal mengunduh rekaman. Silakan coba lagi.')).toBeInTheDocument();
      // Partial recommendation data is also visible!
      expect(screen.getByText('This is a persisted recommendation')).toBeInTheDocument();
    });

    // 4. Setup Full Success Mock for Retry
    vi.mocked(generateReplayAnnotations).mockResolvedValueOnce({
      success: true,
      result: {
        annotations: [{
          id: 'ann-1',
          timestampMs: 500,
          category: 'strength',
          moment: 'good_de_escalation',
          text: 'AI detected strong empathy',
          isManual: false,
          createdBy: 'system'
        }],
        summary: [{ text: 'This is a persisted recommendation', priority: 1 }],
      },
    } as any);

    // 5. Click Retry Button
    const retryButton = screen.getByRole('button', { name: /Coba Lagi/i });
    await user.click(retryButton);

    // 6. Assert Full Success State
    await waitFor(() => {
      expect(screen.queryByText('Gagal mengunduh rekaman. Silakan coba lagi.')).not.toBeInTheDocument();
      expect(screen.getByText('This is a persisted recommendation')).toBeInTheDocument();
      expect(screen.getByText('AI detected strong empathy')).toBeInTheDocument();
    });
  });
});
