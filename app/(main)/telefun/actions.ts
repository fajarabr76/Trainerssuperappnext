'use server';

import { createClient } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { SessionMetrics, VoiceQualityAssessment } from '@/app/types/voiceAssessment';
import { getOwnedRecordingPathOrNull, isValidRecordingPath } from './recordingPath';

export interface TelefunHistoryRecord {
  id: string;
  date: string;
  scenario_title: string;
  consumer_name: string;
  consumer_phone: string | null;
  consumer_city: string | null;
  duration: number;
  configured_duration?: number;
  recording_url: string;
  recording_path?: string;
  agent_recording_path?: string;
  score: number;
  feedback: string | null;
  voice_assessment?: VoiceQualityAssessment | null;
  session_metrics?: SessionMetrics | null;
  realistic_mode_enabled?: boolean;
  voice_dashboard_metrics?: any;
  persona_config?: any;
  disruption_config?: any;
  disruption_results?: any;
  created_at: string;
}

export interface PersistTelefunSessionResult {
  success: boolean;
  session?: {
    id: string;
    date: string;
    scenario_title: string;
    consumer_name: string;
    consumer_phone: string;
    consumer_city: string;
    duration: number;
    configured_duration?: number;
    recording_url: string;
    recording_path?: string | null;
    agent_recording_path?: string | null;
    score: number;
    feedback: string;
    voice_assessment?: VoiceQualityAssessment | null;
    session_metrics?: SessionMetrics | null;
  };
  warning?: string;
  error?: string;
}

export async function loadTelefunHistory(): Promise<{ success: boolean; records?: TelefunHistoryRecord[]; error?: string }> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Tidak dapat memverifikasi pengguna.' };
  }

  // Load extra details from results table to hydrate configured_duration if present
  const { data: resultsRows } = await supabase
    .from('results')
    .select('details')
    .eq('user_id', user.id)
    .eq('module', 'telefun')
    .order('created_at', { ascending: false });

  const configuredDurationMap: Record<string, number> = {};
  if (resultsRows) {
    for (const r of resultsRows) {
      const details = r.details as any;
      if (details && details.legacy_history_id && typeof details.configured_duration === 'number') {
        configuredDurationMap[details.legacy_history_id] = details.configured_duration;
      }
    }
  }

  // Try selecting all columns first
  const { data, error } = await supabase
    .from('telefun_history')
    .select('id, date, scenario_title, consumer_name, consumer_phone, consumer_city, duration, recording_url, recording_path, agent_recording_path, score, feedback, voice_assessment, session_metrics, realistic_mode_enabled, voice_dashboard_metrics, persona_config, disruption_config, disruption_results, created_at')
    .eq('user_id', user.id)
    .order('date', { ascending: false });

  if (error) {
    console.warn('[Telefun] Failed to load full history, retrying with basic columns:', error.message);
    
    // Fallback: Select only guaranteed columns
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('telefun_history')
      .select('id, date, scenario_title, consumer_name, consumer_phone, consumer_city, duration, recording_url, score, feedback, created_at')
      .eq('user_id', user.id)
      .order('date', { ascending: false });

    if (fallbackError) {
      return { success: false, error: fallbackError.message };
    }

    return {
      success: true,
      records: (fallbackData || []).map(row => ({
        id: row.id,
        date: row.date ?? row.created_at,
        scenario_title: row.scenario_title,
        consumer_name: row.consumer_name,
        consumer_phone: row.consumer_phone,
        consumer_city: row.consumer_city,
        duration: row.duration,
        configured_duration: configuredDurationMap[row.id],
        recording_url: row.recording_url,
        score: row.score,
        feedback: row.feedback,
        created_at: row.created_at,
      })),
    };
  }

  return {
    success: true,
    records: (data || []).map(row => ({
      id: row.id,
      date: row.date ?? row.created_at,
      scenario_title: row.scenario_title,
      consumer_name: row.consumer_name,
      consumer_phone: row.consumer_phone,
      consumer_city: row.consumer_city,
      duration: row.duration,
      configured_duration: configuredDurationMap[row.id],
      recording_url: row.recording_url,
      recording_path: row.recording_path,
      agent_recording_path: row.agent_recording_path,
      score: row.score,
      feedback: row.feedback,
      voice_assessment: row.voice_assessment,
      session_metrics: row.session_metrics,
      realistic_mode_enabled: row.realistic_mode_enabled,
      voice_dashboard_metrics: row.voice_dashboard_metrics,
      persona_config: row.persona_config,
      disruption_config: row.disruption_config,
      disruption_results: row.disruption_results,
      created_at: row.created_at,
    })),
  };
}

