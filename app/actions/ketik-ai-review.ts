'use server';

import { createAdminClient } from '@/app/lib/supabase/admin';
import { createClient } from '@/app/lib/supabase/server';
import { generateGeminiContent } from '@/app/actions/gemini';
import { normalizeModelId } from '@/app/lib/ai-models';
import { Type } from '@google/genai';

interface AIReviewResponse {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  coachingFocus: string[];
  scores: {
    final: number;
    empathy: number;
    probing: number;
    typo: number;
    compliance: number;
  };
  typos: Array<{
    messageId: string;
    originalWord: string;
    correctedWord: string;
    severity: 'minor' | 'medium' | 'critical';
  }>;
}

export type KetikAIReviewResult =
  | { status: 'completed' | 'skipped' | 'queued' | 'processing' }
  | { status: 'failed'; error: string };

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
    weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
    coachingFocus: { type: Type.ARRAY, items: { type: Type.STRING } },
    scores: {
      type: Type.OBJECT,
      properties: {
        final: { type: Type.NUMBER },
        empathy: { type: Type.NUMBER },
        probing: { type: Type.NUMBER },
        typo: { type: Type.NUMBER },
        compliance: { type: Type.NUMBER },
      },
      required: ["final", "empathy", "probing", "typo", "compliance"]
    },
    typos: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          messageId: { type: Type.STRING },
          originalWord: { type: Type.STRING },
          correctedWord: { type: Type.STRING },
          severity: { type: Type.STRING, enum: ["minor", "medium", "critical"] },
        },
        required: ["messageId", "originalWord", "correctedWord", "severity"]
      }
    }
  },
  required: ["summary", "strengths", "weaknesses", "coachingFocus", "scores", "typos"]
};

/**
 * Triggers an asynchronous AI review for a KETIK session.
 * Enqueues a job into ketik_review_jobs and lets the worker handle it.
 */
export async function triggerKetikAIReview(sessionId: string): Promise<KetikAIReviewResult> {
  let supabaseAdmin: ReturnType<typeof createAdminClient> | null = null;
  let canMarkFailed = false;

  try {
    supabaseAdmin = createAdminClient();
    const supabaseUser = await createClient();

    // 1. Ownership & Auth Check
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) throw new Error('Unauthorized');

    // 2. Fetch Session History and verify ownership
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('ketik_history')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (sessionError || !session) {
      console.error(`[triggerKetikAIReview] Session not found or unauthorized: ${sessionId}`);
      throw new Error('Session not found or unauthorized');
    }

    canMarkFailed = true;

    if (session.review_status === 'completed') {
      return { status: 'skipped' };
    }

    // Insert/refresh queued job
    const { error: jobError } = await supabaseAdmin
      .from('ketik_review_jobs')
      .upsert(
        {
          session_id: sessionId,
          status: 'queued',
          lease_owner: null,
          lease_expires_at: null,
          error_message: null,
        },
        { onConflict: 'session_id' }
      );

    if (jobError) throw jobError;
    
    await supabaseAdmin.from('ketik_history').update({ review_status: 'pending' }).eq('id', sessionId);

    return { status: 'queued' };

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown AI review error';
    console.error(`[triggerKetikAIReview] Error during AI Review trigger for session: ${sessionId}`, error);
    if (supabaseAdmin && canMarkFailed) {
      await supabaseAdmin.from('ketik_history').update({ review_status: 'failed' }).eq('id', sessionId);
    }
    return { status: 'failed', error: message };
  }
}

/**
 * Claims and processes a specific review job.
 * Used by both the immediate trigger and the background worker.
 */
