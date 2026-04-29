import { AppSettings, Scenario, ConsumerType, ConsumerDifficulty, Identity, ConsumerIdentitySettings } from '@/app/types';

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

export const parseTelefunSettings = (parsed: Record<string, unknown>): AppSettings => ({
  scenarios: mergeWithDefaults(parsed.scenarios as Scenario[], DEFAULT_SCENARIOS),
  consumerTypes: mergeWithDefaults(parsed.consumerTypes as ConsumerType[], DEFAULT_CONSUMER_TYPES),
  activeConsumerTypeId: (parsed.activeConsumerTypeId as string) || 'random',
  preferredConsumerTypeId: (parsed.preferredConsumerTypeId as string) || 'random',
  identitySettings: {
    displayName: (parsed.identitySettings as Record<string, unknown>)?.displayName as string || '',
    gender: (parsed.identitySettings as Record<string, unknown>)?.gender as 'male' | 'female' || 'male',
    phoneNumber: (parsed.identitySettings as Record<string, unknown>)?.phoneNumber as string || '',
    city: (parsed.identitySettings as Record<string, unknown>)?.city as string || '',
    signatureName: (parsed.identitySettings as Record<string, unknown>)?.signatureName as string || '',
  },
  selectedModel: (parsed.selectedModel as string) || 'gemini-3.1-flash-lite-preview',
  maxCallDuration: (parsed.maxCallDuration as number) || 5,
  responsePacingMode:
    (parsed.responsePacingMode === 'realistic' || parsed.responsePacingMode === 'training_fast')
      ? parsed.responsePacingMode
      : 'realistic',
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
    description: 'Konsumen sangat marah, nada bicara tinggi, emosional, dan tidak sabaran. Merasa dirugikan dan menuntut solusi instan. Sering meninggikan suara, memotong pembicaraan agen, dan menggunakan kalimat pendek yang tegas. Tetap terdengar seperti orang sungguhan yang sedang komplain via telepon, bukan karakter fiksi.',
    difficulty: ConsumerDifficulty.Hard
  },
  {
    id: 'bingung',
    name: 'Bingung & Gaptek',
    description: 'Konsumen awam, agak bingung, dan kurang paham istilah teknis atau alur prosedur. Sering minta penjelasan ulang dengan bahasa sederhana, banyak jeda dan gumaman ("ehm", "anu", "begitu ya?"). Tetap terasa natural seperti orang yang benar-benar butuh dibantu, bukan dibuat bodoh-bodohan.',
    difficulty: ConsumerDifficulty.Medium
  },
  {
    id: 'kritis',
    name: 'Kritis & Detail',
    description: 'Konsumen teliti, skeptis, dan cepat menangkap jawaban yang terasa template atau normatif. Suka meminta dasar aturan, alur resmi, atau SOP yang relevan. Tetap bicara sebagai konsumen yang cerdas dan hati-hati, bukan seperti auditor atau pegawai internal. Pertanyaan spesifik dan terstruktur.',
    difficulty: ConsumerDifficulty.Hard
  },
  {
    id: 'ramah',
    name: 'Ramah & Kooperatif',
    description: 'Konsumen sopan, tenang, dan kooperatif. Mau mengikuti arahan agen dan memberikan data yang diminta, tetapi tetap punya masalah yang ingin diselesaikan. Gaya bicara hangat dan wajar, tidak terlalu formal. Sering mengucapkan terima kasih dan menghargai bantuan agen.',
    difficulty: ConsumerDifficulty.Easy
  },
  {
    id: 'terburu-buru',
    name: 'Terburu-buru',
    description: 'Konsumen sedang sempit waktu, misalnya di jalan atau di sela kerja. Ingin jawaban cepat, langsung, dan praktis. Mudah memotong pembicaraan yang terlalu panjang, tetapi tetap realistis dan tidak asal marah. Cenderung memberi respons singkat dan mendesak.',
    difficulty: ConsumerDifficulty.Medium
  },
  {
    id: 'pasrah',
    name: 'Pasrah & Sedih',
    description: 'Konsumen lelah dan putus asa karena masalahnya belum selesai. Nada bicara sedih, khawatir, dan penuh harap saat menghubungi OJK. Tetap manusiawi, tidak melodramatis, dan cenderung mencari kepastian langkah berikutnya. Sering menghela napas atau bicara pelan.',
    difficulty: ConsumerDifficulty.Medium
  }
];

export interface DefaultProfile {
  name: string;
  phone: string;
  city: string;
  gender: 'male' | 'female';
}

export const DEFAULT_IDENTITY_POOL: DefaultProfile[] = [
  { name: 'Agus Setiawan', phone: '0812-3456-7890', city: 'Jakarta', gender: 'male' },
  { name: 'Siti Rahayu', phone: '0813-4567-8901', city: 'Bandung', gender: 'female' },
  { name: 'Budi Hartono', phone: '0814-5678-9012', city: 'Surabaya', gender: 'male' },
  { name: 'Dewi Lestari', phone: '0815-6789-0123', city: 'Medan', gender: 'female' },
  { name: 'Hendra Wijaya', phone: '0816-7890-1234', city: 'Semarang', gender: 'male' },
  { name: 'Rina Marlina', phone: '0817-8901-2345', city: 'Yogyakarta', gender: 'female' },
  { name: 'Andi Pratama', phone: '0818-9012-3456', city: 'Makassar', gender: 'male' },
  { name: 'Fitri Handayani', phone: '0819-0123-4567', city: 'Palembang', gender: 'female' },
  { name: 'Rudi Hermawan', phone: '0821-1234-5678', city: 'Tangerang', gender: 'male' },
  { name: 'Mega Ayuningtyas', phone: '0822-2345-6789', city: 'Bekasi', gender: 'female' },
  { name: 'Dian Permana', phone: '0823-3456-7890', city: 'Depok', gender: 'male' },
  { name: 'Lina Kusuma', phone: '0824-4567-8901', city: 'Bogor', gender: 'female' },
];

export function resolveFinalIdentity(identitySettings: ConsumerIdentitySettings): Identity {
  const hasName = (identitySettings.displayName ?? '').trim().length > 0;
  const hasPhone = (identitySettings.phoneNumber ?? '').trim().length > 0;
  const hasCity = (identitySettings.city ?? '').trim().length > 0;

  const allEmpty = !hasName && !hasPhone && !hasCity;
  const allFilled = hasName && hasPhone && hasCity;

  if (allEmpty) {
    const profile = DEFAULT_IDENTITY_POOL[Math.floor(Math.random() * DEFAULT_IDENTITY_POOL.length)];
    return {
      name: profile.name,
      phone: profile.phone,
      city: profile.city,
      gender: profile.gender,
      signatureName: identitySettings.signatureName,
    };
  }

  if (allFilled) {
    return {
      name: identitySettings.displayName,
      phone: identitySettings.phoneNumber,
      city: identitySettings.city,
      gender: identitySettings.gender ?? 'male',
      signatureName: identitySettings.signatureName,
    };
  }

  const profile = DEFAULT_IDENTITY_POOL[Math.floor(Math.random() * DEFAULT_IDENTITY_POOL.length)];
  return {
    name: hasName ? identitySettings.displayName : profile.name,
    phone: hasPhone ? identitySettings.phoneNumber : profile.phone,
    city: hasCity ? identitySettings.city : profile.city,
    gender: hasName ? (identitySettings.gender ?? 'male') : profile.gender,
    signatureName: identitySettings.signatureName,
  };
}

export { AI_MODELS } from '@/app/lib/ai-models';
