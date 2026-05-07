'use server';

import { createClient } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { generateGeminiContent } from '@/app/actions/gemini';
import { Type } from '@google/genai';
import { VoiceQualityAssessment } from '@/app/types/voiceAssessment';
import { VOICE_ASSESSMENT_MODEL } from '@/app/lib/ai-models';
import { validateAssessment } from '@/app/lib/voiceAssessmentUtils';

const VOICE_ASSESSMENT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    overallScore: { type: Type.NUMBER },
    speakingRate: {
      type: Type.OBJECT,
      properties: {
        score: { type: Type.NUMBER },
        wordsPerMinute: { type: Type.NUMBER },
        verdict: { type: Type.STRING },
        feedback: { type: Type.STRING }
      },
      required: ['score', 'wordsPerMinute', 'verdict', 'feedback']
    },
    intonation: {
      type: Type.OBJECT,
      properties: {
        score: { type: Type.NUMBER },
        verdict: { type: Type.STRING },
        feedback: { type: Type.STRING }
      },
      required: ['score', 'verdict', 'feedback']
    },
    articulation: {
      type: Type.OBJECT,
      properties: {
        score: { type: Type.NUMBER },
        verdict: { type: Type.STRING },
        feedback: { type: Type.STRING }
      },
      required: ['score', 'verdict', 'feedback']
    },
    fillerWords: {
      type: Type.OBJECT,
      properties: {
        score: { type: Type.NUMBER },
        count: { type: Type.NUMBER },
        examples: { type: Type.ARRAY, items: { type: Type.STRING } },
        verdict: { type: Type.STRING },
        feedback: { type: Type.STRING }
      },
      required: ['score', 'count', 'examples', 'verdict', 'feedback']
    },
    emotionalTone: {
      type: Type.OBJECT,
      properties: {
        score: { type: Type.NUMBER },
        dominant: { type: Type.STRING },
        verdict: { type: Type.STRING },
        feedback: { type: Type.STRING }
      },
      required: ['score', 'dominant', 'verdict', 'feedback']
    },
    transcript: { type: Type.STRING },
    highlights: { type: Type.ARRAY, items: { type: Type.STRING } },
    strengths: { type: Type.ARRAY, items: { type: Type.STRING } }
  },
  required: [
    'overallScore', 'speakingRate', 'intonation', 'articulation', 
    'fillerWords', 'emotionalTone', 'transcript', 'highlights', 'strengths'
  ]
};

export async function analyzeVoiceQuality(sessionId: string): Promise<{ 
  success: boolean; 
  assessment?: VoiceQualityAssessment; 
  error?: string 
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Auth required' };

  // 1. Fetch paths using Admin Client to ensure we can read private columns
  const admin = createAdminClient();
  const { data: row, error: fetchError } = await admin.from('telefun_history')
    .select('id, user_id, scenario_title, agent_recording_path, voice_assessment')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single();

  if (fetchError || !row) return { success: false, error: 'Session not found' };

  // 2. Return cached if exists
  if (row.voice_assessment) {
    const cachedAssessment = validateAssessment(row.voice_assessment);
    if (cachedAssessment) {
      return { success: true, assessment: cachedAssessment };
    }

    console.warn('[Telefun] Cached voice assessment invalid, re-analyzing', {
      sessionId,
      userId: user.id,
    });
  }

  if (!row.agent_recording_path) {
    return { success: false, error: 'No agent audio available for assessment' };
  }

  // 3. Get audio from storage
  const { data: audioData, error: downloadError } = await admin.storage
    .from('telefun-recordings')
    .download(row.agent_recording_path);

  if (downloadError || !audioData) {
    return { success: false, error: 'Failed to download audio: ' + downloadError?.message };
  }

  const base64Audio = Buffer.from(await audioData.arrayBuffer()).toString('base64');

  // 4. Call Gemini
  const prompt = `
    Lakukan analisis pada kualitas suara agen dalam simulasi telemarketing/customer service berikut.
    Skenario: ${row.scenario_title}
    
    Evaluasi berdasarkan:
    1. Kecepatan Bicara (Speaking Rate): Idealnya 130-150 WPM.
    2. Intonasi: Variasi nada, antusiasme vs monoton.
    3. Artikulasi: Kejelasan kata, bergumam vs pengucapan jelas.
    4. Kata Pengisi (Filler Words): "hm", "anu", "gitu", "eeeh", dll.
    5. Nada Emosional (Emotional Tone): Empati, kesabaran, rasa percaya diri.
    
    Berikan transkrip lengkap dan poin-poin penting (highlights).
    ATURAN WAJIB:
    1. SEMUA teks, ulasan (verdict), umpan balik (feedback), poin penting, dan kelebihan WAJIB MENGGUNAKAN BAHASA INDONESIA. Jangan gunakan bahasa Inggris.
    2. Sifat ulasan harus KRITIS dengan rasio 50% kritik konstruktif dan 50% apresiasi. Beritahu agen secara tegas apa saja yang masih kurang dan bagaimana cara memperbaikinya.
    3. Semua field nilai (overallScore dan setiap skor aspek) HARUS berada di kisaran 0-10.
    4. Nilai 0 berarti sangat buruk, 10 berarti sangat luar biasa. Jangan ragu untuk memberi skor sedang/rendah jika memang banyak ruang untuk perbaikan.
  `;

  const response = await generateGeminiContent({
    model: VOICE_ASSESSMENT_MODEL,
    systemInstruction: 'Anda adalah pelatih vokal profesional dan analis wicara yang tegas dan objektif. Semua balasan WAJIB sepenuhnya dalam Bahasa Indonesia.',
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType: 'audio/webm', data: base64Audio } }
        ]
      }
    ],
    responseMimeType: 'application/json',
    responseSchema: VOICE_ASSESSMENT_SCHEMA as any,
    usageContext: { module: 'telefun', action: 'voice_assessment' }
  });

  if (!response.success || !response.text) {
    return { success: false, error: response.error || 'Gemini assessment failed' };
  }

  try {
    const rawAssessment = JSON.parse(response.text);
    const assessment = validateAssessment(rawAssessment);

    if (!assessment) {
      console.warn('[Telefun] Invalid assessment payload from model', {
        sessionId,
        userId: user.id,
      });
      return { success: false, error: 'Format hasil analisis tidak valid. Silakan coba lagi.' };
    }

    // 5. Save to DB
    const { error: saveError } = await admin.from('telefun_history')
      .update({ voice_assessment: assessment })
      .eq('id', sessionId)
      .eq('user_id', user.id);

    if (saveError) {
      console.warn('[Telefun] Failed to save assessment to DB:', saveError);
    }

    return { success: true, assessment };
  } catch (err) {
    console.error('[Telefun] Parse error for assessment:', err, response.text);
    return { success: false, error: 'Format hasil analisis tidak valid. Silakan coba lagi.' };
  }
}
