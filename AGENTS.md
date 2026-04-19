# AGENTS.md

## Commands

- Use `npm`, not `pnpm`: the repo has `package-lock.json` and no workspace config.
- Dev server: `npm run dev` (binds to port `3000`).
- Lint: `npm run lint`.
- Type check: `npm run type-check` runs `next build --no-lint`, so it is effectively a production build without ESLint.
- Build: `npm run build`. Build does not lint because `next.config.ts` sets `eslint.ignoreDuringBuilds = true`.

## Verified Structure

- Main protected app lives under `app/(main)/`; the layout calls `requirePageAccess()` before rendering.
- Root `/` is a client-side landing page with auth modal flow, not the main app shell.
- Shared auth helpers live in `app/lib/authz.ts` and `app/lib/supabase/*`.
- There are Server Actions in `app/actions/`, but this repo also uses Route Handlers in `app/api/**` for some server-only flows.
- Supabase SQL changes live in `supabase/migrations/`; rollback SQL is kept separately in `supabase/rollback/`.

## Auth And Access Gotchas

- Middleware entrypoint is root `middleware.ts`, which delegates to `app/lib/supabase/middleware.ts`.
- Protected route checks happen in both middleware and server-side guards. Do not assume middleware alone enforces access.
- Role normalization is non-trivial: `trainers` maps to `trainer` and `agents` maps to `agent` in `app/lib/authz.ts`.
- Login/register routes are treated as legacy pages and redirected back to `/?auth=login` or `/?auth=register`.

## Environment

- Required public Supabase vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Server/admin flows also need `SUPABASE_SERVICE_ROLE_KEY`.
- AI features use `GEMINI_API_KEY` and `OPENROUTER_API_KEY`.
- Some server flows build URLs from `NEXT_PUBLIC_APP_URL`.
- There is no `.env.example` in the repo right now; do not tell users to copy it.
- Missing Supabase public vars do not hard-crash build/dev helpers: the client/server wrappers fall back to placeholder values. This can hide misconfiguration until runtime.

## Verification Notes

- There is no test script in `package.json`.
- For focused verification, default to `npm run lint` and the smallest relevant app flow; use `npm run type-check` only when you need build-level validation.
- Because `type-check` is a build, it is slower and can surface runtime/build integration issues beyond TypeScript.
