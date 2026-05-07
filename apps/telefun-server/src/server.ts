import { createServer } from 'http';
import { randomUUID } from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { env } from './env.js';
import { verifyToken } from './auth.js';
import {
  type LiveUsageSnapshot,
  parseUsageMetadata,
  mergeSnapshot,
  flushLiveUsage,
} from './usage.js';

// --- Process Resilience ---
process.on('uncaughtException', (err) => {
  console.error('🔥 [Telefun] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 [Telefun] Unhandled Rejection at:', promise, 'reason:', reason);
});

const server = createServer((req, res) => {
  if (req.url === '/health') {
    const health = {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      config: {
        supabase: !!env.SUPABASE_URL && !!env.SUPABASE_ANON_KEY,
        gemini: !!env.GEMINI_API_KEY
      }
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(health));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server });

function normalizeOrigin(raw: string): string {
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.host}`;
  } catch {
    return raw.replace(/\/+$/, '');
  }
}

const allowedOrigins = env.ALLOWED_ORIGINS === '*'
  ? []
  : env.ALLOWED_ORIGINS.split(',').map((o) => normalizeOrigin(o.trim())).filter(Boolean);

wss.on('connection', async (ws, req) => {
  try {
    // --- CRITICAL: Register ALL client WS handlers SYNCHRONOUSLY before any await ---
    // Node.js EventEmitter discards events without listeners. If the client sends
    // a message (e.g. setup) during the async verifyToken window (~100ms), the
    // 'message' event fires but no handler catches it → message is permanently lost.
    // Fix: buffer everything immediately, process after auth + Gemini setup complete.

    const pendingMessages: string[] = [];
    let geminiWs: WebSocket | null = null;
    let isGeminiOpen = false;

    // --- Usage tracking (initialized before handlers to avoid TDZ on pre-auth close) ---
    let authed = false;
    let userId = '';
    const requestId = `telefun-live-${randomUUID()}`;
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const correlationId = url.searchParams.get('cid') || requestId;
    let sawFirstModelTurn = false;
    let sawSetupForward = false;
    let closePath: 'client' | 'gemini' | 'server' | 'unknown' = 'unknown';
    let usageSnapshot: LiveUsageSnapshot | null = null;
    let usageFlushed = false;

    function logTimeline(event: string, meta?: Record<string, unknown>) {
      console.log('[Telefun][ProxyTimeline]', {
        event,
        ts: Date.now(),
        correlationId,
        requestId,
        ...meta,
      });
    }

    async function flushUsage() {
      if (usageFlushed || !authed || !usageSnapshot) return;
      usageFlushed = true;
      await flushLiveUsage(requestId, userId, usageSnapshot);
    }

    ws.on('message', (data) => {
      const raw = data.toString();
      // Fast-path audio chunks
      if (raw.startsWith('{"realtimeInput"')) {
        if (geminiWs && isGeminiOpen) geminiWs.send(raw);
        else pendingMessages.push(raw);
        return;
      }
      // Log non-audio messages
      try {
        const parsed = JSON.parse(raw);
        if (parsed.setup) {
          sawSetupForward = true;
          logTimeline('client_setup_forwarded', { model: parsed.setup.model });
          console.log('[Telefun] Client setup message received, model:', parsed.setup.model);
        } else {
          console.log(`[Telefun] Client message: ${Object.keys(parsed).join(',')}`);
        }
      } catch {
        console.log('[Telefun] Client non-JSON message, length:', raw.length);
      }
      // Forward or queue
      if (geminiWs && isGeminiOpen) {
        geminiWs.send(raw);
      } else {
        console.log('[Telefun] Queueing client message (Gemini not ready)');
        pendingMessages.push(raw);
      }
    });

    ws.on('close', () => {
      closePath = 'client';
      logTimeline('close_path', { path: closePath });
      console.log('[Telefun] Client connection closed');
      if (geminiWs && (geminiWs.readyState === WebSocket.OPEN || geminiWs.readyState === WebSocket.CONNECTING)) {
        geminiWs.close();
      }
    });

    ws.on('error', (err) => {
      closePath = 'server';
      logTimeline('close_path', { path: closePath, error: err.message });
      console.error('[Telefun] Client WS Error:', err);
      if (geminiWs && (geminiWs.readyState === WebSocket.OPEN || geminiWs.readyState === WebSocket.CONNECTING)) {
        geminiWs.close();
      }
    });

    // --- Synchronous validation (no await, safe before message handler) ---
    const origin = req.headers.origin;
    if (env.ALLOWED_ORIGINS !== '*' && origin && !allowedOrigins.includes(normalizeOrigin(origin))) {
      console.warn(`[Telefun] Rejected connection from unauthorized origin: ${origin}`);
      ws.close(4003, 'Forbidden Origin');
      return;
    }

    if (url.pathname !== '/' && url.pathname !== '/ws') {
      ws.close(4000, 'Invalid Path');
      return;
    }

    const token = url.searchParams.get('token');
    if (!token) {
      console.warn('[Telefun] Missing token in query params');
      ws.close(4001, 'Unauthorized: Missing Token');
      return;
    }

    // --- Async auth (messages arriving during this window are now safely buffered) ---
    const authResult = await verifyToken(token);

    if (!authResult.success) {
      console.warn(`[Telefun] Auth failed: ${authResult.error}`);
      ws.close(4001, `Unauthorized: ${authResult.error}`);
      return;
    }

    // Client may have disconnected while we were verifying
    if (ws.readyState !== WebSocket.OPEN) {
      console.log('[Telefun] Client disconnected during auth');
      return;
    }

    console.log(`[Telefun] User connected: ${authResult.user?.email}`);
    logTimeline('client_connected', { email: authResult.user?.email ?? null });
    logTimeline('auth_passed');

    // --- Mark as authenticated (enables usage flush) ---
    userId = authResult.user!.id;
    authed = true;

    // --- Connect to Gemini Multimodal Live ---
    const geminiUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${env.GEMINI_API_KEY}`;
    geminiWs = new WebSocket(geminiUrl);

    geminiWs.on('open', () => {
      console.log('[Telefun] Connected to Gemini Live API');
      isGeminiOpen = true;
      logTimeline('gemini_ws_open');
      // Flush all pending messages (including setup message from client)
      let flushed = 0;
      while (pendingMessages.length > 0) {
        const msg = pendingMessages.shift();
        if (msg) {
          geminiWs!.send(msg);
          flushed += 1;
        }
      }
      if (flushed > 0) {
        logTimeline('pending_message_flushed', { count: flushed, sawSetupForward });
      }
    });

    geminiWs.on('message', (data) => {
      const raw = data.toString();
      // Always check for usageMetadata before any fast-path return
      if (raw.includes('"usageMetadata"')) {
        try {
          const parsed = JSON.parse(raw);
          const meta = parseUsageMetadata(parsed.usageMetadata);
          if (meta) usageSnapshot = mergeSnapshot(usageSnapshot, meta);
          if (meta) logTimeline('usage_metadata_seen');
        } catch { /* non-JSON or malformed, skip */ }
      }
      if (raw.startsWith('{"serverContent":{"modelTurn"')) {
        if (!sawFirstModelTurn) {
          sawFirstModelTurn = true;
          logTimeline('first_model_turn');
        }
        if (ws.readyState === WebSocket.OPEN) ws.send(raw);
        return;
      }
      try {
        const parsed = JSON.parse(raw);

        if (parsed.error) {
          logTimeline('gemini_error', { message: (parsed.error as { message?: string }).message ?? 'unknown' });
          console.error('[Telefun] Gemini error payload:', JSON.stringify(parsed.error));
          // Forward error to client and terminate — client is waiting for setupComplete that will never come
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(raw);
            ws.close(1011, `Gemini error: ${(parsed.error as { message?: string }).message?.slice(0, 100) || 'Unknown'}`);
          }
          return;
        } else if (parsed.setupComplete) {
          logTimeline('setup_complete_received');
          console.log('[Telefun] Gemini setupComplete received');
        } else if (parsed.serverContent?.interrupted) {
          logTimeline('interrupted');
          console.log('[Telefun] Gemini interrupted');
        } else if (parsed.serverContent?.turnComplete) {
          logTimeline('turn_complete');
          console.log('[Telefun] Gemini turnComplete');
        } else if (parsed.serverContent?.modelTurn) {
          // audio chunk - skip logging to avoid spam
        } else {
          console.log(`[Telefun] Gemini message: ${Object.keys(parsed).join(',')}`);
        }
      } catch {
        console.log('[Telefun] Gemini non-JSON message, length:', raw.length);
      }
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(raw);
      }
    });

    geminiWs.on('error', (err) => {
      closePath = 'gemini';
      logTimeline('gemini_error', { message: err.message || 'unknown' });
      console.error('[Telefun] Gemini WS Error:', err.message || err);
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1011, 'Gemini API Error');
      }
    });

    geminiWs.on('close', (code, reason) => {
      closePath = 'gemini';
      logTimeline('close_path', { path: closePath, code, reason: reason.toString() });
      console.log(`[Telefun] Gemini WS Closed: ${code} ${reason}`);
      flushUsage();
      // Sanitize: WebSocket spec only allows 1000, 1001, 1003-1013, and 3000-4999 from app code.
      const safeCode = (code >= 3000 && code <= 4999) || (code >= 1000 && code <= 1013) ? code : 1011;
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(safeCode, reason.toString().slice(0, 123));
      }
    });
  } catch (err) {
    console.error('🔥 [Telefun] Fatal error in connection handler:', err);
    ws.close(1011, 'Internal Server Error');
  }
});

server.listen(env.PORT, '0.0.0.0', () => {
  console.log(`🚀 Telefun Server running on http://0.0.0.0:${env.PORT}`);
  console.log(`   - Environment: ${env.NODE_ENV}`);
  console.log(`   - Allowed Origins: ${env.ALLOWED_ORIGINS}`);
  console.log(`   - Gemini Endpoint: v1beta BidiGenerateContent`);
  console.log(`   - Gemini API Key: ${env.GEMINI_API_KEY ? '***' + env.GEMINI_API_KEY.slice(-4) : 'MISSING ⚠️'}`);
});
