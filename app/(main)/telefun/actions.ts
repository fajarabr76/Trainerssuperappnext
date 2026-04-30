'use server';

import { createClient } from '@/app/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export interface TelefunHistoryRecord {
  id: string;
  date: string;
  scenario_title: string;
  consumer_name: string;
  consumer_phone: string | null;
  consumer_city: string | null;
  duration: number;
  recording_url: string;
  score: number;
  feedback: string | null;
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
    recording_url: string;
    score: number;
    feedback: string;
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

  const { data, error } = await supabase
    .from('telefun_history')
    .select('id, date, scenario_title, consumer_name, consumer_phone, consumer_city, duration, recording_url, score, feedback, created_at')
    .eq('user_id', user.id)
    .order('date', { ascending: false });

  if (error) {
    return { success: false, error: error.message };
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
      recording_url: row.recording_url,
      score: row.score,
      feedback: row.feedback,
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
  recordingUrl: string;
  score: number;
  feedback: string;
}): Promise<PersistTelefunSessionResult> {
  const supabase = await createClient();

  const sessionData = {
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
  };

  const { data: historyData, error: historyError } = await supabase
    .from('telefun_history')
    .insert([sessionData])
    .select()
    .single();

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
      recording_url: historyData.recording_url,
      score: historyData.score,
      feedback: historyData.feedback,
    },
    warning: resultsWarning,
  };
}
