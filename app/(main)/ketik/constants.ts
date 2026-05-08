import { Scenario, ConsumerType, ConsumerDifficulty } from '@/app/types';
import { TEXT_SIMULATION_MODELS, normalizeModelId } from '@/app/lib/ai-models';

const mergeWithDefaults = <T extends { id: string; isCustom?: boolean; description?: string }>(
  stored: T[],
  defaults: T[]
): T[] => {
  if (!Array.isArray(stored)) return defaults;
  const storedMap = new Map(stored.map(item => [item.id, item]));
  const merged = [...stored];
  defaults.forEach(defItem => {
    if (!storedMap.has(defItem.id)) {
      merged.push(defItem);
    } else {
      const existingIndex = merged.findIndex(item => item.id === defItem.id);
      if (existingIndex !== -1 && !merged[existingIndex].isCustom) {
        const existing = merged[existingIndex];
        const isOldDefault = existing.description?.startsWith('Anda ');
        if (isOldDefault || existing.description === defItem.description) {
          const preserveIsActive = (existing as any).isActive;
          merged[existingIndex] = {
            ...defItem,
            ...(preserveIsActive !== undefined ? { isActive: preserveIsActive } : {}),
          };
        }
      }
    }
  });
  return merged;
};

/**
 * Validates and normalizes model ID for KETIK.
 * Defaults to Gemini 3.1 Flash Lite if invalid.
 */
export function coerceKetikModelId(modelId?: string | null): string {
  const normalized = normalizeModelId(modelId);
  const exists = TEXT_SIMULATION_MODELS.some(m => m.id === normalized);
  return exists ? normalized : 'gemini-3.1-flash-lite';
}

export const parseSettings = (parsed: any): any => ({
  ...parsed,
  scenarios: mergeWithDefaults(parsed.scenarios, DEFAULT_SCENARIOS),
  consumerTypes: mergeWithDefaults(parsed.consumerTypes, DEFAULT_CONSUMER_TYPES),
  quickTemplates: mergeWithDefaults(parsed.quickTemplates || [], DEFAULT_QUICK_TEMPLATES),
  activeConsumerTypeId: parsed.activeConsumerTypeId || 'random',
  identitySettings: {
    displayName: parsed.identitySettings?.displayName || '',
    signatureName: parsed.identitySettings?.signatureName || '',
    phoneNumber: parsed.identitySettings?.phoneNumber || '',
    city: parsed.identitySettings?.city || '',
  },
  selectedModel: coerceKetikModelId(parsed.selectedModel),
  simulationDuration: parsed.simulationDuration || 5,
});

export const DEFAULT_QUICK_TEMPLATES: any[] = [
  { id: 'qt-selesai', keyword: 'selesai', content: 'Terima kasih telah menghubungi Layanan Kontak OJK 157. Semoga informasi yang kami berikan bermanfaat.' },
  { id: 'qt-closing', keyword: 'closinghdsi', content: 'Demikian informasi yang dapat kami sampaikan. Jika ada hal lain yang ingin ditanyakan, silakan menghubungi kami kembali. Selamat pagi/siang/sore.' },
  { id: 'qt-greeting', keyword: 'greetinghdsi', content: 'Selamat pagi/siang/sore, dengan Layanan Kontak OJK 157. Ada yang bisa kami bantu terkait informasi sektor jasa keuangan?' },
  { id: 'qt-isiform', keyword: 'isiformhdsi', content: 'Mohon kesediaan Bapak/Ibu untuk melengkapi data diri pada link berikut agar kami dapat memproses laporan Anda lebih lanjut: [LINK_FORM]' },
  { id: 'qt-tanya-akun', keyword: 'tanyaakun', content: 'Boleh diinformasikan nomor akun atau ID pelanggan yang Bapak/Ibu gunakan untuk layanan tersebut?' }
];

