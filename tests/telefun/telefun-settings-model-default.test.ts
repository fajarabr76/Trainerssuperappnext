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

  it('preserves realisticModeEnabled when stored as true', () => {
    const rawSettings = { realisticModeEnabled: true };

    const parsed = parseTelefunSettings(rawSettings);
    expect(parsed.realisticModeEnabled).toBe(true);
  });

  it('defaults realisticModeEnabled to false when missing', () => {
    const rawSettings = {};

    const parsed = parseTelefunSettings(rawSettings);
    expect(parsed.realisticModeEnabled).toBe(false);
  });

  it('coerces realisticModeEnabled to false for non-boolean values', () => {
    const rawSettings = { realisticModeEnabled: 'yes' };

    const parsed = parseTelefunSettings(rawSettings);
    expect(parsed.realisticModeEnabled).toBe(false);
  });

  it('defaults realisticModeDisruptionTypes to empty array when missing', () => {
    const rawSettings = {};

    const parsed = parseTelefunSettings(rawSettings);
    expect(parsed.realisticModeDisruptionTypes).toEqual([]);
  });

  it('keeps only valid disruption types, max 3 items', () => {
    const rawSettings = {
      realisticModeDisruptionTypes: [
        'interruption',
        'unclear_voice',
        'emotional_escalation',
        'invalid_type',
        'another_invalid',
      ],
    };

    const parsed = parseTelefunSettings(rawSettings);
    expect(parsed.realisticModeDisruptionTypes).toEqual([
      'interruption',
      'unclear_voice',
      'emotional_escalation',
    ]);
  });

  it('filters out all invalid disruption types, returns empty array', () => {
    const rawSettings = {
      realisticModeDisruptionTypes: ['invalid_a', 'invalid_b'],
    };

    const parsed = parseTelefunSettings(rawSettings);
    expect(parsed.realisticModeDisruptionTypes).toEqual([]);
  });
});
