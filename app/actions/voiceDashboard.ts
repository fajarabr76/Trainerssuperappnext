'use server';

import { createClient } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { generateGeminiContent } from '@/app/actions/gemini';
import { Type } from '@google/genai';
import { VOICE_ASSESSMENT_MODEL } from '@/app/lib/ai-models';
import { isValidRecordingPath } from '@/app/(main)/telefun/recordingPath';
import { runWithVoiceAssessmentTimeout } from '@/app/actions/voiceAssessmentTimeout';
import type {
  VoiceDashboardMetrics,
  SpeakingSpeedClassification,
  SpeakingDominanceClassification,
} from '@/app/(main)/telefun/services/realisticMode/types';

// ---------------------------------------------------------------------------
// Exported helper functions (for testing)
// ---------------------------------------------------------------------------

/**
 * Computes WPM using active speaking time, with fallback to session duration.
 * - Uses totalSpeakingMs when available (> 0) for accurate active-speaking WPM
 * - Falls back to sessionDurationMs when totalSpeakingMs is missing or 0
 */
export async function computeWpm(
  estimatedWordCount: number,
  totalSpeakingMs: number,
  sessionDurationMs: number
): Promise<number> {
  const effectiveSpeakingMs = totalSpeakingMs > 0 ? totalSpeakingMs : sessionDurationMs;
  const effectiveSpeakingMinutes = effectiveSpeakingMs / 60000;
  return effectiveSpeakingMinutes > 0
    ? Math.round(estimatedWordCount / effectiveSpeakingMinutes)
    : 0;
}

/**
 * Classifies speaking speed based on WPM thresholds.
 * - < 120 WPM → too_slow
 * - 120-160 WPM → normal
 * - > 160 WPM → too_fast
 */
export async function classifySpeakingSpeed(wpm: number): Promise<SpeakingSpeedClassification> {
  if (wpm < 120) return 'too_slow';
  if (wpm > 160) return 'too_fast';
  return 'normal';
}

/**
 * Classifies speaking dominance based on ratio thresholds.
 * - < 0.4 → passive
 * - 0.4-0.7 → balanced
 * - > 0.7 → dominated
 */
export async function classifySpeakingDominance(ratio: number): Promise<SpeakingDominanceClassification> {
  if (ratio < 0.4) return 'passive';
  if (ratio > 0.7) return 'dominated';
  return 'balanced';
}

// ---------------------------------------------------------------------------
// Gemini response schema for speech clarity analysis
// ---------------------------------------------------------------------------

const VOICE_DASHBOARD_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    speechClarity: {
      type: Type.NUMBER,
      description: 'Speech clarity score from 0 to 10',
    },
    estimatedWordCount: {
      type: Type.NUMBER,
      description: 'Estimated total word count spoken by the agent',
    },
    intonationVariability: {
      type: Type.NUMBER,
      description: 'Intonation variability score from 0 to 10 (optional)',
    },
  },
  required: ['speechClarity', 'estimatedWordCount'],
};

// ---------------------------------------------------------------------------
// Minimum session duration threshold (seconds)
// ---------------------------------------------------------------------------

const MIN_SESSION_DURATION_S = 15;

// ---------------------------------------------------------------------------
// Main server action
// ---------------------------------------------------------------------------

export interface VoiceDashboardResult {
  success: boolean;
  metrics?: VoiceDashboardMetrics | null;
  notice?: string;
  error?: string;
}

/**
 * Computes voice dashboard metrics for a given Telefun session.
 *
 * Follows the existing `analyzeVoiceQuality` pattern:
 * 1. Authenticate user
 * 2. Fetch session row (validate ownership)
 * 3. Return cached metrics if available
 * 4. Check edge cases (session < 15s, audio unavailable)
 * 5. Download agent-only audio
 * 6. Call Gemini for speech clarity + word count estimation
 * 7. Compute WPM, dominance ratio, and classifications
 * 8. Persist to `telefun_history.voice_dashboard_metrics`
 * 9. Return metrics
 */
