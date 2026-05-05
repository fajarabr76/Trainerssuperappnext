import { beforeEach, describe, expect, it, vi } from 'vitest';

const getUser = vi.fn();
const maybeSingle = vi.fn();

vi.mock('@/app/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser,
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle,
        }),
      }),
    }),
  }),
}));

function createStorage() {
  const store = new Map<string, string>();

  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
}

describe('PDKT settings model defaults', () => {
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

  it('defaults to the first OpenRouter text model for fresh settings', async () => {
    const { loadPdktSettings } = await import('@/app/(main)/pdkt/services/settingService');

    const settings = await loadPdktSettings();

    expect(settings.selectedModel).toBe('openai/gpt-oss-120b:free');
  });

  it('migrates legacy direct Gemini model selections to the OpenRouter default', async () => {
    localStorage.setItem(
      'pdkt_settings_v2',
      JSON.stringify({
        selectedModel: 'gemini-3.1-flash-lite-preview',
        scenarios: [],
        consumerTypes: [],
      })
    );

    const { loadPdktSettings } = await import('@/app/(main)/pdkt/services/settingService');

    const settings = await loadPdktSettings();

    expect(settings.selectedModel).toBe('openai/gpt-oss-120b:free');
  });
});
