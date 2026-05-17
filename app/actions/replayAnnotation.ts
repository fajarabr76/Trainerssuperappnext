'use server';

import { createClient } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { generateGeminiContent } from '@/app/actions/gemini';
import { Type } from '@google/genai';
import { VOICE_ASSESSMENT_MODEL } from '@/app/lib/ai-models';
import { isValidRecordingPath } from '@/app/(main)/telefun/recordingPath';
import { runWithVoiceAssessmentTimeout } from '@/app/actions/voiceAssessmentTimeout';
import {
  MAX_MANUAL_ANNOTATION_CHARS,
  truncateAnnotationsByPriority,
  validateRecommendations,
  isValidAnnotation,
  isValidManualAnnotationText,
  createReplayAnnotationChecksum,
  hasCompleteAiAnnotationSet,
} from './replayAnnotationHelpers';
import type {
  AnnotationCategory,
  AnnotationMoment,
  ReplayAnnotation,
  ReplayAnnotationResult,
  CoachingRecommendation,
} from '@/app/(main)/telefun/services/realisticMode/types';

const MAX_RETRIES = 3;

// ---------------------------------------------------------------------------
// Gemini response schema
// ---------------------------------------------------------------------------

const REPLAY_ANNOTATION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    annotations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          timestampMs: { type: Type.NUMBER, description: 'Position in recording (milliseconds)' },
          category: {
            type: Type.STRING,
            description: 'One of: strength, improvement_area, critical_moment, technique_used',
          },
          moment: {
            type: Type.STRING,
            description: 'One of: missed_empathy, good_de_escalation, long_pause, interruption, technique_usage',
          },
          text: { type: Type.STRING, description: 'Annotation description (max 500 chars)' },
        },
        required: ['timestampMs', 'category', 'moment', 'text'],
      },
    },
    recommendations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING, description: 'Coaching recommendation (max 200 chars)' },
          priority: { type: Type.NUMBER, description: 'Priority 1-5 (1 = highest)' },
        },
        required: ['text', 'priority'],
      },
    },
  },
  required: ['annotations', 'recommendations'],
};

// ---------------------------------------------------------------------------
// Main server action: generateReplayAnnotations
// ---------------------------------------------------------------------------

