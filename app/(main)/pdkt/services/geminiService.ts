import { SessionConfig, EmailMessage, EvaluationResult, Identity, ResolvedConsumerNameMentionPattern, Scenario, AppSettings } from "../types";
import { generateGeminiContent } from '@/app/actions/gemini';
import { generateOpenRouterContent } from '@/app/actions/openrouter';
import { normalizeModelId, resolveModelProvider } from '@/app/lib/ai-models';
import type { UsageContext } from '@/app/lib/ai-usage';
import { getConsumerNameMentionInstruction, getCompanyNameInstruction } from './promptHelpers';

/**
 * Helper to call the appropriate AI provider based on model ID.
 */
async function callAI(options: {
  model: string;
  systemInstruction: string;
  prompt: string;
  temperature?: number;
  responseMimeType?: string;
  usageContext?: UsageContext;
  userId?: string;
}) {
  const { modelId, provider } = resolveModelProvider(options.model);

  if (provider === 'openrouter') {
    return generateOpenRouterContent({
      model: modelId,
      systemInstruction: options.systemInstruction,
      contents: [{ role: 'user', parts: [{ text: options.prompt }] }],
      temperature: options.temperature,
      responseMimeType: options.responseMimeType,
      usageContext: options.usageContext,
      userId: options.userId
    });
  }
  
  return generateGeminiContent({
    model: modelId,
    systemInstruction: options.systemInstruction,
    contents: [{ role: 'user', parts: [{ text: options.prompt }] }],
    temperature: options.temperature,
    responseMimeType: options.responseMimeType,
    usageContext: options.usageContext,
    userId: options.userId
  });
}

/**
 * Normalizes subject from AI response.
 */
function normalizeSubject(raw: string | undefined | null): string {
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (trimmed.length > 60) return '';
  
  const leakyPatterns = [
    /penipuan/i, /fraud/i, /gagal login/i, /transaksi tidak dikenal/i,
    /slik/i, /terror/i, /penagihan/i, /pinjol/i, /pinjaman online/i,
    /investasi bodong/i, /asuransi/i, /leasing/i, /bank.*blokir/i,
    /rekening.*diblokir/i, /dana.*hilang/i, /uang.*raib/i
  ];
  
  for (const pattern of leakyPatterns) {
    if (pattern.test(trimmed)) return '';
  }
  return trimmed;
}

function parseJsonFromModelText(raw: string): any {
  const trimmed = raw.trim();
  try { return JSON.parse(trimmed); } catch {}
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) { try { return JSON.parse(fenced[1].trim()); } catch {} }
  const bracketMatch = trimmed.match(/\{[\s\S]*\}/);
  if (bracketMatch?.[0]) { return JSON.parse(bracketMatch[0]); }
  throw new Error('Tidak ada data JSON valid dari model.');
}

function isTransientAiError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('429') ||
    message.includes('500') ||
    message.includes('503') ||
    message.includes('timeout') ||
    message.includes('fetch failed') ||
    message.includes('sedang sibuk') ||
    message.includes('kesalahan koneksi') ||
    message.includes('temporarily unavailable')
  );
}

/**
 * Helper to render template with name placement.
 */
function renderTemplate(body: string, identity: Identity, pattern: ResolvedConsumerNameMentionPattern): string {
  const text = body.replace(/\{\{consumer_name\}\}/g, '').trim();
  
  if (pattern === 'none') return text;

  const name = identity.name;
  
  if (pattern === 'upfront') {
    return `Halo, saya ${name}.\n\n${text}`;
  } else if (pattern === 'late') {
    return `${text}\n\nSalam,\n${name}`;
  } else {
    // Middle: try to find a middle spot (between paragraphs) or just append
    const paragraphs = text.split('\n\n');
    if (paragraphs.length >= 2) {
      const mid = Math.floor(paragraphs.length / 2);
      paragraphs.splice(mid, 0, `Oya, saya ${name} mau menambahkan sedikit detail lagi.`);
      return paragraphs.join('\n\n');
    }
    return `${text}\n\n(Saya ${name})`;
  }
}

