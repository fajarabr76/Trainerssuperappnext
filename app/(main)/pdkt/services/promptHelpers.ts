import { ResolvedConsumerNameMentionPattern } from '../types';

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
