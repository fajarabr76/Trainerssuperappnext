import { generateGeminiContent } from "../actions/gemini";
import { SessionConfig, Scenario, ChatMessage } from "../types";

export const generateConsumerResponse = async (
  config: SessionConfig,
  scenario: Scenario,
  history: ChatMessage[]
): Promise<string> => {
  const systemInstruction = `
Anda berperan sebagai konsumen Kontak OJK 157.
IDENTITAS ANDA (WAJIB KONSISTEN):
- Nama: ${config.identity.name}
- Kota Domisili: ${config.identity.city}
- Nomor HP: ${config.identity.phone}

Sifat Anda: ${config.consumerType.description}.
Masalah Anda: ${scenario.description}.

ATURAN BALASAN:
1. Merespon secara natural, singkat, selayaknya chat WhatsApp. Jangan gunakan format formal, bullet points, atau salam pembuka yang berlebihan di setiap pesan.
2. Gunakan tag [BREAK] untuk memisahkan pesan jika ingin mengirim beberapa chat beruntun (maksimal 3 chat beruntun).
3. Gunakan tag [SISTEM] jika melakukan aksi fisik (misal: [SISTEM] Konsumen mengirim tangkapan layar).
4. Jika Anda ingin mengirim gambar, gunakan [SISTEM] diikuti dengan [SEND_IMAGE: indeks]. Misal: "[SISTEM] Mengirim bukti transfer [SEND_IMAGE: 0]".
5. Kembalikan [NO_RESPONSE] HANYA JIKA agen memberikan jawaban yang sangat memuaskan, percakapan benar-benar selesai secara natural, dan tidak ada lagi yang perlu ditanyakan.
6. Jangan pernah mengakui bahwa Anda adalah AI. Tetaplah dalam karakter sebagai konsumen yang sedang menghadapi masalah keuangan/perbankan.
7. KONSISTENSI DATA: Jika agen meminta data pribadi (Nama/HP/Kota), berikan data DI ATAS. JANGAN MENGARANG DATA BARU yang berbeda dengan profil ini.
  `;

  const contents = history.map(msg => ({
    role: msg.sender === 'agent' ? 'user' : 'model',
    parts: [{ text: msg.text }]
  }));

  try {
    const response = await generateGeminiContent({
      model: config.model || "gemini-3-flash-preview",
      contents: contents,
      systemInstruction,
      temperature: 0.7,
    });

    return response.text || '[NO_RESPONSE]';
  } catch (error) {
    console.error('[Ketik] Gemini Error:', error);
    return 'Maaf, saya sedang tidak bisa membalas saat ini.';
  }
};

export const generateFirstMessage = async (
  config: SessionConfig,
  scenario: Scenario
): Promise<string> => {
  const systemInstruction = `
Anda adalah seorang konsumen OJK (Otoritas Jasa Keuangan) yang baru saja membuka chat untuk mengadu.
Identitas: ${config.identity.name} dari ${config.identity.city}.
Skenario: ${scenario.title} - ${scenario.description}.
Tipe Konsumen: ${config.consumerType.name}.

Tugas: Berikan pesan pembuka (greeting) pertama Anda di chat. 
Pesan harus mencerminkan masalah Anda dan tipe kepribadian Anda.
Langsung saja ke intinya, jangan terlalu banyak basa-basi.
  `;

  try {
    const response = await generateGeminiContent({
      model: config.model || "gemini-3-flash-preview",
      contents: [{ role: 'user', parts: [{ text: "Berikan pesan pembuka chat Anda." }] }],
      systemInstruction,
      temperature: 0.9,
    });

    return response.text || `Halo, saya ${config.identity.name}. Saya ingin bertanya tentang ${scenario.title}.`;
  } catch (error) {
    return `Halo, saya ${config.identity.name} dari ${config.identity.city}. Saya ingin bertanya tentang ${scenario.title}.`;
  }
};

