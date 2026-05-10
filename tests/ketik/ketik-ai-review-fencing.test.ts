import { beforeEach, describe, expect, it, vi } from 'vitest';
import { claimAndProcessKetikReviewJob } from '@/app/actions/ketik-ai-review';
import { generateGeminiContent } from '@/app/actions/gemini';

vi.mock('server-only', () => ({}));

const sessionReviewDeleteEq = vi.fn();
const jobUpdatePayloads: unknown[] = [];
let jobFromCalls = 0;

function createThenable(result: unknown) {
  return {
    then(resolve: (value: unknown) => unknown) {
      return Promise.resolve(result).then(resolve);
    },
  };
}

function createJobQuery() {
  jobFromCalls += 1;
  const callNumber = jobFromCalls;
  const query: any = {
    update: vi.fn((payload: unknown) => {
      jobUpdatePayloads.push(payload);
      return query;
    }),
    eq: vi.fn(() => query),
    or: vi.fn(() => query),
    select: vi.fn(() => query),
    maybeSingle: vi.fn(),
    then(resolve: (value: unknown) => unknown) {
      if (callNumber === 1) {
        return Promise.resolve({ data: [{ id: 'job-1', attempt_count: 0 }], error: null }).then(resolve);
      }

      if (callNumber === 3) {
        return Promise.resolve({ data: [], error: null }).then(resolve);
      }

      return Promise.resolve({ data: null, error: null }).then(resolve);
    },
  };
  return query;
}

function createHistoryQuery() {
  const query: any = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    single: vi.fn().mockResolvedValue({
      data: {
        id: 'session-1',
        user_id: 'user-1',
        messages: [{ role: 'user', content: 'Halo', timestamp: new Date().toISOString() }],
      },
      error: null,
    }),
    update: vi.fn(() => query),
    then(resolve: (value: unknown) => unknown) {
      return Promise.resolve({ data: null, error: null }).then(resolve);
    },
  };
  return query;
}

vi.mock('@/app/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'ketik_review_jobs') return createJobQuery();
      if (table === 'ketik_history') return createHistoryQuery();
      if (table === 'ketik_session_reviews') {
        return {
          delete: vi.fn(() => ({ eq: sessionReviewDeleteEq })),
          insert: vi.fn(() => createThenable({ data: null, error: null })),
        };
      }
      return {
        delete: vi.fn(() => ({ eq: vi.fn() })),
        insert: vi.fn(() => createThenable({ data: null, error: null })),
      };
    },
  }),
}));

vi.mock('@/app/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: vi.fn() } }),
}));

vi.mock('@/app/actions/gemini', () => ({
  generateGeminiContent: vi.fn(),
}));

describe('KETIK review job lease fencing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    jobFromCalls = 0;
    jobUpdatePayloads.length = 0;
    (generateGeminiContent as any).mockResolvedValue({
      success: true,
      text: JSON.stringify({
        summary: 'Ringkasan.',
        strengths: ['Baik'],
        weaknesses: ['Perlu probing'],
        coachingFocus: ['Latih probing'],
        scores: { final: 80, empathy: 80, probing: 80, typo: 80, compliance: 80 },
        typos: [],
      }),
    });
  });

  it('does not overwrite review rows after the worker loses its lease', async () => {
    const result = await claimAndProcessKetikReviewJob('session-1', 'worker-a');

    expect(result.status).toBe('processing');
    expect(sessionReviewDeleteEq).not.toHaveBeenCalled();
    expect(jobUpdatePayloads).toContainEqual(expect.objectContaining({ lease_owner: 'worker-a' }));
  });
});
