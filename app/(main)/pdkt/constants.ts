import { Scenario, ConsumerType, ConsumerDifficulty } from './types';

export const DEFAULT_SCENARIOS: Scenario[] = [
  {
    id: 'pinjol',
    category: 'Pinjol',
    title: 'Pinjol Ilegal',
    description: 'Konsumen diteror oleh pinjol ilegal padahal tidak pernah meminjam.',
    isActive: true,
    isLicensed: false,
  },
  {
    id: 'penipuan',
    category: 'Penipuan',
    title: 'Penipuan Undian',
    description: 'Konsumen menerima pesan menang undian dan diminta transfer pajak pemenang.',
    isActive: true,
    isLicensed: false,
  },
  {
    id: 'slik',
    category: 'SLIK',
    title: 'Pengecekan SLIK',
    description: 'Konsumen ingin mengecek status BI Checking / SLIK karena pengajuan KPR ditolak.',
    isActive: true,
    isLicensed: true,
  },
  {
    id: 'asuransi',
    category: 'Asuransi',
    title: 'Klaim Asuransi Ditolak',
    description: 'Konsumen mengeluh karena klaim asuransi kesehatannya ditolak dengan alasan yang tidak jelas.',
    isActive: true,
    isLicensed: true,
  },
  {
    id: 'investasi',
    category: 'Investasi',
    title: 'Investasi Bodong',
    description: 'Konsumen melaporkan adanya tawaran investasi dengan imbal hasil tidak wajar (ponzi).',
    isActive: true,
    isLicensed: false,
  },
  {
    id: 'kartu-kredit',
    category: 'Perbankan',
    title: 'Tagihan Kartu Kredit',
    description: 'Konsumen keberatan dengan adanya biaya administrasi atau tagihan yang tidak dikenal di kartu kreditnya.',
    isActive: true,
    isLicensed: true,
  }
];

export const LICENSED_COMPANY_NAMES: Record<string, string[]> = {
  Perbankan: [
    'Bank Central Asia (BCA)',
    'Bank Mandiri',
    'Bank Rakyat Indonesia (BRI)',
    'Bank Negara Indonesia (BNI)',
    'Bank Tabungan Negara (BTN)',
    'Bank CIMB Niaga',
    'Bank Danamon Indonesia',
    'Bank Permata',
    'Bank Maybank Indonesia',
    'Bank Panin',
    'Bank OCBC NISP',
    'Bank Syariah Indonesia (BSI)',
    'Bank Mega',
    'Bank UOB Indonesia',
    'Bank Sinarmas',
  ],
  Asuransi: [
    'Prudential Indonesia',
    'Allianz Life Indonesia',
    'AXA Mandiri Financial Services',
    'Manulife Indonesia',
    'AIA Financial',
    'BNI Life Insurance',
    'BRI Life',
    'Sinarmas MSIG Life',
    'Sequis Life',
    'FWD Insurance Indonesia',
    'Great Eastern Life Indonesia',
    'Sun Life Financial Indonesia',
  ],
};

export const SCENARIO_COMPANY_CATEGORY_MAP: Record<string, string> = {
  'Pengecekan SLIK': 'Perbankan',
  'Tagihan Kartu Kredit': 'Perbankan',
  'Klaim Asuransi Ditolak': 'Asuransi',
};