export async function claimAndProcessKetikReviewJob(
  sessionId: string,
  workerId: string = 'system-auto'
): Promise<KetikAIReviewResult> {
  const supabaseAdmin = createAdminClient();

  // 1. Fetch the job to check if it's claimable
  const { data: job, error: jobError } = await supabaseAdmin
    .from('ketik_review_jobs')
    .select('id, attempt_count, status, lease_expires_at')
    .eq('session_id', sessionId)
    .maybeSingle();

  if (jobError) throw jobError;
  if (!job) throw new Error('Job not found');

  // If already completed, just return success
  if (job.status === 'completed') return { status: 'completed' };

  // If already processing and lease not expired, skip (someone else is working on it)
  if (
    job.status === 'processing' &&
    job.lease_expires_at &&
    new Date(job.lease_expires_at) > new Date()
  ) {
    return { status: 'processing' };
  }

  const nextAttempt = (job.attempt_count || 0) + 1;
  if (nextAttempt > 3) {
    await supabaseAdmin
      .from('ketik_review_jobs')
      .update({ status: 'failed', error_message: 'Max attempts reached' })
      .eq('id', job.id);
    await supabaseAdmin
      .from('ketik_history')
      .update({ review_status: 'failed' })
      .eq('id', sessionId);
    return { status: 'failed', error: 'Max attempts reached' };
  }

  // 2. Claim the job
  const leaseExpiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const { error: claimError } = await supabaseAdmin
    .from('ketik_review_jobs')
    .update({
      status: 'processing',
      lease_owner: workerId,
      lease_expires_at: leaseExpiresAt,
      attempt_count: nextAttempt,
      error_message: null,
    })
    .eq('id', job.id);

  if (claimError) throw claimError;

  // 3. Process the job
  try {
    return await processKetikReviewJob(sessionId);
  } catch (error) {
    const error_message = error instanceof Error ? error.message : 'Unknown processing error';
    await supabaseAdmin
      .from('ketik_review_jobs')
      .update({
        status: 'failed',
        error_message,
        lease_owner: null,
        lease_expires_at: null,
      })
      .eq('id', job.id);
    await supabaseAdmin
      .from('ketik_history')
      .update({ review_status: 'failed' })
      .eq('id', sessionId);
    return { status: 'failed', error: error_message };
  }
}

/**
 * Processes a review job synchronously.
 */