export async function deleteTelefunSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Tidak dapat memverifikasi pengguna.' };
  }

  // Storage cleanup (PII-compliant)
  const admin = createAdminClient();
  const { data: row } = await admin.from('telefun_history')
    .select('recording_path, agent_recording_path')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single();

  const pathsToDelete = [row?.recording_path, row?.agent_recording_path].filter(Boolean) as string[];
  if (pathsToDelete.length > 0) {
    await admin.storage.from('telefun-recordings').remove(pathsToDelete);
  }

  const [historyResult, resultsResult] = await Promise.all([
    supabase
      .from('telefun_history')
      .delete()
      .eq('id', sessionId)
      .eq('user_id', user.id),
    supabase
      .from('results')
      .delete()
      .eq('user_id', user.id)
      .eq('module', 'telefun')
      .not('details->legacy_history_id', 'is', null)
      .contains('details', { legacy_history_id: sessionId }),
  ]);

  if (historyResult.error) {
    return { success: false, error: historyResult.error.message };
  }
  if (resultsResult.error) {
    console.warn('[Telefun] Gagal menghapus baris results terkait:', resultsResult.error.message);
  }

  revalidatePath('/telefun');
  revalidatePath('/dashboard/monitoring');

  return { success: true };
}

export async function clearTelefunHistory(): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Tidak dapat memverifikasi pengguna.' };
  }

  // Batch storage cleanup
  const admin = createAdminClient();
  let allPaths: string[] = [];
  let page = 0;
  const pageSize = 1000;

  while (true) {
    const { data: records, error } = await admin.from('telefun_history')
      .select('recording_path, agent_recording_path')
      .eq('user_id', user.id)
      .order('id') // Stable pagination
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error || !records || records.length === 0) break;

    const paths = records.flatMap(r => [r.recording_path, r.agent_recording_path]).filter(Boolean) as string[];
    allPaths = allPaths.concat(paths);

    if (records.length < pageSize) break;
    page++;
  }
  if (allPaths.length > 0) {
    // Supabase storage.remove() has a 1000 file limit. Batch in chunks of 500 for safety.
    const chunkSize = 500;
    for (let i = 0; i < allPaths.length; i += chunkSize) {
      const chunk = allPaths.slice(i, i + chunkSize);
      await admin.storage.from('telefun-recordings').remove(chunk);
    }
  }

  const [historyResult, resultsResult] = await Promise.all([
    supabase
      .from('telefun_history')
      .delete()
      .eq('user_id', user.id),
    supabase
      .from('results')
      .delete()
      .eq('user_id', user.id)
      .eq('module', 'telefun')
      .not('details->legacy_history_id', 'is', null),
  ]);

  if (historyResult.error) {
    return { success: false, error: historyResult.error.message };
  }
  if (resultsResult.error) {
    console.warn('[Telefun] Gagal menghapus baris results terkait:', resultsResult.error.message);
  }

  revalidatePath('/telefun');
  revalidatePath('/dashboard/monitoring');

  return { success: true };
}

