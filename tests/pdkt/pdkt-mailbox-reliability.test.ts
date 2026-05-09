import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMailboxItem } from '@/app/(main)/pdkt/actions';
import { initializeEmailSession } from '@/app/(main)/pdkt/services/geminiService';
import { processPdktEvaluation } from '@/app/(main)/pdkt/services/evaluationService';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const mocks = vi.hoisted(() => {
  const chain: any = vi.fn().mockImplementation(() => chain);
  chain.select = vi.fn().mockImplementation(() => chain);
  chain.eq = vi.fn().mockImplementation(() => chain);
  chain.update = vi.fn().mockImplementation(() => chain);
  chain.order = vi.fn().mockImplementation(() => chain);
  chain.limit = vi.fn().mockImplementation(() => chain);
  chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  
  // Make it thenable
  chain.then = (onFulfilled: any) => Promise.resolve({ data: null, error: null }).then(onFulfilled);

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
    rpc: mocks.rpc,
    from: vi.fn().mockReturnValue(mocks.chain)
  }),
}));

vi.mock('@/app/lib/supabase/admin', () => ({
  createAdminClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue(mocks.chain),
  }),
}));

vi.mock('@/app/(main)/pdkt/services/geminiService', () => ({
  initializeEmailSession: vi.fn(),
  evaluateAgentResponse: vi.fn().mockResolvedValue({ score: 90, feedback: 'Good' })
}));

describe('PDKT Mailbox Reliability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createMailboxItem uses batch RPC for fanout', async () => {
    const mockScenario = { id: 's1', title: 'Test', description: 'Desc' };
    const mockConfig = { scenarios: [mockScenario], identity: { email: 'c@c.com', name: 'Consumer' } };
    
    (initializeEmailSession as any).mockResolvedValue({
      success: true,
      message: { id: 'm1', from: 'c@c.com', body: 'Hello', subject: 'Sub' }
    });

    mocks.chain.single.mockResolvedValue({ data: { id: 'new-id' }, error: null });

    await createMailboxItem(mockConfig as any, mockScenario as any);

    expect(mocks.rpc).toHaveBeenCalledWith('submit_pdkt_mailbox_batch', expect.objectContaining({
        p_sender_name: 'Consumer',
        p_subject: 'Sub'
    }));
  });

  it('createMailboxItem rejects duplicate client request id batch failures', async () => {
    const mockScenario = { id: 's1', title: 'Test', description: 'Desc' };
    const mockConfig = { scenarios: [mockScenario], identity: { email: 'c@c.com', name: 'Consumer' } };

    (initializeEmailSession as any).mockResolvedValue({
      success: true,
      message: { id: 'm1', from: 'c@c.com', body: 'Hello', subject: 'Sub' }
    });

    mocks.rpc.mockResolvedValueOnce({ error: { message: 'Duplicate mailbox request' } });

    await expect(createMailboxItem(mockConfig as any, mockScenario as any)).rejects.toThrow('Gagal menyimpan email baru.');
  });

  it('processPdktEvaluation reclaims stale rows', async () => {
     // 10 minutes ago
     const staleDate = new Date(Date.now() - 10 * 60 * 1000).toISOString();
     mocks.chain.single.mockResolvedValue({
         data: {
             id: 'h1',
             user_id: 'test-user',
             evaluation_status: 'processing',
             evaluation_started_at: staleDate,
             emails: [{ isAgent: false, body: 'Q' }, { isAgent: true, body: 'A' }],
             config: {}
         },
         error: null
     });
     
     await processPdktEvaluation('h1', 'test-user');
     
     // Should have updated status to processing again (reclaiming)
     expect(mocks.chain.update).toHaveBeenCalledWith(expect.objectContaining({
         evaluation_status: 'processing'
     }));

     // Should eventually mark as completed
     expect(mocks.chain.update).toHaveBeenCalledWith(expect.objectContaining({
         evaluation_status: 'completed'
     }));
  });

  it('processPdktEvaluation blocks non-stale processing rows', async () => {
    // 1 minute ago
    const freshDate = new Date(Date.now() - 1 * 60 * 1000).toISOString();
    mocks.chain.single.mockResolvedValue({
        data: {
            id: 'h2',
            user_id: 'test-user',
            evaluation_status: 'processing',
            evaluation_started_at: freshDate,
        },
        error: null
    });
    
    await expect(processPdktEvaluation('h2', 'test-user')).rejects.toThrow('Evaluation is already in progress');
  });
});
