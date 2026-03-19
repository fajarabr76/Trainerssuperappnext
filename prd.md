# 📄 PRODUCT REQUIREMENTS DOCUMENT (PRD)

**Proyek:** Migrasi Next.js, Restrukturisasi Arsitektur, & Peningkatan UI/UX Premium (Trainers SuperApp)
**Versi:** 2.2 (Draft Revisi)
**Status:** Menunggu Persetujuan Eksekusi

---

## 1. Latar Belakang & Tujuan

Dokumen ini merinci kebutuhan untuk aplikasi "Trainers SuperApp", sebuah platform simulasi untuk pelatihan agen contact center yang sedang dimigrasi dari Vite ke Next.js dengan backend Supabase.
Struktur kode saat ini (Vite/React) mulai tidak terkelola seiring bertambahnya fitur (Ketik, PDKT, Telefun). Logika AI (Gemini) dan UI masih bercampur di sisi klien, menimbulkan risiko keamanan dan kesulitan pemeliharaan jangka panjang.

**Tujuan Utama:**

**Clean Architecture** — Merombak struktur folder secara radikal untuk memisahkan Frontend (UI/UX), Backend (Logika AI & API), dan Shared Resources (Tipe data, Konstanta).

**Keamanan & Performa** — Beralih ke Next.js (App Router) agar pemanggilan API Google Gemini sepenuhnya terjadi di sisi server, mencegah kebocoran API Key, dan mempercepat loading aplikasi.

**UI/UX Premium** — Meningkatkan standar visual aplikasi menjadi level Enterprise/Luxury yang modern dan profesional.

**Preservasi Referensi** — Memastikan seluruh kode lama tetap tersedia dan terorganisir sebagai acuan pengembangan aplikasi baru, tanpa mencemari workspace aktif.

---

## 2. Struktur Pengguna dan Hak Akses (RBAC)

Aplikasi ini menerapkan pembagian peran yang ketat sebagai berikut:

- **Trainer (Super Admin)**
  Memiliki otoritas penuh atas sistem. Dapat membuat, mengubah, dan menghapus data aplikasi serta modul simulasi. Akun `fajarabr76@gmail.com` ditetapkan sebagai Super Admin permanen yang tidak dapat dihapus dari sistem.

- **Leader**
  Memiliki hak akses pantauan (View-Only) untuk data agen. Dapat melihat semua data yang dilihat oleh Trainer (seperti hasil simulasi agen), namun dilarang keras untuk mengubah data atau menghapus data. Leader **dapat** menggunakan dan mengikuti semua aplikasi simulasi (Ketik, PDKT, dan Telefun) secara penuh.

- **Agent**
  Pengguna akhir yang hanya dapat melihat data aplikasi yang ditentukan oleh Trainer. Tugas utama Agent adalah mengikuti semua simulasi yang tersedia dan melihat riwayat nilai pribadi.

---

## 3. Fitur Utama (MVP)

Fitur minimum yang harus tersedia pada peluncuran pertama meliputi:

- **Landing Page & Auth**
  Halaman utama dengan opsi Login dan Daftar. Sistem autentikasi dikelola oleh Supabase Auth dengan penempatan role otomatis saat pendaftaran.

- **Modul Simulasi "Ketik"**
  Simulasi untuk menguji kecepatan dan akurasi pengetikan agen dengan pencatatan skor otomatis.
  - **Fitur Baru:**
    - **Blind Simulation (Session Waiting):** Layar tunggu untuk menyembunyikan detail skenario dan persona konsumen sebelum simulasi dimulai, memastikan agen siap menghadapi situasi apa pun.
    - **Template Sapaan Otomatis:** Tombol "Gunakan Template" di area chat untuk mempercepat pembukaan percakapan dengan sapaan formal yang dipersonalisasi dengan nama agen.

- **Modul Simulasi "PDKT"**
  Simulasi interaksi teks atau alur percakapan untuk menguji kemampuan komunikasi agen.

- **Modul Simulasi "Telefun"**
  Simulasi berbasis suara atau alur telepon untuk melatih penanganan panggilan.