export const generateConsumerEmail = async (
  config: any,
  scenario: any,
  history: any[]
): Promise<{ subject: string; body: string }> => {
  const systemInstruction = `
Anda adalah seorang konsumen OJK yang sedang berkomunikasi melalui EMAIL.
Identitas: ${config.identity.name} (${config.identity.email || 'konsumen@email.com'})
Skenario: ${scenario.title} - ${scenario.description}
Tipe Konsumen: ${config.consumerType.name}

TUGAS:
1. Balaslah email dari petugas OJK.
2. Gunakan format email yang profesional namun tetap mencerminkan karakter/persona Anda (marah, bingung, dll).
3. Sertakan Subject jika ini adalah email baru, atau biarkan kosong jika membalas.
4. Berikan detail kronologi jika diminta, atau tetap menuntut jika Anda merasa tidak puas.
5. JANGAN keluar dari peran.

OUTPUT: Berikan respon dalam format JSON:
{
  "subject": "Re: [Subject]",
  "body": "Isi email Anda..."
}
  `;

  try {
    const response = await generateGeminiContent({
      model: config.model || "gemini-3-flash-preview",
      contents: history.map(h => ({ 
        role: h.sender === 'agent' ? 'user' : 'model', 
        parts: [{ text: h.text }] 
      })),
      systemInstruction,
      responseMimeType: "application/json",
    });

    const result = JSON.parse(response.text || "{}");
    return {
      subject: result.subject || `Re: ${scenario.title}`,
      body: result.body || "Saya menunggu jawaban Anda."
    };
  } catch (error) {
    return {
      subject: `Re: ${scenario.title}`,
      body: "Maaf, saya sedang mengalami kendala teknis dalam mengirim email."
    };
  }
};

export const generateScore = async (
  config: any,
  scenario: any,
  history: any[]
): Promise<{ score: number; feedback: string }> => {
  const systemInstruction = `
Anda adalah seorang Asisten Penilai (Assessor) OJK yang bertugas mengevaluasi kinerja agen contact center dalam menangani keluhan konsumen.
Identitas Konsumen: ${config.identity.name}
Skenario: ${scenario.title} - ${scenario.description}
Tipe Konsumen: ${config.consumerType.name}

TUGAS:
1. Analisis seluruh riwayat percakapan antara agen (user) dan konsumen (model).
2. Berikan penilaian (skor 0-100) berdasarkan kriteria berikut:
   - Empati dan Kesopanan (25%)
   - Pemahaman Masalah (25%)
   - Ketepatan Solusi sesuai SOP OJK (25%)
   - Profesionalisme dan Bahasa (25%)
3. Berikan feedback (umpan balik) yang konstruktif, jelaskan apa yang sudah baik dan apa yang perlu diperbaiki.

OUTPUT: Berikan respon dalam format JSON:
{
  "score": 85,
  "feedback": "Agen sudah menunjukkan empati yang baik, namun solusi yang diberikan kurang spesifik..."
}
  `;

  try {
    const response = await generateGeminiContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts: [{ text: JSON.stringify(history) }] }],
      systemInstruction,
      responseMimeType: "application/json",
    });

    const result = JSON.parse(response.text || "{}");
    return {
      score: result.score || 0,
      feedback: result.feedback || "Gagal menghasilkan penilaian."
    };
  } catch (error) {
    console.error("Scoring error:", error);
    return {
      score: 0,
      feedback: "Terjadi kesalahan sistem saat melakukan penilaian."
    };
  }
};

export const generateConsumerVoice = async (
  config: any,
  scenario: any,
  prompt: string
): Promise<string | undefined> => {
  try {
    const response = await generateGeminiContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: prompt }] }],
      responseModalities: ["AUDIO"] as any,
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: config.consumerType.id === 'marah' ? 'Fenrir' : 'Kore' },
        },
      },
    });

    return response.audioData;
  } catch (error) {
    console.error("Voice generation error:", error);
    return undefined;
  }
};

