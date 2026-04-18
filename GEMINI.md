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

The project uses `npm` for package management.

### Setup
1.  Install dependencies:
    ```bash
    npm install
    ```
2.  Environment Variables: Ensure `.env.local` is configured with Supabase and Gemini credentials (e.g., `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GEMINI_API_KEY`).

### Development Commands
*   **Start Dev Server:** `npm run dev` (runs on port 3000 by default)
*   **Build for Production:** `npm run build`
*   **Start Production Server:** `npm run start`

### Code Quality Commands
*   **Linting:** `npm run lint`
*   **Fix Lint Errors:** `npm run lint:fix`
*   **Type Checking:** `npm run type-check` (runs `tsc --noEmit`)

## 💻 Development Conventions

*   **Architecture:** Follows the Next.js App Router paradigm.
    *   Protected application routes reside inside `app/(main)`.
    *   Data mutations should be handled via **Server Actions** (typically found in `app/actions` or module-specific action files).
*   **Type Safety:** The project is actively enforcing strict TypeScript usage. Avoid `any`. Use `unknown` and proper type casting or narrowing when dealing with dynamic data (especially Supabase RPC responses). Leverage centralized types (e.g., `app/types/auth.ts`, `app/(main)/qa-analyzer/lib/qa-types.ts`).
*   **Supabase Data Handling:** When working with joined data from Supabase that might return single objects or arrays unpredictably, use unwrap helpers (like `unwrapIndicator`, `unwrapPeriod` from `qa-types.ts`) to ensure type safety.
*   **UI/UX:** Adhere to existing design guidelines (refer to `docs/design-guidelines.md`). Use Tailwind CSS and existing UI components.
*   **Documentation:** Consult the `docs/` directory for detailed architecture (`architecture.md`), module specifications (`modules.md`), RBAC (`auth-rbac.md`), and database schema (`database.md`).
*   **Dependency Management:** Do not add new dependencies without explicit instruction. The project relies heavily on the existing ecosystem (Supabase, Tailwind, Recharts).
*   **State Management:** Be cautious with `useEffect` dependency arrays (`exhaustive-deps`). Ensure updates don't cause infinite loops, especially in core contexts like `SessionTimeoutContext`.

## 📂 Key Directories
*   `app/`: Next.js App Router root.
    *   `app/(main)/`: Protected routes requiring authentication.
    *   `app/components/`: Reusable UI components.
    *   `app/lib/`: Core utilities, Supabase clients, and hooks.
    *   `app/actions/`: Global Server Actions.
*   `supabase/migrations/`: Database schema and migration scripts.
*   `docs/`: Extensive project documentation.

## 🤖 Specialized Sub-Agents

### PDKT-Evaluator
**Role:** Senior QA Supervisor & Linguist.
**Trigger:** Tugas terkait perbaikan logika scoring, update rubrik penilaian, atau penanganan error pada module PDKT.
**Instructions:**
1. **Consistency First:** Gunakan `app/lib/ai-models.ts` sebagai satu-satunya sumber kebenaran untuk ID model.
2. **Robustness:** Pastikan setiap pemanggilan AI memiliki mekanisme retry untuk *transient errors* (429, 500, timeout).
3. **Linguistic Standard:** Evaluasi harus mencakup pengecekan typo (Bahasa Indonesia), kejelasan (clarity), dan gap konten berdasarkan konteks konsumen.
4. **Validation:** Setiap perubahan pada logic scoring wajib diverifikasi dengan menjalankan `api/pdkt/evaluate` secara lokal atau melalui simulasi unit test.

### SIDAK-Performance-Guard
**Role:** Frontend Performance Engineer.
**Trigger:** Modifikasi pada module QA-Analyzer (SIDAK) atau penambahan library eksternal baru.
**Instructions:**
1. **Lazy Loading:** Gunakan `next/dynamic` untuk komponen berat (chart, modal besar) dan `import()` dinamis untuk library spreadsheet (XLSX, ExcelJS).
2. **Asset Optimization:** Gunakan `next/image` dan hindari efek blur/shadow berlebihan (>60px) pada viewport mobile.
3. **Bundle Awareness:** Minimalisir First Load JS; pastikan komponen capture hanya di-mount saat dibutuhkan (on-demand).

### Auth-Guard-Sentinel
**Role:** Security & Auth Architect.
**Trigger:** Perubahan pada `app/lib/authz.ts`, `middleware.ts`, atau kueri ke tabel `profiles`.
**Instructions:**
1. **Strict Select:** Selalu gunakan `PROFILE_FIELDS` dari `app/lib/authz.ts` saat melakukan kueri `select` ke tabel `profiles`. Jangan menambahkan kolom manual tanpa memverifikasi skema database.
2. **Explicit Recovery:** Pastikan setiap kegagalan pembacaan profil (`profile is null` atau `error`) memicu `signOut()` dan redirect ke `/?auth=login&message=profile-unavailable`.
3. **Type Sync:** Jaga sinkronisasi antara interface `Profile` di `app/types/auth.ts` dengan skema database asli. Jangan biarkan field "asumsi" (seperti `avatar_url`) masuk ke tipe data utama.
