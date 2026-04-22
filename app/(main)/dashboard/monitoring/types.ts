import type { ChatMessage } from '@/app/types';
import type { EmailMessage } from '@/app/(main)/pdkt/types';

export interface UnifiedHistory {
  id: string;
  user_id: string;
  module: 'ketik' | 'pdkt' | 'telefun';
  scenario_title: string;
  created_at: string;
  duration_seconds: number;
  score: number | null;
  history: ChatMessage[] | EmailMessage[] | string;
  user_email?: string;
  user_role?: string;
}
