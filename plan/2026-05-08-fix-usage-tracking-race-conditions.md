# Plan: Fix Usage Tracking Reliability

## 1. Eliminate Baseline Race Conditions (Start Session)
Currently, all three modules (Ketik, PDKT, Telefun) fetch the usage baseline via a fire-and-forget `void getMyModuleUsage(...)` call when a session starts. If the first AI interaction happens before this query completes, the baseline will include the new usage, making the delta calculation at the end of the session artificially low or zero.

**Action:**
- Modify `startSession` in `app/(main)/ketik/KetikClient.tsx`, `app/(main)/pdkt/PdktClient.tsx`, and `app/(main)/telefun/TelefunClient.tsx` to `await` the `getMyModuleUsage` call before proceeding to start the actual session.

## 2. Eliminate Persistence Race Conditions (End Session)
In Ketik and Telefun, `getMyModuleUsage` is called immediately after the session ends.
- In Telefun, the Railway proxy flushes usage *after* the WebSocket closes. Calling `getMyModuleUsage` synchronously after closing the connection creates a tight race where the DB insert often hasn't completed.
- In Ketik, `getMyModuleUsage` is called immediately after `fetch('/api/ketik/review')`. While the Vercel route handler awaits the DB insert, DB replication or connection pooling latency can still cause immediate reads to miss the new row.
- In PDKT, the client polls until `evaluation_status !== 'processing'`. It then immediately fetches usage. A small buffer here is also safer.

**Action:**
- Add a 1.5 - 2 second delay before the final `getMyModuleUsage` call in `KetikClient.tsx` and `TelefunClient.tsx` (and `PdktClient.tsx` inside the polling success block).

## 3. Dynamic Model ID in Telefun Proxy
The Telefun proxy hardcodes the model ID to `gemini-3.1-flash-live-preview` when logging usage. If the frontend changes the model (e.g., to a different live model), the usage log will still record the hardcoded one.

**Action:**
- Update `apps/telefun-server/src/server.ts` to extract the requested model from the client's `setup` message.
- Pass this dynamic `modelId` to `flushLiveUsage` in `usage.ts`.

## 4. Ensure Pricing Exists for Default Models
If a model does not exist in `ai_pricing_settings`, the usage log still records the tokens but sets `estimated_cost_idr` to `0` (unless it's a live model with hardcoded fallbacks). Users might perceive this as "tagihan tidak bertambah" (billing didn't increase).

**Action:**
- Create a new migration file `supabase/migrations/20260508100000_seed_text_simulation_pricing.sql` to seed default pricing for `gemini-3.1-flash-lite` and `gemini-2.0-flash-lite` (the defaults for Ketik/PDKT).