function getRealisticWritingInstruction(mode: string): string {
  if (mode !== 'realistic') return "";

  return `
    GAYA PENULISAN REALISTIS (WAJIB):
    - Tambahkan minimal 2 dan maksimal 5 typo (salah ketik) acak pada kata-kata di dalam email.
    - Gunakan CAPSLOCK pada 1 hingga 3 kata atau frasa pendek untuk menunjukkan penekanan emosi atau kebingungan.
    - Gunakan minimal 3 kata atau ungkapan bahasa informal/bahasa sehari-hari yang tidak baku.
    - Sertakan minimal 1 bagian di mana Anda menjelaskan masalah secara sedikit berbelit-belit atau mengulang poin yang sama untuk menunjukkan kesulitan dalam menjelaskan masalah.
    - Meskipun gaya penulisan tidak sempurna, pastikan informasi inti keluhan (jenis masalah, nama LJK, dan dampak) tetap dapat diidentifikasi.
  `;
}

export const getSystemInstruction = (config: SessionConfig, hasCustomImages: boolean) => {
  const scenario = config.scenarios[0];
  const scenarioDescription = scenario 
    ? `[${scenario.category}] ${scenario.title}: ${scenario.description}`
    : "Tidak ada skenario spesifik.";

  const templateGuidance = scenario?.sampleEmailTemplate?.body 
    ? `TEMPLATE REFERENSI: Anda bisa merujuk pada gaya bahasa template berikut, namun buatlah versi yang lebih panjang dan bertele-tele:\n"${scenario.sampleEmailTemplate.body}"`
    : "";

  let imageInstruction = "";
  if (hasCustomImages) {
    imageInstruction = "User (Program) sudah melampirkan bukti gambar secara manual. Fokus saja pada cerita keluhannya.";
  } else if (config.enableImageGeneration) {
    imageInstruction = "Buatlah 1 sampai 3 prompt visual (deskripsi gambar) untuk bukti lampiran.";
  } else {
    imageInstruction = "JANGAN membuat prompt gambar visual apapun.";
  }

  const writingStyleMode = config.writingStyleMode || 'training';

  return `
    Anda adalah Simulator Konsumen untuk pelatihan Agen Email Kontak OJK 157.
    
    PROFIL PENGIRIM:
    Nama Akun: ${config.identity.name}
    Email: ${config.identity.email}
    Nama Panggilan/Asli: ${config.identity.bodyName || config.identity.name}
    Kota Domisili: ${config.identity.city}

    PENTING: Gunakan profil di atas secara KONSISTEN.
    ${getConsumerNameMentionInstruction(config.resolvedConsumerNameMentionPattern)}
    ${config.resolvedConsumerNameMentionPattern === 'none' ? 'Jangan menyebut nama diri Anda sama sekali.' : ''}
    
    KARAKTER: ${config.consumerType.name} (${config.consumerType.description})
    
    MASALAH: ${scenarioDescription}
    ${templateGuidance}
    ${imageInstruction}
    ${getRealisticWritingInstruction(writingStyleMode)}
    
    ATURAN WAJIB:
    ${getCompanyNameInstruction(scenario)}
    2. GAYA PENULISAN: Buatlah isi email yang SANGAT PANJANG (500-1000 kata), BERTELE-TELE, dan PENUH DETAIL curhatan tidak relevan. Jangan gunakan bullet points. Gunakan 5-8 paragraf yang dipisahkan dengan baris kosong (\n\n). JANGAN menulis dalam 1 paragraf saja — setiap paragraf harus membahas aspek berbeda (kronologi, detail masalah, dampak emosional, harapan, dll).
    3. FORMAT OUTPUT: HANYA JSON.
    { 
      "subject": "Subjek singkat & samar (maks 6 kata), atau kosong.", 
      "body": "Paragraf 1...\n\nParagraf 2...\n\nParagraf 3...\n\nParagraf 4...\n\nParagraf 5...",
      "imagePrompts": ["Deskripsi gambar 1"]
    }
   `;
};

export type InitializeEmailSessionResult =
  | { success: true; message: EmailMessage }
  | { success: false; error: string };

/**
 * Generate a template email for a scenario using AI.
 * Returns { subject, body } but does NOT create any mailbox items.
 */
