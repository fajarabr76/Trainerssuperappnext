import { beforeEach, describe, expect, it, vi } from 'vitest';

const getUser = vi.fn();
const triggerKetikAIReview = vi.fn();

vi.mock('@/app/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser,
    },
  }),
}));

vi.mock('@/app/actions/ketik-ai-review', () => ({
  triggerKetikAIReview,
}));

describe('KETIK AI review route', () => {
  beforeEach(() => {
    vi.resetModules();
    getUser.mockReset();
    triggerKetikAIReview.mockReset();
  });

  it('rejects unauthenticated review requests', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const { POST } = await import('@/app/api/ketik/review/route');

    const response = await POST(new Request('http://localhost/api/ketik/review', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'session-1' }),
    }));

    expect(response.status).toBe(401);
    expect(triggerKetikAIReview).not.toHaveBeenCalled();
  });

  it('triggers AI review for an authenticated session id', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    triggerKetikAIReview.mockResolvedValue({ status: 'completed' });
    const { POST } = await import('@/app/api/ketik/review/route');

    const response = await POST(new Request('http://localhost/api/ketik/review', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'session-1' }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, status: 'completed' });
    expect(triggerKetikAIReview).toHaveBeenCalledWith('session-1');
  });

  it('returns failed when AI review cannot complete', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    triggerKetikAIReview.mockResolvedValue({ status: 'failed', error: 'Rate limit exceeded' });
    const { POST } = await import('@/app/api/ketik/review/route');

    const response = await POST(new Request('http://localhost/api/ketik/review', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'session-1' }),
    }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'Rate limit exceeded', status: 'failed' });
  });
});
