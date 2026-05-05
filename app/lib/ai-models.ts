/**
 * OpenRouter models available for KETIK and PDKT text simulations.
 * These are text-based models accessed via OpenRouter's unified API.
 */
export const TEXT_OPENROUTER_MODELS = [
  {
    id: 'openai/gpt-oss-120b:free',
    name: 'GPT-OSS 120B',
    description: 'Model open-weight yang kuat untuk tugas yang lebih kompleks.',
    provider: 'openrouter' as const,
  },
  {
    id: 'google/gemini-3.1-flash-lite-preview',
    name: 'Gemini 3.1 Flash Lite',
    description: 'Model ringan Google untuk respons cepat dan hemat biaya via OpenRouter.',
    provider: 'openrouter' as const,
  },
  {
    id: 'google/gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    description: 'Model Gemini 2.5 ringan untuk respons cepat dan hemat biaya via OpenRouter.',
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
 * Direct Gemini models (not via OpenRouter).
 * These are used for various modules that call Gemini API directly.
 */
export const DIRECT_GEMINI_MODELS = [
  {
    id: 'gemini-3.1-flash-lite-preview',
    name: 'Gemini 3.1 Flash Lite',
    description: 'Cepat dan efisien untuk percakapan natural.',
    provider: 'gemini' as const,
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    description: 'Model ringan Gemini 2.5 untuk respons cepat dan hemat biaya.',
    provider: 'gemini' as const,
  },
  {
    id: 'gemini-2.5-flash-preview-tts',
    name: 'Gemini 2.5 Flash TTS',
    description: 'Model Gemini untuk text-to-speech di Telefun.',
    provider: 'gemini' as const,
  },
];

/**
 * Telefun audio models with their transport protocols.
 * Telefun supports two transport modes:
 * - 'gemini-live': Gemini Live API via WebSocket (gemini-3.1-flash-live-preview)
 * - 'openai-audio': OpenAI Realtime API (openai/gpt-audio-mini) - not yet implemented
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
  'gemini-3.1-flash-lite': 'gemini-3.1-flash-lite-preview',
};

/**
 * Normalizes a model ID, handling legacy aliases.
 */
export function normalizeModelId(modelId?: string | null): string {
  if (!modelId) return AI_MODELS[0]?.id || 'gemini-3.1-flash-lite-preview';
  return LEGACY_MODEL_ALIASES[modelId] || modelId;
}

/**
 * Detects the AI provider based on the model ID.
 * OpenRouter models contain a forward slash (/) in their ID.
 */
export function getProviderFromModelId(modelId: string): AIProvider {
  const normalized = normalizeModelId(modelId);
  return normalized.includes('/') ? 'openrouter' : 'gemini';
}

/**
 * Returns models filtered by module use case.
 * - 'ketik' | 'pdkt': Returns OpenRouter text models only
 * - 'telefun': Returns Telefun audio models
 * - 'default': Returns all AI_MODELS (for backwards compatibility)
 */
export function getModelsForModule(module: 'ketik' | 'pdkt' | 'telefun' | 'default' = 'default') {
  switch (module) {
    case 'ketik':
    case 'pdkt':
      return TEXT_OPENROUTER_MODELS;
    case 'telefun':
      return TELEFUN_AUDIO_MODELS;
    default:
      return AI_MODELS;
  }
}

export type AIProvider = 'gemini' | 'openrouter';

/**
 * Complete AI Models list - maintained for backwards compatibility.
 * For new code, prefer using getModelsForModule() or specific model arrays.
 */
export const AI_MODELS = [
  ...DIRECT_GEMINI_MODELS,
  ...TEXT_OPENROUTER_MODELS,
];
