'use server';

import { createClient } from '@/app/lib/supabase/server';
import { revalidatePath } from 'next/cache';

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
