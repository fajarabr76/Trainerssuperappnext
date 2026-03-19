# Handover Document - Migrasi Trainers SuperApp

## Status Proyek
- **Fase Saat Ini:** Fase 4 (Polishing & UI/UX Premium) - Selesai, Menuju Fase 5 (Integrasi Supabase & RBAC) & Fase 6 (Modul Profiler)
- **Terakhir Diperbarui:** 16 Maret 2026
- **Status Migrasi:** Projek saat ini dalam tahap migrasi dari arsitektur SPA (Vite) ke Fullstack Framework (Next.js). Perubahan utama terletak pada perpindahan pengelolaan state dan routing ke server-side serta integrasi database relasional. Modul baru "Profiler Peserta" telah ditambahkan ke dalam roadmap.

## Progress Checklist

### Fase 0: Preservasi & Pemisahan
- [x] Membuat file `prd.md`
- [x] Membuat file `handover.md`
- [x] Membuat folder `reference-old-app`
- [x] Memindahkan seluruh kode lama (`/src`, `.env.example`, `.gitignore`, `package.json`, dll) ke `reference-old-app`
- [x] Memastikan folder `/src` di root sudah dihapus sepenuhnya (dipindahkan ke `/old-file`)
- [x] Membuat `README-REFERENCE.md` di dalam folder referensi

### Fase 1: Setup Next.js & Restrukturisasi
- [x] Inisialisasi proyek Next.js di `trainers-superapp`
- [x] Setup struktur folder `/app` (tanpa folder `src` untuk menghindari kebingungan dengan kode lama)
- [x] Konfigurasi Tailwind CSS v4

### Fase 2: Migrasi Routing & Frontend
- [x] Setup Landing Page Premium
- [x] Setup Dashboard & Sidebar Navigation
- [x] Setup Placeholder Pages untuk Ketik, PDKT, dan Telefun
- [x] Implementasi UI Chat (Ketik)
- [x] Implementasi UI Email (PDKT)
- [x] Implementasi UI Telepon (Telefun)

### Fase 3: Pemisahan Backend & Keamanan AI
- [x] Integrasi Google Gemini AI (Client-side dengan platform security)
- [x] Implementasi Persona Konsumen (Ketik, PDKT, Telefun)
- [x] Implementasi Voice Simulation (Telefun menggunakan Gemini TTS)
- [x] Konsolidasi AI Logic di `/app/lib/ai.ts`
- [x] Memindahkan API Gemini ke server-side (Server Actions)

### Fase 4: Polishing & UI/UX Premium
- [x] Refine UI/UX Ketik (ChatInterface)
- [x] Refine UI/UX PDKT (EmailInterface)
- [x] Refine UI/UX Telefun (CallInterface)
- [x] Konsistensi Tema "Dark Luxury & Clean Utility"

### Fase 5: Integrasi Supabase & RBAC (Selesai)
- [x] Implementasi fungsi pendaftaran yang otomatis memasukkan data ke tabel 'profiles'.
- [x] Penyesuaian API Route untuk pencatatan skor simulasi ke tabel 'results' di Supabase.
- [x] Implementasi Role-Based Access Control (RBAC) lengkap (SQL script disediakan).

### Fase 6: Modul Profiler Peserta (BARU - In Progress)
- **Sub-Fase 6.1 (Paling Rumit): Database, Storage & Core UI**
  - [x] Setup tabel Supabase (`profiler_folders`, `profiler_peserta`, `profiler_tim_list`) dengan RLS.
  - [x] Implementasi `profilerService` untuk operasi CRUD kompleks (cascading delete/rename).
  - [x] Pembuatan UI Halaman Index Profiler (`ProfilerIndex`) dengan sidebar folder dan action cards.
  - [x] Pembuatan UI Tabel Interaktif dengan fitur *Drag-to-Reorder* (update `nomor_urut`), *Bulk Move* (Pindah Folder), dan *Inline Edit*.
  - [x] Implementasi upload foto dengan kompresi (`browser-image-compression`) ke Supabase Storage.
