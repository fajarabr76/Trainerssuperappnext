import { describe, expect, it } from 'vitest';
import {
  coerceDuration,
  isPresetDuration,
  validateDuration,
} from '@/app/lib/duration-validation';

describe('duration validation edge cases', () => {
  describe('validateDuration', () => {
    it('validates boundary values correctly', () => {
      expect(validateDuration(1)).toEqual({
        valid: true,
        value: 1,
        error: null,
      });
      expect(validateDuration(60)).toEqual({
        valid: true,
        value: 60,
        error: null,
      });

      expect(validateDuration(0)).toEqual({
        valid: false,
        value: 0,
        error: 'Durasi minimal adalah 1 menit',
      });
      expect(validateDuration(61)).toEqual({
        valid: false,
        value: 61,
        error: 'Durasi maksimal adalah 60 menit',
      });

      expect(validateDuration(null)).toEqual({
        valid: false,
        value: 0,
        error: 'Durasi wajib diisi',
      });
      expect(validateDuration(undefined)).toEqual({
        valid: false,
        value: 0,
        error: 'Durasi wajib diisi',
      });
      expect(validateDuration(NaN)).toEqual({
        valid: false,
        value: 0,
        error: 'Durasi wajib diisi',
      });
    });
  });

  describe('isPresetDuration', () => {
    it('returns true for preset values and false for others', () => {
      expect(isPresetDuration(5)).toBe(true);
      expect(isPresetDuration(10)).toBe(true);
      expect(isPresetDuration(15)).toBe(true);

      expect(isPresetDuration(7)).toBe(false);
      expect(isPresetDuration(20)).toBe(false);
      expect(isPresetDuration(0)).toBe(false);
    });
  });

  describe('coerceDuration', () => {
    it('coerces various invalid inputs to default 5', () => {
      expect(coerceDuration('invalid')).toBe(5);
      expect(coerceDuration(12.34)).toBe(5);
      expect(coerceDuration(-5)).toBe(5);
      expect(coerceDuration({})).toBe(5);
      expect(coerceDuration([])).toBe(5);
    });

    it('returns valid integers as is', () => {
      expect(coerceDuration(5)).toBe(5);
      expect(coerceDuration(1)).toBe(1);
      expect(coerceDuration(60)).toBe(60);
      expect(coerceDuration('25')).toBe(25);
    });
  });
});
