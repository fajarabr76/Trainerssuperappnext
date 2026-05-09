import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateScenarioEmailTemplate } from '@/app/(main)/pdkt/services/geminiService';
import { generateGeminiContent } from '@/app/actions/gemini';
import { generateOpenRouterContent } from '@/app/actions/openrouter';

vi.mock('@/app/actions/gemini', () => ({
  generateGeminiContent: vi.fn()
}));

vi.mock('@/app/actions/openrouter', () => ({
  generateOpenRouterContent: vi.fn()
}));

vi.mock('@/app/lib/ai-models', () => ({
  normalizeModelId: (id: string) => id,
  resolveModelProvider: (id: string) => ({ modelId: id, provider: id.includes('gpt') ? 'openrouter' : 'gemini' })
}));

describe('PDKT Scenario Email Template', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockScenario = {
    id: 's1',
    category: 'Finance',
    title: 'Wrong Transaction',
    description: 'User reported a wrong transaction of 1 million.',
    isActive: true
  };

  const mockSettings = {
    selectedModel: 'gemini-3.1-flash-lite',
    scenarios: [],
    consumerTypes: [],
    enableImageGeneration: true,
    globalConsumerTypeId: 'random'
  };

  it('generateScenarioEmailTemplate calls AI and normalizes result', async () => {
    (generateGeminiContent as any).mockResolvedValue({
      success: true,
      text: JSON.stringify({
        subject: 'Bantuan Transaksi Salah',
        body: 'Halo, saya {{consumer_name}}. Saya ingin mengadukan transaksi salah sebesar 1 juta.'
      })
    });

    const result = await generateScenarioEmailTemplate(mockScenario as any, mockSettings as any, 'user-123');

    expect(result.subject).toBe('Bantuan Transaksi Salah');
    expect(result.body).toContain('{{consumer_name}}');
    expect(generateGeminiContent).toHaveBeenCalledWith(expect.objectContaining({
      usageContext: { module: 'pdkt', action: 'generate_template' }
    }));
  });

  it('generateScenarioEmailTemplate blocks leaky patterns in subject', async () => {
    (generateGeminiContent as any).mockResolvedValue({
      success: true,
      text: JSON.stringify({
        subject: 'Laporan Penipuan Investasi',
        body: '...'
      })
    });

    const result = await generateScenarioEmailTemplate(mockScenario as any, mockSettings as any, 'user-123');

    // 'penipuan' is a leaky pattern, should be normalized to empty
    expect(result.subject).toBe('');
  });

  it('generateScenarioEmailTemplate uses OpenRouter if configured', async () => {
    const orSettings = { ...mockSettings, selectedModel: 'openai/gpt-4' };
    (generateOpenRouterContent as any).mockResolvedValue({
      success: true,
      text: JSON.stringify({
        subject: 'Subjek OK',
        body: 'Body OK'
      })
    });

    await generateScenarioEmailTemplate(mockScenario as any, orSettings as any, 'user-123');

    expect(generateOpenRouterContent).toHaveBeenCalled();
    expect(generateGeminiContent).not.toHaveBeenCalled();
  });
});
