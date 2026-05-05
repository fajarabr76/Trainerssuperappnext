import { describe, expect, it } from 'vitest';
import {
  coerceConsumerNameMentionPattern,
  resolveConsumerNameMentionPattern,
} from '@/app/(main)/pdkt/services/settingService';

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
});
