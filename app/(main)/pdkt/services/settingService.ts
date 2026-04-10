import { createClient } from '@/app/lib/supabase/client';
import { AppSettings } from '../types';
import { DEFAULT_SCENARIOS, DEFAULT_CONSUMER_TYPES } from '../constants';

const supabase = createClient();
const LOCAL_STORAGE_KEY = 'pdkt_settings_v2';

export const defaultPdktSettings: AppSettings = {
  scenarios: DEFAULT_SCENARIOS,
  consumerTypes: DEFAULT_CONSUMER_TYPES,
  enableImageGeneration: true,
  globalConsumerTypeId: 'random',
  selectedModel: 'qwen/qwen3-next-80b-a3b-instruct:free',
};

export async function loadPdktSettings(): Promise<AppSettings> {
  // 1. Ambil dari localStorage (cepat)
  let settings = defaultPdktSettings;
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      settings = JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load PDKT settings from local storage', e);
  }

  // 2. Ambil dari Supabase (jika login)
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data, error } = await supabase
        .from('user_settings')
        .select('settings')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!error && data?.settings?.pdkt) {
        settings = data.settings.pdkt;
        // Update local storage
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(settings));
      }
    }
  } catch (e) {
    console.error('Failed to load PDKT settings from Supabase', e);
  }

  // Ensure scenarios and consumerTypes are present
  if (!settings.scenarios || settings.scenarios.length === 0) settings.scenarios = DEFAULT_SCENARIOS;
  if (!settings.consumerTypes || settings.consumerTypes.length === 0) settings.consumerTypes = DEFAULT_CONSUMER_TYPES;

  return settings;
}

export async function savePdktSettings(settings: AppSettings): Promise<void> {
  // 1. Simpan ke localStorage
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(settings));

  // 2. Simpan ke Supabase
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: existing } = await supabase
        .from('user_settings')
        .select('settings')
        .eq('user_id', user.id)
        .maybeSingle();

      const mergedSettings = {
        ...(existing?.settings || {}),
        pdkt: settings,
      };

      await supabase
        .from('user_settings')
        .upsert(
          { user_id: user.id, settings: mergedSettings, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        );
    }
  } catch (e) {
    console.error('Failed to save PDKT settings to Supabase', e);
  }
}
