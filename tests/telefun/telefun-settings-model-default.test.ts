import { describe, it, expect } from 'vitest';
import { parseTelefunSettings } from '@/app/(main)/telefun/constants';

describe('Telefun Settings Model Normalization', () => {
  it('coerces legacy model alias to current default model id', () => {
    const rawSettings = {
      selectedModel: 'gemini-3.1-flash-lite-preview',
    };

    const parsed = parseTelefunSettings(rawSettings);
    expect(parsed.selectedModel).toBe('gemini-3.1-flash-lite');
  });

  it('keeps valid model id unchanged', () => {
    const rawSettings = {
      selectedModel: 'gemini-2.0-flash-lite',
    };

    const parsed = parseTelefunSettings(rawSettings);
    expect(parsed.selectedModel).toBe('gemini-2.0-flash-lite');
  });

  it('uses default model id if selectedModel is missing', () => {
    const rawSettings = {};

    const parsed = parseTelefunSettings(rawSettings);
    expect(parsed.selectedModel).toBe('gemini-3.1-flash-lite');
  });
});
