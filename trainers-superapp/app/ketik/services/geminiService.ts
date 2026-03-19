import { SessionConfig, ChatMessage, Scenario } from '../../types';
import { generateGeminiContent } from '@/app/actions/gemini';

export async function generateConsumerResponse(
  config: SessionConfig,
  scenario: Scenario,
  chatHistory: ChatMessage[],
  extraPrompt?: string
): Promise<string> {
  const imagesCount = scenario.images?.length || 0;
  const imageInstruction = imagesCount > 0 
    ? `Anda memiliki ${imagesCount} lampiran gambar yang bisa dikirim (indeks 0 sampai ${imagesCount - 1}). Gunakan tag [SEND_IMAGE: indeks] untuk mengirimnya.`
    : 'Anda tidak memiliki lampiran gambar untuk dikirim.';

  const scriptInstruction = scenario.script 
    ? `SKRIP PERCAKAPAN (PANDUAN ALUR): Berikut adalah skrip/alur yang HARUS Anda ikuti informasinya secara bertahap. Jangan berikan semua informasi sekaligus kecuali ditanya, tapi pastikan alur masalahnya sesuai skrip ini: ${scenario.script}`
    : '';

  const timeLimitInstruction = config.simulationDuration && config.simulationDuration > 0
    ? `\nBATAS WAKTU: Simulasi ini dibatasi maksimal ${config.simulationDuration} menit. Jika kamu merasa percakapan sudah mendekati batas waktu ini, kamu HARUS segera mengakhiri percakapan dengan alasan natural (misal: "Maaf saya ada urusan lain", "Baterai saya habis", dll) MESKIPUN SKRIP BELUM SELESAI. Prioritaskan menutup percakapan jika waktu habis.`
    : '';

  const systemInstruction = `
Anda berperan sebagai konsumen Kontak OJK 157.
IDENTITAS ANDA (WAJIB KONSISTEN):
- Nama: ${config.identity.name}
- Kota Domisili: ${config.identity.city}
- Nomor HP: ${config.identity.phone}

Sifat Anda: ${config.consumerType.description}.
Masalah Anda: ${scenario.description}.

${scriptInstruction}
${timeLimitInstruction}
${imageInstruction}

ATURAN BALASAN:
1. Merespon secara natural, singkat, selayaknya chat WhatsApp. Jangan gunakan format formal, bullet points, atau salam pembuka yang berlebihan di setiap pesan.
2. Gunakan tag [BREAK] untuk memisahkan pesan jika ingin mengirim beberapa chat beruntun (maksimal 3 chat beruntun).
3. Gunakan tag [SISTEM] jika melakukan aksi fisik (misal: [SISTEM] Konsumen mengirim tangkapan layar).
4. Jika Anda ingin mengirim gambar, gunakan [SISTEM] diikuti dengan [SEND_IMAGE: indeks]. Misal: "[SISTEM] Mengirim bukti transfer [SEND_IMAGE: 0]".
5. Kembalikan [NO_RESPONSE] HANYA JIKA agen memberikan jawaban yang sangat memuaskan, percakapan benar-benar selesai secara natural, dan tidak ada lagi yang perlu ditanyakan.
6. Jangan pernah mengakui bahwa Anda adalah AI. Tetaplah dalam karakter sebagai konsumen yang sedang menghadapi masalah keuangan/perbankan.
7. KONSISTENSI DATA: Jika agen meminta data pribadi (Nama/HP/Kota), berikan data DI ATAS. JANGAN MENGARANG DATA BARU yang berbeda dengan profil ini.
  `;

  const historyText = chatHistory
    .filter(m => m.sender !== 'system')
    .map(m => `${m.sender === 'agent' ? 'Agen' : 'Konsumen'}: ${m.text}`)
    .join('\n');
    
  const prompt = `Skenario Saat Ini: ${scenario.title}\n\nRiwayat Chat:\n${historyText}\n\n${extraPrompt || 'Balas sebagai konsumen:'}`;

  try {
    const response = await generateGeminiContent({
      model: config.model || 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction,
      temperature: 0.7,
    });

    return response.text || '[NO_RESPONSE]';
  } catch (error) {
    console.error('[Ketik] Gemini Error:', error);
    return 'Maaf, saya sedang tidak bisa membalas saat ini.';
  }
}

export async function generateFirstMessage(
  config: SessionConfig,
  scenario: Scenario
): Promise<string> {
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
      model: config.model || 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: [{ text: "Berikan pesan pembuka chat Anda." }] }],
      systemInstruction,
      temperature: 0.9,
    });

    return response.text || `Halo, saya ${config.identity.name}. Saya ingin bertanya tentang ${scenario.title}.`;
  } catch (error) {
    console.error("First message error:", error);
    return `Halo, saya ${config.identity.name} dari ${config.identity.city}. Saya ingin bertanya tentang ${scenario.title}.`;
  }
}

export async function generateScore(
  config: SessionConfig,
  scenario: Scenario,
  history: ChatMessage[]
): Promise<{ score: number; feedback: string }> {
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
}
