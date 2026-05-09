import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/ketik/review/status/route';
import { createClient } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';

vi.mock('@/app/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/app/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

describe('GET /api/ketik/review/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 if user is not authenticated', async () => {
    const mockSupabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error('Unauthorized') }) },
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    const req = new Request('http://localhost/api/ketik/review/status?sessionId=123');
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it('returns 400 if sessionId is missing', async () => {
    const mockSupabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }) },
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    const req = new Request('http://localhost/api/ketik/review/status');
    const res = await GET(req);

    expect(res.status).toBe(400);
  });

  it('returns 404 if session not found or unauthorized', async () => {
    const mockSupabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }) },
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    const mockAdmin = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: new Error('Not found') }),
      }),
    };
    (createAdminClient as any).mockReturnValue(mockAdmin);

    const req = new Request('http://localhost/api/ketik/review/status?sessionId=123');
    const res = await GET(req);

    expect(res.status).toBe(404);
  });

  it('returns status from ketik_history (pending/processing)', async () => {
    const mockSupabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }) },
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    const mockAdmin = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { review_status: 'processing', user_id: 'u1' }, error: null }),
      }),
    };
    (createAdminClient as any).mockReturnValue(mockAdmin);

    const req = new Request('http://localhost/api/ketik/review/status?sessionId=123');
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ status: 'processing', resultReady: false, scores: null });
  });

  it('auto-heals if status completed but review data missing', async () => {
    const mockSupabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }) },
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    const mockAdminUpdateKetikHistory = vi.fn().mockReturnThis();
    const mockAdminEqKetikHistory = vi.fn().mockResolvedValue({ error: null });
    const mockAdminUpdateKetikReviewJobs = vi.fn().mockReturnThis();
    const mockAdminEqKetikReviewJobs = vi.fn().mockResolvedValue({ error: null });

    const mockAdmin = {
      from: vi.fn().mockImplementation((table) => {
        if (table === 'ketik_history') {
          return {
            select: vi.fn().mockReturnThis(),
            update: mockAdminUpdateKetikHistory,
            eq: function (_field: string, _value: string) {
                if (this.update) {
                    return mockAdminEqKetikHistory;
                }
                return { single: vi.fn().mockResolvedValue({ data: { review_status: 'completed' }, error: null }) };
            }.bind({ update: table === 'ketik_history' && mockAdminUpdateKetikHistory }), // a bit hacky but works for now
          };
        } else if (table === 'ketik_session_reviews') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        } else if (table === 'ketik_review_jobs') {
            return {
              update: mockAdminUpdateKetikReviewJobs,
              eq: mockAdminEqKetikReviewJobs,
            };
        }
        return {};
      }),
    };
    
    // Better mocking
    mockAdmin.from = vi.fn().mockImplementation((_table) => {
        const chain = {
            select: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { review_status: 'completed', user_id: 'u1' }, error: null }),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
        return chain;
    });

    (createAdminClient as any).mockReturnValue(mockAdmin);

    const req = new Request('http://localhost/api/ketik/review/status?sessionId=123');
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ status: 'failed', resultReady: false, scores: null });
    // Verify auto-heal updates
    expect(mockAdmin.from).toHaveBeenCalledWith('ketik_history');
    expect(mockAdmin.from).toHaveBeenCalledWith('ketik_review_jobs');
  });

  it('returns completed and resultReady true if auto-heal passes', async () => {
    const mockSupabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }) },
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    const mockAdmin = {
      from: vi.fn().mockImplementation((table) => {
        if (table === 'ketik_history') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { review_status: 'completed', user_id: 'u1' }, error: null }),
          };
        } else if (table === 'ketik_session_reviews') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'rev1' }, error: null }),
          };
        }
        return {};
      }),
    };
    (createAdminClient as any).mockReturnValue(mockAdmin);

    const req = new Request('http://localhost/api/ketik/review/status?sessionId=123');
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ 
      status: 'completed', 
      resultReady: true,
      scores: {
        final: undefined,
        empathy: undefined,
        probing: undefined,
        typo: undefined,
        compliance: undefined,
      }
    });
  });
});
