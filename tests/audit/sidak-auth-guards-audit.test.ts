import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/app/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('../../.worktrees/feat-sidak-service-based/app/(main)/qa-analyzer/services/qaService.server', () => ({
  qaServiceServer: {
    getAgentExportData: vi.fn(),
    getPersonalTrendWithParameters: vi.fn(),
    getAgentsByFolder: vi.fn(),
  },
}));

import { createClient } from '@/app/lib/supabase/server';
import {
  createIndicator,
  getAgentExportDataAction,
  getAgentsByFolderAction,
} from '../../.worktrees/feat-sidak-service-based/app/(main)/qa-analyzer/actions';
import { qaServiceServer } from '../../.worktrees/feat-sidak-service-based/app/(main)/qa-analyzer/services/qaService.server';

type MockUser = { id: string; email: string } | null;

function makeSupabase(options: {
  user: MockUser;
  role?: string | null;
  ownPesertaId?: string | null;
  insertResult?: Record<string, unknown>;
  leaderScopeItems?: Array<{ field_name: string; field_value: string }>;
  batchPesertaIds?: string[];
  timPesertaIds?: string[];
  folderAgents?: Array<{ id: string; nama: string; tim: string; jabatan: string }>;
}) {
  const auth = {
    getUser: vi.fn().mockResolvedValue({
      data: { user: options.user },
      error: null,
    }),
  };

  const insertMock = vi.fn().mockResolvedValue({
    data: options.insertResult ?? { id: 'new-indicator' },
    error: null,
  });

  const profilesSingle = vi.fn().mockResolvedValue({
    data: options.role == null ? null : { role: options.role },
    error: null,
  });

  const pesertaSingle = vi.fn().mockResolvedValue({
    data: options.ownPesertaId == null ? null : { id: options.ownPesertaId },
    error: options.ownPesertaId == null ? new Error('not found') : null,
  });

  const profilesQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: profilesSingle,
  };

  function createThenableQuery(data: Array<{ id: string }>) {
    const promise = Promise.resolve({ data, error: null as null });
    Object.assign(promise, {
      select: () => promise,
      in: () => promise,
      limit: () => promise,
      eq: () => promise,
    });
    return promise;
  }

  let pesertaCallCount = 0;

  const pesertaQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: pesertaSingle,
  };

  const indicatorInsertChain = {
    select: vi.fn().mockReturnThis(),
    single: insertMock,
  };

  const indicatorTable = {
    insert: vi.fn().mockReturnValue(indicatorInsertChain),
  };

  const leaderRpc = vi.fn().mockResolvedValue({
    data: options.leaderScopeItems ?? null,
    error: null,
  });

  const from = vi.fn((table: string) => {
    if (table === 'profiles') return profilesQuery;
    if (table === 'profiler_peserta') {
      pesertaCallCount++;

      const allDimIds = [
        ...(options.batchPesertaIds || []),
        ...(options.timPesertaIds || []),
      ];
      if (allDimIds.length > 0) {
        return createThenableQuery(allDimIds.map((id) => ({ id })));
      }

      return pesertaQuery;
    }
    if (table === 'qa_indicators') return indicatorTable;
    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    auth,
    from,
    rpc: leaderRpc,
    __insertMock: indicatorTable.insert,
    __folderAgents: options.folderAgents,
  };
}