export async function generateReplayAnnotations(
  sessionId: string
): Promise<{ success: boolean; result?: ReplayAnnotationResult; error?: string }> {
  // 1. Authenticate user
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Auth required' };

  // 2. Fetch session and validate ownership
  const admin = createAdminClient();
  const { data: row, error: fetchError } = await admin
    .from('telefun_history')
    .select('id, user_id, scenario_title, recording_path, session_metrics')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single();

  if (fetchError || !row) {
    return { success: false, error: 'Session not found' };
  }

  // 3. Return persisted replay data first to avoid duplicate generation
  const { data: existingAnnotations, error: replayError } = await admin
    .from('telefun_replay_annotations')
    .select('id, session_id, user_id, timestamp_ms, category, moment, text, is_manual, created_at')
    .eq('session_id', sessionId)
    .eq('user_id', user.id);

  if (replayError) {
    console.error('[ReplayAnnotator] Failed to read persisted annotations:', replayError);
    return { success: false, error: 'Gagal membaca data anotasi. Silakan coba lagi.' };
  }

  const { data: existingSummary, error: summaryReadError } = await admin
    .from('telefun_coaching_summary')
    .select('id, recommendations, ai_annotation_count, ai_annotation_checksum')
    .eq('session_id', sessionId)
    .maybeSingle();

  if (summaryReadError) {
    console.error('[ReplayAnnotator] Failed to read coaching summary:', summaryReadError);
    return { success: false, error: 'Gagal membaca data rekomendasi. Silakan coba lagi.' };
  }

  const allPersistedAnnotations = (existingAnnotations ?? []).map((a) => ({
    id: a.id,
    timestampMs: a.timestamp_ms,
    category: a.category as AnnotationCategory,
    moment: a.moment as AnnotationMoment,
    text: a.text,
    isManual: a.is_manual,
  }));
  const persistedSummary = Array.isArray(existingSummary?.recommendations)
    ? (existingSummary.recommendations as CoachingRecommendation[])
    : null;

  // Separate AI-generated from manual annotations for recovery logic
  const aiAnnotations = allPersistedAnnotations.filter((a) => !a.isManual);
  const manualAnnotations = allPersistedAnnotations.filter((a) => a.isManual);

  const replayCompletionMetadata = {
    aiAnnotationCount:
      typeof existingSummary?.ai_annotation_count === 'number' ? existingSummary.ai_annotation_count : null,
    aiAnnotationChecksum:
      typeof existingSummary?.ai_annotation_checksum === 'string' ? existingSummary.ai_annotation_checksum : null,
  };
  const hasPersistedSummary = persistedSummary !== null;
  const hasCompletePersistedAIAnnotations =
    hasPersistedSummary && hasCompleteAiAnnotationSet(allPersistedAnnotations, replayCompletionMetadata);
  const hasAnyPersistedData = allPersistedAnnotations.length > 0 || hasPersistedSummary;

  // Only short-circuit when BOTH AI annotations and summary are complete
  if (hasCompletePersistedAIAnnotations) {
    return { success: true, result: { annotations: allPersistedAnnotations, summary: persistedSummary } };
  }

  // 4. Check recording availability
  const recordingPath = row.recording_path as string | null;

  // If we have persisted AI annotations, fall back to them when regeneration is impossible
  const fallbackOnRegenFailure = (regenError: string) => {
    if (hasAnyPersistedData) {
      console.warn('[ReplayAnnotator] Regeneration failed, returning persisted data:', regenError);
      return {
        success: false as const,
        error: regenError,
        result: { annotations: allPersistedAnnotations, summary: persistedSummary ?? [] },
      };
    }
    return { success: false as const, error: regenError };
  };

  if (!recordingPath) {
    return fallbackOnRegenFailure('Rekaman sesi tidak tersedia untuk anotasi.');
  }

  // Validate path ownership
  if (!isValidRecordingPath(recordingPath, user.id, sessionId, 'full_call')) {
    return fallbackOnRegenFailure('Invalid recording path for this session');
  }

  // 5. Download recording from Supabase storage
  const { data: audioData, error: downloadError } = await admin.storage
    .from('telefun-recordings')
    .download(recordingPath);

  if (downloadError || !audioData) {
    return fallbackOnRegenFailure('Gagal mengunduh rekaman. Silakan coba lagi.');
  }

  const base64Audio = Buffer.from(await audioData.arrayBuffer()).toString('base64');

  // 6. Call Gemini with retry on invalid JSON (exponential backoff)
  const prompt = `
    Analisis rekaman percakapan simulasi telemarketing/customer service berikut.
    Skenario: ${row.scenario_title ?? 'Simulasi Telefun'}
    
    Identifikasi momen-momen penting dalam percakapan dan berikan anotasi serta rekomendasi coaching.
    
    ATURAN ANOTASI:
    1. Berikan maksimal 30 anotasi.
    2. Setiap anotasi harus memiliki:
       - timestampMs: posisi dalam rekaman (milidetik)
       - category: salah satu dari "strength", "improvement_area", "critical_moment", "technique_used"
       - moment: salah satu dari "missed_empathy", "good_de_escalation", "long_pause", "interruption", "technique_usage"
       - text: deskripsi singkat dalam Bahasa Indonesia (maksimal 500 karakter)
    3. Prioritaskan momen kritis dan area perbaikan.
    
    ATURAN REKOMENDASI:
    1. Berikan maksimal 5 rekomendasi coaching.
    2. Setiap rekomendasi harus:
       - text: saran singkat dalam Bahasa Indonesia (maksimal 200 karakter)
       - priority: angka 1-5 (1 = paling penting)
    3. Fokus pada saran yang actionable dan spesifik.
    
    SEMUA teks WAJIB dalam Bahasa Indonesia.
  `;

  let lastError: string | undefined;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    // Exponential backoff: 0ms, 1000ms, 2000ms
    if (attempt > 0) {
      const delay = Math.pow(2, attempt - 1) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    let response: Awaited<ReturnType<typeof generateGeminiContent>> | undefined;
    let attemptError: string | undefined;

    try {
      response = await runWithVoiceAssessmentTimeout(signal =>
        generateGeminiContent({
          model: VOICE_ASSESSMENT_MODEL,
          systemInstruction:
            'Anda adalah pelatih komunikasi profesional yang menganalisis rekaman percakapan telemarketing. Berikan anotasi dan rekomendasi coaching dalam Bahasa Indonesia. Respons dalam format JSON.',
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
          responseSchema: REPLAY_ANNOTATION_SCHEMA as any,
          usageContext: { module: 'telefun', action: 'replay_annotation' },
          abortSignal: signal,
        })
      );
    } catch (err) {
      attemptError = err instanceof Error ? err.message : 'Gemini analysis failed';
    }

    if (response?.success && response.text) {
      try {
        const parsed = JSON.parse(response.text) as {
          annotations?: Array<{
            timestampMs?: number;
            category?: string;
            moment?: string;
            text?: string;
          }>;
          recommendations?: Array<{
            text?: string;
            priority?: number;
          }>;
        };

        // Validate structure
        if (!Array.isArray(parsed.annotations) || !Array.isArray(parsed.recommendations)) {
          lastError = 'Invalid JSON structure from Gemini';
          console.warn(`[ReplayAnnotator] Invalid JSON structure (attempt ${attempt + 1}/${MAX_RETRIES})`);
          continue; // Retry on invalid JSON
        }

        // Filter valid annotations
        const validAnnotations: ReplayAnnotation[] = parsed.annotations
          .filter(isValidAnnotation)
          .map((ann) => ({
            id: crypto.randomUUID(),
            timestampMs: ann.timestampMs!,
            category: ann.category as AnnotationCategory,
            moment: ann.moment as AnnotationMoment,
            text: ann.text!.slice(0, MAX_MANUAL_ANNOTATION_CHARS),
            isManual: false,
          }));

        // Truncate by priority if exceeds max
        const truncatedAnnotations = truncateAnnotationsByPriority(validAnnotations);

        // Validate recommendations
        const validRecommendations: CoachingRecommendation[] = parsed.recommendations
          .filter((rec) => rec.text && typeof rec.text === 'string' && typeof rec.priority === 'number')
          .map((rec) => ({
            text: rec.text!,
            priority: rec.priority!,
          }));

        const constrainedRecommendations = validateRecommendations(validRecommendations);

        const finalAnnotations = [...manualAnnotations, ...truncatedAnnotations];
        const finalSummary = constrainedRecommendations;
        const aiCompletionChecksum = createReplayAnnotationChecksum(truncatedAnnotations);
        let aiPersistenceComplete = false;
        let persistenceFailed = false;

        // 6. Delete stale non-manual rows when they exist
        if (aiAnnotations.length > 0) {
          const { error: deleteError } = await admin
            .from('telefun_replay_annotations')
            .delete()
            .eq('session_id', sessionId)
            .eq('user_id', user.id)
            .eq('is_manual', false);

          if (deleteError) {
            console.warn('[ReplayAnnotator] Failed to delete stale AI annotations:', deleteError);
            persistenceFailed = true;
          }
        }

        // 7. Persist regenerated annotations to telefun_replay_annotations
        if (!persistenceFailed && truncatedAnnotations.length > 0) {
          const annotationRows = truncatedAnnotations.map((ann) => ({
            session_id: sessionId,
            user_id: user.id,
            timestamp_ms: ann.timestampMs,
            category: ann.category,
            moment: ann.moment,
            text: ann.text,
            is_manual: false,
          }));

          const { error: insertError } = await admin
            .from('telefun_replay_annotations')
            .insert(annotationRows);

          if (insertError) {
            console.warn('[ReplayAnnotator] Failed to persist annotations:', insertError);
            persistenceFailed = true;
          } else {
            aiPersistenceComplete = true;
          }
        } else if (!persistenceFailed && truncatedAnnotations.length === 0) {
          aiPersistenceComplete = true;
        }

        // 8. Persist recommendations via upsert_telefun_coaching_summary RPC
        const { error: rpcError } = await admin.rpc('upsert_telefun_coaching_summary', {
          p_session_id: sessionId,
          p_recommendations: constrainedRecommendations,
          p_ai_annotation_count: aiPersistenceComplete ? truncatedAnnotations.length : null,
          p_ai_annotation_checksum: aiPersistenceComplete ? aiCompletionChecksum : null,
        });

        if (rpcError) {
          console.warn('[ReplayAnnotator] Failed to persist coaching summary:', rpcError);
          persistenceFailed = true;
        }

        // 9. Return result
        const result: ReplayAnnotationResult = {
          annotations: finalAnnotations,
          summary: finalSummary,
        };

        if (persistenceFailed) {
          return {
            success: false,
            error: 'Sebagian hasil analisis gagal disimpan. Silakan coba lagi.',
            result,
          };
        }

        return { success: true, result };
      } catch (err) {
        // JSON parse error - retry with backoff
        lastError = 'Invalid JSON response from Gemini';
        console.warn(
          `[ReplayAnnotator] JSON parse error (attempt ${attempt + 1}/${MAX_RETRIES}):`,
          err
        );
        continue;
      }
    }

    // Handle transient errors
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
      `[ReplayAnnotator] Transient error (attempt ${attempt + 1}/${MAX_RETRIES}):`,
      lastError
    );
  }

  return fallbackOnRegenFailure(lastError || 'Gagal menghasilkan anotasi. Silakan coba lagi.');
}