export const DEFAULT_CONSUMER_TYPES: ConsumerType[] = [
  { 
    id: 'marah', 
    name: 'Marah & Emosional', 
    description: 'Konsumen sangat marah, emosional, dan tidak sabaran. Merasa dirugikan dan menuntut solusi instan. Sering menggunakan tanda seru.',
    difficulty: ConsumerDifficulty.Hard,
    tone: 'Sangat marah, emosional, tidak sabar, dan sering menggunakan tanda seru.'
  },
  { 
    id: 'bingung', 
    name: 'Bingung & Gaptek', 
    description: 'Konsumen kebingungan, tidak terlalu paham teknologi (gaptek), dan sering bertanya ulang untuk memastikan hal-hal dasar.',
    difficulty: ConsumerDifficulty.Medium,
    tone: 'Bingung, ragu-ragu, dan menggunakan bahasa yang sangat awam.'
  },
  { 
    id: 'kritis', 
    name: 'Kritis & Detail', 
    description: 'Konsumen sangat kritis, menanyakan detail aturan, dasar hukum, dan tidak mudah percaya dengan jawaban template. Ingin tahu SOP-nya.',
    difficulty: ConsumerDifficulty.Hard,
    tone: 'Kritis, logis, menuntut detail, dan skeptis.'
  },
  { 
    id: 'ramah', 
    name: 'Ramah & Kooperatif', 
    description: 'Konsumen sangat ramah, sopan, dan kooperatif dalam memberikan data yang diminta. Sangat menghargai bantuan petugas.',
    difficulty: ConsumerDifficulty.Easy,
    tone: 'Sangat ramah, sopan, dan menghargai.'
  },
  { 
    id: 'terburu-buru', 
    name: 'Terburu-buru', 
    description: 'Konsumen sedang dalam perjalanan atau rapat, ingin jawaban singkat dan cepat tanpa banyak basa-basi.',
    difficulty: ConsumerDifficulty.Medium,
    tone: 'Singkat, padat, dan terkesan terburu-buru.'
  },
  { 
    id: 'pasrah', 
    name: 'Pasrah & Sedih', 
    description: 'Konsumen merasa putus asa karena masalah keuangan ini, berbicara dengan nada sedih dan memohon bantuan.',
    difficulty: ConsumerDifficulty.Medium,
    tone: 'Sedih, putus asa, dan memohon bantuan.'
  }
];

export const DUMMY_CITIES = [
  'Jakarta Selatan', 'Jakarta Pusat', 'Jakarta Barat', 'Jakarta Timur', 'Jakarta Utara',
  'Surabaya', 'Bandung', 'Medan', 'Semarang', 'Makassar', 'Palembang', 'Tangerang',
  'Depok', 'Bekasi', 'Bogor', 'Yogyakarta', 'Malang', 'Denpasar', 'Balikpapan',
  'Samarinda', 'Banjarmasin', 'Pontianak', 'Manado', 'Padang', 'Pekanbaru'
];

export const DUMMY_PROFILES = [
  { name: 'Budi Santoso', email: 'budi.santoso88@gmail.com' },
  { name: 'Siti Aminah', email: 'siti.aminah_real@yahoo.com' },
  { name: 'Agus Setiawan', email: 'agus.setiawan.work@gmail.com' },
  { name: 'Dewi Lestari', email: 'dewi.lestari1990@outlook.com' },
  { name: 'Rudi Hartono', email: 'rudi.hartono.bisnis@gmail.com' },
  { name: 'Ratna Sari', email: 'ratna.sari.cantik@gmail.com' },
  { name: 'Eko Prasetyo', email: 'eko.prasetyo77@yahoo.co.id' },
  { name: 'Sri Wahyuni', email: 'sri.wahyuni.guru@gmail.com' },
  { name: 'Hendra Wijaya', email: 'hendra.wijaya.store@gmail.com' },
  { name: 'Nurul Hidayah', email: 'nurul.hidayah.family@gmail.com' },
  { name: 'Bambang Pamungkas', email: 'bambang.pamungkas.bola@gmail.com' },
  { name: 'Lina Marlina', email: 'lina.marlina.shop@gmail.com' },
  { name: 'Dedi Supriyadi', email: 'dedi.supriyadi.teknik@gmail.com' },
  { name: 'Rina Wati', email: 'rina.wati.kue@gmail.com' },
  { name: 'Fajar Nugroho', email: 'fajar.nugroho.dev@gmail.com' },
  { name: 'Yanti Susanti', email: 'yanti.susanti.salon@gmail.com' },
  { name: 'Iwan Fals', email: 'iwan.fals.fans@gmail.com' },
  { name: 'Maya Putri', email: 'maya.putri.travel@gmail.com' },
  { name: 'Reza Rahadian', email: 'reza.rahadian.actor@gmail.com' },
  { name: 'Indah Permatasari', email: 'indah.permatasari.model@gmail.com' }
];
