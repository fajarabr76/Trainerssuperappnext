import { beforeEach, describe, expect, it, vi } from 'vitest';

type Handler = (...args: any[]) => any;

let capturedConnectionHandler: Handler | null = null;
let wsInstances: MockSocket[] = [];
let throwOnGeminiCreation = false;

class MockSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 3;

  readyState = MockSocket.OPEN;
  handlers: Record<string, Handler> = {};
  sent: string[] = [];

  constructor(public readonly url?: string) {
    if (throwOnGeminiCreation && url?.includes('generativelanguage.googleapis.com')) {
      throw new Error('simulated Gemini connection failure');
    }
    wsInstances.push(this);
  }

  on(event: string, handler: Handler) {
    this.handlers[event] = handler;
  }

  send(payload: string) {
    this.sent.push(payload);
  }

  close(code = 1000, reason = 'closed') {
    this.readyState = MockSocket.CLOSED;
    const closeHandler = this.handlers.close;
    if (closeHandler) return closeHandler(code, Buffer.from(reason));
  }
}

const flushLiveUsage = vi.fn();
const verifyToken = vi.fn();

vi.mock('http', () => ({
  createServer: vi.fn(() => ({ listen: vi.fn() })),
}));

vi.mock('ws', () => ({
  WebSocketServer: class {
    constructor() {}
    on(event: string, handler: Handler) {
      if (event === 'connection') capturedConnectionHandler = handler;
    }
  },
  WebSocket: MockSocket,
}));

vi.mock('../../.worktrees/fix-telefun-usage-flush/apps/telefun-server/src/env.js', () => ({
  env: {
    PORT: 3101,
    NODE_ENV: 'test',
    ALLOWED_ORIGINS: '*',
    GEMINI_API_KEY: 'test-key',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'anon',
    SUPABASE_SERVICE_ROLE_KEY: 'service',
  },
}));

vi.mock('../../.worktrees/fix-telefun-usage-flush/apps/telefun-server/src/auth.js', () => ({
  verifyToken,
}));

vi.mock('../../.worktrees/fix-telefun-usage-flush/apps/telefun-server/src/usage.js', () => ({
  parseUsageMetadata: vi.fn((raw) => raw),
  mergeSnapshot: vi.fn((prev, next) => next ?? prev),
  flushLiveUsage,
}));

async function setupConnection() {
  vi.resetModules();
  wsInstances = [];
  capturedConnectionHandler = null;
  throwOnGeminiCreation = false;
  flushLiveUsage.mockReset();
  verifyToken.mockReset();
  verifyToken.mockResolvedValue({ success: true, user: { id: 'user-1', email: 'user@example.com' } });

  await import('../../.worktrees/fix-telefun-usage-flush/apps/telefun-server/src/server');

  const clientWs = new MockSocket();
  clientWs.readyState = MockSocket.OPEN;
  await capturedConnectionHandler?.(clientWs, {
    headers: { host: 'localhost', origin: 'https://app.example.com' },
    url: '/ws?token=test-token',
  });

  const geminiWs = wsInstances.find((instance) => instance.url?.includes('generativelanguage.googleapis.com'));
  if (!geminiWs) throw new Error('Gemini socket was not created');

  const messageHandler = geminiWs.handlers.message;
  if (!messageHandler) throw new Error('Gemini message handler missing');

  await messageHandler(Buffer.from(JSON.stringify({
    usageMetadata: {
      promptTokenCount: 1,
      responseTokenCount: 2,
      totalTokenCount: 3,
    },
  })));

  return { clientWs, geminiWs };
}

describe('Telefun usage flush audit regression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('flushes exactly once on Gemini close', async () => {
    const { geminiWs } = await setupConnection();

    await geminiWs.handlers.close?.(1000, Buffer.from('ok'));

    expect(flushLiveUsage).toHaveBeenCalledTimes(1);
  });

  it('flushes exactly once on Gemini error', async () => {
    const { geminiWs } = await setupConnection();

    await geminiWs.handlers.error?.(new Error('gemini transport failure'));

    expect(flushLiveUsage).toHaveBeenCalledTimes(1);
  });

  it('flushes exactly once on client close even when Gemini close also runs', async () => {
    const { clientWs } = await setupConnection();

    await clientWs.handlers.close?.();

    expect(flushLiveUsage).toHaveBeenCalledTimes(1);
  });

  it('flushes exactly once on client error even when Gemini close also runs', async () => {
    const { clientWs } = await setupConnection();

    await clientWs.handlers.error?.(new Error('client ws failed'));

    expect(flushLiveUsage).toHaveBeenCalledTimes(1);
  });

  it('fatal catch closes client connection when Gemini creation fails (path 5)', async () => {
    vi.resetModules();
    wsInstances = [];
    capturedConnectionHandler = null;
    throwOnGeminiCreation = true;
    flushLiveUsage.mockReset();
    verifyToken.mockReset();
    verifyToken.mockResolvedValue({ success: true, user: { id: 'user-1', email: 'user@example.com' } });

    await import('../../.worktrees/fix-telefun-usage-flush/apps/telefun-server/src/server');

    const clientWs = new MockSocket();
    clientWs.readyState = MockSocket.OPEN;

    await capturedConnectionHandler?.(clientWs, {
      headers: { host: 'localhost', origin: 'https://app.example.com' },
      url: '/ws?token=test-token',
    });

    throwOnGeminiCreation = false;

    expect(clientWs.readyState).toBe(MockSocket.CLOSED);
    expect(flushLiveUsage).not.toHaveBeenCalled();
  });
});
