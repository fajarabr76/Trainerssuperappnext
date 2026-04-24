import { ChatMessage } from '@/app/types';

const STRICT_INSTRUCTIONAL_CUES = [
  'silakan',
  'mohon',
  'harap',
  'bisa dilakukan',
  'yang perlu',
  'pastikan',
  'hubungi',
  'datang ke',
  'bawa',
  'siapkan',
  'verifikasi',
] as const;

const ACTION_VERB_CUES = [
  'coba',
  'klik',
  'tekan',
  'pilih',
  'masukkan',
  'isi',
  'konfirmasi',
] as const;

export function getLastNonSystemSpeaker(messages: ChatMessage[]): 'agent' | 'consumer' | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m.sender === 'agent' || m.sender === 'consumer') {
      return m.sender;
    }
  }
  return null;
}

export function getLastAgentMessage(messages: ChatMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].sender === 'agent') {
      return messages[i].text;
    }
  }
  return null;
}

function hasStructuralSteps(text: string): boolean {
  const lines = text.split(/\n/);
  let stepCount = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^[\d]+[.)]\s/.test(trimmed)) stepCount += 1;
    else if (/^[a-z][.)]\s/i.test(trimmed)) stepCount += 1;
    else if (/^[-*•]\s/.test(trimmed)) stepCount += 1;
  }
  return stepCount >= 2;
}

function countCuesWithBoundary(lower: string): number {
  let count = 0;
  for (const cue of STRICT_INSTRUCTIONAL_CUES) {
    const escaped = cue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = cue.includes(' ')
      ? new RegExp(escaped, 'i')
      : new RegExp(`\\b${escaped}\\b`, 'i');
    if (pattern.test(lower)) count += 1;
  }
  for (const cue of ACTION_VERB_CUES) {
    const escaped = cue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\\b${escaped}\\b`, 'i');
    if (pattern.test(lower)) count += 1;
  }
  return count;
}

export function allowSolutionAcknowledgement(lastAgentText: string | null): boolean {
  if (!lastAgentText) return false;

  const lower = lastAgentText.toLowerCase();
  const cueCount = countCuesWithBoundary(lower);
  const hasSteps = hasStructuralSteps(lastAgentText);
  const hasNextWord = /\b(selanjutnya|berikutnya|kemudian|lalu)\b/i.test(lower);

  if (cueCount >= 3) return true;
  if (cueCount >= 2 && hasSteps) return true;
  if (cueCount >= 2 && hasNextWord) return true;
  if (cueCount >= 1 && hasSteps) return true;

  return false;
}
