import { SessionConfig, EmailMessage, EvaluationResult } from "../types";
import { generateGeminiContent } from '@/app/actions/gemini';
import { generateOpenRouterContent } from '@/app/actions/openrouter';
import { getProviderFromModelId, normalizeModelId } from '@/app/lib/ai-models';

/**
 * Helper to call the appropriate AI provider based on model ID.
 */
async function callAI(options: { 
  model: string; 
  systemInstruction: string; 
  prompt: string; 
  temperature?: number;
  responseMimeType?: string;
}) {
  const normalizedModel = normalizeModelId(options.model);
  const provider = getProviderFromModelId(normalizedModel);
  
  const callPayload = {
    model: normalizedModel,
    systemInstruction: options.systemInstruction,
    contents: [{ role: 'user', parts: [{ text: options.prompt }] }],
    temperature: options.temperature,
    responseMimeType: options.responseMimeType,
  };

  if (provider === 'openrouter') {
    return generateOpenRouterContent(callPayload);
  }
  
  return generateGeminiContent(callPayload);
}

interface Content {
  role: string;
  parts: Array<{ text?: string; inlineData?: any }>;
}

let chatHistory: Content[] = [];

/**
 * Normalize subject from AI response:
 * - Trim and collapse whitespace
 * - If too descriptive (contains company names, explicit problem keywords, or too long), degrade to empty
 * - Return empty string for invalid/missing subjects
 */
function normalizeSubject(raw: string | undefined | null): string {
  if (!raw || typeof raw !== 'string') return '';
  
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  
  // Too long = likely too descriptive
  if (trimmed.length > 60) return '';
  
  // Check for explicit problem indicators that would leak the case
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

  try {
    return JSON.parse(trimmed);
  } catch {
    // ignore
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      // ignore
    }
  }

  const bracketMatch = trimmed.match(/\{[\s\S]*\}/);
  if (bracketMatch?.[0]) {
    return JSON.parse(bracketMatch[0]);
  }

  throw new Error('Tidak ada data JSON valid dari model.');
}

