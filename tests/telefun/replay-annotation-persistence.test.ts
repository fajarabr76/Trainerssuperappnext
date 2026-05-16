import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createClientMock,
  createAdminClientMock,
  generateGeminiContentMock,
  runWithVoiceAssessmentTimeoutMock,
  isValidRecordingPathMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  createAdminClientMock: vi.fn(),
  generateGeminiContentMock: vi.fn(),
  runWithVoiceAssessmentTimeoutMock: vi.fn(),
  isValidRecordingPathMock: vi.fn(),
}));

vi.mock('@/app/lib/supabase/server', () => ({
  createClient: createClientMock,
}));

vi.mock('@/app/lib/supabase/admin', () => ({
  createAdminClient: createAdminClientMock,
}));

vi.mock('@/app/actions/gemini', () => ({
  generateGeminiContent: generateGeminiContentMock,
}));

vi.mock('@/app/actions/voiceAssessmentTimeout', () => ({
  runWithVoiceAssessmentTimeout: runWithVoiceAssessmentTimeoutMock,
}));

vi.mock('@/app/(main)/telefun/recordingPath', () => ({
  isValidRecordingPath: isValidRecordingPathMock,
}));

import { generateReplayAnnotations } from '@/app/actions/replayAnnotation';

type QueryResult = { data: unknown; error?: unknown };

function createEqBuilder(result: QueryResult) {
  return {
    eq() {
      return {
        eq() {
          return Promise.resolve(result);
        },
      };
    },
  };
}

function createMaybeSingleBuilder(result: QueryResult) {
  return {
    eq() {
      return {
        maybeSingle() {
          return Promise.resolve(result);
        },
      };
    },
  };
}

function createSingleBuilder(result: QueryResult) {
  return {
    eq() {
      return {
        eq() {
          return {
            single() {
              return Promise.resolve(result);
            },
          };
        },
      };
    },
  };
}