export async function computeVoiceDashboardMetrics(
  sessionId: string
): Promise<VoiceDashboardResult> {
  // 1. Authenticate
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Auth required' };

  // 2. Fetch session with ownership validation
  const admin = createAdminClient();
  const { data: row, error: fetchError } = await admin
    .from('telefun_history')
    .select(
      'id, user_id, agent_recording_path, session_metrics, voice_dashboard_metrics, session_duration_ms'
    )
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single();

  if (fetchError || !row) {
    return { success: false, error: 'Session not found' };
  }

  // 3. Return cached metrics if available
  if (row.voice_dashboard_metrics) {
    const cached = row.voice_dashboard_metrics as VoiceDashboardMetrics;
    if (cached && typeof cached.speechClarity === 'number') {
      return { success: true, metrics: cached };
    }
  }

  // 4. Edge case: session duration < 15s
  const sessionDurationMs = row.session_duration_ms
    ?? (row.session_metrics as { sessionDurationMs?: number } | null)?.sessionDurationMs
    ?? 0;

  if (sessionDurationMs < MIN_SESSION_DURATION_S * 1000) {
    return {
      success: true,
      metrics: null,
      notice: 'Sesi terlalu singkat (kurang dari 15 detik) untuk menghasilkan metrik suara.',
    };
  }

  // 5. Check audio availability
  const agentPath = row.agent_recording_path as string | null;
  if (!agentPath) {
    return {
      success: true,
      metrics: null,
      notice: 'Rekaman audio agen tidak tersedia untuk sesi ini.',
    };
  }

  // Validate path ownership
  if (!isValidRecordingPath(agentPath, user.id, sessionId, 'agent_only')) {
    return { success: false, error: 'Invalid recording path for this session' };
  }

  // 6. Download agent-only audio
  const { data: audioData, error: downloadError } = await admin.storage
    .from('telefun-recordings')
    .download(agentPath);

  if (downloadError || !audioData) {
    return {
      success: true,
      metrics: null,
      notice: 'Gagal mengunduh rekaman audio. Silakan coba lagi.',
    };
  }

  const base64Audio = Buffer.from(await audioData.arrayBuffer()).toString('base64');

  // 7. Call Gemini for speech clarity + word count + intonation
  const prompt = `
    Analisis rekaman audio agen berikut dari simulasi telemarketing/customer service.
    
    Evaluasi dan berikan:
    1. speechClarity (0-10): Seberapa jelas pengucapan kata-kata agen. 0 = sangat tidak jelas, 10 = sangat jelas.
    2. estimatedWordCount: Perkiraan jumlah total kata yang diucapkan agen dalam rekaman ini.
    3. intonationVariability (0-10): Seberapa bervariasi intonasi agen. 0 = sangat monoton, 10 = sangat ekspresif dan bervariasi.
    
    ATURAN:
    - Nilai speechClarity harus berdasarkan kejelasan artikulasi, bukan isi konten.
    - estimatedWordCount harus perkiraan realistis berdasarkan durasi dan kecepatan bicara.
    - intonationVariability mengukur variasi nada, bukan volume.
  `;

  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [0, 1000, 2000];
  let lastError: string | undefined;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]));
    }

    let response: Awaited<ReturnType<typeof generateGeminiContent>> | undefined;
    let attemptError: string | undefined;

    try {
      response = await runWithVoiceAssessmentTimeout(signal =>
        generateGeminiContent({
          model: VOICE_ASSESSMENT_MODEL,
          systemInstruction:
            'Anda adalah analis wicara profesional. Berikan penilaian objektif berdasarkan audio yang diberikan. Respons dalam format JSON.',
          contents: [
            {
              role: 'user',
              parts: [
                { text: prompt },
                { inlineData: { mimeType: 'audio/webm', data: base64Audio } },
              ],
            },
          ],
          responseMimeType: 'application/json',
          responseSchema: VOICE_DASHBOARD_SCHEMA as any,
          usageContext: { module: 'telefun', action: 'voice_dashboard' },
          abortSignal: signal,
        })
      );
    } catch (err) {
      attemptError = err instanceof Error ? err.message : 'Gemini analysis failed';
    }

    if (response?.success && response.text) {
      try {
        const parsed = JSON.parse(response.text) as {
          speechClarity?: number;
          estimatedWordCount?: number;
          intonationVariability?: number;
        };

        // Validate parsed values
        const speechClarity = typeof parsed.speechClarity === 'number'
          ? Math.max(0, Math.min(10, parsed.speechClarity))
          : null;
        const estimatedWordCount = typeof parsed.estimatedWordCount === 'number'
          ? Math.max(0, Math.round(parsed.estimatedWordCount))
          : null;

        if (speechClarity === null || estimatedWordCount === null) {
          console.warn('[VoiceDashboard] Invalid Gemini response payload', {
            sessionId,
            userId: user.id,
            attempt,
          });
          return {
            success: false,
            error: 'Format hasil analisis tidak valid. Silakan coba lagi.',
          };
        }

        // 8. Compute WPM using active speaking time
        const sessionMetrics = row.session_metrics as {
          totalSpeakingMs?: number;
          sessionDurationMs?: number;
        } | null;

        const totalSpeakingMs = sessionMetrics?.totalSpeakingMs ?? 0;
        const wpm = await computeWpm(estimatedWordCount, totalSpeakingMs, sessionDurationMs);

        // 9. Compute speaking dominance ratio
        const effectiveSessionDurationMs = sessionMetrics?.sessionDurationMs ?? sessionDurationMs;
        const dominanceRatio = effectiveSessionDurationMs > 0
          ? Math.min(1, Math.max(0, totalSpeakingMs / effectiveSessionDurationMs))
          : 0;

        // 10. Build metrics object
        const metrics: VoiceDashboardMetrics = {
          speechClarity,
          speakingSpeed: {
            wpm,
            classification: await classifySpeakingSpeed(wpm),
          },
          speakingDominance: {
            ratio: Math.round(dominanceRatio * 100) / 100,
            classification: await classifySpeakingDominance(dominanceRatio),
          },
        };

        // Optional intonation variability
        if (typeof parsed.intonationVariability === 'number') {
          metrics.intonationVariability = Math.max(
            0,
            Math.min(10, parsed.intonationVariability)
          );
        }

        // 11. Persist to database
        const { error: saveError } = await admin
          .from('telefun_history')
          .update({ voice_dashboard_metrics: metrics })
          .eq('id', sessionId)
          .eq('user_id', user.id);

        if (saveError) {
          console.warn('[VoiceDashboard] Failed to persist metrics:', saveError);
          // Still return metrics even if persistence fails
        }

        return { success: true, metrics };
      } catch (err) {
        console.error('[VoiceDashboard] Parse error:', err);
        return {
          success: false,
          error: 'Format hasil analisis tidak valid. Silakan coba lagi.',
        };
      }
    }

    // Retry on transient errors only
    attemptError = attemptError || response?.error || 'Gemini analysis failed';
    lastError = attemptError;
    const errLower = lastError.toLowerCase();
    const isTransient =
      errLower.includes('429') ||
      errLower.includes('500') ||
      errLower.includes('502') ||
      errLower.includes('503') ||
      errLower.includes('504') ||
      errLower.includes('econnreset') ||
      errLower.includes('econnrefused') ||
      errLower.includes('etimedout') ||
      errLower.includes('timeout') ||
      errLower.includes('fetch failed');

    if (!isTransient) break;

    console.warn(
      `[VoiceDashboard] Transient error (attempt ${attempt + 1}/${MAX_RETRIES}):`,
      lastError
    );
  }

  return {
    success: false,
    error: lastError || 'Analisis suara gagal. Silakan coba lagi.',
  };
}