- **Sub-Fase 6.2 (Menengah): Import, Export & Presentation**
  - [x] Implementasi Import Excel/CSV dengan validasi dan deteksi duplikat.
  - [x] Implementasi Export ke format Excel, CSV, PowerPoint (PPTX), dan PDF.
  - [x] Pembuatan UI Slide View untuk presentasi profil.
- **Sub-Fase 6.3 (Sederhana): Dashboard & Utilities**
  - [x] Pembuatan Widget Ulang Tahun (Birthday Countdown) di Halaman Index.
  - [x] Manajemen Tim Kustom (CRUD untuk daftar tim).

## Konfigurasi Database (Supabase)
Pastikan hal-hal berikut sudah terkonfigurasi pada dashboard Supabase:

- **Tabel Profiles**
  Kolom wajib: `id` (uuid), `email` (text), `role` (enum: 'Trainer', 'Leader', 'Agent').

- **Row Level Security (RLS)**
  - **Trainer:** Policy ALL (SELECT, INSERT, UPDATE, DELETE).
  - **Leader:** Policy SELECT only (untuk data agen/hasil), dan INSERT (untuk skor simulasi sendiri).
  - **Agent:** Policy SELECT (on specific apps) dan INSERT (on scores).

- **Proteksi Super Admin**
  Pastikan email `fajarabr76@gmail.com` diberikan role 'Trainer'. Tambahkan constraint pada level database atau logic aplikasi agar akun ini tidak bisa dihapus melalui UI admin manapun.

## Komponen Penting Next.js
- **middleware.ts**
  Bertanggung jawab atas proteksi rute. Jika user dengan role 'Agent' mencoba mengakses direktori `/trainer`, middleware harus melakukan redirect ke `/dashboard/agent`.
- **lib/supabase.ts**
  Inisialisasi Supabase Client untuk penggunaan di sisi Client maupun Server.
- **Dashboard Logic**
  Pemisahan view berdasarkan `session.user.role` yang didapat dari metadata JWT Supabase.

## Daftar Tugas Tersisa (To-Do)
- [x] Implementasi fungsi pendaftaran yang otomatis memasukkan data ke tabel 'profiles'.
- [x] Migrasi logika simulasi 'Ketik' dari project Vite lama ke komponen React di Next.js.
- [x] Penyesuaian API Route untuk pencatatan skor simulasi ke tabel 'results' di Supabase.
- [x] Implementasi Blind Simulation (Waiting Screen) untuk modul Ketik, PDKT, dan Telefun.
- [x] Implementasi Template Sapaan Otomatis untuk modul Ketik.

### 2. Tabel `results` (Supabase Schema)
Tabel ini menyimpan hasil simulasi dari Agent dan Leader.

```sql
create table public.results (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  module text not null, -- 'ketik', 'pdkt', 'telefun'
  scenario_title text not null,
  score integer not null,
  feedback text,
  history jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS Policies
alter table public.results enable row level security;

-- Trainer bisa melihat semua hasil
create policy "Trainer can view all results"
  on public.results for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'trainer'
    )
  );

-- Leader bisa melihat hasil agent dan dirinya sendiri
create policy "Leader can view agent and own results"
  on public.results for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'leader'
    )
    OR
    user_id = auth.uid()
  );

-- Agent hanya bisa melihat hasil sendiri
create policy "Agent can view own results"
  on public.results for select
  using (user_id = auth.uid());

-- Semua role bisa insert hasil simulasi mereka sendiri
create policy "Users can insert own results"
  on public.results for insert
  with check (user_id = auth.uid());
```

## Catatan Penting
- Folder `reference-old-app` berisi seluruh kode sumber lama yang terorganisir.
- Folder `old-file` adalah cadangan tambahan untuk folder `/src` root yang telah dipindahkan.
- Pengembangan aktif dilakukan di dalam `trainers-superapp`.
- Aplikasi sudah sepenuhnya menggunakan Server Actions untuk pemanggilan Gemini API, sehingga API Key aman di sisi server.
