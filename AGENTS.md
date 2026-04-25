# AGENTS.md

## MCP Servers

- **context7** - Always use context7 MCP for documentation lookup and code search before executing tasks
- **supabase-mcp-server** - Use for Supabase data queries and database operations

## Subagent Usage

- Untuk searching pattern atau menjawab pertanyaan tentang struktur kode, gunakan context7 MCP tools terlebih dahulu sebelum membaca file satu per satu
- Gunakan subagent (tool Task) untuk tugas yang memerlukan eksplorasi codebase atau riset multi-step
- Gunakan subagent_type `explore` untuk mencari file, searching pattern, atau menjawab pertanyaan tentang struktur kode
- Gunakan subagent_type `general` untuk tugas research kompleks dan multi-step
- Untuk tugas spesifik, gunakan specialized sub-agents yang sudah didefinisikan di bawah

## Specialized Sub-Agents

### PDKT-Evaluator
**Trigger:** Tugas terkait perbaikan logika scoring, update rubrik penilaian, atau penanganan error pada module PDKT.
- Gunakan `app/lib/ai-models.ts` sebagai sumber kebenaran untuk ID model
- Pastikan setiap pemanggilan AI memiliki mekanisme retry untuk transient errors (429, 500, timeout)
- Setiap perubahan pada logic scoring wajib diverifikasi dengan menjalankan `api/pdkt/evaluate`

### SIDAK-Performance-Guard
**Trigger:** Modifikasi pada module QA-Analyzer (SIDAK) atau penambahan library eksternal baru.
- Gunakan lazy loading untuk komponen berat (chart, modal besar)
- Gunakan `next/image` dan hindari efek blur/shadow berlebihan (>60px) pada viewport mobile

### Auth-Guard-Sentinel
**Trigger:** Perubahan pada `app/lib/authz.ts`, `middleware.ts`, atau kueri ke tabel `profiles`.
- Gunakan `PROFILE_FIELDS` dari `app/lib/authz.ts` untuk canonical auth profile read
- Kegagalan pembacaan profil yang bersifat transient (network error, row belum tersedia) tidak lagi memicu `signOut()`. Hanya state terminal (`is_deleted`, `rejected`) dan guest tanpa sesi yang di-redirect keras. Missing profile ditoleransi di middleware dan AuthModal agar sesi aktif tidak hancur.

## Commands

- Use `npm`, not `pnpm`: the repo has `package-lock.json` and no workspace config.
- Dev server: `npm run dev` (binds to port `3000`).
- Lint: `npm run lint`.
- Type check: `npm run type-check` runs `next build`, so it performs a production build and runs ESLint.
- Focused SIDAK tests: `npm run test:sidak`.
- Build: `npm run build`. Build also lints because `next.config.ts` sets `eslint.ignoreDuringBuilds = false`.
- Supabase local backup: `npm run backup:supabase`, `npm run backup:supabase:storage`, or `npm run backup:supabase:all`.

## Verified Structure

- Main protected app lives under `app/(main)/`; the layout calls `requirePageAccess()` before rendering.
- Root `/` is a client-side landing page with auth modal flow, not the main app shell.
- Shared auth helpers live in `app/lib/authz.ts` and `app/lib/supabase/*`.
- There are Server Actions in `app/actions/`, but this repo also uses Route Handlers in `app/api/**` for some server-only flows.
- Supabase SQL changes live in `supabase/migrations/`; rollback SQL is kept separately in `supabase/rollback/`.
- Migration files are not applied by `next build`; DB changes in `supabase/migrations/` must be pushed or executed against the target Supabase project.
- Data mutations should be handled via **Server Actions** (typically found in `app/actions` or module-specific action files).

## Key Directories

- `app/`: Next.js App Router root
  - `app/(main)/`: Protected routes requiring authentication
  - `app/components/`: Reusable UI components
  - `app/lib/`: Core utilities, Supabase clients, and hooks
  - `app/actions/`: Global Server Actions
- `supabase/migrations/`: Database schema and migration scripts
- `docs/`: Extensive project documentation

## Development Conventions

- **Architecture:** Follows Next.js App Router paradigm
- **Type Safety:** Avoid `any`. Use `unknown` and proper type casting. Leverage centralized types (e.g., `app/types/auth.ts`)
- **Supabase Data Handling:** Use unwrap helpers (like `unwrapIndicator`, `unwrapPeriod`) for type safety when dealing with dynamic data
- **UI/UX:** Use Tailwind CSS and existing UI components. Consult `docs/design-guidelines.md`
- **Dependency Management:** Do not add new dependencies without explicit instruction
- **State Management:** Be cautious with `useEffect` dependency arrays to avoid infinite loops