export async function persistTelefunSession(params: {
  userId: string;
  scenarioTitle: string;
  consumerName: string;
  consumerPhone: string;
  consumerCity: string;
  duration: number;
  configuredDuration?: number;
  recordingUrl: string;
  score: number;
  feedback: string;
  sessionMetrics?: SessionMetrics;
  /** Realistic mode fields */
  realisticModeEnabled?: boolean;
  personaConfig?: Record<string, unknown> | null;
  disruptionConfig?: string[] | null;
  disruptionResults?: Record<string, unknown>[] | null;
}): Promise<PersistTelefunSessionResult> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== params.userId) {
    return { success: false, error: 'Auth mismatch or not authenticated.' };
  }

  const sessionData: any = {
    user_id: params.userId,
    date: new Date().toISOString(),
    scenario_title: params.scenarioTitle,
    consumer_name: params.consumerName,
    consumer_phone: params.consumerPhone,
    consumer_city: params.consumerCity,
    duration: params.duration,
    recording_url: params.recordingUrl,
    score: params.score,
    feedback: params.feedback,
    session_metrics: params.sessionMetrics || null,
  };

  // Add realistic mode fields if enabled
  if (params.realisticModeEnabled) {
    sessionData.realistic_mode_enabled = true;
    if (params.personaConfig) sessionData.persona_config = params.personaConfig;
    if (params.disruptionConfig) sessionData.disruption_config = params.disruptionConfig;
    if (params.disruptionResults) sessionData.disruption_results = params.disruptionResults;
  }

  let { data: historyData, error: historyError } = await supabase
    .from('telefun_history')
    .insert([sessionData])
    .select()
    .single();

  if (historyError && historyError.message.includes('session_metrics')) {
    console.warn('[Telefun] Failed to persist with session_metrics, retrying without it...');
    delete sessionData.session_metrics;
    const retry = await supabase
      .from('telefun_history')
      .insert([sessionData])
      .select()
      .single();
    historyData = retry.data;
    historyError = retry.error;
  }

  if (historyError || !historyData) {
    return {
      success: false,
      error: historyError?.message || 'Gagal menyimpan riwayat Telefun.',
    };
  }

  let resultsWarning: string | undefined;

  const resultData = {
    user_id: params.userId,
    module: 'telefun',
    score: params.score,
    details: {
      legacy_history_id: historyData.id,
      scenario_title: params.scenarioTitle,
      consumer_name: params.consumerName,
      consumer_phone: params.consumerPhone,
      consumer_city: params.consumerCity,
      duration: params.duration,
      configured_duration: params.configuredDuration,
      recording_url: params.recordingUrl,
      feedback: params.feedback,
    },
  };

  const { error: resultsError } = await supabase.from('results').insert([resultData]);
  if (resultsError) {
    resultsWarning = `History tersimpan, tetapi gagal menyimpan ke results: ${resultsError.message}`;
  }

  revalidatePath('/telefun');
  revalidatePath('/dashboard/monitoring');

  return {
    success: true,
    session: {
      id: historyData.id,
      date: historyData.date ?? historyData.created_at,
      scenario_title: historyData.scenario_title,
      consumer_name: historyData.consumer_name,
      consumer_phone: historyData.consumer_phone,
      consumer_city: historyData.consumer_city,
      duration: historyData.duration,
      configured_duration: params.configuredDuration,
      recording_url: historyData.recording_url,
      recording_path: historyData.recording_path,
      agent_recording_path: historyData.agent_recording_path,
      score: historyData.score,
      feedback: historyData.feedback,
      voice_assessment: historyData.voice_assessment,
      session_metrics: historyData.session_metrics,
    },
    warning: resultsWarning,
  };
}

export async function finalizeTelefunRecording(params: {
  sessionId: string;
  recordingPath?: string;
  agentRecordingPath?: string;
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Auth required' };

  if (!params.recordingPath && !params.agentRecordingPath) {
    return { success: false, error: 'At least one path required' };
  }

  // Validate each provided path
  if (params.recordingPath &&
      !isValidRecordingPath(params.recordingPath, user.id, params.sessionId, 'full_call')) {
    return { success: false, error: 'Invalid recording path' };
  }
  if (params.agentRecordingPath &&
      !isValidRecordingPath(params.agentRecordingPath, user.id, params.sessionId, 'agent_only')) {
    return { success: false, error: 'Invalid agent recording path' };
  }

  const updateFields: Record<string, string> = {};
  if (params.recordingPath) updateFields.recording_path = params.recordingPath;
  if (params.agentRecordingPath) updateFields.agent_recording_path = params.agentRecordingPath;

  const admin = createAdminClient();
  const { data, error } = await admin.from('telefun_history')
    .update(updateFields)
    .eq('id', params.sessionId)
    .eq('user_id', user.id)
    .select('id')
    .single();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: 'Session not found or not owned by user' };

  return { success: true };
}

export async function getTelefunSignedUrl(params: {
  sessionId: string;
  type: 'full_call' | 'agent_only';
}): Promise<{ success: boolean; signedUrl?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Auth required' };

  const admin = createAdminClient();
  const column = params.type === 'full_call' ? 'recording_path' : 'agent_recording_path';

  const { data: row } = await admin.from('telefun_history')
    .select(column)
    .eq('id', params.sessionId)
    .eq('user_id', user.id)
    .single();

  const path = getOwnedRecordingPathOrNull(row?.[column], user.id, params.sessionId, params.type);
  if (!path) {
    return { success: false, error: 'Recording path not found for this session' };
  }

  const { data, error } = await admin.storage
    .from('telefun-recordings')
    .createSignedUrl(path, 3600); // 1 hour

  if (error || !data?.signedUrl) {
    return { success: false, error: error?.message || 'Failed to generate signed URL' };
  }

  return { success: true, signedUrl: data.signedUrl };
}