export async function processKetikReviewJob(sessionId: string): Promise<KetikAIReviewResult> {
  const supabaseAdmin = createAdminClient();
  
  // 1. Fetch ketik_history for messages
  const { data: session, error: sessionError } = await supabaseAdmin
    .from('ketik_history')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (sessionError || !session) {
    throw new Error('Session not found');
  }

  // 2. Prepare Transcript
  const transcript = JSON.stringify(session.messages);

  const systemInstruction = `
  You are an expert Quality Assurance (QA) and Coaching AI for a customer service contact center.
  Review the customer service chat transcript between an Agent (user) and a Consumer (consumer).
  
  Evaluation Categories (Skala 0-100):
  - Communication (naturalness, empathy, readability, professionalism)
  - Probing (depth, relevance, chronology gathering)
  - Resolution (clarity, actionable response, completeness)
  - Compliance (no misinformation, no victim blaming, no rude wording)
  - Typo & Writing (typo frequency, readability)

  Rubrik Penilaian (0-100):
  - 90-100: Sangat Baik (Excellent)
  - 75-89: Baik (Good)
  - 60-74: Cukup (Fair)
  - <60: Perlu Coaching (Needs Coaching)

  Rules for Typo Detection:
  - Ignore common Indonesian slang/informal words like 'yg', 'sy', 'kak', 'ga', 'gak', 'ok', 'oke'.
  - Identify formal typos that affect professionalism or readability.
  - Severity: 'minor' (small typo), 'medium' (repeated or confusing), 'critical' (changes meaning or unprofessional).

  IMPORTANT: ALL textual response (summary, strengths, weaknesses, coachingFocus) MUST be in Indonesian.
  `;

  // 3. Call AI
  const aiResponse = await generateGeminiContent({
    model: normalizeModelId('gemini-3.1-flash-lite'),
    systemInstruction,
    contents: [{ role: 'user', parts: [{ text: `Transcript:\n${transcript}` }] }],
    responseMimeType: "application/json",
    responseSchema: responseSchema as any,
    usageContext: { module: 'ketik', action: 'coaching_review' },
    userId: session.user_id
  });

  if (!aiResponse.success || !aiResponse.text) {
    throw new Error(aiResponse.error || "AI Response failed or empty");
  }
  
  let reviewResult: AIReviewResponse;
  try {
    reviewResult = JSON.parse(aiResponse.text);
    
    // 3.1. Clamping & Validation
    const clamp = (val: any) => {
      const num = Number(val);
      if (isNaN(num)) return 0;
      return Math.max(0, Math.min(100, Math.round(num)));
    };

    reviewResult.scores = {
      empathy: clamp(reviewResult.scores?.empathy),
      probing: clamp(reviewResult.scores?.probing),
      typo: clamp(reviewResult.scores?.typo),
      compliance: clamp(reviewResult.scores?.compliance),
      final: clamp(reviewResult.scores?.final),
    };

    // Calculate a safe final score if missing or 0
    const calculatedFinal = Math.round(
      (reviewResult.scores.empathy +
        reviewResult.scores.probing +
        reviewResult.scores.typo +
        reviewResult.scores.compliance) / 4
    );
    
    // If the model gave 0 but sub-scores are high, or if it's vastly different, prefer a consistent mean
    if (reviewResult.scores.final === 0 || Math.abs(reviewResult.scores.final - calculatedFinal) > 15) {
      reviewResult.scores.final = calculatedFinal;
    }

    // Default Indonesian fallbacks
    if (!reviewResult.summary) reviewResult.summary = "Ringkasan tidak tersedia.";
    if (!Array.isArray(reviewResult.strengths) || reviewResult.strengths.length === 0) reviewResult.strengths = ["Pertahankan profesionalisme dalam berkomunikasi."];
    if (!Array.isArray(reviewResult.weaknesses) || reviewResult.weaknesses.length === 0) reviewResult.weaknesses = ["Terus latih teknik probing dan empati."];
    if (!Array.isArray(reviewResult.coachingFocus) || reviewResult.coachingFocus.length === 0) reviewResult.coachingFocus = ["Fokus pada detail kebutuhan konsumen."];

    // Verify minimal shape
    if (
      !reviewResult ||
      typeof reviewResult !== 'object' ||
      !reviewResult.scores ||
      typeof reviewResult.scores.final !== 'number' ||
      typeof reviewResult.summary !== 'string'
    ) {
      throw new Error('Invalid AI response shape after normalization');
    }
  } catch (error) {
    console.error("[processKetikReviewJob] Failed to parse or normalize AI response:", error, aiResponse.text);
    throw new Error('AI response JSON tidak valid atau format tidak sesuai.');
  }

  // 4. Persist review rows FIRST to ketik_session_reviews and ketik_typo_findings
  await supabaseAdmin.from('ketik_session_reviews').delete().eq('session_id', sessionId);
  
  const { error: reviewInsertError } = await supabaseAdmin
    .from('ketik_session_reviews')
    .insert({
      session_id: sessionId,
      ai_summary: reviewResult.summary,
      strengths: reviewResult.strengths,
      weaknesses: reviewResult.weaknesses,
      coaching_focus: reviewResult.coachingFocus
    });

  if (reviewInsertError) throw reviewInsertError;

  await supabaseAdmin.from('ketik_typo_findings').delete().eq('session_id', sessionId);

  if (reviewResult.typos && reviewResult.typos.length > 0) {
    const typoInserts = reviewResult.typos.map(t => ({
      session_id: sessionId,
      message_id: t.messageId,
      original_word: t.originalWord,
      corrected_word: t.correctedWord,
      severity: t.severity
    }));

    const { error: typoInsertError } = await supabaseAdmin
      .from('ketik_typo_findings')
      .insert(typoInserts);

    if (typoInsertError) throw typoInsertError;
  }

  // 5. Update ketik_history scores + review_status='completed' LAST
  const { error: updateError } = await supabaseAdmin
    .from('ketik_history')
    .update({
      final_score: reviewResult.scores.final,
      empathy_score: reviewResult.scores.empathy,
      probing_score: reviewResult.scores.probing,
      typo_score: reviewResult.scores.typo,
      compliance_score: reviewResult.scores.compliance,
      review_status: 'completed'
    })
    .eq('id', sessionId);

  if (updateError) throw updateError;

  // 6. Update ketik_review_jobs.status='completed'
  const { error: jobUpdateError } = await supabaseAdmin
    .from('ketik_review_jobs')
    .update({ status: 'completed', lease_owner: null, lease_expires_at: null })
    .eq('session_id', sessionId);

  if (jobUpdateError) throw jobUpdateError;

  if (process.env.NODE_ENV === 'development') {
    console.log(`[processKetikReviewJob] AI Review completed successfully for session: ${sessionId}`);
  }
  return { status: 'completed' };
}
