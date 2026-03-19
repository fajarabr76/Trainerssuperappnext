import { Scenario, ConsumerType, ConsumerDifficulty } from './types';

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
    description: 'Konsumen sangat marah, emosional, dan tidak sabaran. Merasa dirugikan dan menuntut solusi instan. Sering menggunakan tanda seru.',
    difficulty: ConsumerDifficulty.Hard
  },
  { 
    id: 'bingung', 
    name: 'Bingung & Gaptek', 
    description: 'Konsumen kebingungan, tidak terlalu paham teknologi (gaptek), dan sering bertanya ulang untuk memastikan hal-hal dasar.',
    difficulty: ConsumerDifficulty.Medium
  },
  { 
    id: 'kritis', 
    name: 'Kritis & Detail', 
    description: 'Konsumen sangat kritis, menanyakan detail aturan, dasar hukum, dan tidak mudah percaya dengan jawaban template. Ingin tahu SOP-nya.',
    difficulty: ConsumerDifficulty.Hard
  },
  { 
    id: 'ramah', 
    name: 'Ramah & Kooperatif', 
    description: 'Konsumen sangat ramah, sopan, dan kooperatif dalam memberikan data yang diminta. Sangat menghargai bantuan petugas.',
    difficulty: ConsumerDifficulty.Easy
  },
  { 
    id: 'terburu-buru', 
    name: 'Terburu-buru', 
    description: 'Konsumen sedang dalam perjalanan atau rapat, ingin jawaban singkat dan cepat tanpa banyak basa-basi.',
    difficulty: ConsumerDifficulty.Medium
  },
  { 
    id: 'pasrah', 
    name: 'Pasrah & Sedih', 
    description: 'Konsumen merasa putus asa karena masalah keuangan ini, berbicara dengan nada sedih dan memohon bantuan.',
    difficulty: ConsumerDifficulty.Medium
  }
];

export const AI_MODELS = [
  { id: 'gemini-2.5-flash-native-audio-preview-12-2025', name: 'Gemini 2.5 Flash Audio', description: 'Model audio native dengan latensi rendah.' },
];

export const DUMMY_CITIES = [
  'Jakarta', 'Surabaya', 'Bandung', 'Medan', 'Semarang', 'Makassar', 'Palembang', 'Tangerang', 'Depok', 'Bekasi'
];

export const DUMMY_MALE_NAMES = [
  'Budi', 'Agus', 'Eko', 'Dedi', 'Hendra', 'Iwan', 'Joko', 'Rudi', 'Yudi', 'Adi'
];

export const DUMMY_FEMALE_NAMES = [
  'Siti', 'Ani', 'Dewi', 'Rina', 'Sri', 'Wati', 'Yanti', 'Lina', 'Nur', 'Eka'
];