// ── System Instruction ───────────────────────────────────────
const getSystemInstruction = (config: SessionConfig, hasCustomImages: boolean) => {
  const scenarioDescriptions = config.scenarios.map((s, index) => 
    `${index + 1}. [${s.category}] ${s.title}: ${s.description}`
  ).join('\n    ');

  let imageInstruction = "";
  if (hasCustomImages) {
    imageInstruction = "User (Program) sudah melampirkan bukti gambar secara manual. ANDA TIDAK PERLU MEMINTA ATAU MENDESKRIPSIKAN LAMPIRAN GAMBAR BARU. Fokus saja pada cerita keluhannya.";
  } else if (config.enableImageGeneration) {
    imageInstruction = "Buatlah 1 sampai 3 prompt visual (deskripsi gambar) untuk bukti lampiran. Bukti harus bervariasi.";
  } else {
    imageInstruction = "JANGAN membuat prompt gambar visual apapun. Fokus hanya pada teks email.";
  }

  const senderName = config.identity.name;
  const bodyName = config.identity.bodyName || senderName;
  const nameNote = senderName !== bodyName 
    ? `CATATAN: Anda menggunakan akun email atas nama "${senderName}", tetapi nama panggilan/asli Anda di dalam surat adalah "${bodyName}".` 
    : "";

  return `
    Anda adalah Simulator Konsumen untuk pelatihan Agen Email Kontak OJK 157.
    
    PROFIL PENGIRIM (Akun Email):
    Nama Akun: ${senderName}
    Email: ${config.identity.email}
    
    PROFIL DIRI (Penulis Surat):
    Nama Asli/Panggilan: ${bodyName}
    Kota Domisili: ${config.identity.city}
    ${nameNote}

    PENTING: Gunakan data profil di atas secara KONSISTEN. Jangan mengarang nama/kota/email lain yang berbeda dari profil ini.
    
    KARAKTER:
    Tipe: ${config.consumerType.name}
    Deskripsi: ${config.consumerType.description}
    
    DAFTAR MASALAH YANG DIALAMI:
    ${scenarioDescriptions}

    DETAIL SKRIP/KRONOLOGI (JIKA ADA):
    ${config.scenarios.map(s => s.script ? `[${s.title}]: ${s.script}` : '').filter(Boolean).join('\n')}
    
    ATURAN WAJIB (HARUS DIPATUHI):
    1. PENAMAAN PERUSAHAAN (SANGAT PENTING):
       - Anda DILARANG KERAS hanya menyebut "bank saya", "aplikasi itu", "pihak leasing", atau "perusahaan tersebut".
       - Anda WAJIB mengarang NAMA SPESIFIK untuk perusahaan yang diadukan.
       - Jika skenario terkait BANK, ASURANSI, PASAR MODAL, atau LEASING (Gagal Login, Transaksi Tidak Dikenal, SLIK): Gunakan nama fiktif yang terdengar RESMI, LEGAL, dan BERIZIN OJK.
         Contoh Nama yang Diharapkan: "Bank Nusantara Sentosa", "PT Asuransi Keluarga Harmoni", "Sekuritas Investasi Jaya", "Mega Finance Indonesia".
       - Jika skenario terkait PINJOL ILEGAL (Teror Penagihan): Gunakan nama yang terdengar tidak formal.
         Contoh: "Dompet Kilat", "Dana Cepat Cair", "Pinjam Dulu".

    1a. ATURAN SUBJECT EMAIL (ADAPTIF BERDASARKAR KARAKTER):
        - Subject email harus menyesuaikan dengan tipe karakter Anda:
          * Jika Anda tipe yang bingung/awam: Subject BOLEH KOSONG (string kosong "") atau sangat umum seperti "Mohon Bantuan" atau "Pertanyaan".
          * Jika Anda tipe biasa: Subject singkat dan samar, misal "Perlu Klarifikasi" atau "Menanyakan Sesuatu".
          * Jika Anda tipe yang lebih terstruktur/ekspresif: Subject boleh ada, tetapi hanya memberi clue tipis. Maksimal 4-6 kata. Contoh: "Ada Masalah di Aplikasi", "Transaksi Bermasalah".
        - DILARANG: Subject yang membocorkan inti masalah secara eksplisit, kombinasi nama perusahaan + jenis masalah, kronologi lengkap, atau kata-kata yang langsung menjawab diagnosis kasus.
        - Subject harus natural, tidak terasa "dioptimalkan untuk memberi hint" kepada agen.
        - Jika ragu, lebih baik kosong atau sangat umum.

    2. GAYA PENULISAN:
       - Buatlah isi email yang SANGAT PANJANG (minimal 300-400 kata), BERTELE-TELE, dan PENUH DETAIL.
       - Ceritakan kronologi dengan sangat rinci. Masukkan curhatan pribadi yang tidak relevan (distraksi) tentang pekerjaan, keluarga, atau perasaan Anda untuk menyembunyikan inti masalah.
       - Tujuannya adalah melatih agen untuk "mencari jarum di tumpukan jerami".
       - Gunakan 3 sampai 5 paragraf narasi yang dipisahkan dengan baris kosong (\n\n) agar struktur email rapi dan mudah dibaca. Jangan gunakan bullet points.
       - Tetap gunakan Bahasa Indonesia yang natural seperti ditulis konsumen Indonesia asli, bukan hasil terjemahan literal.
       - Hindari bahasa yang terlalu kaku, terlalu formal, atau terasa seperti template mesin.
       - Jangan sengaja membuat typo atau ejaan rusak. Jika ingin santai, tetap harus wajar dan mudah dipahami.

    3. KONTEKS MASALAH:
       - Gabungkan SEMUA skenario masalah di atas menjadi satu cerita utuh.
       - Jangan memberikan solusi sendiri. Anda di sini untuk mengeluh.

     4. OUTPUT:
        - Format output HANYA JSON.
        - ${imageInstruction}
        - Struktur JSON:
        { 
          "subject": "Subjek email boleh kosong (string kosong), sangat umum, atau memberi clue tipis saja. Jangan membocorkan inti masalah, nama LJK + problem utama, atau kronologi lengkap. Maksimal 6 kata, natural.", 
          "body": "Isi Email Panjang...",
          "imagePrompts": ["Deskripsi gambar 1"]
        }
   `;
};

type InitializeEmailSessionResult =
  | { success: true; message: EmailMessage }
  | { success: false; error: string };

