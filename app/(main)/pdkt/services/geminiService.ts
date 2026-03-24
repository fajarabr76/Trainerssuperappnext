import { SessionConfig, EmailMessage, EvaluationResult } from "../types";
import { generateGeminiContent } from '@/app/actions/gemini';

interface Content {
  role: string;
  parts: Array<{ text?: string; inlineData?: any }>;
}

let chatHistory: Content[] = [];

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
       - Gunakan paragraf narasi yang panjang. Jangan gunakan bullet points.

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

// ── Init Email Session ───────────────────────────────────────
export const initializeEmailSession = async (config: SessionConfig): Promise<EmailMessage> => {
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
  const model = "gemini-3-flash-preview";

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
    const response = await generateGeminiContent({
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: getSystemInstruction(config, hasCustomImages),
      responseMimeType: "application/json"
    });

    if (!response.success) throw new Error(response.error);

    const responseText = response.text || "{}";
    const jsonResponse = JSON.parse(responseText);

    chatHistory.push({ role: 'user', parts: [{ text: prompt }] });
    chatHistory.push({ role: 'model', parts: [{ text: responseText }] });

    let attachmentBase64s: string[] = [];

    if (hasCustomImages) {
      attachmentBase64s = customAttachments;
    } else if (config.enableImageGeneration) {
      console.warn("[PDKT] Image generation skipped as it's not yet fully supported on server action.");
    }

    return {
      id: Date.now().toString(),
      from: config.identity.email,
      to: "konsumen@ojk.go.id",
      subject: jsonResponse.subject || "Keluhan Pelanggan",
      body: jsonResponse.body || "Gagal memuat isi email.",
      timestamp: new Date(),
      isAgent: false,
      attachments: attachmentBase64s
    };

  } catch (error) {
    console.error("[PDKT] Error init email via Server Action:", error);
    throw error;
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
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts: [{ text: evaluationPrompt }] }],
      responseMimeType: "application/json"
    });

    if (!response.success) throw new Error(response.error);

    const evalText = response.text || "{}";
    const result = JSON.parse(evalText);

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