export async function generateScenarioEmailTemplate(
  scenario: Scenario,
  settings: AppSettings,
  userId?: string
): Promise<{ subject: string; body: string }> {
  const modelId = normalizeModelId(settings.selectedModel || "gemini-3.1-flash-lite");
  
  const systemInstruction = `
    Anda adalah Simulator Konsumen untuk pelatihan Agen Email Kontak OJK 157.
    Tugas Anda adalah membuat SATU CONTOH TEMPLATE EMAIL pengaduan berdasarkan skenario yang diberikan.
    
    ATURAN:
    ${getCompanyNameInstruction(scenario)}
    2. SUBJECT: Singkat (maks 6 kata), samar, tidak mengandung kata terlarang (fraud, penipuan, pinjol, dll).
    3. BODY: Gunakan placeholder {{consumer_name}} jika ingin menyebut nama diri sendiri.
    4. GAYA BAHASA: Sangat PANJANG (500-1000 kata), natural, bertele-tele, penuh detail kronologi curhatan, tanpa bullet points. Wajib 5-8 paragraf yang dipisahkan dengan baris kosong (\n\n). JANGAN menulis dalam 1 paragraf saja — setiap paragraf harus membahas aspek berbeda (kronologi awal, detail masalah, upaya yang sudah dilakukan, dampak emosional/finansial, harapan penyelesaian, dll).
    5. JANGAN menyertakan prompt gambar.
    6. JANGAN menyertakan identitas spesifik (kota, email asli) selain placeholder.
    
    FORMAT OUTPUT JSON:
    { "subject": "...", "body": "Paragraf 1...\n\nParagraf 2...\n\nParagraf 3...\n\nParagraf 4...\n\nParagraf 5..." }
  `;

  const prompt = `Buat template email panjang dan natural untuk skenario: [${scenario.category}] ${scenario.title}. Detail: ${scenario.description}. PENTING: Email harus 500-1000 kata, terdiri dari 5-8 paragraf terpisah (gunakan \\n\\n antar paragraf). Jangan tulis dalam 1 paragraf saja.`;

  const executeGeneration = async (retryPrompt?: string) => {
    const finalPrompt = retryPrompt ? `${prompt}\n\nREVISI: ${retryPrompt}` : prompt;
    const response = await callAI({
      model: modelId,
      prompt: finalPrompt,
      systemInstruction,
      responseMimeType: "application/json",
      usageContext: { module: 'pdkt', action: 'generate_template' },
      userId,
    });

    if (!response.success) {
      throw new Error(response.error || 'Gagal generate template.');
    }

    const responseText = typeof response.text === 'string' ? response.text : "{}";
    const jsonResponse = parseJsonFromModelText(responseText);
    
    const subject = normalizeSubject(jsonResponse.subject);
    const body = jsonResponse.body || "";
    const wordCount = body.split(/\s+/).filter(Boolean).length;

    return { subject, body, wordCount };
  };

  let result = await executeGeneration();

  // Retry once if body is shorter than requested minimum.
  if (result.wordCount < 500) {
    result = await executeGeneration("Hasil sebelumnya terlalu pendek. Tolong buat jauh lebih panjang, detail, dan bertele-tele (target 500-1000 kata, minimal 500 kata, 5-8 paragraf terpisah dengan baris kosong, tanpa bullet points). Setiap paragraf harus membahas aspek berbeda.");
  }

  // Final validation after retry.
  if (result.wordCount < 500) {
    throw new Error('Hasil template terlalu pendek. Silakan klik Generate ulang untuk mencoba lagi.');
  }

  return {
    subject: result.subject,
    body: result.body
  };
}

