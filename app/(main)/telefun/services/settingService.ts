import { createClient } from '@/app/lib/supabase/client';
import { AppSettings } from '../types';
import { DEFAULT_SCENARIOS, DEFAULT_CONSUMER_TYPES, AI_MODELS } from '../constants';

const supabase = createClient();
const LOCAL_STORAGE_KEY = 'telefun_app_settings_v1';

export const defaultTelefunSettings: AppSettings = {
  scenarios: DEFAULT_SCENARIOS,
  consumerTypes: DEFAULT_CONSUMER_TYPES,
  identitySettings: {
      displayName: '',
      gender: 'male',
      phoneNumber: '',
      city: ''
  },
  selectedModel: 'gemini-2.5-flash-native-audio-preview-12-2025',
  preferredConsumerTypeId: 'random',
  maxCallDuration: 5
};

function saveToLocal(settings: AppSettings) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(settings));
  }
}

function loadFromLocal(): AppSettings | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    
    // Merge with defaults
    return {
         ...defaultTelefunSettings,
         ...parsed,
         scenarios: parsed.scenarios && Array.isArray(parsed.scenarios) ? parsed.scenarios : DEFAULT_SCENARIOS,
         consumerTypes: parsed.consumerTypes && Array.isArray(parsed.consumerTypes) ? parsed.consumerTypes : DEFAULT_CONSUMER_TYPES,
    };
  } catch {
    return null;
  }
}

export async function saveTelefunSettings(settings: AppSettings): Promise<void> {
  saveToLocal(settings);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: existing } = await supabase
    .from('user_settings')
    .select('settings')
    .eq('user_id', user.id)
    .maybeSingle();

  const updatedSettings = {
    ...(existing?.settings || {}),
    telefun: settings
  };

  const { error } = await supabase
    .from('user_settings')
    .upsert({ 
      user_id: user.id, 
      settings: updatedSettings, 
      updated_at: new Date().toISOString() 
    }, { onConflict: 'user_id' });

  if (error) console.error('[Telefun Settings] Error:', error.message);
}

export async function loadTelefunSettings(): Promise<AppSettings> {
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data, error } = await supabase
      .from('user_settings')
      .select('settings')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!error && data?.settings?.telefun) {
      const settings = data.settings.telefun;
      saveToLocal(settings);
      return settings;
    }
  }

  return loadFromLocal() || defaultTelefunSettings;
}
