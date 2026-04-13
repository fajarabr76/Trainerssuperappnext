export const AI_MODELS = [
  // Gemini
  { 
    id: 'gemini-3-flash-preview', 
    name: 'Gemini 3 Flash', 
    description: 'Cepat dan efisien untuk percakapan natural.', 
    provider: 'gemini' as const 
  },
  { 
    id: 'gemini-2.5-flash-lite', 
    name: 'Gemini 2.5 Flash Lite', 
    description: 'Model ringan Gemini 2.5 untuk respons cepat dan hemat biaya.', 
    provider: 'gemini' as const 
  },
  { 
    id: 'gemma-3-27b-it', 
    name: 'Gemma 3 27B', 
    description: 'Model Gemma 3 27B untuk kebutuhan instruksi yang lebih kompleks.', 
    provider: 'gemini' as const 
  },
  { 
    id: 'gemma-4-31b-it', 
    name: 'Gemma 4 31B', 
    description: 'Model Gemma 4 31B untuk reasoning lebih dalam pada skenario lanjutan.', 
    provider: 'gemini' as const 
  },

  // OpenRouter
  { 
    id: 'z-ai/glm-4.5-air:free', 
    name: 'GLM 4.5 Air', 
    description: 'Model ringkas dengan kemampuan reasoning yang baik.', 
    provider: 'openrouter' as const 
  },
  { 
    id: 'openai/gpt-oss-120b:free', 
    name: 'GPT-OSS 120B', 
    description: 'Model open-weight yang kuat untuk tugas yang lebih kompleks.', 
    provider: 'openrouter' as const 
  },
  { 
    id: 'minimax/minimax-m2.5:free', 
    name: 'MiniMax m2.5', 
    description: 'Model MiniMax terbaru, sangat cerdas & responsif.', 
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