export const initializeEmailSession = async (
  config: SessionConfig,
  userId?: string
): Promise<InitializeEmailSessionResult> => {
  const scenario = config.scenarios[0];
  if (!scenario) return { success: false, error: "Skenario tidak ditemukan." };

  // Handle Forced Template
  if (scenario.alwaysUseSampleEmail && scenario.sampleEmailTemplate?.body) {
    const renderedBody = renderTemplate(
      scenario.sampleEmailTemplate.body, 
      config.identity, 
      config.resolvedConsumerNameMentionPattern
    );
    return {
      success: true,
      message: {
        id: Date.now().toString(),
        from: config.identity.email,
        to: "konsumen@ojk.go.id",
        subject: scenario.sampleEmailTemplate.subject || '',
        body: renderedBody,
        timestamp: new Date(),
        isAgent: false,
        attachments: [],
      },
    };
  }

  // AI Generation Flow
  const customAttachments: string[] = scenario.attachmentImages || [];
  const hasCustomImages = customAttachments.length > 0;
  const model = normalizeModelId(config.selectedModel || "gemini-3.1-flash-lite");

  const prompt = `Tulis email pengaduan pertama Anda sekarang. Masalah: ${scenario.title}. Karakter: ${config.consumerType.name}. PENTING: Email harus 500-1000 kata, terdiri dari 5-8 paragraf terpisah (gunakan \\n\\n antar paragraf). Jangan tulis dalam 1 paragraf saja.`;

  try {
    const response = await callAI({
      model,
      prompt,
      systemInstruction: getSystemInstruction(config, hasCustomImages),
      responseMimeType: "application/json",
      usageContext: { module: 'pdkt', action: 'init_email' },
      userId,
    });

    if (!response.success) {
      return { success: false, error: response.error || 'Layanan AI tidak tersedia.' };
    }

    const responseText = typeof response.text === 'string' ? response.text : "{}";
    const jsonResponse = parseJsonFromModelText(responseText);

    return {
      success: true,
      message: {
        id: Date.now().toString(),
        from: config.identity.email,
        to: "konsumen@ojk.go.id",
        subject: normalizeSubject(jsonResponse.subject),
        body: jsonResponse.body || "Gagal memuat isi email.",
        timestamp: new Date(),
        isAgent: false,
        attachments: customAttachments,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal memulai sesi email." };
  }
};

export const evaluateAgentResponse = async (
  emails: EmailMessage[],
  config: SessionConfig,
  userId?: string
): Promise<EvaluationResult> => {
  const modelId = normalizeModelId(config.selectedModel || "gemini-3.1-flash-lite");
  
  const lastAgentReply = [...emails].reverse().find(e => e.isAgent);
  const firstInbound = emails.find(e => !e.isAgent);
  
  if (!lastAgentReply || !firstInbound) {
    throw new Error("Missing email context for evaluation.");
  }

  const evaluationPrompt = `
    Anda adalah SUPERVISOR QA OJK.
    
    KELUHAN KONSUMEN:
    "${firstInbound.body}"
    
    JAWABAN AGEN:
    "${lastAgentReply.body}"
    
    TUGAS: Nilai jawaban agen (Skor Awal 100).
    1. TYPO: Salah ketik.
    2. CLARITY: Apakah mudah dimengerti? Struktur logis?
    3. RELEVANSI: Apakah menjawab masalah inti?
    
    OUTPUT JSON:
    { "score": number, "typos": string[], "clarityIssues": string[], "contentGaps": string[], "feedback": string }
  `;

  let lastError: unknown;
  const retryDelaysMs = [250, 500];

  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt++) {
    try {
      const response = await callAI({
        model: modelId,
        prompt: evaluationPrompt,
        systemInstruction: "Anda adalah supervisor QA yang memberikan penilaian objektif dalam format JSON.",
        responseMimeType: "application/json",
        temperature: 0.2,
        usageContext: { module: 'pdkt', action: 'evaluate_response' },
        userId,
      });

      if (!response.success) throw new Error(response.error || "Gagal mendapatkan respons AI.");
      
      const evalText = typeof response.text === 'string' ? response.text : "{}";
      const result = parseJsonFromModelText(evalText);

      return {
        score: result.score ?? 0,
        typos: result.typos || [],
        clarityIssues: result.clarityIssues || [],
        contentGaps: result.contentGaps || [],
        feedback: result.feedback || "Tidak ada masukan."
      };
    } catch (error) {
      lastError = error;
      if (!isTransientAiError(error) || attempt === retryDelaysMs.length) break;

      await new Promise(resolve => setTimeout(resolve, retryDelaysMs[attempt]));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Gagal mendapatkan respons AI.");
};

export const replyToEmail = async (): Promise<EmailMessage> => {
  throw new Error("One-way communication only.");
};
