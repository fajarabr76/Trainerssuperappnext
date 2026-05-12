# Trainers SuperApp

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-green?logo=supabase)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)

**Trainers SuperApp** adalah aplikasi serba ada (*SuperApp*) yang dirancang khusus untuk mempermudah tugas tim pelatih (*trainers*) dan operasional *contact center*.

Aplikasi ini berfungsi sebagai **pusat latihan simulasi kerja cerdas berbasis AI** bagi para agen layanan pelanggan, sekaligus menyediakan sistem pencatatan data agen, pemantauan penggunaan AI, serta penilaian kualitas layanan (*Quality Assurance*). Dengan antarmuka yang ramah dan terintegrasi, siapa saja dapat menggunakannya untuk meningkatkan keterampilan komunikasi tim tanpa takut salah di dunia nyata.

---

## 📦 Modul Utama Aplikasi

Agar lebih mudah dipahami dan menyenangkan, fitur-fitur di aplikasi ini dibagi menjadi beberapa modul dengan nama yang akrab di telinga:

### 💬 KETIK (Kelas Etika & Trik Komunikasi)
- **Apa itu?** Tempat latihan membalas *chat* pelanggan.
- **Kegunaan:** Agen dapat berlatih melayani pelanggan tiruan (AI) melalui obrolan teks. Dilengkapi dengan pengaturan waktu kustom (*custom duration timer*), riwayat obrolan yang tersimpan otomatis, serta ringkasan penggunaan kuota AI bulanan.

### 📧 PDKT (Paham Dulu Kasih Tanggapan)
- **Apa itu?** Latihan menangani *email* pelanggan.
- **Kegunaan:** Menyediakan simulasi kotak masuk (*mailbox*) interaktif tempat agen memilih skenario kasus, menyusun draf balasan, dan mendapatkan evaluasi. Status draf dipantau secara transparan (*processing / completed / failed*) dengan dukungan penyaringan (*filtering*) yang rapi.

### 📞 TELEFUN (Telephone Fun)
- **Apa itu?** Simulasi panggilan telepon langsung dengan AI.
- **Kegunaan:** Menggunakan teknologi suara canggih (**Gemini Live** via *WebSocket*), agen dapat berlatih berbicara langsung layaknya menerima telepon dari pelanggan. Mendukung **10 pilihan karakter suara AI** yang konsisten dengan gender, opsi gender acak (*random*), pengaturan durasi kustom, serta deteksi bicara cerdas agar percakapan terasa sangat alami.

### 🗂️ KTP (Kotak Tool Profil)
- **Apa itu?** Buku induk atau basis data (*database*) keagenan.
- **Kegunaan:** Tempat menyimpan data lengkap para peserta pelatihan dan agen. Mendukung pengelompokan folder bertingkat, manajemen tim, penyimpanan foto, materi presentasi (*slides*), hingga kemudahan ekspor/impor data.

### 📊 SIDAK (Sistem Informasi Data Analisis Kualitas)
- **Apa itu?** Pusat analisis dan rapor kualitas (*QA Analyzer*).
- **Kegunaan:** Membantu tim penilai/auditor memantau kualitas kerja, mencatat temuan kesalahan, melihat grafik peringkat performa, serta menghasilkan laporan akhir yang mendalam guna menjaga standar layanan.

---

## ✨ Fitur Unggulan & Kondisi Terkini

- **Dashboard Terpusat (Unified Dashboard):** Halaman beranda utama yang menyajikan pintasan cepat ke semua modul, ringkasan aktivitas terkini, serta pengelolaan pengguna.
- **Transparansi Pemakaian & Biaya (Monitoring Usage & Billing):** Fitur untuk melacak secara langsung berapa banyak token AI yang telah digunakan beserta perkiraan biayanya dalam Rupiah (berbasis waktu WIB). Admin juga dapat menyesuaikan tarif atau kurs yang berlaku.
- **Ekspor Formulir & Laporan Fleksibel:** Mendukung pembuatan dan unduhan formulir evaluasi dalam format siap pakai seperti Excel, Word, PDF, hingga file presentasi.
- **Pencadangan Mandiri (Local Backup):** Dilengkapi skrip otomatis untuk mengamankan salinan cadangan basis data dan berkas operasional secara lokal kapan pun dibutuhkan.

---

## 🛠️ Informasi Teknis & Panduan Pengembang

Bagian di bawah ini ditujukan bagi tim pengembang (*developers*) atau teknisi yang ingin melakukan instalasi, konfigurasi, dan pengembangan kode lebih lanjut.

### Tech Stack

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
