# Trainers SuperApp

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-green?logo=supabase)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)

**Trainers SuperApp** adalah platform internal komprehensif untuk operasional contact center—mencakup pelatihan interaktif, simulasi kerja, database peserta (KTP), monitoring operasional, dan quality assurance (SIDAK).

## 🚀 Fitur Utama

- **Unified Dashboard**: Pusat kendali dengan ringkasan performa dan log aktivitas real-time.
- **KETIK (Chat)**: Simulasi interaksi chat berbasis AI untuk melatih empati dan solusi.
- **PDKT (Email)**: Simulasi korespondensi email profesional dengan feedback otomatis.
- **TELEFUN (Phone)**: Simulasi panggilan suara untuk melatih intonasi dan presisi bicara.
- **Profiler (KTP)**: Manajemen database peserta training dengan struktur folder hierarkis.
- **SIDAK (QA Analyzer)**: Dashboard analytics kualitas dengan filosofi *"The Path to Zero"*.
- **User Management**: Sistem approval akun dan manajemen role (RBAC) yang ketat.

## 🛠️ Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript.
- **Styling**: Tailwind CSS 4, Motion/React (Framer Motion).
- **Backend**: Supabase (Auth, DB, RLS, Storage).
- **Charts**: Recharts.

---

## 📚 Dokumentasi Teknis

Untuk pemahaman lebih dalam mengenai sistem, silakan merujuk ke dokumen berikut:

1.  **[System Architecture](docs/architecture.md)**: Gambaran besar teknis dan struktur folder.
2.  **[Modules Guide](docs/modules.md)**: Detail fungsionalitas setiap modul aplikasi.
3.  **[Auth & RBAC](docs/auth-rbac.md)**: Panduan keamanan, role, dan sistem approval.
4.  **[Database Schema](docs/database.md)**: Struktur tabel dan kebijakan keamanan data (RLS).
5.  **[Design Guidelines](docs/design-guidelines.md)**: Standar visual, komponen, dan prinsip UI/UX.

---

## 💻 Memulai Pengembangan

### Prasyarat
- Node.js 20+
- Akun Supabase (untuk database dan auth)

### Instalasi
1. Kloning repositori:
   ```bash
   git clone https://github.com/fajarabr76/Trainerssuperappnext.git
   ```
2. Instal dependensi:
   ```bash
   npm install
   ```
3. Konfigurasi Environment:
   Salin `.env.example` ke `.env.local` dan isi nilainya:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
   ```
4. Jalankan mode pengembangan:
   ```bash
   npm run dev
   ```

## 📝 Catatan Pengembangan
- Gunakan direktori `app/(main)` untuk halaman aplikasi utama yang diproteksi auth.
- Semua mutasi data harus melalui **Server Actions** di `app/actions` atau folder modul terkait.
- Patuhi standar visual di [Design Guidelines](docs/design-guidelines.md).

## 📄 Lisensi
Private Internal Project.
