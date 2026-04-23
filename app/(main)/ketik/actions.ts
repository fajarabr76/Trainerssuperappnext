'use server';

import { createClient } from '@/app/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { ChatMessage } from '@/app/types';

export interface PersistKetikSessionResult {
  success: boolean;
  session?: {
    id: string;
    date: string;
    scenario_title: string;
    consumer_name: string;
    consumer_phone: string;
    consumer_city: string;
    messages: ChatMessage[];
  };
  warning?: string;
  error?: string;
}

export async function persistKetikSession(params: {
  userId: string;
  scenarioTitle: string;
  consumerName: string;
  consumerPhone: string;
  consumerCity: string;
  messages: ChatMessage[];
}): Promise<PersistKetikSessionResult> {
  const supabase = await createClient();

  const sessionData = {
    user_id: params.userId,
    date: new Date().toISOString(),
    scenario_title: params.scenarioTitle,
    consumer_name: params.consumerName,
    consumer_phone: params.consumerPhone,
    consumer_city: params.consumerCity,
    messages: params.messages,
  };

  const { data: historyData, error: historyError } = await supabase
    .from('ketik_history')
    .insert([sessionData])
    .select()
    .single();

  if (historyError || !historyData) {
    return {
      success: false,
      error: historyError?.message || 'Gagal menyimpan riwayat Ketik.',
    };
  }

  let resultsWarning: string | undefined;

  const resultData = {
    user_id: params.userId,
    module: 'ketik',
    score: 0,
    details: {
      legacy_history_id: historyData.id,
      scenario_title: params.scenarioTitle,
      consumer_name: params.consumerName,
      consumer_phone: params.consumerPhone,
      consumer_city: params.consumerCity,
      messages: params.messages,
    },
  };

  const { error: resultsError } = await supabase.from('results').insert([resultData]);
  if (resultsError) {
    resultsWarning = `History tersimpan, tetapi gagal menyimpan ke results: ${resultsError.message}`;
  }

  revalidatePath('/ketik');
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
      messages: historyData.messages,
    },
    warning: resultsWarning,
  };
}
