import 'server-only';

import { createAdminClient } from '@/app/lib/supabase/admin';
import type { ChatMessage } from '@/app/types';
import type { EmailMessage, SessionConfig as PdktSessionConfig, EvaluationResult as PdktEvaluationResult } from '@/app/(main)/pdkt/types';
import type { UnifiedHistory } from './types';

type RoleProfile = {
  id: string;
  email: string | null;
  role: string | null;
};

function safeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function safeObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function safeChatMessages(value: unknown): ChatMessage[] {
  return Array.isArray(value) ? (value as ChatMessage[]) : [];
}

function safeEmails(value: unknown): EmailMessage[] {
  return Array.isArray(value) ? (value as EmailMessage[]) : [];
}

function createTelefunSignature(entry: Pick<UnifiedHistory, 'user_id' | 'scenario_title' | 'created_at' | 'history'>): string {
  const recordingUrl = typeof entry.history === 'string' ? entry.history : '';
  return [
    entry.user_id,
    entry.scenario_title,
    recordingUrl || entry.created_at,
  ].join('::');
}

export async function getMonitoringHistory(): Promise<UnifiedHistory[]> {
  try {
    const admin = createAdminClient();
    const [ketikRes, pdktRes, telefunHistoryRes, telefunResultsRes] = await Promise.all([
      admin.from('ketik_history').select('*').order('date', { ascending: false }),
      admin.from('pdkt_history').select('*').order('timestamp', { ascending: false }),
      admin.from('telefun_history').select('*').order('date', { ascending: false }),
      admin
        .from('results')
        .select('id, user_id, module, score, details, history, created_at')
        .eq('module', 'telefun')
        .order('created_at', { ascending: false }),
    ]);

    if (ketikRes.error) console.error('[monitoring] Failed to read ketik_history:', ketikRes.error);
    if (pdktRes.error) console.error('[monitoring] Failed to read pdkt_history:', pdktRes.error);
    if (telefunHistoryRes.error) console.error('[monitoring] Failed to read telefun_history:', telefunHistoryRes.error);
    if (telefunResultsRes.error) console.error('[monitoring] Failed to read telefun results:', telefunResultsRes.error);

    const allUserIds = new Set<string>();
    (ketikRes.data || []).forEach((row) => allUserIds.add(row.user_id));
    (pdktRes.data || []).forEach((row) => allUserIds.add(row.user_id));
    (telefunHistoryRes.data || []).forEach((row) => allUserIds.add(row.user_id));
    (telefunResultsRes.data || []).forEach((row) => allUserIds.add(row.user_id));

    const profilesMap: Record<string, RoleProfile> = {};
    if (allUserIds.size > 0) {
      const { data: profilesData, error: profilesError } = await admin
        .from('profiles')
        .select('id, email, role')
        .in('id', [...allUserIds]);

      if (profilesError) {
        console.error('[monitoring] Failed to read profiles:', profilesError);
      } else {
        (profilesData || []).forEach((profile) => {
          profilesMap[profile.id] = profile as RoleProfile;
        });
      }
    }

    const unified: UnifiedHistory[] = [];

    (ketikRes.data || []).forEach((row) => {
      const messages = safeChatMessages(row.messages);
      const timestamps = messages
        .map((message) => new Date(message.timestamp || '').getTime())
        .filter((value) => Number.isFinite(value));
      const durationSeconds = timestamps.length >= 2
        ? Math.floor((Math.max(...timestamps) - Math.min(...timestamps)) / 1000)
        : 0;

      unified.push({
        id: row.id,
        user_id: row.user_id,
        module: 'ketik',
        scenario_title: safeString(row.scenario_title, 'Simulasi Chat'),
        created_at: safeString(row.date, ''),
        duration_seconds: durationSeconds,
        score: null,
        history: messages,
        user_email: profilesMap[row.user_id]?.email || undefined,
        user_role: profilesMap[row.user_id]?.role || undefined,
      });
    });

    (pdktRes.data || []).forEach((row) => {
      const config = safeObject(row.config) as unknown as Partial<PdktSessionConfig>;
      const evaluation = safeObject(row.evaluation) as unknown as Partial<PdktEvaluationResult>;

      unified.push({
        id: row.id,
        user_id: row.user_id,
        module: 'pdkt',
        scenario_title: safeString(config?.scenarios?.[0]?.title, 'Simulasi Email'),
        created_at: safeString(row.timestamp, ''),
        duration_seconds: safeNumber(row.time_taken, 0),
        score: typeof evaluation?.score === 'number' ? evaluation.score : null,
        history: safeEmails(row.emails),
        user_email: profilesMap[row.user_id]?.email || undefined,
        user_role: profilesMap[row.user_id]?.role || undefined,
      });
    });

    const telefunSeen = new Set<string>();

    (telefunResultsRes.data || []).forEach((row) => {
      const payload = safeObject(row.details || row.history);
      const entry: UnifiedHistory = {
        id: row.id,
        user_id: row.user_id,
        module: 'telefun',
        scenario_title: safeString(payload.scenario || payload.scenario_title, 'Simulasi Telepon'),
        created_at: safeString(row.created_at, ''),
        duration_seconds: safeNumber(payload.duration, 0),
        score: typeof row.score === 'number' ? row.score : null,
        history: safeString(payload.recordingUrl, ''),
        user_email: profilesMap[row.user_id]?.email || undefined,
        user_role: profilesMap[row.user_id]?.role || undefined,
      };

      telefunSeen.add(createTelefunSignature(entry));
      unified.push(entry);
    });

    (telefunHistoryRes.data || []).forEach((row) => {
      const entry: UnifiedHistory = {
        id: row.id,
        user_id: row.user_id,
        module: 'telefun',
        scenario_title: safeString(row.scenario_title, 'Simulasi Telepon'),
        created_at: safeString(row.date, ''),
        duration_seconds: safeNumber(row.duration, 0),
        score: null,
        history: safeString(row.recording_url, ''),
        user_email: profilesMap[row.user_id]?.email || undefined,
        user_role: profilesMap[row.user_id]?.role || undefined,
      };

      const signature = createTelefunSignature(entry);
      if (!telefunSeen.has(signature)) {
        telefunSeen.add(signature);
        unified.push(entry);
      }
    });

    return unified.sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
  } catch (error) {
    console.error('[monitoring] Failed to assemble unified monitoring history:', error);
    return [];
  }
}