- **Modul Profiler Peserta (BARU)**
  Sistem manajemen database profil agen secara terpusat untuk menggantikan pengelolaan manual via Excel.
  - **Fitur Utama:** Manajemen folder/batch, form input lengkap (identitas, data kerja, pribadi, sensitif), upload foto, import/export Excel, dan generasi otomatis slide presentasi profil (PPTX/PDF).

- **Monitoring Dashboard**
  Halaman khusus Trainer dan Leader untuk memantau durasi pengerjaan dan skor rata-rata agen secara real-time.

---

## 4. Spesifikasi Teknis

| Aspek | Teknologi |
|---|---|
| Framework Utama | Next.js 14/15 (App Router) |
| Database & Auth | Supabase (PostgreSQL, Storage, RLS) |
| Styling & Animasi | Tailwind CSS + Framer Motion |
| Ikonografi | Lucide React |
| Backend / Server Logic | Next.js Route Handlers & Server Actions |
| AI Engine | @google/genai (Server-side only) |
| Ekspor Data | SheetJS (Excel/CSV), pptxgenjs (PPTX), jsPDF + html2canvas (PDF) |
| Deployment | Vercel (Menggunakan domain yang sudah ada) |
| Referensi Lama | Vite + React (read-only, tidak dimodifikasi) |

---

## 5. Standar Arsitektur Folder (Sebelum & Sesudah Migrasi)

### 5a. Kondisi Setelah Fase 0 — Dua Folder Utama di Root

Sebelum pembangunan aplikasi baru dimulai, workspace akan dibagi menjadi dua zona yang sepenuhnya terpisah:

```
/ (Root Workspace)
├── /reference-old-app          # ← ZONA REFERENSI (Read-Only)
│   └── [Seluruh konten proyek Vite/React lama dipindahkan ke sini]
│
└── /trainers-superapp          # ← ZONA AKTIF (Proyek Next.js Baru)
    └── [Dibangun dari nol, mengacu ke reference-old-app bila perlu]
```

---

## 6. Rencana Migrasi & Eksekusi (Termasuk Modul Profiler)

### Fase 0 — Preservasi & Pemisahan (Pre-Migration)
**Tujuan:** Menyelamatkan seluruh kode lama sebelum ada perubahan apapun, dan menjadikannya referensi yang terorganisir.

### Fase 1 — Setup Next.js & Restrukturisasi Folder (Pondasi)
### Fase 2 — Migrasi Routing & Frontend
### Fase 3 — Pemisahan Backend & Keamanan AI
### Fase 4 — Implementasi UI/UX Premium (Polishing)
### Fase 5 — Integrasi Supabase & RBAC

### Fase 6 — Pengembangan Modul Profiler Peserta (BARU)
Pengembangan modul Profiler dibagi menjadi 3 sub-fase dengan prioritas kerumitan di awal:
- **Sub-Fase 6.1 (Paling Rumit): Database, Storage & Core UI**
  - Setup tabel Supabase (`profiler_folders`, `profiler_peserta`, `profiler_tim_list`) dengan RLS.
  - Implementasi `profilerService` untuk operasi CRUD kompleks (cascading delete/rename).
  - Pembuatan UI Tabel Interaktif dengan fitur *Drag-to-Reorder* (update `nomor_urut`), *Bulk Move* (Pindah Folder), dan *Inline Edit*.
  - Implementasi upload foto dengan kompresi (`browser-image-compression`) ke Supabase Storage.
- **Sub-Fase 6.2 (Menengah): Import, Export & Presentation**
  - Implementasi Import Excel/CSV dengan validasi dan deteksi duplikat.
  - Implementasi Export ke format Excel, CSV, PowerPoint (PPTX), dan PDF.
  - Pembuatan UI Slide View untuk presentasi profil.
- **Sub-Fase 6.3 (Sederhana): Dashboard & Utilities**
  - Pembuatan Widget Ulang Tahun (Birthday Countdown).
  - Manajemen Tim Kustom (CRUD untuk daftar tim).

---

## 7. Rencana Desain UI/UX Premium (Konsep Visual)
### Tema "Dark Luxury & Clean Utility"
### Layout "Mission Control" untuk Simulasi
### Landing Page Split-Screen