// ---------------------------------------------------------------------------
// Server action: addManualAnnotation
// ---------------------------------------------------------------------------

export async function addManualAnnotation(
  sessionId: string,
  annotation: Omit<ReplayAnnotation, 'id' | 'isManual' | 'createdBy'>
): Promise<{ success: boolean; error?: string }> {
  // 1. Authenticate user
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Auth required' };

  // 2. Validate annotation text length (max 500 chars)
  if (!isValidManualAnnotationText(annotation.text)) {
    return {
      success: false,
      error: `Teks anotasi harus antara 1-${MAX_MANUAL_ANNOTATION_CHARS} karakter.`,
    };
  }

  // 3. Validate annotation fields
  if (!isValidAnnotation(annotation)) {
    return {
      success: false,
      error: 'Data anotasi tidak valid. Periksa kategori, momen, dan timestamp.',
    };
  }

  // 4. Validate session ownership
  const admin = createAdminClient();
  const { data: row, error: fetchError } = await admin
    .from('telefun_history')
    .select('id, user_id')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single();

  if (fetchError || !row) {
    return { success: false, error: 'Session not found' };
  }

  // 5. Insert manual annotation
  const { error: insertError } = await admin
    .from('telefun_replay_annotations')
    .insert({
      session_id: sessionId,
      user_id: user.id,
      timestamp_ms: annotation.timestampMs,
      category: annotation.category,
      moment: annotation.moment,
      text: annotation.text,
      is_manual: true,
    });

  if (insertError) {
    console.error('[ReplayAnnotator] Failed to insert manual annotation:', insertError);
    return { success: false, error: 'Gagal menyimpan anotasi. Silakan coba lagi.' };
  }

  return { success: true };
}