## Golden Rule: File Editing Harus Pakai Unified Diff

Saat mendesain agent, prioritaskan pembuatan fungsi tool untuk editing file menggunakan metode patch dengan format **unified diff**.

### Kenapa aturan ini penting
Metode unified diff memaksa agent untuk membaca isi file terbaru sebelum melakukan perubahan. Ini penting untuk mencegah agent mengubah file secara sembarangan, terutama pada file yang sensitif terhadap struktur seperti Python yang sangat bergantung pada indentasi.

Selain itu, file bisa saja sudah berubah oleh step sebelumnya tetapi belum terbaca lagi oleh agent. Risiko ini makin besar pada sistem yang menggunakan parallel execution atau multi-agent. Karena itu, patch berbasis unified diff harus dianggap sebagai mekanisme edit default, dan dalam konteks multi-agent sifatnya wajib.

### Aturan wajib
1. Agent **harus membaca file terlebih dahulu** sebelum membuat perubahan.
2. Agent **harus mengedit file menggunakan patch berformat unified diff**, bukan overwrite penuh.
3. Agent **tidak boleh mengganti seluruh isi file** jika perubahan hanya terjadi pada sebagian kecil.
4. Agent **harus membuat perubahan seminimal mungkin** agar scope edit tetap jelas dan aman.
5. Agent **harus menggunakan konteks terbaru dari file** sebelum menyusun patch.
6. Untuk file dengan struktur sensitif seperti Python, YAML, atau file konfigurasi lain, penggunaan unified diff **sangat diprioritaskan**.
7. Dalam workflow parallel atau multi-agent, patch unified diff **wajib digunakan** untuk mengurangi konflik dan mencegah file corruption.

### Tujuan utama
- Menjaga agent agar tidak ngawur saat mengubah file
- Mengurangi risiko merusak syntax, indentasi, atau struktur file
- Memastikan perubahan tetap presisi walaupun file sudah berubah di step sebelumnya
- Membuat proses edit lebih aman, audit-able, dan mudah direview

### Prinsip implementasi
Jika agent ingin mengubah file, urutannya harus seperti ini:
1. Baca file terbaru
2. Identifikasi bagian yang benar-benar perlu diubah
3. Buat patch dalam format unified diff
4. Terapkan patch
5. Verifikasi hasil akhir setelah patch diterapkan

### Catatan penting
Jangan jadikan overwrite penuh sebagai default behavior. Default behavior agent untuk file editing harus selalu: **read first, patch second**.

## AI Integration Conventions

- Gunakan `app/lib/ai-models.ts` sebagai sumber kebenaran untuk model ID dan provider mapping.
- Untuk integrasi provider, utamakan wrapper server-side terpusat seperti `app/actions/gemini.ts` dan `app/actions/openrouter.ts`.
- `app/actions/gemini.ts` now applies per-user rate limiting through the `consume_rate_limit` Supabase RPC in `app/lib/rate-limit.ts`; keep this flow server-side and preserve fail-closed behavior on infra errors.
- Prompt hardening for Gemini uses unique per-request boundaries. If you change instruction injection, preserve the boundary sanitization logic and avoid static delimiters.
- Jangan mengasumsikan bentuk `response.text` stabil antar versi SDK/provider. Untuk Gemini (`@google/genai`), ekstraksi teks harus defensif: cek property string, function accessor, lalu fallback ke `response.candidates?.[0]?.content?.parts`.
- Pastikan `GeminiResponse.text` atau output provider lain dinormalisasi ke string sebelum dipakai caller.
- Sebelum memakai output AI untuk `sanitizeConsumerText`, `JSON.parse`, `parseJsonFromModelText`, atau render UI, validasi dulu bahwa nilainya string yang valid.
- Jika format respons AI invalid, kembalikan pesan error yang user-friendly dan gunakan log warning terstruktur dengan prefix modul bila perlu tracing.
- Untuk perubahan AI integration, verifikasi minimal dengan `npm run lint`, `npm run type-check`, dan smoke test flow modul yang terdampak.

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
- Rate limiting and other admin RPC flows also require `SUPABASE_SERVICE_ROLE_KEY` to be present at runtime.

## Verification Notes

- There is no general `npm test` script in `package.json`, but focused SIDAK coverage is available via `npm run test:sidak`.
- For focused verification, default to `npm run lint` and the smallest relevant app flow; use `npm run type-check` when you need full build-level validation.
- Because `type-check` is a full build with linting, it is slower and can surface runtime/build integration issues beyond TypeScript.
