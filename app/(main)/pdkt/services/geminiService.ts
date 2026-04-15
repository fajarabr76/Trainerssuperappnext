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
         "subject": "Subjek Email (Buat yang menarik/emosional sesuai karakter)", 
         "body": "Isi Email Panjang...",
         "imagePrompts": ["Deskripsi gambar 1"]
       }
  `;
};

export type InitializeEmailSessionResult =
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

    const responseText = response.text || "{}";
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
        subject: jsonResponse.subject || "Keluhan Pelanggan",
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
export const evaluateAgentResponse = async (agentReplyBody: string, consumerContext: string): Promise<EvaluationResult> => {
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

  try {
    const response = await generateGeminiContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: [{ role: 'user', parts: [{ text: evaluationPrompt }] }],
      responseMimeType: "application/json"
    });

    if (!response.success) throw new Error(response.error);

    const evalText = response.text || "{}";
    const result = parseJsonFromModelText(evalText);

    return {
      score: result.score || 0,
      typos: result.typos || [],
      clarityIssues: result.clarityIssues || [],
      contentGaps: result.contentGaps || [],
      feedback: result.feedback || "Tidak ada masukan."
    };

  } catch (error) {
    console.error("[PDKT] Error evaluating via Server Action:", error);
    throw error;
  }
};

export const replyToEmail = async (_agentReplyBody: string): Promise<EmailMessage> => {
  throw new Error("One-way communication only.");
};
