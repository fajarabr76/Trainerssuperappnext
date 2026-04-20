# Trainers SuperApp - AI Development Guide

This document provides context and guidelines for AI assistants working on the **Trainers SuperApp** project.

## 🚀 Project Overview

**Trainers SuperApp** is a comprehensive internal web platform built for contact center operations. It provides interactive training, work simulation, participant databases, operational monitoring, and quality assurance analytics.

### Main Technologies & Stack
*   **Framework:** Next.js 15 (App Router)
*   **Language:** TypeScript
*   **UI Library:** React 19
*   **Styling:** Tailwind CSS 4, Framer Motion (`motion/react`)
*   **Backend & DB:** Supabase (Auth, Database, RLS, Storage)
*   **AI Integration:** `@google/genai` (Gemini API)
*   **Data Visualization & Export:** Recharts, `exceljs`, `xlsx`, `docx`, `jspdf`, `pptxgenjs`

### Key Modules
*   **KETIK:** AI-based chat interaction simulation.
*   **PDKT:** Professional email correspondence simulation.
*   **TELEFUN:** Voice call simulation.
*   **Profiler:** Participant database management with hierarchical folders.
*   **SIDAK (QA Analyzer):** Quality assurance analytics dashboard.
*   **Dashboard:** Unified control center and monitoring.

## 🏗️ Building and Running

The project uses `npm` for package management. **Do not use pnpm or yarn.**

### Setup
1.  Install dependencies:
    ```bash
    npm install
    ```
2.  Environment Variables: Ensure `.env.local` is configured with Supabase and Gemini credentials (e.g., `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GEMINI_API_KEY`).
    *   **Note:** There is no `.env.example` in the repo. Missing Supabase public vars might not crash build/dev but will cause runtime errors.

### Development Commands
*   **Start Dev Server:** `npm run dev` (runs on port 3000 by default)
*   **Build for Production:** `npm run build` (Next.js production build with ESLint enabled)
*   **Start Production Server:** `npm run start`

### Code Quality Commands
*   **Linting:** `npm run lint`
*   **Fix Lint Errors:** `npm run lint:fix`
*   **Type Checking:** `npm run type-check` (runs `next build`, so it validates compile, types, and ESLint in one pass).

## 💻 Development Conventions

*   **Leverage Sub-Agents:** Utilize specialized sub-agents (via the `Task` tool) for complex, multi-step tasks and research.
    *   Use `subagent_type: "explore"` for searching patterns or mapping codebase structure.
    *   Use `subagent_type: "general"` for multi-step research or implementation tasks.
*   **Context7 First:** Always use `context7` MCP tools for documentation lookup and code search before reading files manually.
*   **Architecture:** Follows the Next.js App Router paradigm.
    *   Protected application routes reside inside `app/(main)`.
    *   Data mutations should be handled via **Server Actions** (typically found in `app/actions` or module-specific action files).
*   **Type Safety:** Strict TypeScript usage. Avoid `any`. Use `unknown` and proper type narrowing. Leverage centralized types (e.g., `app/types/auth.ts`).
*   **Supabase Data Handling:** Use unwrap helpers (like `unwrapIndicator`, `unwrapPeriod` from `qa-types.ts`) for type safety when dealing with joined/dynamic data.
*   **UI/UX:** Use Tailwind CSS 4 and existing UI components. Consult `docs/design-guidelines.md`.
*   **State Management:** Be cautious with `useEffect` dependency arrays to avoid infinite loops, especially in core contexts.

## 📂 Key Directories
*   `app/`: Next.js App Router root.
    *   `app/(main)/`: Protected routes requiring authentication.
    *   `app/components/`: Reusable UI components.
    *   `app/lib/`: Core utilities, Supabase clients, and hooks.
    *   `app/actions/`: Global Server Actions.
*   `supabase/migrations/`: Database schema and migration scripts.
    *   Migration files are versioned in git but are not applied by `next build`; they must still be pushed or executed against the target Supabase database.
*   `docs/`: Extensive project documentation.

