import { beforeEach, describe, expect, it, vi } from 'vitest';

const getUser = vi.fn();
const maybeSingle = vi.fn();
const upsert = vi.fn();

vi.mock('@/app/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle }) }),
      upsert: () => ({ select: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }),
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

describe('PDKT Writing Style — Settings UI behavior', () => {
  beforeEach(() => {
    vi.resetModules();
    getUser.mockReset();
    maybeSingle.mockReset();
    upsert.mockReset();
    getUser.mockResolvedValue({ data: { user: null } });
    maybeSingle.mockResolvedValue({ data: null, error: null });
    Object.defineProperty(globalThis, 'localStorage', {
      value: createStorage(),
      configurable: true,
      writable: true,
    });
  });

  it('defaults to training when no value is stored', async () => {
    const { loadPdktSettings } = await import('@/app/(main)/pdkt/services/settingService');

    const settings = await loadPdktSettings();

    expect(settings.writingStyleMode).toBe('training');
  });

  it('loads stored realistic mode from localStorage', async () => {
    localStorage.setItem('pdkt_settings_v2', JSON.stringify({
      scenarios: [],
      consumerTypes: [],
      enableImageGeneration: true,
      globalConsumerTypeId: 'random',
      writingStyleMode: 'realistic',
    }));

    const { loadPdktSettings } = await import('@/app/(main)/pdkt/services/settingService');

    const settings = await loadPdktSettings();

    expect(settings.writingStyleMode).toBe('realistic');
  });

  it('loads stored training mode from localStorage', async () => {
    localStorage.setItem('pdkt_settings_v2', JSON.stringify({
      scenarios: [],
      consumerTypes: [],
      enableImageGeneration: true,
      globalConsumerTypeId: 'random',
      writingStyleMode: 'training',
    }));

    const { loadPdktSettings } = await import('@/app/(main)/pdkt/services/settingService');

    const settings = await loadPdktSettings();

    expect(settings.writingStyleMode).toBe('training');
  });

  it('coerces invalid stored value to training', async () => {
    localStorage.setItem('pdkt_settings_v2', JSON.stringify({
      scenarios: [],
      consumerTypes: [],
      enableImageGeneration: true,
      globalConsumerTypeId: 'random',
      writingStyleMode: 'invalid-value',
    }));

    const { loadPdktSettings } = await import('@/app/(main)/pdkt/services/settingService');

    const settings = await loadPdktSettings();

    expect(settings.writingStyleMode).toBe('training');
  });

  it('includes writingStyleMode when saving settings', async () => {
    const { savePdktSettings } = await import('@/app/(main)/pdkt/services/settingService');

    await savePdktSettings({
      scenarios: [],
      consumerTypes: [],
      enableImageGeneration: true,
      globalConsumerTypeId: 'random',
      writingStyleMode: 'realistic',
    } as any);

    const saved = JSON.parse(localStorage.getItem('pdkt_settings_v2') || '{}');
    expect(saved.writingStyleMode).toBe('realistic');
  });

  it('coerces writingStyleMode to training on save even if invalid value is passed', async () => {
    const { savePdktSettings } = await import('@/app/(main)/pdkt/services/settingService');

    await savePdktSettings({
      scenarios: [],
      consumerTypes: [],
      enableImageGeneration: true,
      globalConsumerTypeId: 'random',
      writingStyleMode: 'bogus',
    } as any);

    const saved = JSON.parse(localStorage.getItem('pdkt_settings_v2') || '{}');
    expect(saved.writingStyleMode).toBe('training');
  });
});
