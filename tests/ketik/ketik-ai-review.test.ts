import { beforeEach, describe, expect, it, vi } from 'vitest';

const getUser = vi.fn();
const selectSingle = vi.fn();
const updateEq = vi.fn();
const update = vi.fn(() => ({ eq: updateEq }));

const adminFrom = vi.fn((table: string) => {
  if (table === 'ketik_history') {
    return {
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: selectSingle,
          }),
        }),
      }),
      update,
      delete: vi.fn(() => ({ eq: vi.fn() })),
    };
  }

  return {
    insert: vi.fn(),
    delete: vi.fn(() => ({ eq: vi.fn() })),
  };
});

vi.mock('@/app/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser,
    },
  }),
}));

vi.mock('@/app/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: adminFrom,
  }),
}));

vi.mock('@/app/actions/gemini', () => ({
  generateGeminiContent: vi.fn(),
}));

describe('triggerKetikAIReview authorization hardening', () => {
  beforeEach(() => {
    vi.resetModules();
    getUser.mockReset();
    selectSingle.mockReset();
    updateEq.mockReset();
    update.mockClear();
    adminFrom.mockClear();
  });

  it('does not mutate review_status for unauthorized session id', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-b' } }, error: null });
    selectSingle.mockResolvedValue({ data: null, error: { message: 'not found' } });

    const { triggerKetikAIReview } = await import('@/app/actions/ketik-ai-review');
    const result = await triggerKetikAIReview('session-owned-by-user-a');

    expect(result.status).toBe('failed');
    expect(update).not.toHaveBeenCalled();
    expect(updateEq).not.toHaveBeenCalled();
  });
});
