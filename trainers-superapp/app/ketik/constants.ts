import { Scenario, ConsumerType, ConsumerDifficulty } from '../types';

export const mergeWithDefaults = <T extends { id: string; isCustom?: boolean; description?: string }>(
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

export const parseSettings = (parsed: any): any => ({
  ...parsed,
  scenarios: mergeWithDefaults(parsed.scenarios, DEFAULT_SCENARIOS),
  consumerTypes: mergeWithDefaults(parsed.consumerTypes, DEFAULT_CONSUMER_TYPES),
  activeConsumerTypeId: parsed.activeConsumerTypeId || 'random',
  identitySettings: {
    displayName: parsed.identitySettings?.displayName || '',
    signatureName: parsed.identitySettings?.signatureName || '',
    phoneNumber: parsed.identitySettings?.phoneNumber || '',
    city: parsed.identitySettings?.city || '',
  },
  selectedModel: parsed.selectedModel || 'gemini-3-flash-preview',
  simulationDuration: parsed.simulationDuration || 5,
});

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
    description: 'Konsumen sangat marah, emosional, and tidak sabaran. Merasa dirugikan and menuntut solusi instan. Sering menggunakan tanda seru.',
    difficulty: ConsumerDifficulty.Hard
  },
  { 
    id: 'bingung', 
    name: 'Bingung & Gaptek',
    description: 'Konsumen kebingungan, tidak terlalu paham teknologi (gaptek), and sering bertanya ulang untuk memastikan hal-hal dasar.',
    difficulty: ConsumerDifficulty.Medium
  },
  { 
    id: 'kritis', 
    name: 'Kritis & Detail',
    description: 'Konsumen sangat kritis, menanyakan detail aturan, dasar hukum, and tidak mudah percaya dengan jawaban template. Ingin tahu SOP-nya.',
    difficulty: ConsumerDifficulty.Hard
  },
  { 
    id: 'ramah', 
    name: 'Ramah & Kooperatif',
    description: 'Konsumen sangat ramah, sopan, and kooperatif dalam memberikan data yang diminta. Sangat menghargai bantuan petugas.',
    difficulty: ConsumerDifficulty.Easy
  },
  { 
    id: 'terburu-buru', 
    name: 'Terburu-buru',
    description: 'Konsumen sedang dalam perjalanan atau rapat, ingin jawaban singkat and cepat tanpa banyak basa-basi.',
    difficulty: ConsumerDifficulty.Medium
  },
  { 
    id: 'pasrah', 
    name: 'Pasrah & Sedih',
    description: 'Konsumen merasa putus asa karena masalah keuangan ini, berbicara dengan nada sedih and memohon bantuan.',
    difficulty: ConsumerDifficulty.Medium
  }
];

export const AI_MODELS = [
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', description: 'Cepat dan efisien untuk percakapan natural.' },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', description: 'Lebih cerdas untuk skenario yang sangat kompleks.' }
];

export const GREETING_TEMPLATE = (agentName: string) => 
  `Selamat pagi/siang/sore Bapak/Ibu, perkenalkan saya ${agentName} dari Kontak OJK 157. Ada yang bisa saya bantu terkait kendala Bapak/Ibu hari ini?`;
