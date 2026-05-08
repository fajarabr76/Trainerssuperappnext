import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '@/app/api/pdkt/evaluate/route';

vi.mock('server-only', () => ({}));

vi.mock('@/app/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user' } } }),
    },
  }),
}));

const { mockUpdate, mockEq, mockIs, mockSelect, mockMaybeSingle } = vi.hoisted(() => ({
  mockUpdate: vi.fn().mockReturnThis(),
  mockEq: vi.fn().mockReturnThis(),
  mockIs: vi.fn().mockReturnThis(),
  mockSelect: vi.fn().mockReturnThis(),
  mockMaybeSingle: vi.fn(),
}));

vi.mock('@/app/lib/supabase/admin', () => ({
  createAdminClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      update: mockUpdate,
      select: mockSelect,
      eq: mockEq,
      is: mockIs,
      maybeSingle: mockMaybeSingle,
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
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
    // Setup the mock to return a row so evaluateAgentResponse is called
    mockMaybeSingle.mockResolvedValue({
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
});
