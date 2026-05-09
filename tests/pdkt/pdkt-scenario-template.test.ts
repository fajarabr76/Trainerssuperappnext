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
    scenarios: [
      { id: 'other', category: 'Other', title: 'Other Active Scenario', description: 'Must not be mixed', isActive: true }
    ],
    consumerTypes: [],
    enableImageGeneration: true,
    globalConsumerTypeId: 'random'
  };

  it('generateScenarioEmailTemplate calls AI and normalizes result', async () => {
    const longBody = Array(320).fill('word').join(' ');
    (generateGeminiContent as any).mockResolvedValue({
      success: true,
      text: JSON.stringify({
        subject: 'Bantuan Transaksi Salah',
        body: `Halo, saya {{consumer_name}}. ${longBody}`
      })
    });

    const result = await generateScenarioEmailTemplate(mockScenario as any, mockSettings as any, 'user-123');

    expect(result.subject).toBe('Bantuan Transaksi Salah');
    expect(result.body).toContain('{{consumer_name}}');
    expect(generateGeminiContent).toHaveBeenCalledWith(expect.objectContaining({
      usageContext: { module: 'pdkt', action: 'generate_template' }
    }));
    const firstCallPrompt = (generateGeminiContent as any).mock.calls[0][0].contents[0].parts[0].text;
    expect(firstCallPrompt).toContain('[Finance] Wrong Transaction');
    expect(firstCallPrompt).toContain('Detail: User reported a wrong transaction of 1 million.');
    expect(firstCallPrompt).not.toContain('Other Active Scenario');
    const systemInstruction = (generateGeminiContent as any).mock.calls[0][0].systemInstruction;
    expect(systemInstruction).toContain('300-400 kata');
  });

  it('generateScenarioEmailTemplate retries if body is too short', async () => {
    const shortBody = 'Too short.';
    const longBody = Array(320).fill('word').join(' ');

    (generateGeminiContent as any)
      .mockResolvedValueOnce({
        success: true,
        text: JSON.stringify({ subject: 'Short', body: shortBody })
      })
      .mockResolvedValueOnce({
        success: true,
        text: JSON.stringify({ subject: 'Longer', body: longBody })
      });

    const result = await generateScenarioEmailTemplate(mockScenario as any, mockSettings as any, 'user-123');

    expect(generateGeminiContent).toHaveBeenCalledTimes(2);
    expect(result.body).toBe(longBody);
    expect(generateGeminiContent).toHaveBeenLastCalledWith(expect.objectContaining({
      contents: expect.arrayContaining([
        expect.objectContaining({
          parts: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining('REVISI: Hasil sebelumnya terlalu pendek')
            })
          ])
        })
      ])
    }));
  });

  it('generateScenarioEmailTemplate throws if result remains too short after retry', async () => {
    const stillShortBody = Array(220).fill('word').join(' ');
    (generateGeminiContent as any).mockResolvedValue({
      success: true,
      text: JSON.stringify({ subject: 'Short', body: stillShortBody })
    });

    await expect(generateScenarioEmailTemplate(mockScenario as any, mockSettings as any, 'user-123'))
      .rejects.toThrow('Hasil template terlalu pendek');
    
    expect(generateGeminiContent).toHaveBeenCalledTimes(2);
  });

  it('generateScenarioEmailTemplate blocks leaky patterns in subject', async () => {
    const longBody = Array(320).fill('word').join(' ');
    (generateGeminiContent as any).mockResolvedValue({
      success: true,
      text: JSON.stringify({
        subject: 'Laporan Penipuan Investasi',
        body: longBody
      })
    });

    const result = await generateScenarioEmailTemplate(mockScenario as any, mockSettings as any, 'user-123');

    // 'penipuan' is a leaky pattern, should be normalized to empty
    expect(result.subject).toBe('');
  });

  it('generateScenarioEmailTemplate uses OpenRouter if configured', async () => {
    const orSettings = { ...mockSettings, selectedModel: 'openai/gpt-4' };
    const longBody = Array(320).fill('word').join(' ');
    (generateOpenRouterContent as any).mockResolvedValue({
      success: true,
      text: JSON.stringify({
        subject: 'Subjek OK',
        body: longBody
      })
    });

    await generateScenarioEmailTemplate(mockScenario as any, orSettings as any, 'user-123');

    expect(generateOpenRouterContent).toHaveBeenCalled();
    expect(generateGeminiContent).not.toHaveBeenCalled();
  });
});
