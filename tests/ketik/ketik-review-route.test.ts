import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const getUser = vi.fn();
const mockQuery: any = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  then: function(resolve: any) {
    resolve({ data: null, error: null });
  }
};

vi.mock('@/app/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser,
    },
  }),
}));

vi.mock('@/app/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (_table: string) => mockQuery,
  }),
}));

vi.mock('@/app/actions/ketik-ai-review', () => ({
  claimAndProcessKetikReviewJob: vi.fn(),
}));

describe('KETIK AI review route - durable pipeline', () => {
  beforeEach(() => {
    vi.resetModules();
    getUser.mockReset();
    mockQuery.select.mockReturnThis();
    mockQuery.eq.mockReturnThis();
    mockQuery.single.mockReset();
    mockQuery.maybeSingle.mockReset();
    mockQuery.insert.mockReset();
    mockQuery.insert.mockReturnThis();
    mockQuery.update.mockReset();
    mockQuery.update.mockReturnThis();
    
    // Reset mock actions
    import('@/app/actions/ketik-ai-review').then(m => {
      (m.claimAndProcessKetikReviewJob as Mock).mockClear();
    });
  });

  it('rejects unauthenticated review requests', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const { POST } = await import('@/app/api/ketik/review/route');

    const response = await POST(new Request('http://localhost/api/ketik/review', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'session-1' }),
    }));

    expect(response.status).toBe(401);
  });

  it('returns 403 if user does not own the session', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mockQuery.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } }); // Simulate not found/not owned
    const { POST } = await import('@/app/api/ketik/review/route');

    const response = await POST(new Request('http://localhost/api/ketik/review', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'session-1' }),
    }));

    expect(response.status).toBe(403);
  });

  it('returns existing job status if job already exists', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    // First query: ownership check
    mockQuery.single.mockResolvedValueOnce({ data: { user_id: 'user-1', review_status: 'completed' }, error: null });
    // Second query: existing job
    mockQuery.maybeSingle.mockResolvedValueOnce({ data: { status: 'completed' }, error: null });
    
    const { POST } = await import('@/app/api/ketik/review/route');

    const response = await POST(new Request('http://localhost/api/ketik/review', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'session-1' }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, status: 'completed' });
    // Check that we didn't insert a new job
    expect(mockQuery.insert).not.toHaveBeenCalled();
  });

  it('enqueues a new job, marks history processing, and claims it from the manual trigger', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    // First query: ownership check
    mockQuery.single.mockResolvedValueOnce({ data: { user_id: 'user-1', review_status: 'pending' }, error: null });
    // Second query: existing job (none found)
    mockQuery.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    // Insert job
    mockQuery.insert.mockReturnThis();
    // Update history
    mockQuery.update.mockReturnThis();

    const { claimAndProcessKetikReviewJob } = await import('@/app/actions/ketik-ai-review');
    (claimAndProcessKetikReviewJob as Mock).mockResolvedValue({ status: 'completed' });
    const { POST } = await import('@/app/api/ketik/review/route');

    const response = await POST(new Request('http://localhost/api/ketik/review', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'session-1' }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, status: 'completed' });
    expect(mockQuery.insert).toHaveBeenCalled();
    expect(mockQuery.update).toHaveBeenCalled();
    expect(claimAndProcessKetikReviewJob).toHaveBeenCalledWith(
      'session-1',
      expect.stringMatching(/^ketik-review-route-/)
    );
  });

  it('resets failed jobs before claiming them again', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mockQuery.single.mockResolvedValueOnce({ data: { user_id: 'user-1', review_status: 'failed' }, error: null });
    mockQuery.maybeSingle.mockResolvedValueOnce({ data: { status: 'failed' }, error: null });

    const { claimAndProcessKetikReviewJob } = await import('@/app/actions/ketik-ai-review');
    (claimAndProcessKetikReviewJob as Mock).mockResolvedValue({ status: 'processing' });
    const { POST } = await import('@/app/api/ketik/review/route');

    const response = await POST(new Request('http://localhost/api/ketik/review', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'session-1' }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, status: 'processing' });
    expect(mockQuery.update).toHaveBeenCalledWith({
      status: 'queued',
      lease_owner: null,
      lease_expires_at: null,
      error_message: null,
    });
    expect(claimAndProcessKetikReviewJob).toHaveBeenCalledWith(
      'session-1',
      expect.stringMatching(/^ketik-review-route-/)
    );
  });
});
