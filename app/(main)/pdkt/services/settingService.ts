import { createClient } from '@/app/lib/supabase/client';
import { AppSettings, ConsumerNameMentionPattern, ResolvedConsumerNameMentionPattern } from '../types';
import { DEFAULT_SCENARIOS, DEFAULT_CONSUMER_TYPES } from '../constants';
import { normalizeModelId, TEXT_OPENROUTER_MODELS } from '@/app/lib/ai-models';

const supabase = createClient();
const LOCAL_STORAGE_KEY = 'pdkt_settings_v2';
const DEFAULT_PDKT_MODEL_ID = TEXT_OPENROUTER_MODELS[0]?.id || 'openai/gpt-oss-120b:free';

const CONSUMER_NAME_MENTION_PATTERNS = [
  'random',
  'upfront',
  'middle',
  'late',
  'none',
] as const;

const RESOLVED_CONSUMER_NAME_MENTION_PATTERNS = [
  'upfront',
  'middle',
  'late',
  'none',
] as const;

function coercePdktModelId(modelId?: string | null): string {
  const normalizedModelId = normalizeModelId(modelId);
  return TEXT_OPENROUTER_MODELS.some((model) => model.id === normalizedModelId)
    ? normalizedModelId
    : DEFAULT_PDKT_MODEL_ID;
}

export function coerceConsumerNameMentionPattern(
  value?: string | null
): ConsumerNameMentionPattern {
  return CONSUMER_NAME_MENTION_PATTERNS.includes(
    value as ConsumerNameMentionPattern
  )
    ? (value as ConsumerNameMentionPattern)
    : 'random';
}

export function resolveConsumerNameMentionPattern(
  value?: string | null
): ResolvedConsumerNameMentionPattern {
  const coerced = coerceConsumerNameMentionPattern(value);

  if (coerced !== 'random') {
    return coerced;
  }

  const randomIndex = Math.floor(
    Math.random() * RESOLVED_CONSUMER_NAME_MENTION_PATTERNS.length
  );

  return RESOLVED_CONSUMER_NAME_MENTION_PATTERNS[randomIndex];
}

export const defaultPdktSettings: AppSettings = {
  scenarios: DEFAULT_SCENARIOS,
  consumerTypes: DEFAULT_CONSUMER_TYPES,
  enableImageGeneration: true,
  globalConsumerTypeId: 'random',
  selectedModel: DEFAULT_PDKT_MODEL_ID,
  consumerNameMentionPattern: 'random',
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
  settings.selectedModel = coercePdktModelId(settings.selectedModel);
  settings.consumerNameMentionPattern = coerceConsumerNameMentionPattern(
    settings.consumerNameMentionPattern
  );

  return settings;
}

export async function savePdktSettings(settings: AppSettings): Promise<void> {
  settings.selectedModel = coercePdktModelId(settings.selectedModel);
  settings.consumerNameMentionPattern = coerceConsumerNameMentionPattern(
    settings.consumerNameMentionPattern
  );

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
