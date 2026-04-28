import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { env } from './env.js';
import { verifyToken } from './auth.js';

const server = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server });

const allowedOrigins = env.ALLOWED_ORIGINS === '*'
  ? []
  : env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean);

wss.on('connection', async (ws, req) => {
  const origin = req.headers.origin;
  if (env.ALLOWED_ORIGINS !== '*' && origin && !allowedOrigins.includes(origin)) {
    console.warn(`[Telefun] Rejected connection from unauthorized origin: ${origin}`);
    ws.close(4003, 'Forbidden Origin');
    return;
  }

  const protocol = req.headers['sec-websocket-protocol'];
  if (!protocol) {
    ws.close(4001, 'Unauthorized: Missing Token');
    return;
  }

  // Token is expected to be passed via protocol
  const token = protocol;
  const authResult = await verifyToken(token);

  if (!authResult.success) {
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
});

server.listen(env.PORT, '0.0.0.0', () => {
  console.log(`🚀 Telefun Server running on http://0.0.0.0:${env.PORT}`);
});
