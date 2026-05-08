import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/ketik/worker/route';
import { createAdminClient } from '@/app/lib/supabase/admin';
import * as reviewActions from '@/app/actions/ketik-ai-review';

vi.mock('@/app/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

vi.mock('@/app/actions/ketik-ai-review', () => ({
  processKetikReviewJob: vi.fn(),
}));

describe('GET /api/ketik/worker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with no jobs found if no pending jobs exist', async () => {
    const mockAdmin = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    };
    (createAdminClient as any).mockReturnValue(mockAdmin);

    const req = new Request('http://localhost/api/ketik/worker');
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ message: 'No jobs to process' });
  });

  it('fails job if attempt_count >= 3', async () => {
    const mockJob = { id: 'job1', session_id: 'sess1', attempt_count: 3 };
    const mockAdminUpdateJob = vi.fn().mockReturnThis();
    const mockAdminEqJob = vi.fn().mockResolvedValue({ error: null });
    const mockAdminUpdateHistory = vi.fn().mockReturnThis();
    const mockAdminEqHistory = vi.fn().mockResolvedValue({ error: null });

    const mockAdmin = {
      from: vi.fn().mockImplementation((table) => {
        if (table === 'ketik_review_jobs') {
          return {
            select: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: mockJob, error: null }),
            update: mockAdminUpdateJob,
            eq: mockAdminEqJob,
          };
        } else if (table === 'ketik_history') {
          return {
            update: mockAdminUpdateHistory,
            eq: mockAdminEqHistory,
          };
        }
        return {};
      }),
    };
    (createAdminClient as any).mockReturnValue(mockAdmin);

    const req = new Request('http://localhost/api/ketik/worker');
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.message).toBe('Job failed: max attempts reached');
    expect(mockAdminUpdateJob).toHaveBeenCalledWith({ status: 'failed', error_message: 'Max attempts reached' });
    expect(mockAdminUpdateHistory).toHaveBeenCalledWith({ review_status: 'failed' });
  });

  it('processes job and marks as completed', async () => {
    const mockJob = { id: 'job1', session_id: 'sess1', attempt_count: 0 };
    const mockAdminUpdateJob = vi.fn().mockReturnThis();
    const mockAdminEqJob = vi.fn().mockResolvedValue({ error: null });

    const mockAdmin = {
      from: vi.fn().mockImplementation((table) => {
        if (table === 'ketik_review_jobs') {
          return {
            select: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: mockJob, error: null }),
            update: mockAdminUpdateJob,
            eq: mockAdminEqJob,
          };
        }
        return {};
      }),
    };
    (createAdminClient as any).mockReturnValue(mockAdmin);
    (reviewActions.processKetikReviewJob as any).mockResolvedValue({ status: 'completed' });

    const req = new Request('http://localhost/api/ketik/worker');
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.message).toBe('Job processed successfully');
    expect(reviewActions.processKetikReviewJob).toHaveBeenCalledWith('sess1');
  });

  it('fails job if processKetikReviewJob throws', async () => {
    const mockJob = { id: 'job1', session_id: 'sess1', attempt_count: 0 };
    const mockAdminUpdateJob = vi.fn().mockReturnThis();
    const mockAdminEqJob = vi.fn().mockResolvedValue({ error: null });
    const mockAdminUpdateHistory = vi.fn().mockReturnThis();
    const mockAdminEqHistory = vi.fn().mockResolvedValue({ error: null });

    const mockAdmin = {
      from: vi.fn().mockImplementation((table) => {
        if (table === 'ketik_review_jobs') {
          return {
            select: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: mockJob, error: null }),
            update: mockAdminUpdateJob,
            eq: mockAdminEqJob,
          };
        } else if (table === 'ketik_history') {
          return {
            update: mockAdminUpdateHistory,
            eq: mockAdminEqHistory,
          };
        }
        return {};
      }),
    };
    (createAdminClient as any).mockReturnValue(mockAdmin);
    (reviewActions.processKetikReviewJob as any).mockRejectedValue(new Error('AI error'));

    const req = new Request('http://localhost/api/ketik/worker');
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200); // the worker successfully caught the error
    expect(json.message).toBe('Job processed with error');
    expect(mockAdminUpdateJob).toHaveBeenLastCalledWith({
      status: 'failed',
      error_message: 'AI error',
      lease_owner: null,
      lease_expires_at: null,
    });
    expect(mockAdminUpdateHistory).toHaveBeenCalledWith({ review_status: 'failed' });
  });
});
