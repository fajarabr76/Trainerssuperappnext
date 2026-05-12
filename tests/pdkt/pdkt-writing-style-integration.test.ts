import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppSettings } from '@/app/(main)/pdkt/types';
import { DEFAULT_SCENARIOS, DEFAULT_CONSUMER_TYPES } from '@/app/(main)/pdkt/constants';

const getUser = vi.fn();
const maybeSingle = vi.fn();

vi.mock('@/app/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle }) }),
      upsert: vi.fn().mockReturnValue({ catch: vi.fn() }),
    }),
  }),
}));

function createStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
  };
}

const baseSettings: AppSettings = {
  scenarios: DEFAULT_SCENARIOS,
  consumerTypes: DEFAULT_CONSUMER_TYPES,
  enableImageGeneration: true,
  globalConsumerTypeId: 'random',
  consumerNameMentionPattern: 'random',
  selectedModel: 'gemini-3.1-flash-lite',
};

describe('PDKT Writing Style — Integration (save/load round-trip)', () => {
  beforeEach(() => {
    vi.resetModules();
    getUser.mockReset();
    maybeSingle.mockReset();
    getUser.mockResolvedValue({ data: { user: null } });
    maybeSingle.mockResolvedValue({ data: null, error: null });
    Object.defineProperty(globalThis, 'localStorage', {
      value: createStorage(),
      configurable: true,
      writable: true,
    });
  });

  it('saves and reloads writingStyleMode: realistic', async () => {
    const { savePdktSettings, loadPdktSettings } = await import(
      '@/app/(main)/pdkt/services/settingService'
    );

    await savePdktSettings({ ...baseSettings, writingStyleMode: 'realistic' });

    const loaded = await loadPdktSettings();
    expect(loaded.writingStyleMode).toBe('realistic');
  });

  it('saves and reloads writingStyleMode: training', async () => {
    const { savePdktSettings, loadPdktSettings } = await import(
      '@/app/(main)/pdkt/services/settingService'
    );

    await savePdktSettings({ ...baseSettings, writingStyleMode: 'training' });

    const loaded = await loadPdktSettings();
    expect(loaded.writingStyleMode).toBe('training');
  });

  it('loads with training default when no writingStyleMode in stored settings', async () => {
    const { loadPdktSettings } = await import(
      '@/app/(main)/pdkt/services/settingService'
    );

    localStorage.setItem('pdkt_settings_v2', JSON.stringify({
      scenarios: DEFAULT_SCENARIOS,
      consumerTypes: DEFAULT_CONSUMER_TYPES,
      enableImageGeneration: true,
      globalConsumerTypeId: 'random',
    }));

    const loaded = await loadPdktSettings();
    expect(loaded.writingStyleMode).toBe('training');
  });
});

describe('PDKT Writing Style — generateSessionConfig', () => {
  it('produces correct writingStyleMode for realistic', async () => {
    const { generateSessionConfig } = await import(
      '@/app/(main)/pdkt/services/settingService'
    );

    const config = generateSessionConfig({
      ...baseSettings,
      writingStyleMode: 'realistic',
    });

    expect(config.writingStyleMode).toBe('realistic');
  });

  it('produces correct writingStyleMode for training', async () => {
    const { generateSessionConfig } = await import(
      '@/app/(main)/pdkt/services/settingService'
    );

    const config = generateSessionConfig({
      ...baseSettings,
      writingStyleMode: 'training',
    });

    expect(config.writingStyleMode).toBe('training');
  });

  it('defaults to training when writingStyleMode is missing from AppSettings', async () => {
    const { generateSessionConfig } = await import(
      '@/app/(main)/pdkt/services/settingService'
    );

    const config = generateSessionConfig(baseSettings);

    expect(config.writingStyleMode).toBe('training');
  });

  it('defaults to training when writingStyleMode has invalid value', async () => {
    const { generateSessionConfig } = await import(
      '@/app/(main)/pdkt/services/settingService'
    );

    const config = generateSessionConfig({
      ...baseSettings,
      writingStyleMode: 'bogus' as any,
    });

    expect(config.writingStyleMode).toBe('training');
  });
});
