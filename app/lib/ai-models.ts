const DEFAULT_MODEL_ID = 'gemini-3.1-flash-lite';

export const VOICE_ASSESSMENT_MODEL = 'gemini-3.1-flash-lite';

/**
 * Complete AI Models list.
 * For new code, prefer using getModelsForModule() or specific model arrays.
 */
export const AI_MODELS = [
  // Direct Gemini
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    description: 'Cepat dan efisien untuk percakapan natural.',
    provider: 'gemini' as const,
  },
  {
    id: 'gemini-2.0-flash-lite',
    name: 'Gemini 2.0 Flash Lite',
    description: 'Model ringan Gemini 2.0 untuk respons cepat dan hemat biaya.',
    provider: 'gemini' as const,
  },
  {
    id: 'gemini-2.0-flash-preview-tts',
    name: 'Gemini 2.0 Flash TTS',
    description: 'Model Gemini untuk text-to-speech di Telefun.',
    provider: 'gemini' as const,
  },
  // OpenRouter
  {
    id: 'openai/gpt-oss-120b:free',
    name: 'GPT-OSS 120B',
    description: 'Model open-weight yang kuat untuk tugas yang lebih kompleks.',
    provider: 'openrouter' as const,
  },
  {
    id: 'google/gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    description: 'Model ringan Google untuk respons cepat dan hemat biaya via OpenRouter.',
    provider: 'openrouter' as const,
  },
  {
    id: 'google/gemini-2.0-flash-lite',
    name: 'Gemini 2.0 Flash Lite',
    description: 'Model Gemini 2.0 ringan untuk respons cepat dan hemat biaya via OpenRouter.',
    provider: 'openrouter' as const,
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    description: 'Model OpenAI yang compact dan efisien untuk tugas text.',
    provider: 'openrouter' as const,
  },
  {
    id: 'qwen/qwen3.5-flash-02-23',
    name: 'Qwen 3.5 Flash',
    description: 'Model Qwen yang cepat dan efisien untuk berbagai tugas text.',
    provider: 'openrouter' as const,
  },
];

/**
 * OpenRouter models available for KETIK and PDKT text simulations.
 */
export const TEXT_OPENROUTER_MODELS = AI_MODELS.filter(m => m.provider === 'openrouter');

/**
 * Direct Gemini models (not via OpenRouter).
 */
export const DIRECT_GEMINI_MODELS = AI_MODELS.filter(m => m.provider === 'gemini' && !m.id.includes('live'));

/**
 * Models available for KETIK and PDKT text simulations.
 * Explicitly curated to exclude non-text models (like TTS).
 */
export const TEXT_SIMULATION_MODELS = AI_MODELS.filter(m => 
  (m.provider === 'gemini' && !m.id.includes('live') && !m.id.includes('tts')) ||
  (m.provider === 'openrouter' && !m.id.includes('audio'))
);

/**
 * Telefun audio models with their transport protocols.
 */
export const TELEFUN_AUDIO_MODELS = [
  {
    id: 'gemini-3.1-flash-live-preview',
    name: 'Gemini 3.1 Flash Live',
    description: 'Model live real-time untuk voice call Telefun via Gemini Live WebSocket.',
    provider: 'gemini' as const,
    telefunTransport: 'gemini-live' as const,
  },
  {
    id: 'openai/gpt-audio-mini',
    name: 'GPT Audio Mini',
    description: 'Model OpenAI untuk audio. BELUM DIIMPLEMENTASI - coming soon.',
    provider: 'openrouter' as const,
    telefunTransport: 'openai-audio' as const,
    disabled: true,
  },
];

/**
 * Legacy model aliases for backwards compatibility.
 */
const LEGACY_MODEL_ALIASES: Record<string, string> = {
  'gemini-3.1-flash-lite-preview': 'gemini-3.1-flash-lite',
};

/**
 * Normalizes a model ID, handling legacy aliases.
 */
export function normalizeModelId(modelId?: string | null): string {
  if (!modelId) return DEFAULT_MODEL_ID;
  return LEGACY_MODEL_ALIASES[modelId] || modelId;
}


/**
 * Detects the AI provider based on the model ID.
 */
export function getProviderFromModelId(modelId: string): AIProvider {
  const normalized = normalizeModelId(modelId);
  return normalized.includes('/') ? 'openrouter' : 'gemini';
}

/**
 * Returns models filtered by module use case.
 */
export function getModelsForModule(module: 'ketik' | 'pdkt' | 'telefun' | 'default' = 'default') {
  switch (module) {
    case 'ketik':
    case 'pdkt':
      return TEXT_SIMULATION_MODELS;
    case 'telefun':
      return TELEFUN_AUDIO_MODELS;
    default:
      return AI_MODELS;
  }
}

export type AIProvider = 'gemini' | 'openrouter';

