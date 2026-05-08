import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/ketik/worker/route';
import { createAdminClient } from '@/app/lib/supabase/admin';
import * as reviewActions from '@/app/actions/ketik-ai-review';

vi.mock('@/app/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

vi.mock('@/app/actions/ketik-ai-review', () => ({
  processKetikReviewJob: vi.fn(),
  claimAndProcessKetikReviewJob: vi.fn(),
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

  it('handles failed job from helper', async () => {
    const mockJob = { id: 'job1', session_id: 'sess1', attempt_count: 3 };

    const mockAdmin = {
      from: vi.fn().mockImplementation((table) => {
        if (table === 'ketik_review_jobs') {
          return {
            select: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: mockJob, error: null }),
          };
        }
        return {};
      }),
    };
    (createAdminClient as any).mockReturnValue(mockAdmin);
    (reviewActions.claimAndProcessKetikReviewJob as any).mockResolvedValue({ status: 'failed', error: 'Max attempts reached' });

    const req = new Request('http://localhost/api/ketik/worker');
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.message).toBe('Job failed');
    expect(reviewActions.claimAndProcessKetikReviewJob).toHaveBeenCalledWith('sess1', expect.stringContaining('ketik-worker-'));
  });

  it('processes job and marks as completed', async () => {
    const mockJob = { id: 'job1', session_id: 'sess1', attempt_count: 0 };

    const mockAdmin = {
      from: vi.fn().mockImplementation((table) => {
        if (table === 'ketik_review_jobs') {
          return {
            select: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: mockJob, error: null }),
          };
        }
        return {};
      }),
    };
    (createAdminClient as any).mockReturnValue(mockAdmin);
    (reviewActions.claimAndProcessKetikReviewJob as any).mockResolvedValue({ status: 'completed' });

    const req = new Request('http://localhost/api/ketik/worker');
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.message).toBe('Job processed successfully');
    expect(reviewActions.claimAndProcessKetikReviewJob).toHaveBeenCalledWith('sess1', expect.stringContaining('ketik-worker-'));
  });

  it('handles error from helper correctly', async () => {
    const mockJob = { id: 'job1', session_id: 'sess1', attempt_count: 0 };

    const mockAdmin = {
      from: vi.fn().mockImplementation((table) => {
        if (table === 'ketik_review_jobs') {
          return {
            select: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: mockJob, error: null }),
          };
        }
        return {};
      }),
    };
    (createAdminClient as any).mockReturnValue(mockAdmin);
    (reviewActions.claimAndProcessKetikReviewJob as any).mockResolvedValue({ status: 'failed', error: 'AI error' });

    const req = new Request('http://localhost/api/ketik/worker');
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.message).toBe('Job failed');
    expect(json.error).toBe('AI error');
  });
});