// ── Init Email Session ───────────────────────────────────────
export const initializeEmailSession = async (
  config: SessionConfig
): Promise<InitializeEmailSessionResult> => {
  chatHistory = [];

  const customAttachments: string[] = config.scenarios
    .flatMap(s => {
      let images: string[] = [];
      if (s.attachmentImages && Array.isArray(s.attachmentImages)) {
        images = s.attachmentImages;
      } else if ((s as any).attachmentImage) {
        images = [(s as any).attachmentImage];
      }
      return images;
    })
    .map(img => {
      const matches = img.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) return matches[2];
      return img;
    })
    .filter((img): img is string => !!img);

  const hasCustomImages = customAttachments.length > 0;
  const model = normalizeModelId(config.model || "gemini-3.1-flash-lite-preview");

  // Existing logic for prompt remains the same...
  const prompt = `
    Silakan tulis email pengaduan pertama Anda sekarang.
    
    INGAT INSTRUKSI KRUSIAL:
    Sebutkan NAMA LJK (Bank/Leasing/Aplikasi) SECARA SPESIFIK dan JELAS.
    Jangan gunakan nama umum. Karanglah nama perusahaan (misal: "Bank Merdeka Abadi" atau "Aplikasi Investasi Cerdas") agar terlihat seperti perusahaan berizin OJK.
    
    Masalah yang dialami:
    ${config.scenarios.map(s => `- ${s.title} (${s.description})`).join('\n')}
    
    Karakter Konsumen: ${config.consumerType.name}.
    ${hasCustomImages ? 'Gambar bukti sudah dilampirkan oleh sistem, abaikan pembuatan imagePrompts.' : (config.enableImageGeneration ? 'Berikan array "imagePrompts" berisi 1-3 deskripsi gambar bukti yang berbeda.' : 'JANGAN buat imagePrompts.')}
  `;

  try {
    const response = await callAI({
      model,
      prompt,
      systemInstruction: getSystemInstruction(config, hasCustomImages),
      responseMimeType: "application/json"
    });

    if (!response.success) {
      return {
        success: false,
        error:
          response.error ||
          'Layanan AI tidak tersedia sementara. Silakan tunggu beberapa detik lalu coba lagi.',
      };
    }

    const responseText = typeof response.text === 'string' ? response.text : "{}";
    let jsonResponse;
    try {
      jsonResponse = parseJsonFromModelText(responseText);
    } catch (e) {
      console.warn("[PDKT] Gagal parse JSON init session:", e);
      return { success: false, error: "Format balasan AI tidak valid. Coba mulai sesi lagi." };
    }

    chatHistory.push({ role: 'user', parts: [{ text: prompt }] });
    chatHistory.push({ role: 'model', parts: [{ text: responseText }] });

    let attachmentBase64s: string[] = [];

    if (hasCustomImages) {
      attachmentBase64s = customAttachments;
    } else if (config.enableImageGeneration) {
      console.warn("[PDKT] Image generation skipped as it's not yet fully supported on server action.");
    }

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
        attachments: attachmentBase64s,
      },
    };
  } catch (error) {
    console.warn("[PDKT] Error init email via Server Action:", error);
    const msg =
      error instanceof Error
        ? error.message
        : "Gagal memulai sesi email. Periksa koneksi lalu coba lagi.";
    return { success: false, error: msg };
  }
};

// ── Evaluate Agent Response ──────────────────────────────────
export const evaluateAgentResponse = async (
  agentReplyBody: string, 
  consumerContext: string,
  modelId?: string
): Promise<EvaluationResult> => {
  const normalizedModel = normalizeModelId(modelId || "gemini-3.1-flash-lite-preview");
  
  const evaluationPrompt = `
    Anda sekarang bertindak sebagai EDITOR BAHASA & SUPERVISOR CONTACT CENTER OJK.
    
    KONTEKS KELUHAN KONSUMEN:
    "${consumerContext}"
    
    JAWABAN AGEN (YANG PERLU DINILAI):
    "${agentReplyBody}"
    
    TUGAS:
    Nilai jawaban agen berdasarkan kriteria berikut (Skor Awal 100):
    
    1. TYPO (Salah Ketik):
       - Kurangi poin jika ada. Daftar kata yang salah.
    
    2. KEJELASAN INFORMASI & STRUKTUR (Clarity):
       - Apakah kalimatnya mudah dimengerti orang awam?
       - Apakah berbelit-belit atau membingungkan?
       - Apakah strukturnya logis (Pembuka -> Isi -> Penutup)?
       - Daftar kalimat yang membingungkan.
       
    3. RELEVANSI KONTEN (Content Relevance):
       - Apakah jawaban MENJAWAB masalah konsumen di atas?
       - Apakah informasinya tepat sasaran atau hanya template kosong?
       - Daftar informasi penting yang kurang (jika ada).
    
    OUTPUT JSON FORMAT:
    {
      "score": number,
      "typos": string[],
      "clarityIssues": string[],
      "contentGaps": string[],
      "feedback": string
    }
  `;

  let lastError: any;
  const MAX_RETRIES = 3;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await callAI({
        model: normalizedModel,
        prompt: evaluationPrompt,
        systemInstruction: "Anda adalah supervisor QA yang memberikan penilaian objektif dalam format JSON.",
        responseMimeType: "application/json",
        temperature: 0.2 // Lower temperature for more consistent evaluation
      });

      if (!response.success) {
        throw new Error(response.error || "Gagal mendapatkan respons dari AI.");
      }

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
      console.warn(`[PDKT Evaluate] Attempt ${attempt} failed:`, error);
      
      // Only retry on potential transient errors
      const isTransient = attempt < MAX_RETRIES && (
        error instanceof Error && (
          error.message.includes('429') || 
          error.message.includes('500') || 
          error.message.includes('503') || 
          error.message.includes('timeout') ||
          error.message.includes('fetch failed') ||
          error.message.toLowerCase().includes('sedang sibuk') ||
          error.message.toLowerCase().includes('kesalahan koneksi')
        )
      );

      if (!isTransient) break;
      
      // Exponential backoff: 1s, 2s
      await new Promise(resolve => setTimeout(resolve, attempt * 1000));
    }
  }

  console.error("[PDKT] Error evaluating via Server Action after retries:", lastError);
  throw lastError;
};

export const replyToEmail = async (_agentReplyBody: string): Promise<EmailMessage> => {
  throw new Error("One-way communication only.");
};
