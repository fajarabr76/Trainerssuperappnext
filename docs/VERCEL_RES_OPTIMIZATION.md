# Vercel RES Optimization

Dokumen ini mencatat optimasi Real Experience Score (RES) Vercel untuk Trainers SuperApp. Gunakan dokumen ini saat mengecek perubahan performa, meninjau hasil build, atau memutuskan apakah optimasi lanjutan boleh masuk ke area yang lebih sensitif seperti auth, middleware, dan caching protected route.

## Status

- Tahap 0-3: selesai secara build/lint lokal.
- Tahap 4-6: belum dikerjakan dan wajib meminta persetujuan user sebelum implementasi.
- Tracking plan: `plan/res-vercel-optimization-v1.md`.

## Konteks RES

RES di Vercel Speed Insights berasal dari real-user monitoring, bukan hanya simulasi lokal. Build lokal dipakai untuk melihat First Load JS dan validasi integrasi, tetapi dampak akhir RES baru terlihat setelah deployment mengumpulkan data user nyata.

Metrik yang paling relevan untuk optimasi ini:

- FCP: first content paint.
- LCP: largest content paint.
- INP: responsiveness setelah interaksi.
- CLS: layout shift.
- TTFB: bukan bobot langsung RES utama, tetapi tetap memengaruhi FCP/LCP dan pengalaman route server-rendered.

## Hasil Tahap 0-3

Baseline dan hasil build lokal terakhir:

| Route | Sebelum | Sesudah | Catatan |
| --- | ---: | ---: | --- |
| `/` | 209 kB | 210 kB | Relatif stabil |
| `/dashboard` | 155 kB | 155 kB | Relatif stabil |
| `/qa-analyzer/dashboard` | 252 kB | 108 kB | Turun sekitar 57% |
| `/profiler/analytics` | 283 kB | 108 kB | Turun sekitar 62% |
| `/profiler/table` | 242 kB | 108 kB | Turun sekitar 55% |

Verifikasi lokal:

- `npm run lint`: lulus.
- `npm run build`: lulus.

## Perubahan yang Sudah Diterapkan

### Image Optimization

- `next.config.ts` tidak lagi memakai `images.unoptimized: true`.
- `images.remotePatterns` dibuat spesifik untuk sumber image runtime yang dipakai:
  - Supabase Storage project domain.
  - `api.dicebear.com`.
- `DiceBearAvatar.tsx` tidak lagi memaksa prop `unoptimized`.
- CSP masih mengizinkan domain image yang lebih luas sesuai konfigurasi sebelumnya; ini tidak otomatis berarti image optimizer ikut mengizinkan domain tersebut.

Catatan:

- Jika ada image baru dari domain lain, tambahkan domain tersebut ke `remotePatterns` secara spesifik.
- Jangan menambahkan wildcard image domain terlalu luas tanpa kebutuhan runtime yang jelas.

### Deferred Loading Komponen Berat

Komponen client berat dipindahkan ke loader berbasis `next/dynamic` dengan skeleton stabil:

- `QaDashboardClientLoader.tsx` untuk `/qa-analyzer/dashboard`.
- `ProfilerAnalyticsClientLoader.tsx` untuk `/profiler/analytics`.
- `ProfilerTableClientLoader.tsx` untuk `/profiler/table`.

Tujuannya adalah menurunkan initial JS pada route yang berat tanpa mengubah data, query, atau business logic.

### Sidebar Hydration

- `Sidebar.tsx` tidak lagi memakai `motion/react` untuk overlay dan submenu QA.
- Animasi sidebar diganti ke CSS transition native.
- Menu, role visibility, dan route access tidak boleh berubah dari optimasi ini.

## Guardrail Wajib

Perubahan RES berikutnya tidak boleh:

- Mengubah schema database.
- Mengubah RBAC, route guard, atau `requirePageAccess()`.
- Menghapus middleware protected route.
- Mengubah handling user `pending`, `rejected`, atau `is_deleted`.
- Mengubah rumus SIDAK, total temuan, ranking, clean-session semantics, phantom rows, atau scoring.
- Mengubah flow bisnis KETIK, PDKT, Telefun, Profiler, atau QA Analyzer tanpa scope yang disetujui.

## Tahap Lanjutan yang Harus Minta Persetujuan

Tahap berikut tidak boleh dikerjakan otomatis.

### Tahap 4 - Auth, Middleware, dan RBAC Performance

Wajib minta persetujuan user sebelum implementasi.

Risiko:

- Akses route bisa terbuka terlalu luas.
- User valid bisa terblokir.
- Session bisa dihancurkan secara salah.

Verifikasi minimum jika tahap ini disetujui:

- `npm run lint`
- `npm run build`
- Smoke test login/logout.
- Smoke test guest redirect.
- Smoke test user `pending`, `rejected`, dan `is_deleted`.
- Smoke test route access untuk trainer, leader, agent, dan admin.

### Tahap 5 - Route Dynamic, Server Caching, dan Data Cache

Wajib minta persetujuan user sebelum implementasi.

Risiko:

- Data stale tampil ke user.
- Data user-specific atau role-specific tercache lintas user.
- Angka SIDAK berubah karena cache key atau invalidation salah.

Verifikasi minimum jika tahap ini disetujui:

- `npm run lint`
- `npm run type-check`
- `npm run test:sidak`
- Smoke test dashboard.
- Smoke test SIDAK dashboard, ranking, input, dan agent detail.
- Bandingkan angka total temuan, score, ranking, dan clean-session behavior sebelum/sesudah.

### Tahap 6 - Dependency Cleanup

Wajib minta persetujuan user jika sampai menghapus dependency dari `package.json`.

Risiko:

- Import path animation rusak.
- Fitur export/import yang jarang dipakai rusak.
- `package-lock.json` berubah luas.

Verifikasi minimum jika tahap ini disetujui:

- `npm run lint`
- `npm run build`
- Smoke test modal, animation, chart, export, dan import.
- Review diff `package.json` dan `package-lock.json`.

## Checklist Setelah Deploy

Setelah perubahan Tahap 0-3 masuk production:

- Buka Vercel Speed Insights untuk production.
- Filter mobile dan desktop secara terpisah.
- Cek route:
  - `/qa-analyzer/dashboard`
  - `/profiler/analytics`
  - `/profiler/table`
  - `/`
  - `/dashboard`
- Bandingkan RES, FCP, LCP, INP, dan CLS dengan periode sebelum deploy.
- Jangan menyimpulkan hasil dari data preview atau traffic rendah; tunggu data real user yang cukup.

## Catatan Commit Scope

Untuk commit Tahap 0-3, scope yang relevan adalah:

- `next.config.ts`
- `app/components/DiceBearAvatar.tsx`
- `app/components/Sidebar.tsx`
- page dan loader untuk QA dashboard dan Profiler.
- `plan/res-vercel-optimization-v1.md`
- `docs/VERCEL_RES_OPTIMIZATION.md`

File Supabase lokal seperti `supabase/.gitignore` dan `supabase/config.toml` bukan bagian langsung dari optimasi RES, kecuali user memang meminta semua file lokal ikut di-commit.
