import { describe, it, expect } from 'vitest';
import { resolveTelefunRealisticModeConfig } from '@/app/(main)/telefun/services/resolveRealisticModeConfig';
import { ConsumerDifficulty, SessionConfig } from '@/app/types';

function makeConfig(overrides: Partial<SessionConfig> = {}): SessionConfig {
  return {
    scenarios: [],
    consumerType: { id: 'ramah', name: 'Ramah & Kooperatif', description: '', difficulty: ConsumerDifficulty.Easy },
    identity: { name: 'Test', city: '', phone: '' },
    selectedModel: 'gemini-3.1-flash-lite',
    simulationDuration: 5,
    responsePacingMode: 'realistic',
    ...overrides,
  };
}

describe('resolveTelefunRealisticModeConfig', () => {
  it('returns enabled: false when realisticModeEnabled is falsy', () => {
    const result = resolveTelefunRealisticModeConfig(makeConfig({ realisticModeEnabled: false }));
    expect(result.enabled).toBe(false);
  });

  it('returns enabled: false when realisticModeEnabled is missing', () => {
    const result = resolveTelefunRealisticModeConfig(makeConfig());
    expect(result.enabled).toBe(false);
  });

  it('returns enabled: true with personaType cooperative for ramah consumer', () => {
    const result = resolveTelefunRealisticModeConfig(
      makeConfig({ realisticModeEnabled: true, consumerType: { id: 'ramah', name: 'Ramah & Kooperatif', description: '', difficulty: ConsumerDifficulty.Easy } })
    );
    expect(result.enabled).toBe(true);
    expect(result.personaType).toBe('cooperative');
  });

  it('maps marah consumer to angry persona', () => {
    const result = resolveTelefunRealisticModeConfig(
      makeConfig({ realisticModeEnabled: true, consumerType: { id: 'marah', name: 'Marah & Emosional', description: '', difficulty: ConsumerDifficulty.Hard } })
    );
    expect(result.personaType).toBe('angry');
  });

  it('maps bingung consumer to confused persona', () => {
    const result = resolveTelefunRealisticModeConfig(
      makeConfig({ realisticModeEnabled: true, consumerType: { id: 'bingung', name: 'Bingung & Gaptek', description: '', difficulty: ConsumerDifficulty.Medium } })
    );
    expect(result.personaType).toBe('confused');
  });

  it('maps kritis consumer to critical persona', () => {
    const result = resolveTelefunRealisticModeConfig(
      makeConfig({ realisticModeEnabled: true, consumerType: { id: 'kritis', name: 'Kritis & Detail', description: '', difficulty: ConsumerDifficulty.Hard } })
    );
    expect(result.personaType).toBe('critical');
  });

  it('maps terburu-buru consumer to rushed persona', () => {
    const result = resolveTelefunRealisticModeConfig(
      makeConfig({ realisticModeEnabled: true, consumerType: { id: 'terburu-buru', name: 'Terburu-buru', description: '', difficulty: ConsumerDifficulty.Medium } })
    );
    expect(result.personaType).toBe('rushed');
  });

  it('maps pasrah consumer to passive persona', () => {
    const result = resolveTelefunRealisticModeConfig(
      makeConfig({ realisticModeEnabled: true, consumerType: { id: 'pasrah', name: 'Pasrah & Sedih', description: '', difficulty: ConsumerDifficulty.Medium } })
    );
    expect(result.personaType).toBe('passive');
  });

  it('falls back to cooperative for unknown consumer type', () => {
    const result = resolveTelefunRealisticModeConfig(
      makeConfig({ realisticModeEnabled: true, consumerType: { id: 'unknown_custom', name: 'Custom', description: '', difficulty: ConsumerDifficulty.Easy } })
    );
    expect(result.personaType).toBe('cooperative');
  });

  it('passes valid disruption types when enabled', () => {
    const result = resolveTelefunRealisticModeConfig(
      makeConfig({
        realisticModeEnabled: true,
        realisticModeDisruptionTypes: ['interruption', 'emotional_escalation'],
      })
    );
    expect(result.disruptionTypes).toEqual(['interruption', 'emotional_escalation']);
  });

  it('returns empty disruption types when none configured', () => {
    const result = resolveTelefunRealisticModeConfig(
      makeConfig({ realisticModeEnabled: true })
    );
    expect(result.disruptionTypes).toEqual([]);
  });
});