## 🔌 MCP Servers

This project has MCP servers configured:
- **context7** - Primary tool for documentation lookup and codebase exploration.
- **supabase-mcp-server** - Used for database queries and Supabase operations.

## 🤖 AI Integration Conventions

*   **Source of Truth:** Use `app/lib/ai-models.ts` for all model IDs and provider mapping.
*   **Centralized Actions:** Use server-side wrappers like `app/actions/gemini.ts` and `app/actions/openrouter.ts`.
*   **Prompt Isolation:** Gemini instruction injection now uses unique per-request boundaries. Preserve the boundary sanitization logic and avoid reintroducing static markers.
*   **Rate Limiting:** Gemini requests are rate-limited through the `consume_rate_limit` Supabase RPC in `app/lib/rate-limit.ts`. Keep this server-side and preserve fail-closed behavior if RPC or DB access breaks.
*   **Defensive Extraction:** For Gemini (`@google/genai`), extraction of `response.text` must be defensive (check property, function, then candidates fallback).
*   **Normalization:** Always ensure AI responses are normalized to valid strings (or empty string fallback) before use.
*   **Validation:** Always validate/sanitize AI output before calling `JSON.parse`, `sanitizeConsumerText`, or rendering.
*   **Error Handling:** Provide user-friendly error messages if AI fails or returns invalid formats. Use structured warnings with module prefixes.

## Security Notes

*   `next.config.ts` now sets `eslint.ignoreDuringBuilds = false`, so both `npm run build` and `npm run type-check` will fail on lint errors.
*   Security headers are defined centrally in `next.config.ts`, including `Content-Security-Policy`, `X-Frame-Options`, and `Referrer-Policy`.
*   Admin Supabase flows depend on `SUPABASE_SERVICE_ROLE_KEY`; `app/lib/supabase/admin.ts` is guarded with `server-only` and should stay server-exclusive.

## 🤖 Specialized Sub-Agents

### PDKT-Evaluator
**Role:** Senior QA Supervisor & Linguist.
**Trigger:** Tugas terkait perbaikan logika scoring, update rubrik penilaian, atau penanganan error pada module PDKT.
**Instructions:**
1. **Consistency First:** Gunakan `app/lib/ai-models.ts` sebagai satu-satunya sumber kebenaran untuk ID model.
2. **Robustness:** Pastikan setiap pemanggilan AI memiliki mekanisme retry untuk *transient errors* (429, 500, timeout).
3. **Linguistic Standard:** Evaluasi harus mencakup pengecekan typo (Bahasa Indonesia), kejelasan (clarity), dan gap konten.
4. **Validation:** Setiap perubahan logic scoring wajib diverifikasi dengan menjalankan `api/pdkt/evaluate` secara lokal.

### SIDAK-Performance-Guard
**Role:** Frontend Performance Engineer.
**Trigger:** Modifikasi pada module QA-Analyzer (SIDAK) atau penambahan library eksternal baru.
**Instructions:**
1. **Lazy Loading:** Gunakan `next/dynamic` untuk komponen berat dan `import()` dinamis untuk library spreadsheet.
2. **Asset Optimization:** Gunakan `next/image` dan hindari efek visual berlebihan pada viewport mobile.
3. **Bundle Awareness:** Minimalisir First Load JS; mount komponen berat hanya saat dibutuhkan.

### Auth-Guard-Sentinel
**Role:** Security & Auth Architect.
**Trigger:** Perubahan pada `app/lib/authz.ts`, `middleware.ts`, atau kueri ke tabel `profiles`.
**Instructions:**
1. **Strict Select:** Gunakan `PROFILE_FIELDS` dari `app/lib/authz.ts` untuk canonical auth profile read.
2. **Explicit Recovery:** Kegagalan pembacaan profil memicu `signOut()` dan redirect ke `/?auth=login&message=profile-unavailable`.
3. **Type Sync:** Sinkronkan interface `Profile` dengan skema database asli.
4. **Verification:** Jalankan `npm run lint` dan `npm run type-check` setelah perubahan auth.