export const DEFAULT_SCENARIOS: Scenario[] = [
  {
    id: 'pinjol',
    category: 'Pinjol',
    title: 'Pinjol Ilegal',
    description: 'Konsumen diteror oleh pinjol ilegal padahal tidak pernah meminjam.',
    isActive: true,
  },
  {
    id: 'penipuan',
    category: 'Penipuan',
    title: 'Penipuan Undian',
    description: 'Konsumen menerima pesan menang undian dan diminta transfer pajak pemenang.',
    isActive: true,
  },
  {
    id: 'slik',
    category: 'SLIK',
    title: 'Pengecekan SLIK',
    description: 'Konsumen ingin mengecek status BI Checking / SLIK karena pengajuan KPR ditolak.',
    isActive: true,
  },
  {
    id: 'asuransi',
    category: 'Asuransi',
    title: 'Klaim Asuransi Ditolak',
    description: 'Konsumen mengeluh karena klaim asuransi kesehatannya ditolak dengan alasan yang tidak jelas.',
    isActive: true,
  },
  {
    id: 'investasi',
    category: 'Investasi',
    title: 'Investasi Bodong',
    description: 'Konsumen melaporkan adanya tawaran investasi dengan imbal hasil tidak wajar (ponzi).',
    isActive: true,
  },
  {
    id: 'kartu-kredit',
    category: 'Perbankan',
    title: 'Tagihan Kartu Kredit',
    description: 'Konsumen keberatan dengan adanya biaya administrasi atau tagihan yang tidak dikenal di kartu kreditnya.',
    isActive: true,
  }
];

export const DEFAULT_CONSUMER_TYPES: ConsumerType[] = [
  { 
    id: 'marah', 
    name: 'Marah & Emosional',
    description: 'Konsumen sedang sangat kesal karena merasa dirugikan. Nada chat tegas, mendesak, dan mudah terpancing bila jawaban agen terasa normatif, tetapi tetap terdengar seperti orang sungguhan yang sedang komplain ke OJK. Cenderung menekan agar ada langkah konkret, bukan penjelasan berputar-putar.',
    difficulty: ConsumerDifficulty.Hard
  },
  { 
    id: 'bingung', 
    name: 'Bingung & Gaptek',
    description: 'Konsumen awam, agak bingung, dan kurang paham istilah teknis atau alur digital. Sering minta penjelasan ulang dengan bahasa sederhana, tetapi tetap terasa natural seperti orang yang benar-benar butuh dibantu, bukan dibuat bodoh-bodohan.',
    difficulty: ConsumerDifficulty.Medium
  },
  { 
    id: 'kritis', 
    name: 'Kritis & Detail',
    description: 'Konsumen teliti, skeptis, dan cepat menangkap jawaban yang terasa template. Suka meminta dasar aturan, alur resmi, atau SOP yang relevan. Tetap bicara sebagai konsumen yang cerdas dan hati-hati, bukan seperti auditor atau pegawai internal.',
    difficulty: ConsumerDifficulty.Hard
  },
  { 
    id: 'ramah', 
    name: 'Ramah & Kooperatif',
    description: 'Konsumen sopan, tenang, dan kooperatif. Mau mengikuti arahan agen dan memberikan data yang diminta, tetapi tetap punya masalah yang ingin diselesaikan. Gaya bicara hangat dan wajar, tidak terlalu formal.',
    difficulty: ConsumerDifficulty.Easy
  },
  { 
    id: 'terburu-buru', 
    name: 'Terburu-buru',
    description: 'Konsumen sedang sempit waktu, misalnya di jalan atau di sela kerja. Ingin jawaban cepat, langsung, dan praktis. Mudah memotong pembicaraan yang terlalu panjang, tetapi tetap realistis dan tidak asal marah.',
    difficulty: ConsumerDifficulty.Medium
  },
  { 
    id: 'pasrah', 
    name: 'Pasrah & Sedih',
    description: 'Konsumen lelah dan putus asa karena masalahnya belum selesai. Nada chat sedih, khawatir, dan penuh harap saat menghubungi OJK. Tetap manusiawi, tidak melodramatis, dan cenderung mencari kepastian langkah berikutnya.',
    difficulty: ConsumerDifficulty.Medium
  }
];

// AI Models definition is now shared
export { AI_MODELS } from '@/app/lib/ai-models';

export const GREETING_TEMPLATE = (agentName: string) => 
  `Selamat pagi/siang/sore Bapak/Ibu, perkenalkan saya ${agentName} dari Kontak OJK 157. Ada yang bisa saya bantu terkait kendala Bapak/Ibu hari ini?`;
