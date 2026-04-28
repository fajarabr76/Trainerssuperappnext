# Telefun WebSocket Server

Standalone long-running Node.js service for Telefun live flow proxying.

## Setup
1. `npm install`
2. Create `.env`:
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
