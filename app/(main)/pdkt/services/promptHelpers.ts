import { ResolvedConsumerNameMentionPattern, Scenario } from '../types';
import { LICENSED_COMPANY_NAMES, SCENARIO_COMPANY_CATEGORY_MAP } from '../constants';

export function getConsumerNameMentionInstruction(
  pattern: ResolvedConsumerNameMentionPattern
): string {
  switch (pattern) {
    case 'upfront':
      return 'ATURAN NAMA KONSUMEN: Anda boleh menyebut nama di awal email, termasuk pada salam pembuka atau paragraf pertama.';
    case 'middle':
      return 'ATURAN NAMA KONSUMEN: Jangan sebut nama di awal email atau salam pembuka. Jika nama muncul, letakkan di bagian tengah isi email.';
    case 'late':
      return 'ATURAN NAMA KONSUMEN: Jangan sebut nama di awal email atau bagian tengah. Jika nama muncul, letakkan menjelang akhir email atau dekat penutup.';
    case 'none':
      return 'ATURAN NAMA KONSUMEN: Jangan sebut nama Anda sama sekali di salam, body, maupun penutup email. Jangan mengarang nama konsumen jika nama tidak disebut.';
  }
}

export function getCompanyNameInstruction(scenario: Scenario | undefined): string {
  if (!scenario?.isLicensed) {
    return `1. PENAMAAN PERUSAHAAN: WAJIB mengarang NAMA entitas/perusahaan fiktif yang diadukan. JANGAN menggunakan kata "Bank", "Asuransi", atau "Sekuritas" karena entitas ilegal tidak berhak menggunakan nama tersebut. Contoh: "Pinjaman Kilat Nusantara", "Dana Cepat 88", "Investasi Cuan Jaya".`;
  }

  const category = SCENARIO_COMPANY_CATEGORY_MAP[scenario.title] || 'Perbankan';
  const names = LICENSED_COMPANY_NAMES[category];
  const namesList = names.map(n => `- ${n}`).join('\n');

  return `1. PENAMAAN PERUSAHAAN: Gunakan SALAH SATU NAMA RESMI perusahaan berikut untuk LJK yang diadukan:\n${namesList}\nPilih salah satu nama dari daftar di atas. JANGAN mengarang nama perusahaan lain.`;
}