describe('SIDAK auth/RBAC audit regression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects indicator mutation for authenticated non-privileged users', async () => {
    const supabase = makeSupabase({
      user: { id: 'user-1', email: 'agent@example.com' },
      role: 'agent',
    });
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    await expect(
      createIndicator('call' as any, 'Indicator A', 'critical' as any, 10, false),
    ).rejects.toThrow('Akses ditolak: Hanya trainer dan admin yang dapat melakukan aksi ini');

    expect(supabase.__insertMock).not.toHaveBeenCalled();
  });

  it('allows indicator mutation for trainer/admin users', async () => {
    const supabase = makeSupabase({
      user: { id: 'user-2', email: 'trainer@example.com' },
      role: 'trainer',
      insertResult: { id: 'created-indicator' },
    });
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    const result = await createIndicator('call' as any, 'Indicator B', 'critical' as any, 10, false);

    expect(result).toEqual({ id: 'created-indicator' });
    expect(supabase.__insertMock).toHaveBeenCalledTimes(1);
  });

  it('rejects agent detail export when an agent requests another peserta record', async () => {
    const supabase = makeSupabase({
      user: { id: 'user-3', email: 'agent@example.com' },
      role: 'agent',
      ownPesertaId: 'peserta-self',
    });
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    await expect(getAgentExportDataAction('peserta-other')).rejects.toThrow('Akses ditolak');
    expect(vi.mocked(qaServiceServer.getAgentExportData)).not.toHaveBeenCalled();
  });

  it('allows agent detail export for the caller own peserta record', async () => {
    const supabase = makeSupabase({
      user: { id: 'user-4', email: 'agent@example.com' },
      role: 'agent',
      ownPesertaId: 'peserta-self',
    });
    vi.mocked(createClient).mockResolvedValue(supabase as never);
    vi.mocked(qaServiceServer.getAgentExportData).mockResolvedValue({ ok: true } as never);

    const result = await getAgentExportDataAction('peserta-self');

    expect(result).toEqual({ ok: true });
    expect(qaServiceServer.getAgentExportData).toHaveBeenCalledWith('peserta-self');
  });

  it('should reject folder-level agent reads for plain authenticated agents', async () => {
    const supabase = makeSupabase({
      user: { id: 'user-5', email: 'agent@example.com' },
      role: 'agent',
    });
    vi.mocked(createClient).mockResolvedValue(supabase as never);
    vi.mocked(qaServiceServer.getAgentsByFolder).mockResolvedValue([{ id: 'p1' }] as never);

    await expect(getAgentsByFolderAction('Batch A')).rejects.toThrow(/Akses ditolak/);
  });

  it('rejects leader agent detail export when leader has no approved scope', async () => {
    const supabase = makeSupabase({
      user: { id: 'leader-1', email: 'leader@example.com' },
      role: 'leader',
      leaderScopeItems: [],
    });
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    await expect(getAgentExportDataAction('peserta-a')).rejects.toThrow(
      'Akses ditolak: Anda tidak memiliki akses yang disetujui untuk modul ini',
    );
  });

  it('rejects leader agent detail export when agent is outside approved scope', async () => {
    const supabase = makeSupabase({
      user: { id: 'leader-2', email: 'leader@example.com' },
      role: 'leader',
      leaderScopeItems: [
        { field_name: 'peserta_id', field_value: 'peserta-allowed' },
      ],
    });
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    await expect(getAgentExportDataAction('peserta-other')).rejects.toThrow(
      'Akses ditolak: peserta di luar scope akses Anda',
    );
  });

  it('allows leader agent detail export when agent is within approved scope', async () => {
    const supabase = makeSupabase({
      user: { id: 'leader-3', email: 'leader@example.com' },
      role: 'leader',
      leaderScopeItems: [
        { field_name: 'peserta_id', field_value: 'peserta-scoped' },
      ],
    });
    vi.mocked(createClient).mockResolvedValue(supabase as never);
    vi.mocked(qaServiceServer.getAgentExportData).mockResolvedValue({ id: 'peserta-scoped' } as never);

    const result = await getAgentExportDataAction('peserta-scoped');

    expect(result).toEqual({ id: 'peserta-scoped' });
  });

  it('rejects leader access when agent is outside combined peserta_id scope', async () => {
    const supabase = makeSupabase({
      user: { id: 'leader-4', email: 'leader@example.com' },
      role: 'leader',
      leaderScopeItems: [
        { field_name: 'peserta_id', field_value: 'p1' },
        { field_name: 'peserta_id', field_value: 'p2' },
        { field_name: 'peserta_id', field_value: 'p3' },
      ],
    });
    vi.mocked(createClient).mockResolvedValue(supabase as never);
    vi.mocked(qaServiceServer.getAgentExportData).mockResolvedValue({ id: 'p2' } as never);

    const result = await getAgentExportDataAction('p2');
    expect(result).toEqual({ id: 'p2' });

    await expect(getAgentExportDataAction('p-unknown')).rejects.toThrow(
      'Akses ditolak: peserta di luar scope akses Anda',
    );
  });

  it('unions batch_name and tim scope dimensions for leader access', async () => {
    const supabase = makeSupabase({
      user: { id: 'leader-6', email: 'leader@example.com' },
      role: 'leader',
      leaderScopeItems: [
        { field_name: 'batch_name', field_value: 'Batch A' },
        { field_name: 'tim', field_value: 'Tim X' },
      ],
      batchPesertaIds: ['p-batch-1', 'p-batch-2'],
      timPesertaIds: ['p-tim-1'],
    });
    vi.mocked(createClient).mockResolvedValue(supabase as never);
    vi.mocked(qaServiceServer.getAgentExportData).mockResolvedValue({ id: 'p-batch-1' } as never);

    const result = await getAgentExportDataAction('p-batch-1');
    expect(result).toEqual({ id: 'p-batch-1' });

    vi.mocked(qaServiceServer.getAgentExportData).mockResolvedValue({ id: 'p-tim-1' } as never);
    const result2 = await getAgentExportDataAction('p-tim-1');
    expect(result2).toEqual({ id: 'p-tim-1' });

    await expect(getAgentExportDataAction('p-unknown')).rejects.toThrow(
      'Akses ditolak: peserta di luar scope akses Anda',
    );
  });

  it('filters folder agents to leader approved scope', async () => {
    const supabase = makeSupabase({
      user: { id: 'leader-5', email: 'leader@example.com' },
      role: 'leader',
      leaderScopeItems: [
        { field_name: 'peserta_id', field_value: 'p1' },
        { field_name: 'peserta_id', field_value: 'p3' },
      ],
      folderAgents: [
        { id: 'p1', nama: 'Agent 1', tim: 'Tim A', jabatan: 'Staff' },
        { id: 'p2', nama: 'Agent 2', tim: 'Tim A', jabatan: 'Staff' },
        { id: 'p3', nama: 'Agent 3', tim: 'Tim A', jabatan: 'Staff' },
      ],
    });
    vi.mocked(createClient).mockResolvedValue(supabase as never);
    vi.mocked(qaServiceServer.getAgentsByFolder).mockResolvedValue(
      supabase.__folderAgents as never,
    );

    const result = await getAgentsByFolderAction('Batch A');

    expect(result).toHaveLength(2);
    expect(result.map((a: { id: string }) => a.id)).toEqual(['p1', 'p3']);
  });
});
