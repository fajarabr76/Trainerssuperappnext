import { describe, expect, it } from 'vitest';

import {
  resolveServiceTypeFromTeam,
  computeEffectiveService,
} from '../../app/(main)/qa-analyzer/lib/qa-types';
import type { ServiceType } from '../../app/(main)/qa-analyzer/lib/qa-types';

describe('resolveServiceTypeFromTeam', () => {
  it.each([
    { input: 'Mix', expected: 'cso' },
    { input: 'mix', expected: 'cso' },
    { input: 'Tim Mix', expected: 'cso' },
    { input: 'CSO', expected: 'cso' },
    { input: 'cso', expected: 'cso' },
    { input: 'Telepon', expected: 'call' },
    { input: 'telepon', expected: 'call' },
    { input: 'Call', expected: 'call' },
    { input: 'Chat', expected: 'chat' },
    { input: 'Email', expected: 'email' },
    { input: 'BKO', expected: 'bko' },
    { input: 'SLIK', expected: 'slik' },
    { input: 'Pencatatan', expected: 'pencatatan' },
  ])('maps "$input" to "$expected"', ({ input, expected }) => {
    expect(resolveServiceTypeFromTeam(input)).toBe(expected);
  });

  it('falls back to "call" for unknown or empty input', () => {
    expect(resolveServiceTypeFromTeam('Tim Unknown')).toBe('call');
    expect(resolveServiceTypeFromTeam('')).toBe('call');
    expect(resolveServiceTypeFromTeam(null)).toBe('call');
    expect(resolveServiceTypeFromTeam(undefined)).toBe('call');
  });
});

describe('computeEffectiveService', () => {
  it('defaults to agent team inference when no override is set', () => {
    const result = computeEffectiveService(
      null, // no override
      'Mix',
      'call' // fallback
    );
    expect(result).toBe('cso');
  });

  it('defaults to "call" for Telepon team when no override is set', () => {
    const result = computeEffectiveService(
      null,
      'Telepon',
      'call'
    );
    expect(result).toBe('call');
  });

  it('honours manual override over agent team inference', () => {
    const result = computeEffectiveService(
      'chat' as ServiceType,
      'Mix',
      'call'
    );
    expect(result).toBe('chat');
  });

  it('honours manual override even when agent team would suggest a different service', () => {
    const result = computeEffectiveService(
      'email' as ServiceType,
      'Telepon',
      'call'
    );
    expect(result).toBe('email');
  });

  it('uses fallback service when both override and team are absent', () => {
    const result = computeEffectiveService(
      null,
      null,
      'email' as ServiceType
    );
    expect(result).toBe('email');
  });

  it('falls back to "call" when nothing is provided', () => {
    const result = computeEffectiveService(null, null, null);
    expect(result).toBe('call');
  });

  it('simulates agent switch after override: reset override makes service follow new agent team', () => {
    // Agent A (Mix) with manual override to Call
    const withOverride = computeEffectiveService('call' as ServiceType, 'Mix', 'call');
    expect(withOverride).toBe('call');

    // User switches to Agent B (CSO) and UI resets override to null
    const afterReset = computeEffectiveService(null, 'CSO', 'call');
    expect(afterReset).toBe('cso');
  });
});
