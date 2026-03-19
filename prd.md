# Product Requirements Document
## QA Performance Dashboard — "The Path to Zero"

| Field | Detail |
|---|---|
| Versi | 1.0.0 — MVP |
| Status | Selesai (MVP) |
| Tanggal | Maret 2026 |
| Platform | Web App (React + Vite + TypeScript + Supabase) |
| Modul Parent | TrainersSuperApp — QA Analyzer |

---

## Daftar Isi

1. [Ringkasan Produk](#1-ringkasan-produk)
2. [Filosofi Desain](#2-filosofi-desain)
3. [Ruang Lingkup & Fitur MVP](#3-ruang-lingkup--fitur-mvp)
4. [Spesifikasi Teknis](#4-spesifikasi-teknis)
5. [User Stories](#5-user-stories)
6. [Spesifikasi Layout UI](#6-spesifikasi-layout-ui)
7. [Scope MVP & Roadmap](#7-scope-mvp--roadmap)
8. [Non-Functional Requirements](#8-non-functional-requirements)
9. [Definition of Done & Acceptance Criteria](#9-definition-of-done--acceptance-criteria)
10. [Lampiran](#10-lampiran)

---

## 1. Ringkasan Produk

### 1.1 Latar Belakang

Modul QA Analyzer pada TrainersSuperApp saat ini sudah dapat menampung data temuan QA (input temuan, kelola parameter, manajemen periode). Namun belum tersedia tampilan dashboard yang memungkinkan QA, Supervisor, dan manajemen untuk melihat pola kesalahan, tren perbaikan, dan mengidentifikasi agen bermasalah secara cepat dan visual.

Filosofi desain yang diadopsi adalah **"The Path to Zero"** — setiap temuan adalah sebuah masalah yang harus dipecahkan, dan dashboard ini harus mencerminkan penurunan temuan dari waktu ke waktu sebagai indikator keberhasilan.

### 1.2 Permasalahan yang Dipecahkan

- QA & SPV tidak punya visibilitas cepat terhadap kondisi kualitas contact center secara keseluruhan
- Sulit mengidentifikasi pola kesalahan yang berulang (kategori parameter apa yang paling sering kena temuan)
- Tidak ada mekanisme untuk memantau tren perbaikan dari bulan ke bulan per agen atau per tim
- Proses coaching tidak berdasarkan data — hanya anekdot atau memori supervisor
- Tidak ada ringkasan eksekutif untuk dilaporkan ke manajemen secara berkala

### 1.3 Tujuan Produk

1. Menyediakan Executive Summary visual yang dapat dibaca dalam kurang dari 30 detik
2. Mengidentifikasi agen dan tim yang membutuhkan coaching berdasarkan data temuan
3. Menampilkan root cause analysis untuk menentukan prioritas perbaikan proses
4. Memungkinkan perbandingan kinerja antar periode (bulan ke bulan)
5. Mendukung budaya "data-driven coaching" di lingkungan Contact Center

### 1.4 Target Pengguna

| Persona | Role | Kebutuhan Utama |
|---|---|---|
| QA Officer | Quality Analyst | Input temuan, lihat parameter bermasalah, buat laporan |
| Supervisor | Team Leader | Monitor performa agen, identifikasi yang butuh coaching |
| Trainer | Learning & Development | Identifikasi gap kompetensi untuk program pelatihan |
| Manager | Operational Manager | Executive summary, tren, dan KPI kepatuhan keseluruhan |

---

## 2. Filosofi Desain

> **"The Path to Zero"** — Dashboard ini bukan sekadar laporan. Ini adalah peta perjalanan menuju kualitas sempurna. Setiap angka yang turun adalah kemenangan. Setiap temuan baru adalah kesempatan perbaikan.

### 2.1 Prinsip Visual

- **Warna sebagai sinyal:** Hijau = baik (angka rendah), Kuning/Oranye = waspada, Merah = perlu perhatian segera
- **Reverse logic metrics:** Berbeda dari dashboard biasa, di sini angka RENDAH = LEBIH BAIK untuk mayoritas metrik
- **Tren turun adalah target:** Grafik garis yang diharapkan menunjukkan penurunan temuan dari waktu ke waktu
- **Data density rendah:** Setiap kartu hanya menampilkan satu metrik utama agar mudah dibaca sekilas
- **Dark mode friendly:** Mendukung mode gelap yang sudah diimplementasikan di TrainersSuperApp

### 2.2 Sistem Warna Temuan (Reverse Logic)

| Status | Warna | Kondisi Temuan | Contoh Metrik |
|---|---|---|---|
| 🟢 BAIK | Hijau | Temuan rendah / menurun | Total Temuan < target |
| 🟡 WASPADA | Kuning | Mendekati batas atau stagnan | Rata-rata temuan = target |
| 🔴 KRITIS | Merah | Tinggi / meningkat / fatal | Fatal error rate naik |

> **Pengecualian:** Metrik "% Kepatuhan SOP" menggunakan logika NORMAL (tinggi = baik) sebagai penyeimbang perspektif.

---

## 3. Ruang Lingkup & Fitur MVP

### 3.1 Arsitektur Dashboard

Dashboard dibagi menjadi tiga level tampilan yang dapat diakses secara bertahap:

| Level | Nama | Deskripsi |
|---|---|---|
| Level 1 | Executive Summary | Kartu metrik utama + tren mini. Untuk semua persona. |
| Level 2 | Team & Agent Performance | Komparasi antar tim dan agen. Untuk SPV & QA. |
| Level 3 | Root Cause Analysis | Pareto chart dan distribusi kategori. Untuk QA & Trainer. |

---

### 3.2 Level 1: Executive Summary

#### 3.2.1 Filter Global

- **Filter Periode:** dropdown pilih bulan/tahun dari `qa_periods` yang tersedia
- **Filter Tim:** dropdown pilih satu folder/sub-folder atau "Semua Tim"
- **Filter Channel:** Telepon / Chat / Email (berbasis `jenis_tim` dari `profiler_peserta`)
- Semua komponen dashboard merespons filter yang dipilih secara real-time

#### 3.2.2 Kartu Metrik Utama (4 KPI Cards)

| Metrik | Logika | Target | Interpretasi |
|---|---|---|---|
| Total Temuan QA (Defects) | RENDAH = BAIK | < 100/bulan | Semakin sedikit temuan, semakin baik kualitasnya |
| Rata-rata Temuan per Audit | RENDAH = BAIK | < 1.0 | Target: kurang dari 1 kesalahan per sesi telepon yang diaudit |
| % Fatal Error Rate | RENDAH = BAIK | < 1% | Kesalahan fatal (Critical Error dengan nilai 0) harus segera ditangani |
| % Kepatuhan SOP | TINGGI = BAIK | > 95% | Persentase parameter yang dinilai sesuai (nilai 3) dari total audit |

Setiap kartu menampilkan:
- Nilai besar di tengah
- Grafik garis mini (sparkline) tren 3 bulan terakhir
- Badge status berwarna (Baik / Waspada / Kritis)
- Delta vs periode sebelumnya (▲/▼ + persentase)
- Target indicator: teks kecil "Target: < X" jika berlaku

#### 3.2.3 Mini Sparkline

- Grafik garis kecil di dalam setiap kartu KPI
- Menampilkan tren 3 bulan terakhir
- Warna garis mengikuti status kartu (hijau/kuning/merah)
- Untuk metrik "reverse", tren garis turun = warna hijau, naik = warna merah

---

### 3.3 Level 2: Team & Agent Performance

#### 3.3.1 Grafik Tren Mingguan (Line Chart)

- Menampilkan total temuan per minggu dalam periode yang dipilih
- Setiap tim/folder ditampilkan sebagai garis berbeda warna
- Garis horizontal merah sebagai "target line" (misal: < 30 temuan/minggu)
- Label "LOWER IS BETTER" di pojok kanan atas grafik

#### 3.3.2 Total Temuan per Tim (Horizontal Bar Chart)

- Grafik batang horizontal, satu batang per folder/sub-folder
- Batang terpanjang = tim terburuk — diberi highlight warna merah
- Warna batang mengikuti threshold: hijau → kuning → oranye → merah
- Label angka di ujung setiap batang
- Badge severity level: Critical, High, Medium, Low

#### 3.3.3 Tabel Top 5 Agen dengan Temuan Tertinggi

- Ranking agen berdasarkan jumlah temuan bermasalah (nilai 0, 1, atau 2) dalam periode
- Kolom: Rank, Nama Agen, Tim/Batch, Jumlah Temuan, Skor QA, Aksi (klik untuk drill-down)
- Badge merah pada agen dengan critical error
- Klik baris → navigate ke halaman detail agen di QA Analyzer yang sudah ada
- Catatan: data ini hanya terlihat oleh QA/SPV, bukan untuk publik

---

### 3.4 Level 3: Root Cause Analysis

#### 3.4.1 Pareto Chart (Bar + Cumulative Line)

- Grafik batang menunjukkan jumlah temuan per kategori parameter
- Garis merah di atas batang menunjukkan persentase kumulatif (Hukum Pareto 80/20)
- Sumbu Y kiri: jumlah temuan. Sumbu Y kanan: persentase kumulatif (0–100%)
- Batang diurutkan dari terbesar ke terkecil (descending)
- Tooltip saat hover: nama lengkap parameter, jumlah, persentase, kategori (Critical/Non-Critical)
- Anotasi visual pada titik 80% persentase kumulatif

#### 3.4.2 Donut Chart: Fatal vs Non-Fatal

- Dua segmen: Fatal (Critical Error, nilai 0) dan Non-Fatal (semua temuan lainnya)
- Warna: Merah untuk fatal, kuning untuk non-fatal
- Angka total di tengah donut
- Legenda di bawah dengan persentase masing-masing

#### 3.4.3 Distribusi Nilai per Parameter (Heat Table)

- Tabel dengan baris = nama parameter, kolom = nilai (0, 1, 2, 3)
- Setiap sel menampilkan jumlah temuan dengan warna intensitas (heatmap)
- Sel merah gelap = banyak nilai 0 (masalah serius)
- Sel hijau = banyak nilai 3 (agen sudah sesuai)
- Ini adalah versi yang sudah ada di QA Analyzer — perlu adaptasi untuk dashboard

---

## 4. Spesifikasi Teknis

### 4.1 Stack Teknologi

| Komponen | Teknologi | Keterangan |
|---|---|---|
| Frontend Framework | React + Vite + TypeScript | Sesuai dengan TrainersSuperApp yang sudah ada |
| Styling | Tailwind CSS | Konsisten dengan komponen QA Analyzer existing |
| Charting Library | Recharts | Sudah digunakan di QA Analyzer; tambah Pareto chart |
| Backend/Database | Supabase (PostgreSQL) | Tabel existing: `qa_temuan`, `qa_indicators`, `profiler_peserta`, `qa_periods` |
| State Management | React useState/useMemo | Tidak perlu state manager eksternal untuk MVP |
| Routing | React Router v6 | Route baru: `/qa-analyzer/dashboard` |
| Deployment | Vercel | Sama dengan deployment TrainersSuperApp existing |

### 4.2 Struktur Route Baru

```
/qa-analyzer/dashboard                    → Halaman utama QA Dashboard
/qa-analyzer/dashboard?period=:id         → Dashboard dengan filter periode aktif
/qa-analyzer/dashboard?folder=:name       → Dashboard dengan filter tim aktif
```

> Halaman existing `/qa-analyzer` (QA Analyzer Index) tetap dipertahankan sebagai halaman operasional.

### 4.3 Data Sources & Queries

#### 4.3.1 Tabel yang Digunakan

| Tabel Supabase | Field Penting | Digunakan Untuk |
|---|---|---|
| `qa_temuan` | `indicator_id, nilai, no_tiket, agent_id, period_id` | Sumber data utama semua metrik dashboard |
| `qa_indicators` | `name, category, bobot, team_type` | Label parameter dan kategori (Critical/Non-Critical) |
| `qa_periods` | `month, year` | Filter periode dan label sumbu waktu di grafik |
| `profiler_peserta` | `nama, tim, batch_name` | Data identitas agen dan pengelompokan tim |
| `profiler_folders` | `name, parent_id, year_id` | Struktur hierarki folder untuk filter tim |

#### 4.3.2 Fungsi `lib/qa-actions.ts` yang Perlu Dibuat (Baru)

```typescript
getDashboardSummary(folderIds: string[], periodId: string)
  → KPI cards data (total temuan, avg per audit, fatal rate, kepatuhan)

getWeeklyTrendByFolders(folderIds: string[], periodId: string)
  → Data grafik tren mingguan [{week: number, total: number}]

getTeamComparison(folderIds: string[], periodId: string)
  → Data horizontal bar chart per tim [{name: string, total: number, severity: string}]

getTopAgentsWithDefects(folderIds: string[], periodId: string, limit?: number)
  → Top N agen bermasalah [{agentId, nama, batch, defects, score}]

getParetoData(folderIds: string[], periodId: string)
  → Data Pareto chart [{paramName, count, cumulative: number, category}]

getFatalVsNonFatal(folderIds: string[], periodId: string)
  → {fatal: number, nonFatal: number, total: number}

getKpiSparkline(folderIds: string[], months: number)
  → Data sparkline 3 bulan terakhir [{label: string, value: number}]
```

### 4.4 Kalkulasi Metrik

#### 4.4.1 Total Temuan QA (Defects)

```sql
COUNT(*) FROM qa_temuan
WHERE nilai < 3
  AND period_id = :periodId
  AND agent_id IN (SELECT id FROM profiler_peserta WHERE batch_name IN (:folders))
```

#### 4.4.2 Rata-rata Temuan per Audit

```
COUNT(nilai < 3) / COUNT(DISTINCT no_tiket)
-- temuan bermasalah dibagi jumlah sesi unik (per no_tiket)
```

#### 4.4.3 Fatal Error Rate (%)

```
COUNT(*) WHERE nilai = 0 AND category = 'critical'
─────────────────────────────────────────────────── × 100
COUNT(DISTINCT no_tiket)
```

#### 4.4.4 Kepatuhan SOP (%)

```
COUNT(*) WHERE nilai = 3
────────────────────────── × 100
COUNT(*)
```

---

## 5. User Stories

### Epic 1 — Executive Summary View

| # | User Story | Acceptance Criteria |
|---|---|---|
| 1 | Sebagai **Manager**, saya ingin melihat 4 KPI utama dalam satu halaman agar saya bisa menilai kualitas contact center dalam 30 detik | 4 kartu tampil dengan nilai, delta, dan badge status yang benar |
| 2 | Sebagai **QA Officer**, saya ingin memfilter dashboard per periode agar saya bisa membandingkan bulan ini dengan bulan lalu | Dropdown periode tersedia; semua komponen update saat filter berubah |
| 3 | Sebagai **Supervisor**, saya ingin memfilter dashboard per tim saya saja agar saya fokus pada data yang relevan | Filter folder/tim berfungsi; data hanya menampilkan agen di tim tersebut |
| 4 | Sebagai **Manager**, saya ingin melihat sparkline tren 3 bulan agar saya tahu apakah kualitas membaik atau memburuk | Sparkline tampil dengan warna merah jika tren naik, hijau jika turun |

### Epic 2 — Team & Agent Performance

| # | User Story | Acceptance Criteria |
|---|---|---|
| 5 | Sebagai **SPV**, saya ingin melihat perbandingan temuan antar tim dalam grafik batang agar saya tahu tim mana yang paling bermasalah | Bar chart horizontal tampil diurutkan descending; tim terburuk berwarna merah |
| 6 | Sebagai **SPV**, saya ingin melihat daftar 5 agen dengan temuan terbanyak agar saya bisa menjadwalkan coaching yang tepat sasaran | Tabel top 5 agen tampil dengan jumlah temuan dan skor QA |
| 7 | Sebagai **SPV**, saya ingin klik nama agen di tabel untuk langsung ke halaman detail agen di QA Analyzer | Klik baris navigasi ke `/qa-analyzer` dengan agen tersebut dipilih dan tab Analitik aktif |
| 8 | Sebagai **QA**, saya ingin melihat tren temuan per minggu dalam bulan ini agar saya tahu apakah ada pola di minggu tertentu | Line chart mingguan tampil dengan garis target sebagai referensi |

### Epic 3 — Root Cause Analysis

| # | User Story | Acceptance Criteria |
|---|---|---|
| 9 | Sebagai **Trainer**, saya ingin melihat Pareto Chart agar saya tahu 2-3 kategori parameter yang menyebabkan 80% masalah | Pareto Chart tampil dengan garis kumulatif; anotasi titik 80% |
| 10 | Sebagai **QA**, saya ingin melihat proporsi fatal vs non-fatal error agar saya tahu seberapa serius kondisi kualitas saat ini | Donut chart tampil dengan dua segmen, persentase, dan total di tengah |
| 11 | Sebagai **Trainer**, saya ingin hover pada batang Pareto untuk melihat detail parameter agar saya bisa memahami konteksnya | Tooltip muncul dengan: nama lengkap, jumlah, %, kategori (CR/NC) |

---

## 6. Spesifikasi Layout UI

### 6.1 Struktur Halaman

```
┌─────────────────────────────────────────────────────────────────┐
│  TITLE BAR  │  QA Performance Dashboard  │  [Periode] [Tim] [Ch]│
├─────────────────────────────────────────────────────────────────┤
│  LEVEL 1: EXECUTIVE SUMMARY                                      │
│  [KPI: Total Temuan] [KPI: Avg/Audit] [KPI: Fatal%] [KPI: SOP%] │
├───────────────────────────────────┬─────────────────────────────┤
│  LEVEL 2: TEAM PERFORMANCE        │                             │
│  Weekly Trend Line Chart          │  Team Bar Chart             │
├───────────────────────────────────┴─────────────────────────────┤
│  LEVEL 2: AGENT PERFORMANCE                                      │
│  Top 5 Agents with Highest Findings Table                        │
├───────────────────────────────────┬─────────────────────────────┤
│  LEVEL 3: ROOT CAUSE              │                             │
│  Pareto Chart                     │  Donut: Fatal vs Non-Fatal  │
└───────────────────────────────────┴─────────────────────────────┘
```

### 6.2 KPI Card Component Spec

```tsx
// Struktur setiap KPI Card
interface KpiCardProps {
  label: string;           // "Total Temuan QA"
  value: number | string;  // 125
  delta: number;           // -10 (turun 10% = baik jika reverse)
  target?: string;         // "Target: < 100"
  reverseLogic: boolean;   // true = turun itu baik
  sparklineData: {label: string; value: number}[];
  unit?: string;           // "%" atau undefined
}

// Status calculation (reverse logic)
const getStatus = (delta: number, reverseLogic: boolean) => {
  const isGood = reverseLogic ? delta <= 0 : delta >= 0;
  const isWarning = Math.abs(delta) < 5;
  if (isWarning) return 'warning';  // 🟡
  return isGood ? 'good' : 'critical'; // 🟢 atau 🔴
};
```

Setiap card menggunakan class Tailwind: `bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-200/80 dark:border-white/[0.06] p-5`

### 6.3 Navigasi & Integration

- Tombol **"Dashboard"** ditambahkan di title bar QA Analyzer Index (halaman existing)
- Dari Dashboard, klik nama agen di Top 5 Table → navigate ke QA Analyzer dengan agent pre-selected dan tab Analitik aktif
- Dari Dashboard, klik nama tim di Bar Chart → filter dashboard ke tim tersebut
- Breadcrumb: `Dashboard / [Nama Tim yang dipilih]`
- Back button di Dashboard → kembali ke `/qa-analyzer`

---

## 7. Scope MVP & Roadmap

### 7.1 Definisi MVP

> MVP adalah versi pertama yang dapat segera digunakan oleh QA Officer dan Supervisor untuk membuat keputusan coaching berbasis data. Bukan fitur yang paling lengkap, tapi fitur yang paling berdampak.

### 7.2 Fitur yang MASUK MVP

| # | Fitur | Prioritas | Effort |
|---|---|---|---|
| 1 | Filter global: Periode, Tim/Folder | P0 — Kritis | S |
| 2 | 4 KPI Cards (Total Temuan, Avg per Audit, Fatal Rate, Kepatuhan) | P0 — Kritis | M |
| 3 | Sparkline mini di setiap KPI Card | P1 — Tinggi | M |
| 4 | Delta vs periode sebelumnya di KPI Card | P1 — Tinggi | S |
| 5 | Horizontal Bar Chart: Temuan per Tim | P0 — Kritis | M |
| 6 | Tabel Top 5 Agen dengan Temuan Tertinggi | P0 — Kritis | M |
| 7 | Pareto Chart: Kategori Temuan Terbanyak | P1 — Tinggi | L |
| 8 | Donut Chart: Fatal vs Non-Fatal | P1 — Tinggi | S |
| 9 | Navigasi dari Dashboard ke detail agen | P1 — Tinggi | S |
| 10 | Weekly Trend Line Chart | P2 — Medium | M |
| 11 | Responsive design (mobile-friendly) | P2 — Medium | L |

> Keterangan Effort: **S** = Small (< 1 hari), **M** = Medium (1–2 hari), **L** = Large (2–3 hari)

### 7.3 Fitur yang TIDAK MASUK MVP (Post-MVP)

- Export PDF/PNG dashboard — fase 2
- Email otomatis laporan mingguan ke Supervisor — fase 3
- Threshold alerts (notifikasi jika fatal error rate naik) — fase 3
- Comparison view: bulan ini vs bulan lalu side-by-side — fase 2
- Filter per agen individual dari dashboard — fase 2
- Drill-down klik batang Pareto ke daftar agen terdampak — fase 2
- Custom date range (bukan hanya per periode bulan) — fase 2

### 7.4 Estimasi Pengerjaan MVP

| # | Task | Estimasi | Dependensi |
|---|---|---|---|
| 1 | Setup route baru + layout halaman + filter global | 0.5 hari | — |
| 2 | Fungsi query Supabase baru di `qa-actions.ts` | 1 hari | Task 1 |
| 3 | KPI Cards + sparkline + delta calculation | 1.5 hari | Task 2 |
| 4 | Horizontal Bar Chart per Tim | 1 hari | Task 2 |
| 5 | Top 5 Agents Table + navigasi ke detail | 0.5 hari | Task 2 |
| 6 | Pareto Chart (bar + cumulative line) | 1.5 hari | Task 2 |
| 7 | Donut Chart Fatal vs Non-Fatal | 0.5 hari | Task 2 |
| 8 | Integrasi navigasi, polish UI, testing | 1 hari | Task 3–7 |
| | **TOTAL ESTIMASI MVP** | **7.5 hari kerja** | **~1.5 minggu** |

---

## 8. Non-Functional Requirements

### 8.1 Performa

- Dashboard harus selesai load dalam **< 3 detik** pada koneksi normal (WiFi kantor)
- Saat filter berubah, data harus update dalam **< 1.5 detik**
- Untuk dataset besar (> 500 temuan per periode), gunakan agregasi di sisi Supabase (SQL `GROUP BY`) bukan di sisi React
- Gunakan `useMemo` untuk kalkulasi yang mahal agar tidak dihitung ulang saat re-render tidak relevan

### 8.2 Aksesibilitas & UX

- Semua warna status harus memiliki indikator teks tambahan (tidak hanya warna) agar ramah color-blind
- Tooltip pada setiap grafik harus menampilkan angka dan konteks yang cukup
- Loading state yang konsisten (spinner violet) selama data loading
- Error state dengan pesan yang jelas dan tombol retry
- Empty state yang informatif saat belum ada data untuk periode yang dipilih

### 8.3 Keamanan

- Data Top 5 Agents hanya tampil untuk user dengan role QA atau SPV (implementasi Row Level Security di Supabase jika diperlukan)
- Dashboard tidak mengekspos data agen ke channel publik
- Filter tidak mengizinkan akses ke folder di luar scope yang diizinkan

### 8.4 Konsistensi Desain

- Menggunakan design system yang sama dengan QA Analyzer: `rounded-2xl`, `violet-500` sebagai brand color, dark/light mode toggle
- Font, spacing, dan komponen card harus identik dengan halaman QA Analyzer yang sudah ada
- Badge dan warna status mengikuti pola yang sama dengan `scoreBg()` dan `scoreColor()` yang ada di `qa-types.ts`

---

## 9. Definition of Done & Acceptance Criteria

### 9.1 Definition of Done

Sebuah fitur dinyatakan **DONE** apabila memenuhi semua kriteria berikut:

1. Fungsional sesuai user story dan acceptance criteria yang tertulis
2. Tampil benar di dark mode dan light mode
3. Tidak ada TypeScript error (strict mode)
4. Loading state, error state, dan empty state sudah diimplementasikan
5. Filter global terhubung dan mengubah data secara reaktif
6. Terintegrasi dengan navigasi existing (breadcrumb, back button)

### 9.2 Acceptance Criteria Dashboard

| # | Skenario | Expected Outcome |
|---|---|---|
| AC1 | Buka `/qa-analyzer/dashboard` tanpa filter | 4 KPI cards tampil dengan data periode terbaru; semua tim |
| AC2 | Pilih periode bulan berbeda dari dropdown | Semua komponen update otomatis menampilkan data periode tersebut |
| AC3 | Pilih filter tim tertentu | Data hanya menampilkan agen dari tim yang dipilih |
| AC4 | Hover pada batang Pareto Chart | Tooltip menampilkan nama parameter, jumlah temuan, %, kategori |
| AC5 | Klik nama agen di Top 5 Table | Navigate ke QA Analyzer dengan agen tersebut sudah terpilih dan tab Analitik aktif |
| AC6 | Buka dashboard saat belum ada data temuan | Empty state informatif tampil; bukan blank/error |
| AC7 | Fatal Error Rate naik dari periode sebelumnya | Badge "Kritis" merah; delta menampilkan tanda ▲ merah |
| AC8 | Total Temuan turun dari periode sebelumnya | Badge "Baik" hijau; delta menampilkan tanda ▼ hijau |

---

## 10. Lampiran

### 10.1 Daftar Komponen React yang Perlu Dibuat

```
src/pages/qa-analyzer/
├── QADashboard.tsx           ← Halaman utama, container semua komponen
│
src/components/qa-dashboard/
├── DashboardFilters.tsx      ← Filter global (periode, tim, channel)
├── KpiCard.tsx               ← Reusable card dengan sparkline dan badge status
├── Sparkline.tsx             ← Mini line chart 60×40px menggunakan Recharts
├── TeamBarChart.tsx          ← Horizontal bar chart perbandingan tim
├── TopAgentsTable.tsx        ← Tabel 5 agen dengan temuan terbanyak
├── ParetoChart.tsx           ← Bar chart + cumulative line chart
├── FatalDonutChart.tsx       ← Donut chart fatal vs non-fatal
└── WeeklyTrendChart.tsx      ← Line chart tren mingguan (P2 — post-MVP)
```

### 10.2 Referensi Metrik QA Contact Center

| Metrik | Formula | Logika |
|---|---|---|
| Defect Rate (%) | (Temuan bermasalah / Total parameter diaudit) × 100 | RENDAH = BAIK |
| Fatal Error Rate (%) | (Call dengan nilai 0 Critical / Total call diaudit) × 100 | RENDAH = BAIK |
| Avg Errors Per Call | Total temuan bermasalah / Total call diaudit | RENDAH = BAIK |
| SOP Non-Compliance Count | COUNT(\*) WHERE nilai < 3 per parameter tertentu | RENDAH = BAIK |
| SOP Compliance Rate (%) | (Parameter nilai 3 / Total parameter) × 100 | TINGGI = BAIK ⚠️ |

### 10.3 Pereto Chart — Implementasi Recharts

```tsx
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Data format yang dibutuhkan
interface ParetoItem {
  name: string;       // nama parameter (truncated)
  fullName: string;   // nama lengkap (untuk tooltip)
  count: number;      // jumlah temuan
  cumulative: number; // persentase kumulatif (0–100)
  category: 'critical' | 'non_critical';
}

<ComposedChart data={paretoData}>
  <CartesianGrid strokeDasharray="3 3" vertical={false} />
  <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} />
  <YAxis yAxisId="left" orientation="left" />
  <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickFormatter={v => `${v}%`} />
  <Tooltip formatter={(value, name) => name === 'cumulative' ? `${value}%` : value} />
  <Bar yAxisId="left" dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
  <Line yAxisId="right" dataKey="cumulative" stroke="#ef4444" strokeWidth={2.5}
    dot={{ fill: '#ef4444', r: 4 }} type="monotone" />
</ComposedChart>
```

### 10.4 Changelog

| Versi | Tanggal | Author | Perubahan |
|---|---|---|---|
| 1.0.0 | Maret 2026 | Fajar / Claude | Dokumen PRD awal — MVP scope |
| 1.0.1 | 18 Maret 2026 | Fajar / Claude | Implementasi MVP Selesai (Dashboard, KPI, Pareto, Team Chart, Top Agents) |

---

*Dokumen ini merupakan living document. Update akan dicatat di tabel changelog di atas.*
