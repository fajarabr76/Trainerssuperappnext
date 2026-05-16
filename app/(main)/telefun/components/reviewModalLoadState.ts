import type { ReviewModalTab } from './ReviewModal';
import type { ReplayAnnotationResult } from '../services/realisticMode/types';
import type { VoiceDashboardMetrics } from '../services/realisticMode/types';

export function shouldAutoLoadReviewPanel({
  activeTab,
  panelTab,
  realisticModeEnabled,
  loaded,
  loading,
  error,
}: {
  activeTab: ReviewModalTab;
  panelTab: Extract<ReviewModalTab, 'voice_dashboard' | 'replay'>;
  realisticModeEnabled: boolean;
  loaded: boolean;
  loading: boolean;
  error?: string;
}): boolean {
  return realisticModeEnabled && activeTab === panelTab && !loaded && !loading && !error;
}

export function resolveReplayLoadResult({
  success,
  result,
  error,
}: {
  success: boolean;
  result?: ReplayAnnotationResult;
  error?: string;
}) {
  const hasResult = !!result;
  const isCompleteSuccess = success && hasResult;

  return {
    annotations: hasResult ? result.annotations : [],
    recommendations: hasResult ? result.summary : [],
    loaded: isCompleteSuccess,
    error: isCompleteSuccess ? undefined : (error || 'Gagal menghasilkan anotasi.'),
  };
}

export function resolveVoiceDashboardResult(result: {
  success: boolean;
  metrics?: VoiceDashboardMetrics | null;
  notice?: string;
  error?: string;
}): {
  metrics: VoiceDashboardMetrics | null;
  error: string | undefined;
  loaded: boolean;
  notice?: string;
} {
  if (!result.success) {
    return { metrics: null, error: result.error || 'Gagal memuat metrik suara.', loaded: false };
  }
  if (result.metrics) {
    return { metrics: result.metrics, error: undefined, loaded: true };
  }
  // metrics is null — check if notice is retryable
  if (result.notice?.includes('Silakan coba lagi')) {
    return { metrics: null, error: result.notice, loaded: false };
  }
  // Permanent notice (short session, no recording): acknowledge, no retry
  return { metrics: null, notice: result.notice, error: undefined, loaded: true };
}
