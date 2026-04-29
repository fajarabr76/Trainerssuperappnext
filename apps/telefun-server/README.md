# Telefun WebSocket Server

Standalone long-running Node.js service for Telefun live flow proxying.

## Setup

### Prerequisites

Frontend Next.js harus punya env var berikut di `.env.local` root project:

```env
NEXT_PUBLIC_TELEFUN_WS_URL=ws://localhost:3001/ws
```

### Server `.env`

1. `npm install`
2. Create `.env` di folder `apps/telefun-server`:
   ```env
   PORT=3001
   SUPABASE_URL=your-supabase-url
   SUPABASE_ANON_KEY=your-supabase-anon-key
   GEMINI_API_KEY=your-gemini-api-key
   ALLOWED_ORIGINS=http://localhost:3000,https://your-vercel-domain.com
   ```

## Development
```bash
npm run dev
```

## Production
```bash
npm run build
npm run start
```

## Deployment on Railway
- Root Directory: `apps/telefun-server`
- Build Command: `npm install && npm run build`
- Start Command: `npm run start`
- Ensure all environment variables are set.

## Deployment Gotcha
- `npm run start` executes `node dist/server.js`, so Railway must run `npm run build` before starting the service.
- If a deploy logs `[Telefun] User connected` and `[Telefun] Connected to Gemini Live API` but never logs `[Telefun] Client setup message received`, the running container may still be using a stale `dist/server.js` build.
- After a successful deploy of the current proxy code, a healthy call should log:
  ```text
  [Telefun] User connected: ...
  [Telefun] Connected to Gemini Live API
  [Telefun] Client setup message received, model: models/gemini-3.1-flash-live-preview
  [Telefun] Gemini setupComplete received
  ```
