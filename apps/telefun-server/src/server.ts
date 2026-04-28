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
        gemini: !!env.GEMINI_API_KEY,
        origins: env.ALLOWED_ORIGINS
      }
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(health));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ 
  server,
  handleProtocols: () => false // Explicitly reject all subprotocols
});

const allowedOrigins = env.ALLOWED_ORIGINS === '*'
  ? []
  : env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean);

wss.on('connection', async (ws, req) => {
  try {
    const origin = req.headers.origin;
    if (env.ALLOWED_ORIGINS !== '*' && origin && !allowedOrigins.includes(origin)) {
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
    const geminiUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${env.GEMINI_API_KEY}`;
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
      // Forward from Gemini to Client
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data.toString());
      }
    });

    geminiWs.on('error', (err) => {
      console.error('[Telefun] Gemini WS Error:', err);
      ws.close(1011, 'Gemini API Error');
    });

    geminiWs.on('close', (code, reason) => {
      console.log(`[Telefun] Gemini WS Closed: ${code} ${reason}`);
      ws.close(code, reason.toString());
    });

    ws.on('message', (data) => {
      // Forward from Client to Gemini with queueing
      if (isGeminiOpen) {
        geminiWs.send(data.toString());
      } else {
        console.log('[Telefun] Queueing client message (Gemini not ready)');
        messageQueue.push(data.toString());
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
});
