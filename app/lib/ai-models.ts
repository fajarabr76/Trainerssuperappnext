export const AI_MODELS = [
  { 
    id: 'gemini-3-flash-preview', 
    name: 'Gemini 3 Flash', 
    description: 'Cepat dan efisien untuk percakapan natural.', 
    provider: 'gemini' as const 
  },
  { 
    id: 'gemini-3.1-pro-preview', 
    name: 'Gemini 3.1 Pro', 
    description: 'Lebih cerdas untuk skenario yang sangat kompleks.', 
    provider: 'gemini' as const 
  },
  { 
    id: 'qwen/qwen3-next-80b-a3b-instruct:free', 
    name: 'Qwen 3 Next 80B', 
    description: 'Model Qwen generasi berikutnya, sangat cerdas & responsif (gratis).', 
    provider: 'openrouter' as const 
  },
  { 
    id: 'google/gemma-4-31b-it:free', 
    name: 'Gemma 4 31B', 
    description: 'Model Google terbaru, efisien dan cerdas (gratis).', 
    provider: 'openrouter' as const 
  },
];

export type AIProvider = 'gemini' | 'openrouter';

/**
 * Detects the AI provider based on the model ID.
 * OpenRouter models typically contain a forward slash (/).
 */
export function getProviderFromModelId(modelId: string): AIProvider {
  return modelId.includes('/') ? 'openrouter' : 'gemini';
}
