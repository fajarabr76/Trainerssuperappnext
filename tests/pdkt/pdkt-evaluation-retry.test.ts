import { beforeEach, describe, expect, it, vi } from 'vitest';
import { evaluateAgentResponse } from '@/app/(main)/pdkt/services/geminiService';
import { generateGeminiContent } from '@/app/actions/gemini';

vi.mock('@/app/actions/gemini', () => ({
  generateGeminiContent: vi.fn(),
}));

vi.mock('@/app/actions/openrouter', () => ({
  generateOpenRouterContent: vi.fn(),
}));

vi.mock('@/app/lib/ai-models', () => ({
  normalizeModelId: (id: string) => id,
  resolveModelProvider: (id: string) => ({ modelId: id, provider: 'gemini' }),
}));

describe('PDKT evaluation retry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retries transient provider failures before marking evaluation failed', async () => {
    (generateGeminiContent as any)
      .mockResolvedValueOnce({ success: false, error: '503 provider temporarily unavailable' })
      .mockResolvedValueOnce({
        success: true,
        text: JSON.stringify({
          score: 88,
          typos: [],
          clarityIssues: [],
          contentGaps: [],
          feedback: 'Respons sudah relevan.',
        }),
      });

    const result = await evaluateAgentResponse(
      [
        { id: 'consumer-1', isAgent: false, body: 'Saya gagal login.', from: 'c@example.com', timestamp: new Date() },
        { id: 'agent-1', isAgent: true, body: 'Silakan reset password melalui menu bantuan.', from: 'a@example.com', timestamp: new Date() },
      ] as any,
      { selectedModel: 'gemini-3.1-flash-lite' } as any,
      'user-123',
    );

    expect(result.score).toBe(88);
    expect(generateGeminiContent).toHaveBeenCalledTimes(2);
  });
});
