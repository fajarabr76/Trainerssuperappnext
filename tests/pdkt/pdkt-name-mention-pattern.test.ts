import { describe, expect, it } from 'vitest';
import {
  coerceConsumerNameMentionPattern,
  resolveConsumerNameMentionPattern,
} from '@/app/(main)/pdkt/services/settingService';
import { getConsumerNameMentionInstruction } from '@/app/(main)/pdkt/services/promptHelpers';

describe('PDKT consumer name mention pattern', () => {
  it('coerces unsupported values to random', () => {
    expect(coerceConsumerNameMentionPattern(undefined)).toBe('random');
    expect(coerceConsumerNameMentionPattern(null)).toBe('random');
    expect(coerceConsumerNameMentionPattern('invalid')).toBe('random');
  });

  it('keeps supported trainer config values', () => {
    expect(coerceConsumerNameMentionPattern('random')).toBe('random');
    expect(coerceConsumerNameMentionPattern('upfront')).toBe('upfront');
    expect(coerceConsumerNameMentionPattern('middle')).toBe('middle');
    expect(coerceConsumerNameMentionPattern('late')).toBe('late');
    expect(coerceConsumerNameMentionPattern('none')).toBe('none');
  });

  it('resolves non-random modes as-is', () => {
    expect(resolveConsumerNameMentionPattern('upfront')).toBe('upfront');
    expect(resolveConsumerNameMentionPattern('middle')).toBe('middle');
    expect(resolveConsumerNameMentionPattern('late')).toBe('late');
    expect(resolveConsumerNameMentionPattern('none')).toBe('none');
  });

  it('resolves random mode into one supported session mode', () => {
    const originalRandom = Math.random;

    try {
      Math.random = () => 0;
      expect(resolveConsumerNameMentionPattern('random')).toBe('upfront');

      Math.random = () => 0.3;
      expect(resolveConsumerNameMentionPattern('random')).toBe('middle');

      Math.random = () => 0.6;
      expect(resolveConsumerNameMentionPattern('random')).toBe('late');

      Math.random = () => 0.9;
      expect(resolveConsumerNameMentionPattern('random')).toBe('none');
    } finally {
      Math.random = originalRandom;
    }
  });
});

describe('getConsumerNameMentionInstruction', () => {
  it('returns none rule that forbids any name mention', () => {
    expect(getConsumerNameMentionInstruction('none')).toContain('Jangan sebut nama Anda sama sekali');
    expect(getConsumerNameMentionInstruction('none')).toContain('Jangan mengarang nama');
  });

  it('returns middle rule that forbids opening mention', () => {
    expect(getConsumerNameMentionInstruction('middle')).toContain('Jangan sebut nama di awal email');
    expect(getConsumerNameMentionInstruction('middle')).toContain('bagian tengah');
  });

  it('returns late rule that delays mention until closing', () => {
    expect(getConsumerNameMentionInstruction('late')).toContain('Jangan sebut nama di awal email');
    expect(getConsumerNameMentionInstruction('late')).toContain('menjelang akhir');
  });

  it('returns upfront rule that allows early mention', () => {
    expect(getConsumerNameMentionInstruction('upfront')).toContain('boleh menyebut nama di awal');
  });
});
