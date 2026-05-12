import { describe, expect, it, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import type { SessionConfig, WritingStyleMode, ResolvedConsumerNameMentionPattern, AppSettings, Scenario } from '@/app/(main)/pdkt/types';

vi.mock('@/app/actions/gemini', () => ({
  generateGeminiContent: vi.fn().mockResolvedValue({ success: true, text: JSON.stringify({ subject: 'Test', body: 'Test body content that is long enough for a template email scenario with enough words.' }) }),
}));

vi.mock('@/app/actions/openrouter', () => ({
  generateOpenRouterContent: vi.fn().mockResolvedValue({ success: true, text: JSON.stringify({ subject: 'Test', body: 'Test body content that is long enough for a template email scenario with enough words.' }) }),
}));

const dummyIdentity = {
  name: 'Test User',
  email: 'test@ojk.go.id',
  city: 'Jakarta',
  bodyName: 'Test',
};

const dummyConsumerType = {
  id: 'test',
  name: 'Test Consumer',
  description: 'A test consumer type',
};

const dummyScenario: Scenario = {
  id: 'test-scenario',
  category: 'Test',
  title: 'Test Problem',
  description: 'A test scenario description for testing purposes with sufficient length.',
  isActive: true,
};

function makeSessionConfig(mode: WritingStyleMode): SessionConfig {
  return {
    scenarios: [dummyScenario],
    consumerType: dummyConsumerType,
    identity: dummyIdentity,
    enableImageGeneration: false,
    selectedModel: 'gemini-3.1-flash-lite',
    resolvedConsumerNameMentionPattern: 'none' as ResolvedConsumerNameMentionPattern,
    writingStyleMode: mode,
  };
}

describe('Property 1: Prompt mode fidelity', () => {
  it('includes realistic directives if and only if writingStyleMode is realistic', async () => {
    const { getSystemInstruction } = await import('@/app/(main)/pdkt/services/geminiService');

    fc.assert(
      fc.property(
        fc.constantFrom<WritingStyleMode>('realistic', 'training'),
        (mode) => {
          const config = makeSessionConfig(mode);
          const instruction = getSystemInstruction(config, false);

          const hasRealisticDirectives =
            (instruction.includes('typo') || instruction.includes('TYPO')) &&
            instruction.includes('CAPSLOCK');

          if (mode === 'realistic') {
            return hasRealisticDirectives === true;
          }
          return hasRealisticDirectives === false;
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 3: Template generation mode immunity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('never includes realistic directives in template generation system instruction', async () => {
    const { generateScenarioEmailTemplate } = await import('@/app/(main)/pdkt/services/geminiService');
    const { defaultPdktSettings } = await import('@/app/(main)/pdkt/services/settingService');

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom<WritingStyleMode>('realistic', 'training'),
        async (mode) => {
          const settings: AppSettings = { ...defaultPdktSettings, writingStyleMode: mode } as AppSettings;
          const scenario: Scenario = {
            ...dummyScenario,
            sampleEmailTemplate: { subject: 'Test', body: 'Test body template for scenario email testing with proper length and content.' },
            alwaysUseSampleEmail: false,
          };

          try {
            const result = await generateScenarioEmailTemplate(scenario, settings, 'test-user');
            expect(result.body).toBeDefined();
          } catch {
            // AI call may be mocked — verify no realistic directives in captured systemInstruction
          }

          // Verify that generateGeminiContent was called with a clean system prompt
          const { generateGeminiContent } = await import('@/app/actions/gemini');
          const calls = vi.mocked(generateGeminiContent).mock.calls;
          for (const call of calls) {
            const sysInst = call[0]?.systemInstruction || '';
            expect(sysInst).not.toContain('TYPO');
            expect(sysInst).not.toContain('CAPSLOCK');
            expect(sysInst).not.toContain('BAHASA INFORMAL');
          }
        }
      ),
      { numRuns: 10 }
    );
  });
});
