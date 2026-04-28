import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { env } from './env.js';
import { verifyToken } from './auth.js';

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
    const origin = req.headers.origin;
    if (env.ALLOWED_ORIGINS !== '*' && origin && !allowedOrigins.includes(normalizeOrigin(origin))) {
      console.warn(`[Telefun] Rejected connection from unauthorized origin: ${origin}`);
      ws.close(4003, 'Forbidden Origin');
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    
    // Optional: Only accept connections to root or specific path
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

    // Verify Supabase Token
    const authResult = await verifyToken(token);

    if (!authResult.success) {
      console.warn(`[Telefun] Auth failed: ${authResult.error}`);
      ws.close(4001, `Unauthorized: ${authResult.error}`);
      return;
    }

    console.log(`[Telefun] User connected: ${authResult.user?.email}`);

    // Connect to Gemini Multimodal Live (using BidiGenerateContent endpoint compatible with latest SDK patterns)
    const geminiUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${env.GEMINI_API_KEY}`;
    const geminiWs = new WebSocket(geminiUrl);

    const messageQueue: string[] = [];
    let isGeminiOpen = false;

    geminiWs.on('open', () => {
      console.log('[Telefun] Connected to Gemini Live API');
      isGeminiOpen = true;
      // Flush queue
      while (messageQueue.length > 0) {
        const msg = messageQueue.shift();
        if (msg) {
          geminiWs.send(msg);
        }
      }
    });

    geminiWs.on('message', (data) => {
      const raw = data.toString();
      if (raw.startsWith('{"serverContent":{"modelTurn"')) {
        if (ws.readyState === WebSocket.OPEN) ws.send(raw);
        return;
      }
      try {
        const parsed = JSON.parse(raw);
        if (parsed.error) {
          console.error('[Telefun] Gemini error payload:', JSON.stringify(parsed.error));
          // Forward error to client and terminate — client is waiting for setupComplete that will never come
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(raw);
            ws.close(1011, `Gemini error: ${(parsed.error as { message?: string }).message?.slice(0, 100) || 'Unknown'}`);
          }
          return;
        } else if (parsed.setupComplete) {
          console.log('[Telefun] Gemini setupComplete received');
        } else if (parsed.serverContent?.interrupted) {
          console.log('[Telefun] Gemini interrupted');
        } else if (parsed.serverContent?.turnComplete) {
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
      console.error('[Telefun] Gemini WS Error:', err.message || err);
      ws.close(1011, 'Gemini API Error');
    });

    geminiWs.on('close', (code, reason) => {
      console.log(`[Telefun] Gemini WS Closed: ${code} ${reason}`);
      // Sanitize: WebSocket spec only allows 1000, 1001, 1003-1013, and 3000-4999 from app code.
      // Invalid codes (e.g. 1005, 1006, 1015) thrown by ws.close() would crash the handler.
      const safeCode = (code >= 3000 && code <= 4999) || (code >= 1000 && code <= 1013) ? code : 1011;
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(safeCode, reason.toString().slice(0, 123));
      }
    });

    ws.on('message', (data) => {
      const raw = data.toString();
      if (raw.startsWith('{"realtimeInput"')) {
        if (isGeminiOpen) geminiWs.send(raw);
        else messageQueue.push(raw);
        return;
      }
      try {
        const parsed = JSON.parse(raw);
        if (parsed.setup) {
          console.log('[Telefun] Client setup message received, model:', parsed.setup.model);
        } else {
          console.log(`[Telefun] Client message: ${Object.keys(parsed).join(',')}`);
        }
      } catch {
        console.log('[Telefun] Client non-JSON message, length:', raw.length);
      }
      if (isGeminiOpen) {
        geminiWs.send(raw);
      } else {
        console.log('[Telefun] Queueing client message (Gemini not ready)');
        messageQueue.push(raw);
      }
    });

    ws.on('close', () => {
      console.log('[Telefun] Client connection closed');
      if (geminiWs.readyState === WebSocket.OPEN || geminiWs.readyState === WebSocket.CONNECTING) {
        geminiWs.close();
      }
    });

    ws.on('error', (err) => {
      console.error('[Telefun] Client WS Error:', err);
      if (geminiWs.readyState === WebSocket.OPEN || geminiWs.readyState === WebSocket.CONNECTING) {
        geminiWs.close();
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
