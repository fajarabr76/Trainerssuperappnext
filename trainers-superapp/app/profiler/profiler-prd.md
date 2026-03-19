# Product Requirements Document
## Aplikasi Database Profil Peserta
### Modul Profiler — TrainersSuperApp

| Atribut | Detail |
|---|---|
| Versi | 1.1.0 |
| Tanggal | Maret 2025 |
| Penulis | Tim Trainer — OJK Kontak 157 |
| Status | Draft untuk Review |
| Platform | Web App (React + Vite + TypeScript + Supabase) |

> **Changelog v1.1.0** — Ditambahkan: manajemen tahun, sub-folder, duplikat folder antar tahun, picker "Tambah Anggota", simpan slide sebagai gambar, template Excel dengan dropdown nyata (ExcelJS), dan ThemeToggle.

---

## Daftar Isi

1. [Ringkasan Eksekutif](#1-ringkasan-eksekutif)
2. [Scope Produk](#2-scope-produk)
3. [Stakeholder & Pengguna](#3-stakeholder--pengguna)
4. [Data Model & Struktur Database](#4-data-model--struktur-database)
5. [Spesifikasi Fitur](#5-spesifikasi-fitur)
6. [Persyaratan Non-Fungsional](#6-persyaratan-non-fungsional)
7. [User Flow Utama](#7-user-flow-utama)
8. [Acceptance Criteria](#8-acceptance-criteria)
9. [Arsitektur & Tech Stack](#9-arsitektur--tech-stack)
10. [Roadmap & Prioritas](#10-roadmap--prioritas)
11. [Risiko & Mitigasi](#11-risiko--mitigasi)
12. [Glosarium](#12-glosarium)
13. [Riwayat Dokumen & Persetujuan](#13-riwayat-dokumen--persetujuan)

---

## 1. Ringkasan Eksekutif

Modul Profiler Peserta adalah komponen inti dari TrainersSuperApp yang dirancang khusus untuk kebutuhan Tim Trainer di OJK Kontak 157. Modul ini menyediakan sistem pengelolaan data profil agen secara terpusat, terstruktur, dan mudah digunakan.

> **Tujuan Produk**
> - Menggantikan pengelolaan data peserta yang tersebar di berbagai file Excel manual.
> - Menyediakan database profil agen yang bisa diakses kapan saja, dari mana saja.
> - Menghasilkan materi presentasi (slide profil) secara otomatis tanpa perlu desain manual.
> - Mempermudah proses onboarding dan orientasi karyawan baru Contact Center 157.
> - Mendukung pengelolaan data multi-tahun dan multi-angkatan secara hierarkis.

### 1.1 Problem Statement

Tim Trainer OJK Kontak 157 menghadapi tantangan berikut:

- Data peserta tersebar di banyak file Excel tanpa sumber kebenaran tunggal.
- Proses pembuatan slide presentasi profil memakan waktu 2–3 jam per batch secara manual.
- Tidak ada cara mudah untuk melacak ulang tahun peserta secara real-time.
- Data sensitif (KTP, NPWP, rekening) tidak tersimpan aman dan terstandar.
- Sulit mengelola data lintas angkatan (tahun berbeda) dan lintas sub-program pelatihan.
- Trainer sering perlu memindahkan peserta yang sama ke batch berbeda tanpa cara yang efisien.

### 1.2 Solusi yang Diusulkan

- Struktur hierarkis 3 level: **Tahun → Folder → Sub-folder**.
- Manajemen folder fleksibel dengan rename, hapus, duplikat ke tahun lain.
- Picker "Tambah Anggota" untuk menyalin peserta dari folder lain tanpa re-input data.
- Form input manual lengkap (27+ field) dan import massal via Excel dengan dropdown validasi nyata (ExcelJS).
- Tampilan tabel interaktif, slide view, dan ekspor ke berbagai format.
- Simpan slide individu sebagai gambar PNG.
- Dashboard ulang tahun dengan countdown real-time.

---

## 2. Scope Produk

### 2.1 Dalam Scope (In Scope)

| No | Fitur | Deskripsi Singkat |
|---|---|---|
| 1 | Manajemen Tahun | Tambah tahun (contoh: 2025, 2026) sebagai lapisan organisasi tertinggi |
| 2 | Manajemen Folder/Batch | Buat, rename, hapus, duplikat folder di dalam tahun |
| 3 | Sub-folder | Buat sub-folder di dalam folder (hierarki 2 level dalam satu tahun) |
| 4 | Duplikat Folder ke Tahun Lain | Salin folder beserta semua pesertanya ke tahun berbeda |
| 5 | Input Manual Peserta | Form lengkap 27+ field untuk menambahkan peserta satu per satu |
| 6 | Tambah Anggota (Picker) | Salin peserta yang sudah ada di folder lain ke folder aktif |
| 7 | Import Excel/CSV | Upload spreadsheet untuk input massal dengan dropdown validasi nyata |
| 8 | Lihat & Edit Tabel | Tabel interaktif dengan edit inline, drag-to-reorder, filter tim |
| 9 | Pindah Folder | Memindahkan satu atau banyak peserta antar folder secara batch |
| 10 | Slide View + Simpan Gambar | Tampilan kartu profil visual; simpan slide aktif sebagai PNG |
| 11 | Download (Ekspor) | Unduh ke Excel (.xlsx), CSV, PowerPoint (.pptx), dan PDF |
| 12 | Birthday Dashboard | Widget countdown ulang tahun 5 peserta terdekat per folder |
| 13 | Upload Foto Profil | Foto peserta dengan kompresi otomatis ke Supabase Storage |
| 14 | Autentikasi Trainer | Data terikat ke akun trainer via RLS Supabase |
| 15 | Dark Mode + ThemeToggle | Toggle gelap/terang tersedia di title bar halaman utama |
| 16 | Tim Kustom | Trainer bisa menambah/hapus kategori tim; digunakan juga di dropdown template Excel |

### 2.2 Di Luar Scope (Out of Scope)

- Integrasi langsung dengan sistem HRIS atau Simpeg OJK.
- Modul absensi atau kehadiran pelatihan.
- Notifikasi push/email ulang tahun otomatis (direncanakan v1.2).
- Laporan analitik atau dashboard statistik (direncanakan v1.2).
- Aplikasi mobile native (iOS/Android).
- Multi-tenant (satu instalasi untuk banyak organisasi berbeda).

---

## 3. Stakeholder & Pengguna

### 3.1 Stakeholder

| Stakeholder | Peran | Kepentingan |
|---|---|---|
| Tim Trainer OJK 157 | Primary User | Mengelola data peserta sehari-hari lintas tahun dan angkatan |
| Koordinator Pelatihan | Secondary User | Mereview dan mengunduh laporan/slide profil peserta |
| Management Contact Center | Viewer | Mengakses data agregat untuk pelaporan dan evaluasi |
| Tim IT OJK / Developer | Admin Teknis | Memelihara infrastruktur Supabase, Vercel, dan deployment |

### 3.2 User Persona

#### Persona 1 — Trainer Senior

| Atribut | Detail |
|---|---|
| Nama Persona | Budi, Trainer Senior |
| Jabatan | Trainer di Tim Contact Center 157 |
| Keahlian Teknis | Menengah — familiar dengan Excel dan aplikasi web dasar |
| Kebutuhan Utama | Kelola data batch lintas tahun, cetak slide presentasi cepat |
| Pain Point | Setiap tahun harus buat ulang semua folder meskipun strukturnya sama |
| Goal | Duplikat struktur folder dari tahun lalu dalam 1 klik, lalu isi data baru |

#### Persona 2 — Trainer Baru

| Atribut | Detail |
|---|---|
| Nama Persona | Sari, Trainer Junior |
| Jabatan | Trainer baru, bergabung 3 bulan lalu |
| Keahlian Teknis | Dasar — nyaman dengan form web |
| Kebutuhan Utama | Interface intuitif, template Excel dengan panduan lengkap |
| Pain Point | Tidak tahu format apa yang diterima saat isi Excel |
| Goal | Download template dengan dropdown otomatis, langsung isi tanpa bingung |

---

## 4. Data Model & Struktur Database

### 4.1 Entitas Utama

Sistem menggunakan 5 tabel di Supabase.

#### 4.1.1 Tabel: `profiler_years`

| Field | Tipe | Nullable | Deskripsi |
|---|---|---|---|
| `id` | uuid | NOT NULL | Primary key, auto-generated |
| `year` | integer | NOT NULL | Tahun kalender (contoh: 2025) |
| `label` | text | NOT NULL | Label tampilan (contoh: "Tahun 2025") |
| `created_at` | timestamptz | NOT NULL | Waktu pembuatan, default `now()` |

#### 4.1.2 Tabel: `profiler_folders` *(diperbarui v1.1)*

| Field | Tipe | Nullable | Deskripsi |
|---|---|---|---|
| `id` | uuid | NOT NULL | Primary key, auto-generated |
| `name` | text | NOT NULL | Nama folder/batch |
| `trainer_id` | uuid | NOT NULL | FK ke `auth.users` |
| `year_id` | uuid | **nullable** | FK ke `profiler_years` (null = folder lama tanpa tahun) |
| `parent_id` | uuid | **nullable** | FK self-referential ke `profiler_folders.id` (null = root folder) |
| `created_at` | timestamptz | NOT NULL | Waktu pembuatan |

> **Catatan:** `parent_id` mendukung hierarki sub-folder. Saat folder induk dihapus, sub-folder terhapus otomatis via `ON DELETE CASCADE`.

#### 4.1.3 Tabel: `profiler_peserta`

| Field | Tipe | Kelompok | Deskripsi |
|---|---|---|---|
| `id` | uuid | System | Primary key, auto-generated |
| `trainer_id` | uuid | System | FK ke `auth.users` (RLS) |
| `batch_name` | text | System | FK logis ke `profiler_folders.name` |
| `nomor_urut` | integer | System | Urutan tampil di tabel |
| `created_at` / `updated_at` | timestamptz | System | Audit timestamp |
| `nama` | text | Identitas | Nama lengkap **(REQUIRED)** |
| `tim` | text | Identitas | Nama tim (Telepon / Chat / Email / custom) |
| `jabatan` | enum | Identitas | `cca`, `cca_senior`, `team_leader`, `trainer`, `spv`, `operation_manager`, `wfm`, `qa`, `cso` |
| `foto_url` | text | Identitas | URL foto di Supabase Storage |
| `nik_ojk` | text | Data Kerja | Nomor Induk Karyawan OJK |
| `bergabung_date` | date | Data Kerja | Tanggal bergabung di Contact Center 157 |
| `email_ojk` | text | Data Kerja | Alamat email dinas |
| `no_telepon` | text | Data Kerja | Nomor HP aktif |
| `no_telepon_darurat` | text | Data Kerja | Nomor HP darurat |
| `nama_kontak_darurat` | text | Data Kerja | Nama kontak darurat |
| `hubungan_kontak_darurat` | text | Data Kerja | Orang Tua / Saudara / Pasangan / Teman |
| `jenis_kelamin` | text | Data Pribadi | Laki-laki / Perempuan |
| `agama` | text | Data Pribadi | Islam / Kristen / Katolik / Hindu / Buddha / Konghucu |
| `tgl_lahir` | date | Data Pribadi | Tanggal lahir untuk birthday countdown |
| `status_perkawinan` | text | Data Pribadi | Belum Menikah / Menikah / Cerai |
| `pendidikan` | text | Data Pribadi | SMA / D3 / S1 / S2 / S3 |
| `no_ktp` | text | Data Sensitif | 16 digit NIK |
| `no_npwp` | text | Data Sensitif | Nomor NPWP |
| `nomor_rekening` | text | Data Sensitif | Nomor rekening bank |
| `nama_bank` | text | Data Sensitif | Nama bank |
| `alamat_tinggal` | text | Data Sensitif | Alamat tempat tinggal |
| `status_tempat_tinggal` | text | Data Sensitif | Milik Sendiri / Milik Orang Tua / Kost/Sewa / Lainnya |
| `nama_lembaga` | text | Latar Belakang | Nama universitas/sekolah |
| `jurusan` | text | Latar Belakang | Jurusan studi |
| `previous_company` | text | Latar Belakang | Perusahaan sebelumnya |
| `pengalaman_cc` | text | Latar Belakang | Pernah / Tidak Pernah |
| `catatan_tambahan` | text | Catatan | Prestasi, bakat, hobi |
| `keterangan` | text | Catatan | Catatan umum trainer |

#### 4.1.4 Tabel: `profiler_tim_list`

| Field | Tipe | Deskripsi |
|---|---|---|
| `id` | uuid | Primary key |
| `nama` | text | Nama tim kustom |
| `trainer_id` | uuid | FK ke `auth.users` |
| `created_at` | timestamptz | Waktu pembuatan |

### 4.2 Hierarki Struktur Data

```
profiler_years
└── profiler_folders (root, year_id = <id>, parent_id = null)
    └── profiler_folders (sub-folder, parent_id = <root.id>)
        └── profiler_peserta (batch_name = folder.name)
```

### 4.3 Row Level Security (RLS)

Semua tabel menggunakan Supabase RLS:

- **SELECT:** `WHERE trainer_id = auth.uid()`
- **INSERT:** `WITH CHECK (trainer_id = auth.uid())`
- **UPDATE / DELETE:** `WHERE trainer_id = auth.uid()`

---

## 5. Spesifikasi Fitur

### 5.1 Halaman Index Profiler (`ProfilerIndex`)

Layout dua kolom: sidebar hierarkis di kiri, area aksi di kanan.

#### 5.1.1 Sidebar — Tree Tahun & Folder

**Level 1: Tahun**

| Aksi | Deskripsi | Behavior |
|---|---|---|
| Tambah Tahun | Input angka tahun (2000–2100) + Enter | Validasi duplikat; simpan ke `profiler_years`; tahun baru langsung aktif |
| Pilih Tahun | Klik baris tahun | Update `selectedYearId`; folder di bawah tahun tetap visible |
| Collapse/Expand | Tombol chevron di kanan | Toggle visibilitas daftar folder di bawah tahun |

**Level 2: Folder (root)**

| Aksi | Deskripsi | Behavior |
|---|---|---|
| Buat Folder | Tombol "+ Folder baru" di bawah daftar folder tahun aktif | Input inline, Enter untuk konfirmasi |
| Pilih Folder | Klik folder tanpa sub-folder → pilih; folder dengan sub-folder → expand/collapse | Update `selectedBatch` |
| Rename | Ikon pensil (hover) | Inline edit, Enter konfirmasi, Escape batal |
| Hapus | Ikon trash (hover) | Modal konfirmasi, hapus rekursif: peserta sub-folder + sub-folder + peserta sendiri + folder |
| Duplikat ke Tahun | Ikon copy (hover) | Buka modal pilih tahun tujuan; salin semua peserta; nama baru otomatis jika sudah ada |
| Tambah Sub-folder | Ikon + (hover, hanya folder root) | Input inline di bawah folder root |

**Level 3: Sub-folder**

Tampilan dan aksi sama seperti folder root, kecuali: tidak bisa punya sub-folder lagi (maksimal 2 level), tidak ada tombol "+" di dalamnya.

#### 5.1.2 Panel Kanan — Header Folder

Menampilkan nama folder aktif, badge tahun, badge jumlah peserta, dan dua tombol shortcut:

| Tombol | Aksi |
|---|---|
| **Tambah Anggota** (violet) | Buka Picker Modal — salin peserta dari folder lain |
| **Anggota Baru** (abu-abu) | Navigasi ke `/profiler/add?batch=<nama>` |

#### 5.1.3 Panel Kanan — Action Cards

| Card | Warna | Navigasi | Aktif |
|---|---|---|---|
| Input Manual | Biru | `/profiler/add?batch=<nama>` | Selalu |
| Import Excel | Hijau | `/profiler/import?batch=<nama>` | Selalu |
| Lihat Tabel | Oranye | `/profiler/table?batch=<nama>` | Hanya jika peserta > 0 |
| Lihat Slide | Pink | `/profiler/slides?batch=<nama>` | Hanya jika peserta > 0 |
| Download | Violet | `/profiler/download?batch=<nama>` | Hanya jika peserta > 0 |

#### 5.1.4 Widget Ulang Tahun

- Kartu pink di bagian bawah panel kanan, tampil saat peserta > 0.
- Tampilkan nama dan countdown (hari) peserta ulang tahun terdekat.
- Label **"Hari ini! 🎉"** jika `days === 0`.
- Klik membuka modal daftar 5 ulang tahun terdekat dengan detail: nama, tanggal, umur yang akan dicapai, hari mundur.

#### 5.1.5 Picker Modal "Tambah Anggota" *(baru v1.1)*

| Elemen | Deskripsi |
|---|---|
| Search bar | Filter real-time berdasarkan nama, folder, atau tim (terintegrasi di dalam header gradient modal) |
| Daftar peserta | Dikelompokkan per `batch_name` (grouped list), dengan checkbox per item |
| Avatar inisial | Gradient violet, huruf pertama nama |
| Badge tim & jabatan | Tampil di bawah nama untuk membantu identifikasi |
| Footer tombol | "Tambahkan N anggota terpilih" — disabled jika belum ada yang dipilih |
| Success state | Setelah simpan: animasi icon `UserCheck`, teks konfirmasi, modal otomatis tutup setelah 1.5 detik |
| Exclusion | Peserta yang sudah ada di folder aktif tidak muncul di daftar |

**Flow teknis:** `getGlobalPesertaPool()` → filter exclude peserta existing → user pilih → `copyPesertaToFolder()` per ID (INSERT row baru, bukan move) → refresh `pesertaMap` dan `counts`.

#### 5.1.6 Duplicate Folder Modal *(baru v1.1)*

- Tampilkan daftar tahun lain (tahun asal dikecualikan) sebagai radio button.
- Setelah konfirmasi: buat folder baru di tahun tujuan → INSERT semua peserta (strip `id`, `created_at`, `updated_at`) → redirect ke folder baru.
- Nama folder baru: sama seperti aslinya; jika sudah ada di tahun tujuan, tambahkan suffix `(tahun)` dan angka jika masih konflik.

---

### 5.2 Input Manual (`AddManual`)

Form 8 seksi, tidak ada perubahan dari v1.0.

| Seksi | Field Utama |
|---|---|
| Identitas Utama | Foto, Nama*, Tim*, Jabatan* |
| Data Kerja | NIK OJK, Bergabung, Email, Telepon, Kontak Darurat |
| Data Pribadi | Jenis Kelamin, Agama, Tanggal Lahir, Status Perkawinan, Pendidikan |
| Data Sensitif | KTP, NPWP, Rekening, Bank, Alamat, Status Hunian |
| Latar Belakang | Lembaga, Jurusan, Prev Company, Pengalaman CC |
| Catatan Tambahan | Textarea bebas (tampil di slide PPTX dengan highlight kuning) |
| Keterangan | Textarea bebas (catatan internal) |

**Flow:** Generate UUID → Upload foto ke Storage → INSERT ke `profiler_peserta` → Redirect ke TableView.

---

### 5.3 Import Excel (`ImportExcel`) *(upgrade v1.1)*

#### 5.3.1 Template Excel — Dropdown Validasi Nyata

Template dihasilkan menggunakan **ExcelJS** (bukan SheetJS). Perbedaan utama dari v1.0:

| Aspek | v1.0 (SheetJS) | v1.1 (ExcelJS) |
|---|---|---|
| Library | SheetJS/xlsx | ExcelJS (dynamic import) |
| Dropdown | Hanya komentar/catatan di Sheet Panduan | Validasi dropdown Excel nyata di 9 kolom |
| Sumber dropdown | Hardcoded di kode | Sheet tersembunyi `_Pilihan` (state: veryHidden) |
| Tim | Hardcoded "Telepon / Chat / Email" | Dinamis dari `profilerService.getTimList()` |
| Jumlah sheet | 2 (Data Peserta, Panduan) | 3 (Data Peserta, _Pilihan [hidden], Panduan) |

**9 kolom dengan dropdown nyata:**

| Kolom | Sumber |
|---|---|
| Tim | Dinamis dari `profiler_tim_list` di DB |
| Jabatan | Static: 9 pilihan enum |
| Hubungan Kontak Darurat | Static: Orang Tua / Saudara / Pasangan / Teman |
| Jenis Kelamin | Static: Laki-laki / Perempuan |
| Agama | Static: 6 pilihan |
| Status Perkawinan | Static: Belum Menikah / Menikah / Cerai |
| Pendidikan | Static: SMA / D3 / S1 / S2 / S3 |
| Status Tempat Tinggal | Static: 4 pilihan |
| Pengalaman Contact Center | Static: Pernah / Tidak Pernah |

Validasi dropdown diterapkan ke 1000 baris data. Header berwarna: hijau tua untuk kolom wajib, biru untuk opsional.

#### 5.3.2 Proses Parsing (tidak berubah dari v1.0)

| Langkah | Deskripsi |
|---|---|
| 1. Read File | XLSX.js, mendukung `.xlsx`, `.xls`, `.csv` |
| 2. Header Mapping | HEADER_MAP (27 kolom + alias) |
| 3. Date Parsing | Normalisasi 5 format: Excel serial, YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, YYYY/MM/DD |
| 4. Enum Normalization | Jabatan, Agama, Status Hunian |
| 5. Duplikat Check | Nama (lowercase) vs DB existing + nama di run ini |
| 6. Insert | Per baris untuk tracking error individual |
| 7. Laporan | Ringkasan: berhasil / dilewati / gagal |

---

### 5.4 Tabel View (`TableView`)

Tidak ada perubahan fungsional dari v1.0.

#### 5.4.1 Mode Normal
- List peserta dengan foto, nama, tim, jabatan. Klik baris → `EditModal`.
- Filter per tim (chip selector). Tombol Tambah dan Slide View di header.

#### 5.4.2 Mode Urutkan (Drag-to-Reorder)
- Drag handle di kiri tiap baris. Indikator garis biru di posisi drop target.
- Baris yang digeser semi-transparan. Simpan urutan memperbarui `nomor_urut` di DB.

#### 5.4.3 Mode Pilih & Pindah
- Checkbox per baris. "Pilih Semua" mengikuti filter tim aktif.
- Floating action bar saat ada yang dipilih. `MoveFolderModal` untuk pilih folder tujuan.

---

### 5.5 Slide View (`SlideView`) *(upgrade v1.1)*

#### 5.5.1 Tampilan Slide
Layout 2-kolom responsif (27% sidebar kiri / 73% konten kanan), navigasi keyboard (←→), dot indicator di bawah, animasi fade antar slide.

#### 5.5.2 Simpan Slide sebagai Gambar *(baru v1.1)*

Tombol **"Simpan"** (ikon `ImageDown`) di top bar untuk mengunduh slide aktif sebagai PNG.

**Implementasi teknis:**
- Menggunakan `html2canvas` dengan `scale: 3` untuk kualitas tinggi (3x resolusi layar).
- Sebelum render, semua `computed styles` dari elemen asli diambil via `window.getComputedStyle()` dan diinline ke clone — ini memastikan warna `oklch` dari Tailwind v4 sudah di-resolve browser ke `rgb` sebelum html2canvas memproses.
- Stylesheet dihapus dari clone *setelah* inline styles diterapkan.
- Nama file: `<batch>_<nama_peserta>.png`.

---

### 5.6 Download Panel (`DownloadPanel`)

Tidak ada perubahan dari v1.0. Folder picker dropdown, 4 format ekspor: Excel, CSV, PPTX (pptxgenjs), PDF (jsPDF + html2canvas).

---

## 6. Persyaratan Non-Fungsional

### 6.1 Performa

- Halaman Index Profiler memuat dalam < 2 detik meski ada banyak tahun dan folder (parallel requests via `Promise.all()`).
- Template Excel dengan ExcelJS dihasilkan dalam < 5 detik di browser (lazy load).
- Simpan slide sebagai PNG selesai dalam < 3 detik per slide (html2canvas scale 3x).
- Import 100 baris Excel selesai dalam < 30 detik.
- Generasi PPTX untuk 50 peserta selesai dalam < 60 detik.

### 6.2 Keamanan

- Semua tabel dilindungi Row Level Security (RLS) — trainer hanya mengakses datanya sendiri.
- `copyPesertaToFolder()` memperbarui `trainer_id` ke user aktif saat menyalin peserta.
- Data sensitif (KTP, NPWP, rekening) tidak tampil di slide presentasi secara default.
- Foto peserta di Supabase Storage dengan bucket `profiler-foto`, akses terbatas.

### 6.3 Usability

- Sidebar tree collapsible agar tidak overwhelming saat ada banyak tahun dan folder.
- Semua aksi destruktif (hapus folder, hapus peserta) memerlukan konfirmasi modal dengan informasi jumlah data yang terdampak.
- Picker Modal "Tambah Anggota" memiliki search bar autofocus dan grouping per batch untuk navigasi mudah.
- ThemeToggle tersedia langsung di title bar ProfilerIndex.
- Keyboard shortcut: **Enter** konfirmasi, **Escape** batal pada semua input inline.

### 6.4 Aksesibilitas

- Semua tombol memiliki label deskriptif atau `title` attribute.
- Kontras warna memenuhi WCAG AA (4.5:1 untuk teks normal).
- Focus management yang benar saat modal dibuka/ditutup.

### 6.5 Maintainability

- TypeScript dengan typing eksplisit: interface `Peserta`, `ProfilerYear`, semua props komponen.
- Service layer terpusat (`profilerService`) — semua query Supabase di satu tempat.
- Dynamic import untuk library besar: ExcelJS, pptxgenjs, jsPDF, html2canvas — tidak membebani initial bundle.

---

## 7. User Flow Utama

### 7.1 Flow Onboarding Batch Baru (dengan hierarki tahun)

1. Trainer buka `/profiler`.
2. Klik `+` di sidebar → input tahun (contoh: 2026) → Enter.
3. Tahun baru muncul di sidebar, otomatis aktif.
4. Klik "Folder baru" di bawah daftar folder tahun aktif → input nama batch → Enter.
5. Panel kanan menampilkan action cards.
6. Pilih "Import Excel" → download template → isi data (pakai dropdown) → upload.
7. Sistem memproses dan tampilkan laporan hasil.
8. Klik "Lihat Tabel" untuk verifikasi, "Lihat Slide" / "Download" untuk output.

### 7.2 Flow Duplikat Folder ke Tahun Baru

1. Trainer hover ke folder yang ingin diduplikat.
2. Klik ikon Copy → Duplicate Modal terbuka.
3. Pilih tahun tujuan dari daftar radio button.
4. Klik "Duplikat ke [tahun]".
5. Sistem buat folder baru di tahun tujuan, salin semua peserta.
6. Sidebar beralih ke tahun tujuan, folder baru otomatis terpilih.

### 7.3 Flow Tambah Anggota dari Folder Lain

1. Trainer pilih folder tujuan di sidebar.
2. Klik tombol "Tambah Anggota" (violet) di header panel kanan.
3. Picker Modal terbuka. Sistem fetch semua peserta dari DB, exclude yang sudah ada di folder ini.
4. Ketik nama di search bar untuk filter.
5. Centang peserta yang ingin ditambahkan (bisa lintas batch).
6. Klik "Tambahkan N anggota terpilih".
7. Sistem INSERT row baru untuk setiap peserta → tampil animasi sukses → modal tutup otomatis.
8. Count peserta di sidebar dan panel kanan terupdate.

### 7.4 Flow Simpan Slide sebagai Gambar

1. Trainer buka SlideView (`/profiler/slides?batch=<nama>`).
2. Navigasi ke slide peserta yang diinginkan (keyboard ← → atau klik dot).
3. Klik tombol "Simpan" (ikon `ImageDown`) di top bar.
4. html2canvas render slide dengan inline style resolution (fix oklch Tailwind v4).
5. File PNG terunduh otomatis dengan nama `<batch>_<nama_peserta>.png`.

### 7.5 Flow Edit Data Peserta

1. Buka TableView → klik baris peserta → `EditModal` terbuka.
2. Ubah field, ganti foto jika perlu. Klik "Simpan Perubahan".
3. Tabel diperbarui secara optimistic update.

---

## 8. Acceptance Criteria

| ID | Fitur | Kriteria Penerimaan |
|---|---|---|
| AC-01 | Tambah Tahun | Tahun baru tersimpan di `profiler_years`. Muncul di sidebar. Validasi tahun duplikat dan range 2000–2100. |
| AC-02 | Buat Folder | Folder tersimpan di `profiler_folders` dengan `year_id` yang benar. Muncul di tree sidebar di bawah tahun aktif. |
| AC-03 | Sub-folder | Sub-folder tersimpan dengan `parent_id` yang benar. Tampil di tree indented di bawah folder induk. |
| AC-04 | Rename Folder | Nama folder dan `batch_name` semua peserta terkait diperbarui secara atomik. |
| AC-05 | Hapus Folder | Folder, sub-folder, dan semua pesertanya terhapus. Modal konfirmasi tampil dengan jumlah peserta terdampak. |
| AC-06 | Duplikat Folder | Folder baru terbuat di tahun tujuan. Semua peserta tersalin. Nama baru tidak konflik. Sidebar beralih ke folder baru. |
| AC-07 | Tambah Anggota | Peserta tersalin (row baru) ke folder aktif. Peserta yang sudah ada tidak tampil di picker. Count terupdate. Animasi sukses tampil. |
| AC-08 | Input Manual | Peserta tersimpan dengan semua field. Foto ter-compress dan ter-upload. Redirect ke TableView. |
| AC-09 | Import Excel (Template) | File `.xlsx` berisi dropdown nyata yang berfungsi di Excel/Sheets. Tim dropdown mencerminkan data dari DB. |
| AC-10 | Import Excel (Parse) | Duplikat dilewati. Baris valid diimpor. Laporan ringkasan tampil. |
| AC-11 | Drag Reorder | `nomor_urut` diperbarui di DB. Urutan konsisten saat reload. |
| AC-12 | Pindah Folder | `batch_name` peserta terpilih berubah ke folder tujuan. Peserta hilang dari tabel asal. |
| AC-13 | Simpan Slide PNG | File PNG ter-download. Warna/font/layout identik dengan tampilan di browser. Foto peserta tampil (CORS OK). |
| AC-14 | Ekspor PPTX | 1 slide per peserta. Foto tampil. Warna tema sesuai tim. Data sensitif tampil dengan label merah. |
| AC-15 | Ekspor PDF | 1 halaman per peserta. Layout identik SlideView. Foto peserta tampil. |
| AC-16 | Birthday Widget | Countdown akurat. "Hari ini!" tampil pada hari lahir. Top 5 terdekat ditampilkan di modal. |
| AC-17 | RLS Security | Trainer A tidak bisa mengakses atau memodifikasi data Trainer B meskipun mengetahui `batch_name` atau ID. |

---

## 9. Arsitektur & Tech Stack

### 9.1 Frontend

| Teknologi | Versi | Kegunaan |
|---|---|---|
| React | 18.x | UI library utama |
| Vite | 5.x | Build tool dan dev server |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 4.x | Styling (note: menggunakan warna oklch, perlu inline style fix untuk html2canvas) |
| React Router | 6.x | Client-side routing |
| Lucide React | Latest | Icon library |

### 9.2 Backend & Infrastruktur

| Teknologi | Kegunaan |
|---|---|
| Supabase (PostgreSQL) | Database, Auth, Storage (`profiler-foto`), RLS |
| Vercel | Hosting dan auto-deploy dari GitHub |

### 9.3 Library — Detail dan Cara Load

| Library | Format Output | Cara Load | Catatan |
|---|---|---|---|
| SheetJS / xlsx | Parse Excel untuk import | Import statis | Digunakan di `ImportExcel` untuk membaca file upload |
| ExcelJS | Generate template Excel | Dynamic `import()` | Baru di v1.1; menghasilkan dropdown validasi nyata |
| pptxgenjs | PowerPoint | Dynamic `import()` | Lazy load saat generate PPTX |
| jsPDF | PDF | Dynamic `import()` | Lazy load |
| html2canvas | PDF render + PNG slide | Dynamic `import()` | Digunakan di `DownloadPanel` (PDF) dan `SlideView` (PNG) |
| browser-image-compression | Kompresi foto upload | Import statis | Max 0.2MB / 400px |

### 9.4 Routing

| Path | Komponen | Deskripsi |
|---|---|---|
| `/profiler` | `ProfilerIndex` | Halaman utama dengan tree sidebar |
| `/profiler/add` | `AddManual` | Form input manual peserta |
| `/profiler/table` | `TableView` | Tabel edit + drag reorder |
| `/profiler/slides` | `SlideView` | Slide view + simpan PNG |
| `/profiler/import` | `ImportExcel` | Import via Excel/CSV |
| `/profiler/download` | `DownloadPanel` | Export ke berbagai format |

---

## 10. Roadmap & Prioritas

### 10.1 Fase 1 — MVP (v1.0) ✅

Manajemen folder flat, input manual, import Excel dasar, tabel view, slide view, ekspor (Excel/CSV/PPTX/PDF), birthday widget, RLS.

### 10.2 Fase 2 — Hierarki & Kolaborasi (v1.1) ✅

Manajemen tahun, sub-folder, duplikat folder ke tahun lain, picker "Tambah Anggota", template Excel dengan dropdown nyata (ExcelJS), simpan slide sebagai PNG, ThemeToggle.

### 10.3 Fase 3 — Analytics & Notifikasi (v1.2)

- **Statistik Batch:** Dashboard distribusi jabatan, gender, pendidikan per folder.
- **Search Global:** Cari peserta lintas semua tahun dan folder.
- **Notifikasi Ulang Tahun:** Email/notifikasi browser H-7 dan H-0.
- **Export PDF Individual:** Unduh PDF satu peserta dari SlideView.
- **Audit Log:** Riwayat perubahan data (siapa mengubah apa dan kapan).

### 10.4 Fase 4 — Integrasi (v2.0)

- **QR Code Profil:** Link ke halaman profil publik terbatas.
- **Bulk Edit:** Edit satu field untuk banyak peserta sekaligus.
- **Template Slide Kustom:** Pilih tema warna atau layout berbeda.
- **Sinkronisasi Google Calendar:** Ulang tahun peserta ke kalender trainer.

---

## 11. Risiko & Mitigasi

| Risiko | Dampak | Kemungkinan | Mitigasi |
|---|---|---|---|
| Data sensitif peserta bocor | Sangat Tinggi | Rendah | RLS Supabase ketat; data sensitif tidak di-expose di slide publik |
| Duplikat peserta saat copy antar folder | Sedang | Sedang | `copyPesertaToFolder()` buat row baru; trainer perlu sadar ini adalah copy, bukan reference |
| html2canvas gagal render warna oklch (Tailwind v4) | Sedang | Tinggi (sudah terjadi) | **Mitigasi aktif:** inline semua computed styles sebelum render; stylesheet dihapus setelah inline |
| Template ExcelJS gagal di browser lama | Rendah | Rendah | Dynamic import dengan error handling; fallback alert dengan pesan deskriptif |
| Performa lambat saat load banyak tahun + folder sekaligus | Sedang | Sedang | `Promise.all()` untuk parallel fetch; pertimbangkan lazy load per tahun di v1.2 |
| Hierarki folder terlalu dalam membingungkan user | Rendah | Rendah | Dibatasi maksimal 2 level (folder + sub-folder); tidak ada nesting lebih dalam |
| Trainer tidak sengaja hapus folder berisi banyak data | Tinggi | Rendah | Modal konfirmasi wajib tampilkan jumlah peserta; hapus rekursif jelas dijelaskan |
| Duplikasi nama peserta yang sah | Rendah | Rendah | Deteksi duplikat berbasis nama lowercase; NIK bisa dipakai sebagai disambiguator |

---

## 12. Glosarium

| Istilah | Definisi |
|---|---|
| **Tahun** | Layer organisasi tertinggi di Profiler, mewakili satu tahun kalender. Disimpan di tabel `profiler_years`. |
| **Folder / Batch** | Kelompok peserta dalam satu angkatan atau program pelatihan. Terikat ke satu tahun. |
| **Sub-folder** | Folder anak di dalam folder root. Berguna untuk membagi angkatan ke kelompok lebih kecil (misal: Tim A, Tim B). |
| **Peserta** | Karyawan Contact Center 157 (agen, TL, trainer, dll) yang datanya dikelola dalam sistem. |
| **Trainer** | Pengguna aplikasi. Semua data terikat ke akun Supabase Auth via `trainer_id`. |
| **Tambah Anggota** | Fitur menyalin (bukan memindahkan) peserta dari folder lain ke folder aktif tanpa re-input data. |
| **Duplikat Folder** | Fitur menyalin seluruh folder beserta pesertanya ke tahun berbeda. |
| **Tim** | Unit kerja: Telepon, Chat, Email, atau custom. Disimpan di `profiler_tim_list`; digunakan sebagai dropdown di template Excel. |
| **Jabatan** | Posisi: CCA, CCA Senior, Team Leader, Trainer, SPV, Operation Manager, WFM, QA, CSO. |
| **Masa Dinas** | Durasi sejak `bergabung_date` hingga sekarang. Dihitung otomatis (contoh: "2 Tahun 3 Bulan"). |
| **RLS** | Row Level Security — membatasi akses data di level baris berdasarkan `auth.uid()`. |
| **ExcelJS** | Library JS untuk generate file Excel dengan fitur lengkap termasuk dropdown validasi. Menggantikan SheetJS untuk pembuatan template. |
| **oklch** | Format warna di Tailwind CSS v4. Tidak didukung langsung oleh html2canvas; perlu di-resolve ke rgb via `getComputedStyle()` sebelum render. |
| **TrainersSuperApp** | Nama keseluruhan aplikasi web yang menaungi modul Profiler, PDKT, Telefun, dan modul lainnya. |

---

## 13. Riwayat Dokumen & Persetujuan

| Versi | Tanggal | Perubahan | Penulis |
|---|---|---|---|
| 1.0.0 | Maret 2025 | Dokumen awal — MVP v1.0 | Tim Trainer OJK 157 |
| 1.1.0 | Maret 2025 | Tambah: manajemen tahun, sub-folder, duplikat folder, picker anggota, simpan PNG, ExcelJS dropdown, ThemeToggle | Tim Trainer OJK 157 |

---

### Tanda Tangan

| | Dibuat Oleh | Disetujui Oleh |
|---|---|---|
| **Nama** | _________________________ | _________________________ |
| **Jabatan** | _________________________ | _________________________ |
| **Tanggal** | _________________________ | _________________________ |
| **Tanda Tangan** | _________________________ | _________________________ |

---

*OJK — Kontak 157 | Dokumen ini bersifat konfidensial dan hanya untuk kalangan internal.*
