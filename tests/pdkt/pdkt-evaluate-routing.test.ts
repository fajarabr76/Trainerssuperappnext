import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '@/app/api/pdkt/evaluate/route';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => {
  const chain: any = vi.fn().mockImplementation(() => chain);
  chain.select = vi.fn().mockImplementation(() => chain);
  chain.eq = vi.fn().mockImplementation(() => chain);
  chain.neq = vi.fn().mockImplementation(() => chain);
  chain.or = vi.fn().mockImplementation(() => chain);
  chain.update = vi.fn().mockImplementation(() => chain);
  chain.is = vi.fn().mockImplementation(() => chain);
  chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  chain.insert = vi.fn().mockResolvedValue({ error: null });
  
  // Make it thenable so it can be awaited (for update().select())
  chain.then = (onFulfilled: any) => Promise.resolve({ data: [{}], error: null }).then(onFulfilled);

  return {
    chain,
    rpc: vi.fn().mockResolvedValue({ error: null }),
  };
});

vi.mock('@/app/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user' } } }),
    },
  }),
}));

vi.mock('@/app/lib/supabase/admin', () => ({
  createAdminClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue(mocks.chain),
    rpc: mocks.rpc,
  }),
}));

vi.mock('@/app/(main)/pdkt/services/geminiService', () => ({
  evaluateAgentResponse: vi.fn().mockRejectedValue(new Error('Simulated transient error 500')),
}));

describe('PDKT Evaluate Route Error Standardization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('standardizes error responses on failure', async () => {
    mocks.chain.single.mockResolvedValue({
      data: {
        id: 'history-123',
        user_id: 'test-user',
        config: { model: 'gemini-3.1-flash-lite' },
        emails: [{ isAgent: false, body: 'C text' }, { isAgent: true, body: 'A text' }],
        time_taken: 100,
      },
      error: null,
    });

    const request = new Request('http://localhost/api/pdkt/evaluate', {
      method: 'POST',
      body: JSON.stringify({ historyId: 'history-123' }),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json).toEqual({
      success: false,
      error: 'Simulated transient error 500',
    });
  });

  it('allows retrying if evaluation_started_at is stale (older than 5 mins)', async () => {
    mocks.chain.single.mockResolvedValue({
      data: {
        id: 'stale-123',
        user_id: 'test-user',
        config: { model: 'gemini-3.1-flash-lite' },
        emails: [{ isAgent: false, body: 'C text' }, { isAgent: true, body: 'A text' }],
        time_taken: 100,
        evaluation_status: 'processing',
        evaluation_started_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      },
      error: null,
    });

    const request = new Request('http://localhost/api/pdkt/evaluate', {
      method: 'POST',
      body: JSON.stringify({ historyId: 'stale-123' }),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe('Simulated transient error 500');
  });
});
