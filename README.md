# Trainers SuperApp

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-green?logo=supabase)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)

**Trainers SuperApp** adalah platform internal untuk operasional contact center: simulasi kerja berbasis AI, database peserta/agen, monitoring aktivitas dan usage AI, serta quality assurance SIDAK.

Nama modul yang dipakai di repo ini adalah:
- **KETIK**: Kelas Etika & Trik Komunikasi
- **PDKT**: Paham Dulu Kasih Tanggapan
- **TELEFUN**: Telephone Fun
- **KTP**: Kotak Tool Profil
- **SIDAK**: Sistem Informasi Data Analisis Kualitas

## Status Aplikasi Saat Ini

- **Unified Dashboard**: Pusat kendali protected app dengan shortcut modul, aktivitas, monitoring lintas akun, dan manajemen user.
- **KETIK**: Simulasi chat layanan berbasis AI, history tersimpan di Supabase, settings local-first plus sync akun, serta quick-view `Usage Bulan Ini`.
- **PDKT**: Simulasi email dengan composer-style reply, evaluasi async, history Supabase, quick-view usage, status evaluasi `processing/completed/failed`, dan pengaturan pola penyebutan nama konsumen untuk email awal.
- **TELEFUN**: Simulasi percakapan telepon berbasis Gemini Live melalui WebSocket proxy, history `telefun_history`, quick-view `Usage`, monitoring pusat, dan tuning deteksi bicara agar respons singkat tidak memutus sesi terlalu cepat.
- **Profiler / KTP**: Database peserta dan agen dengan folder bertingkat, import/export, slides, tim, foto, dan workflow export.
- **SIDAK / QA Analyzer**: Dashboard kualitas, input temuan, ranking, laporan data/AI, aturan clean-session, dan guardrail scoring versioned rules.
- **Monitoring Usage & Billing**: Rekap token dan biaya AI bulanan berbasis WIB, editor harga/kurs untuk role yang diizinkan, dan snapshot biaya per request sukses.
- **Supabase Local Backup**: Script backup database dan Storage lokal untuk snapshot manual operasional.

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript.
- **Styling**: Tailwind CSS 4, Motion/React (Framer Motion).
- **Backend**: Supabase Auth, PostgreSQL, RLS, Storage, Server Actions, dan beberapa Route Handlers.
- **AI Providers**: Gemini dan OpenRouter melalui wrapper server-side.
- **Charts & Export**: Recharts, ExcelJS, xlsx, jsPDF, docx, pptxgenjs, html2canvas.

---

## Dokumentasi Teknis

Untuk pemahaman lebih dalam mengenai sistem, silakan merujuk ke dokumen berikut:

1. **[Documentation Index](docs/README.md)**: Peta dokumentasi yang paling aman dibaca pertama.
2. **[System Architecture](docs/architecture.md)**: Gambaran teknis, struktur folder, data flow, dan command operasional.
3. **[Modules Guide](docs/modules.md)**: Status fungsional setiap modul aplikasi.
4. **[Auth & RBAC](docs/auth-rbac.md)**: Role, approval akun, route guard, dan kontrak profile read.
5. **[Database Schema](docs/database.md)**: Tabel utama, RLS, usage billing, dan Storage.
6. **[Monitoring Usage & Billing](docs/MONITORING_TOKEN_USAGE_BILLING.md)**: Kontrak usage AI, billing Rupiah, dan smoke test.
7. **[Telefun Operational Runbook](docs/TELEFUN_OPERATIONAL_RUNBOOK.md)**: Runtime Telefun, WebSocket proxy Railway, env, usage, dan smoke test.
8. **[Supabase Local Backup](docs/SUPABASE_LOCAL_BACKUP.md)**: Backup database dan Storage lokal.
9. **[Design Guidelines](docs/design-guidelines.md)**: Standar visual, komponen, dan prinsip UI/UX.

---

## Memulai Pengembangan

### Prasyarat
- Node.js 20+
- `npm` (repo memakai `package-lock.json`)
- Akun Supabase untuk Auth, database, RLS, dan Storage
- API key Gemini/OpenRouter jika menjalankan fitur AI
- PostgreSQL client tools jika menjalankan backup lokal (`pg_dump`, `pg_restore`, `psql`)

### Instalasi
1. Kloning repositori:
   ```bash
   git clone https://github.com/fajarabr76/Trainerssuperappnext.git
   ```
2. Instal dependensi:
   ```bash
   npm install
   ```
3. Buat `.env.local` secara manual. Repo ini belum menyediakan `.env.example`.
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   GEMINI_API_KEY=your_gemini_key
   OPENROUTER_API_KEY=your_openrouter_key
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   NEXT_PUBLIC_TELEFUN_WS_URL=ws://localhost:3001/ws
   ```
4. Jalankan mode pengembangan:
   ```bash
   npm run dev
   ```

## Command Operasional

```bash
npm run dev
npm run lint
npm run type-check
npm run test:sidak
npm run build
npm run backup:supabase
npm run backup:supabase:storage
npm run backup:supabase:all
npm run telefun:dev
npm run telefun:build
npm run telefun:start
```

`npm run type-check` menjalankan `next build`, sehingga validasi ini lebih berat daripada type-check murni dan juga memicu linting build.
`npm run telefun:*` menjalankan service WebSocket proxy di `apps/telefun-server`; gunakan bersama `npm run dev` saat menguji voice flow Telefun lokal.

## Catatan Pengembangan
- Gunakan direktori `app/(main)` untuk halaman aplikasi utama yang diproteksi auth.
- Mutasi data default melalui **Server Actions** di `app/actions` atau folder modul terkait; Route Handlers dipakai untuk flow server-only tertentu seperti evaluasi async PDKT.
- Gunakan `app/lib/ai-models.ts` sebagai sumber kebenaran model AI.
- Migration SQL berada di `supabase/migrations/`, tetapi tidak otomatis diterapkan oleh `next build`.
- Backup lokal masuk ke `local-backups/` dan tidak boleh di-commit.
- Patuhi standar visual di [Design Guidelines](docs/design-guidelines.md).

## Lisensi
Private Internal Project.
