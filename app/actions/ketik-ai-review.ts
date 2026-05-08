'use server';

import { createAdminClient } from '@/app/lib/supabase/admin';
import { generateGeminiContent } from '@/app/actions/gemini';
import { SchemaType } from '@google/genai';

/**
 * Interface for the AI Review response from Gemini.
 * Matches the schema we'll ask Gemini to generate.
 */
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

/**
 * Schema for Gemini to ensure structured JSON output.
 */
const responseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    summary: { type: SchemaType.STRING },
    strengths: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    weaknesses: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    coachingFocus: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    scores: {
      type: SchemaType.OBJECT,
      properties: {
        final: { type: SchemaType.NUMBER },
        empathy: { type: SchemaType.NUMBER },
        probing: { type: SchemaType.NUMBER },
        typo: { type: SchemaType.NUMBER },
        compliance: { type: SchemaType.NUMBER },
      },
      required: ["final", "empathy", "probing", "typo", "compliance"]
    },
    typos: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          messageId: { type: SchemaType.STRING },
          originalWord: { type: SchemaType.STRING },
          correctedWord: { type: SchemaType.STRING },
          severity: { type: SchemaType.STRING, enum: ["minor", "medium", "critical"] },
        },
        required: ["messageId", "originalWord", "correctedWord", "severity"]
      }
    }
  },
  required: ["summary", "strengths", "weaknesses", "coachingFocus", "scores", "typos"]
};

/**
 * Triggers an asynchronous AI review for a KETIK session.
 * Evaluates the transcript and saves scores, summary, and typo findings to Supabase.
 */
export async function triggerKetikAIReview(sessionId: string) {
  const supabase = createAdminClient();

  // 1. Fetch Session History
  const { data: session, error: sessionError } = await supabase
    .from('ketik_history')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (sessionError || !session) {
    console.error(`[triggerKetikAIReview] Session not found: ${sessionId}`, sessionError);
    throw new Error('Session not found');
  }

  // 2. Prepare Transcript for AI
  const transcript = JSON.stringify(session.messages);

  const systemInstruction = `
    You are an expert Quality Assurance (QA) and Coaching AI for a customer service contact center.
    Review the customer service chat transcript between an Agent (user) and a Consumer (consumer).
    
    Evaluation Categories:
    - Communication (naturalness, empathy, readability, professionalism)
    - Probing (depth, relevance, chronology gathering)
    - Resolution (clarity, actionable response, completeness)
    - Compliance (no misinformation, no victim blaming, no rude wording)
    - Typo & Writing (typo frequency, readability)

    Rules for Typo Detection:
    - Ignore common Indonesian slang/informal words like 'yg', 'sy', 'kak', 'ga', 'gak', 'ok', 'oke'.
    - Identify formal typos that affect professionalism or readability.
    - Severity: 'minor' (small typo), 'medium' (repeated or confusing), 'critical' (changes meaning or unprofessional).
  `;

  try {
    // 3. Generate AI Content using centralized helper
    const aiResponse = await generateGeminiContent({
      model: "gemini-1.5-flash",
      systemInstruction,
      contents: [{ role: 'user', parts: [{ text: `Transcript:\n${transcript}` }] }],
      responseMimeType: "application/json",
      responseSchema: responseSchema as any,
      usageContext: "ketik-coaching-review",
      userId: session.user_id
    });

    if (!aiResponse.success || !aiResponse.text) {
      throw new Error(aiResponse.error || "AI Response failed or empty");
    }
    
    let reviewResult: AIReviewResponse;
    try {
      reviewResult = JSON.parse(aiResponse.text);
    } catch (parseError) {
      console.error("[triggerKetikAIReview] Failed to parse AI response JSON:", aiResponse.text);
      await supabase.from('ketik_history').update({ review_status: 'failed' }).eq('id', sessionId);
      return;
    }

    // 4. Update ketik_history with Scores
    const { error: updateError } = await supabase
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

    // 5. Insert AI Review Summary
    const { error: reviewInsertError } = await supabase
      .from('ketik_session_reviews')
      .insert({
        session_id: sessionId,
        ai_summary: reviewResult.summary,
        strengths: reviewResult.strengths,
        weaknesses: reviewResult.weaknesses,
        coaching_focus: reviewResult.coachingFocus
      });

    if (reviewInsertError) throw reviewInsertError;

    // 6. Insert Typo Findings if any
    if (reviewResult.typos && reviewResult.typos.length > 0) {
      const typoInserts = reviewResult.typos.map(t => ({
        session_id: sessionId,
        message_id: t.messageId,
        original_word: t.originalWord,
        corrected_word: t.correctedWord,
        severity: t.severity
      }));

      const { error: typoInsertError } = await supabase
        .from('ketik_typo_findings')
        .insert(typoInserts);

      if (typoInsertError) throw typoInsertError;
    }

    console.log(`[triggerKetikAIReview] AI Review completed successfully for session: ${sessionId}`);

  } catch (error) {
    console.error(`[triggerKetikAIReview] Error during AI Review for session: ${sessionId}`, error);
    await supabase.from('ketik_history').update({ review_status: 'failed' }).eq('id', sessionId);
  }
}