function createAdminClient(options: {
  sessionRow: Record<string, unknown>;
  existingAnnotations: Array<Record<string, unknown>>;
  existingSummary: { id: string; recommendations: Array<{ text: string; priority: number }> } | null;
  annotationsSelectError?: unknown;
  summarySelectError?: unknown;
  downloadResult?: QueryResult;
  insertResult?: QueryResult;
  rpcResult?: QueryResult;
}) {
  const insert = vi.fn().mockResolvedValue(options.insertResult ?? { data: null, error: null });
  const rpc = vi.fn().mockResolvedValue(options.rpcResult ?? { data: 'summary-id', error: null });
  const download = vi.fn().mockResolvedValue(
    options.downloadResult ?? {
      data: {
        arrayBuffer: async () => new TextEncoder().encode('audio').buffer,
      },
      error: null,
    }
  );

  const from = vi.fn((table: string) => {
    if (table === 'telefun_history') {
      return {
        select() {
          return createSingleBuilder({ data: options.sessionRow, error: null });
        },
      };
    }

    if (table === 'telefun_replay_annotations') {
      return {
        select() {
          return createEqBuilder({
            data: options.annotationsSelectError ? null : options.existingAnnotations,
            error: options.annotationsSelectError ?? null,
          });
        },
        insert,
      };
    }

    if (table === 'telefun_coaching_summary') {
      return {
        select() {
          return createMaybeSingleBuilder({
            data: options.summarySelectError ? null : options.existingSummary,
            error: options.summarySelectError ?? null,
          });
        },
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    admin: {
      from,
      rpc,
      storage: {
        from: vi.fn(() => ({ download })),
      },
    },
    spies: { insert, rpc, download, from },
  };
}

describe('generateReplayAnnotations partial persistence recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
    });
    isValidRecordingPathMock.mockReturnValue(true);
    runWithVoiceAssessmentTimeoutMock.mockImplementation(async (callback: (signal: AbortSignal) => Promise<unknown>) => {
      return callback(new AbortController().signal);
    });
  });

  it('backfills a missing coaching summary when annotations already exist', async () => {
    const existingAnnotations = [
      {
        id: 'ann-1',
        timestamp_ms: 500,
        category: 'strength',
        moment: 'good_de_escalation',
        text: 'Persisted annotation',
        is_manual: false,
      },
    ];
    const { admin, spies } = createAdminClient({
      sessionRow: {
        id: 'session-1',
        user_id: 'user-1',
        scenario_title: 'Test scenario',
        recording_path: 'telefun-recordings/user-1/session-1/full_call.webm',
        session_metrics: null,
      },
      existingAnnotations,
      existingSummary: null,
    });
    createAdminClientMock.mockReturnValue(admin);
    generateGeminiContentMock.mockResolvedValue({
      success: true,
      text: JSON.stringify({
        annotations: [
          {
            timestampMs: 999,
            category: 'critical_moment',
            moment: 'interruption',
            text: 'Generated annotation',
          },
        ],
        recommendations: [{ text: 'Generated recommendation', priority: 1 }],
      }),
    });

    const result = await generateReplayAnnotations('session-1');

    expect(result).toEqual({
      success: true,
      result: {
        annotations: [
          {
            id: 'ann-1',
            timestampMs: 500,
            category: 'strength',
            moment: 'good_de_escalation',
            text: 'Persisted annotation',
            isManual: false,
          },
        ],
        summary: [{ text: 'Generated recommendation', priority: 1 }],
      },
    });
    expect(spies.download).toHaveBeenCalledTimes(1);
    expect(spies.insert).not.toHaveBeenCalled();
    expect(spies.rpc).toHaveBeenCalledWith('upsert_telefun_coaching_summary', {
      p_session_id: 'session-1',
      p_recommendations: [{ text: 'Generated recommendation', priority: 1 }],
    });
  });

  it('backfills missing annotations when a coaching summary already exists', async () => {
    const persistedSummary = [{ text: 'Persisted recommendation', priority: 2 }];
    const { admin, spies } = createAdminClient({
      sessionRow: {
        id: 'session-1',
        user_id: 'user-1',
        scenario_title: 'Test scenario',
        recording_path: 'telefun-recordings/user-1/session-1/full_call.webm',
        session_metrics: null,
      },
      existingAnnotations: [],
      existingSummary: {
        id: 'summary-1',
        recommendations: persistedSummary,
      },
    });
    createAdminClientMock.mockReturnValue(admin);
    generateGeminiContentMock.mockResolvedValue({
      success: true,
      text: JSON.stringify({
        annotations: [
          {
            timestampMs: 1200,
            category: 'improvement_area',
            moment: 'long_pause',
            text: 'Generated annotation',
          },
        ],
        recommendations: [{ text: 'New recommendation that should be ignored', priority: 5 }],
      }),
    });

    const result = await generateReplayAnnotations('session-1');

    expect(result).toEqual({
      success: true,
      result: {
        annotations: [
          {
            id: expect.any(String),
            timestampMs: 1200,
            category: 'improvement_area',
            moment: 'long_pause',
            text: 'Generated annotation',
            isManual: false,
          },
        ],
        summary: persistedSummary,
      },
    });
    expect(spies.download).toHaveBeenCalledTimes(1);
    expect(spies.insert).toHaveBeenCalledTimes(1);
    expect(spies.rpc).not.toHaveBeenCalled();
  });

  it('regenerates AI annotations when only manual annotations exist', async () => {
    const manualAnnotations = [
      {
        id: 'manual-1',
        timestamp_ms: 300,
        category: 'strength',
        moment: 'good_de_escalation',
        text: 'User added this manually',
        is_manual: true,
      },
    ];
    const { admin, spies } = createAdminClient({
      sessionRow: {
        id: 'session-1',
        user_id: 'user-1',
        scenario_title: 'Test scenario',
        recording_path: 'telefun-recordings/user-1/session-1/full_call.webm',
        session_metrics: null,
      },
      existingAnnotations: manualAnnotations,
      existingSummary: null,
    });
    createAdminClientMock.mockReturnValue(admin);
    generateGeminiContentMock.mockResolvedValue({
      success: true,
      text: JSON.stringify({
        annotations: [
          {
            timestampMs: 1500,
            category: 'critical_moment',
            moment: 'interruption',
            text: 'AI-generated annotation',
          },
        ],
        recommendations: [{ text: 'AI recommendation', priority: 1 }],
      }),
    });

    const result = await generateReplayAnnotations('session-1');

    // Should contain both manual and AI annotations
    expect(result.success).toBe(true);
    expect(result.result?.annotations).toHaveLength(2);
    const manualAnn = result.result?.annotations.find((a) => a.isManual === true);
    const aiAnn = result.result?.annotations.find((a) => a.isManual === false);
    expect(manualAnn).toMatchObject({
      id: 'manual-1',
      text: 'User added this manually',
      isManual: true,
    });
    expect(aiAnn).toMatchObject({
      text: 'AI-generated annotation',
      isManual: false,
    });
    expect(result.result?.summary).toEqual([{ text: 'AI recommendation', priority: 1 }]);
    // Should download audio to generate AI annotations
    expect(spies.download).toHaveBeenCalledTimes(1);
    // Should NOT insert AI annotations again since manual ones already exist
    // (manual annotations are already persisted, only AI ones need persisting)
    expect(spies.rpc).toHaveBeenCalledWith('upsert_telefun_coaching_summary', {
      p_session_id: 'session-1',
      p_recommendations: [{ text: 'AI recommendation', priority: 1 }],
    });
  });

  it('fails fast when replay annotations select errors instead of silently regenerating', async () => {
    const { admin, spies } = createAdminClient({
      sessionRow: {
        id: 'session-1',
        user_id: 'user-1',
        scenario_title: 'Test scenario',
        recording_path: 'telefun-recordings/user-1/session-1/full_call.webm',
        session_metrics: null,
      },
      existingAnnotations: [],
      existingSummary: null,
      annotationsSelectError: new Error('Database connection lost'),
    });
    createAdminClientMock.mockReturnValue(admin);

    const result = await generateReplayAnnotations('session-1');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Gagal membaca data anotasi');
    expect(spies.download).not.toHaveBeenCalled();
  });

  it('returns persisted AI annotations as partial data when summary backfill fails', async () => {
    const existingAnnotations = [
      {
        id: 'ann-1',
        timestamp_ms: 500,
        category: 'strength',
        moment: 'good_de_escalation',
        text: 'Persisted AI annotation',
        is_manual: false,
      },
    ];
    const { admin, spies } = createAdminClient({
      sessionRow: {
        id: 'session-1',
        user_id: 'user-1',
        scenario_title: 'Test scenario',
        recording_path: 'telefun-recordings/user-1/session-1/full_call.webm',
        session_metrics: null,
      },
      existingAnnotations,
      existingSummary: null,
      downloadResult: { data: null, error: new Error('Storage error') },
    });
    createAdminClientMock.mockReturnValue(admin);

    const result = await generateReplayAnnotations('session-1');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Gagal mengunduh rekaman. Silakan coba lagi.');
    expect(result.result?.annotations).toEqual([
      {
        id: 'ann-1',
        timestampMs: 500,
        category: 'strength',
        moment: 'good_de_escalation',
        text: 'Persisted AI annotation',
        isManual: false,
      },
    ]);
    expect(result.result?.summary).toEqual([]);
    expect(spies.download).toHaveBeenCalledTimes(1);
  });

  it('returns persisted manual annotations and summary as partial data when regeneration fails without AI annotations', async () => {
    const manualAnnotations = [
      {
        id: 'manual-1',
        timestamp_ms: 300,
        category: 'strength',
        moment: 'good_de_escalation',
        text: 'User added this manually',
        is_manual: true,
      },
    ];
    const persistedSummary = [{ text: 'Existing recommendation', priority: 2 }];
    const { admin, spies } = createAdminClient({
      sessionRow: {
        id: 'session-1',
        user_id: 'user-1',
        scenario_title: 'Test scenario',
        recording_path: 'telefun-recordings/user-1/session-1/full_call.webm',
        session_metrics: null,
      },
      existingAnnotations: manualAnnotations,
      existingSummary: { id: 'summary-1', recommendations: persistedSummary },
      downloadResult: { data: null, error: new Error('Storage error') },
    });
    createAdminClientMock.mockReturnValue(admin);

    const result = await generateReplayAnnotations('session-1');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Gagal mengunduh rekaman. Silakan coba lagi.');
    expect(result.result?.annotations).toEqual([
      {
        id: 'manual-1',
        timestampMs: 300,
        category: 'strength',
        moment: 'good_de_escalation',
        text: 'User added this manually',
        isManual: true,
      },
    ]);
    expect(result.result?.summary).toEqual(persistedSummary);
    expect(spies.download).toHaveBeenCalledTimes(1);
  });

  it('returns persisted summary as partial data when annotation backfill fails', async () => {
    const persistedSummary = [{ text: 'Existing recommendation', priority: 2 }];
    const { admin, spies } = createAdminClient({
      sessionRow: {
        id: 'session-1',
        user_id: 'user-1',
        scenario_title: 'Test scenario',
        recording_path: 'telefun-recordings/user-1/session-1/full_call.webm',
        session_metrics: null,
      },
      existingAnnotations: [],
      existingSummary: { id: 'summary-1', recommendations: persistedSummary },
      downloadResult: { data: null, error: new Error('Storage error') },
    });
    createAdminClientMock.mockReturnValue(admin);

    const result = await generateReplayAnnotations('session-1');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Gagal mengunduh rekaman. Silakan coba lagi.');
    expect(result.result?.annotations).toEqual([]);
    expect(result.result?.summary).toEqual(persistedSummary);
    expect(spies.download).toHaveBeenCalledTimes(1);
  });

  it('returns generated replay data as partial failure when annotation persistence fails', async () => {
    const { admin, spies } = createAdminClient({
      sessionRow: {
        id: 'session-1',
        user_id: 'user-1',
        scenario_title: 'Test scenario',
        recording_path: 'telefun-recordings/user-1/session-1/full_call.webm',
        session_metrics: null,
      },
      existingAnnotations: [],
      existingSummary: null,
      insertResult: { data: null, error: new Error('Insert failed') },
    });
    createAdminClientMock.mockReturnValue(admin);
    generateGeminiContentMock.mockResolvedValue({
      success: true,
      text: JSON.stringify({
        annotations: [
          {
            timestampMs: 900,
            category: 'critical_moment',
            moment: 'interruption',
            text: 'Generated annotation',
          },
        ],
        recommendations: [{ text: 'Generated recommendation', priority: 1 }],
      }),
    });

    const result = await generateReplayAnnotations('session-1');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Sebagian hasil analisis gagal disimpan. Silakan coba lagi.');
    expect(result.result).toEqual({
      annotations: [
        {
          id: expect.any(String),
          timestampMs: 900,
          category: 'critical_moment',
          moment: 'interruption',
          text: 'Generated annotation',
          isManual: false,
        },
      ],
      summary: [{ text: 'Generated recommendation', priority: 1 }],
    });
    expect(spies.rpc).toHaveBeenCalledWith('upsert_telefun_coaching_summary', {
      p_session_id: 'session-1',
      p_recommendations: [{ text: 'Generated recommendation', priority: 1 }],
    });
  });

  it('returns generated replay data as partial failure when summary persistence fails', async () => {
    const { admin } = createAdminClient({
      sessionRow: {
        id: 'session-1',
        user_id: 'user-1',
        scenario_title: 'Test scenario',
        recording_path: 'telefun-recordings/user-1/session-1/full_call.webm',
        session_metrics: null,
      },
      existingAnnotations: [],
      existingSummary: null,
      rpcResult: { data: null, error: new Error('RPC failed') },
    });
    createAdminClientMock.mockReturnValue(admin);
    generateGeminiContentMock.mockResolvedValue({
      success: true,
      text: JSON.stringify({
        annotations: [
          {
            timestampMs: 1100,
            category: 'improvement_area',
            moment: 'long_pause',
            text: 'Generated annotation',
          },
        ],
        recommendations: [{ text: 'Generated recommendation', priority: 2 }],
      }),
    });

    const result = await generateReplayAnnotations('session-1');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Sebagian hasil analisis gagal disimpan. Silakan coba lagi.');
    expect(result.result).toEqual({
      annotations: [
        {
          id: expect.any(String),
          timestampMs: 1100,
          category: 'improvement_area',
          moment: 'long_pause',
          text: 'Generated annotation',
          isManual: false,
        },
      ],
      summary: [{ text: 'Generated recommendation', priority: 2 }],
    });
  });
});
