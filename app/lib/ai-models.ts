export const AI_MODELS = [
  // Gemini
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

  // OpenRouter
  { 
    id: 'nvidia/nemotron-3-nano-30b-a3b:free', 
    name: 'Nemotron 3 Nano 30B', 
    description: 'Model NVIDIA yang ringan dan responsif untuk percakapan cepat.', 
    provider: 'openrouter' as const 
  },
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
