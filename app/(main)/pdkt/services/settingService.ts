import { createClient } from '@/app/lib/supabase/client';
import { AppSettings, ConsumerNameMentionPattern, ResolvedConsumerNameMentionPattern, SessionConfig, Scenario, ConsumerType, Identity } from '../types';
import { DEFAULT_SCENARIOS, DEFAULT_CONSUMER_TYPES, DUMMY_PROFILES, DUMMY_CITIES } from '../constants';
import { normalizeModelId, TEXT_SIMULATION_MODELS } from '@/app/lib/ai-models';

const supabase = createClient();
const LOCAL_STORAGE_KEY = 'pdkt_settings_v2';
const DEFAULT_PDKT_MODEL_ID = 'gemini-3.1-flash-lite';

const CONSUMER_NAME_MENTION_PATTERNS = [
  'random',
  'upfront',
  'middle',
  'late',
  'none',
] as const;

const WRITING_STYLE_MODES = ['realistic', 'training'] as const;

const RESOLVED_CONSUMER_NAME_MENTION_PATTERNS = [
  'upfront',
  'middle',
  'late',
  'none',
] as const;

function coercePdktModelId(modelId?: string | null): string {
  const normalizedModelId = normalizeModelId(modelId);
  const exists = TEXT_SIMULATION_MODELS.some((model) => model.id === normalizedModelId);
  
  if (modelId && !exists) {
    console.warn(`[PDKT] Model ID "${modelId}" is not in curated list. Coercing to default.`);
  }

  return exists ? normalizedModelId : DEFAULT_PDKT_MODEL_ID;
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

export function coerceWritingStyleMode(
  value?: string | null
): 'realistic' | 'training' {
  return WRITING_STYLE_MODES.includes(value as any)
    ? (value as 'realistic' | 'training')
    : 'training';
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
  writingStyleMode: 'training',
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
  if (!settings.scenarios || settings.scenarios.length === 0) {
    settings.scenarios = DEFAULT_SCENARIOS;
  } else {
    // Migration logic for legacy script field
    settings.scenarios = settings.scenarios.map(s => {
      if (s.script && (!s.sampleEmailTemplate || !s.sampleEmailTemplate.body)) {
        return {
          ...s,
          sampleEmailTemplate: {
            ...s.sampleEmailTemplate,
            body: s.script
          },
          alwaysUseSampleEmail: false
        };
      }
      return s;
    });

    // Merge saved scenarios with defaults to pick up new fields (e.g. isLicensed)
    settings.scenarios = settings.scenarios.map(saved => {
      const defaultScenario = DEFAULT_SCENARIOS.find(d => d.id === saved.id);
      return defaultScenario ? { ...defaultScenario, ...saved } : saved;
    });
  }

  if (!settings.consumerTypes || settings.consumerTypes.length === 0) settings.consumerTypes = DEFAULT_CONSUMER_TYPES;
  settings.selectedModel = coercePdktModelId(settings.selectedModel);
  settings.consumerNameMentionPattern = coerceConsumerNameMentionPattern(
    settings.consumerNameMentionPattern
  );
  settings.writingStyleMode = coerceWritingStyleMode(settings.writingStyleMode);

  return settings;
}

export async function savePdktSettings(settings: AppSettings): Promise<void> {
  settings.selectedModel = coercePdktModelId(settings.selectedModel);
  settings.consumerNameMentionPattern = coerceConsumerNameMentionPattern(
    settings.consumerNameMentionPattern
  );
  settings.writingStyleMode = coerceWritingStyleMode(settings.writingStyleMode);

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

export function generateSessionConfig(settings: AppSettings, scenario?: Scenario): SessionConfig {
  let selectedConsumerType: ConsumerType;
  if (settings.globalConsumerTypeId && settings.globalConsumerTypeId !== 'random') {
    selectedConsumerType = settings.consumerTypes.find(t => t.id === settings.globalConsumerTypeId)
      || settings.consumerTypes[Math.floor(Math.random() * settings.consumerTypes.length)];
  } else {
    selectedConsumerType = settings.consumerTypes[Math.floor(Math.random() * settings.consumerTypes.length)];
  }

  const randomProfile = DUMMY_PROFILES[Math.floor(Math.random() * DUMMY_PROFILES.length)];
  const randomCity = DUMMY_CITIES[Math.floor(Math.random() * DUMMY_CITIES.length)];
  const customIdentity = settings.customIdentity;

  const identity: Identity = {
    name: customIdentity?.senderName || randomProfile.name,
    email: customIdentity?.email || randomProfile.email,
    city: customIdentity?.city || randomCity,
    bodyName: customIdentity?.bodyName || (customIdentity?.senderName || randomProfile.name),
  };

  const resolvedConsumerNameMentionPattern =
    resolveConsumerNameMentionPattern(settings.consumerNameMentionPattern);

  return {
    scenarios: scenario ? [scenario] : settings.scenarios.filter(s => s.isActive),
    consumerType: selectedConsumerType,
    identity,
    enableImageGeneration: settings.enableImageGeneration ?? true,
    selectedModel: normalizeModelId(settings.selectedModel),
    resolvedConsumerNameMentionPattern,
    writingStyleMode: coerceWritingStyleMode(settings.writingStyleMode),
  };
}
