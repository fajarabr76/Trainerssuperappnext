# Database Schema & Security

Dokumen ini menjelaskan struktur tabel PostgreSQL di Supabase dan kebijakan Row Level Security (RLS) yang diterapkan.

## ER Diagram (Overview)

```mermaid
erDiagram
    PROFILES ||--o{ RESULTS : "performs"
    PROFILES ||--o{ PROFILER_PESERTA : "manages"
    PROFILER_YEARS ||--o{ PROFILER_FOLDERS : "contains"
    PROFILER_FOLDERS ||--o{ PROFILER_FOLDERS : "subfolder"
    PROFILER_FOLDERS ||--o{ PROFILER_PESERTA : "contains"
    QA_PERIODS ||--o{ QA_TEMUAN : "timeframe"
    QA_TEMUAN ||--o{ QA_INDICATORS : "details"
```

## Tabel Utama

### 1. `public.profiles`
Menyimpan data profil user yang terintegrasi dengan `auth.users`.
- `id` (UUID, Primary Key): ID user dari Supabase Auth.
- `email` (Text, Unique): Email user.
- `full_name` (Text): Nama lengkap user.
- `role` (Text): Role user (`admin`, `trainer`, `leader`, `agent`).
- `status` (Text): Status akun (`pending`, `approved`, `rejected`).
- `created_at` (Timestamptz): Timestamp pendaftaran akun.
- `is_deleted` (Boolean): Flag untuk soft delete akun.

**Penting:** Tabel ini **TIDAK** memiliki kolom `avatar_url` atau `updated_at`. Gunakan konstanta `PROFILE_FIELDS` dari `app/lib/authz.ts` untuk canonical auth profile read. Untuk kueri feature-specific, pilih subset kolom yang memang diperlukan, tetapi tetap batasi hanya pada field yang benar-benar ada di skema ini agar tidak terjadi *query failure*.

### 2. `public.results`
Menyimpan hasil simulasi dari modul Ketik, PDKT, dan Telefun.
- `user_id` (UUID): Referensi ke `profiles`.
- `module` (Text): Nama modul.
- `score` (Integer): Skor hasil simulasi.
- `feedback` (Text): Saran perbaikan dari AI/System.
- `history` (JSONB): Log interaksi selama simulasi.

### 3. Modul Profiler (KTP)
- **`profiler_years`**: Daftar tahun database.
- **`profiler_folders`**: Batch atau grup peserta (mendukung struktur folder bertingkat).
- **`profiler_peserta`**: Data detail peserta (NIK, Alamat, Foto, dll).
- **`profiler_tim_list`**: Daftar tim operasional yang tersedia.

### 4. Modul SIDAK (QA Analyzer)
- **`qa_periods`**: Definisi periode audit kualitas.
- **`qa_temuan`**: Data utama audit (Agent, Tim, Temuan, Status).
- **`qa_indicators`**: Daftar parameter penilaian audit.
- **`qa_categories`**: Pengelompokan indikator temuan (Pareto mapping).

### 5. Monitoring AI Usage & Billing
- **`ai_usage_logs`**: Log 1 baris per AI call sukses final. Menyimpan `request_id` unik, `user_id`, `provider`, `model_id`, `module`, `action`, token input/output/total, snapshot harga input/output per 1 juta token, snapshot kurs USD/IDR, serta estimasi biaya USD dan IDR.
- **`ai_pricing_settings`**: Harga token input/output per model kanonik. Lookup model mengikuti normalisasi `normalizeModelId()` agar alias lama tetap jatuh ke pricing yang benar.
- **`ai_billing_settings`**: Riwayat nilai kurs global USD ke IDR. Request baru memakai kurs terbaru saat request terjadi, sementara histori lama tetap memakai snapshot kurs yang sudah tersimpan di `ai_usage_logs`.

**Catatan Kontrak Billing:**
- Histori biaya tidak dihitung ulang dari setting terbaru. Snapshot harga dan kurs disimpan langsung pada row usage.
- Request gagal, timeout, atau 429 final tidak boleh membuat row usage baru.
- Jika provider tidak mengembalikan metadata token atau pricing model belum tersedia, flow user tetap lanjut tetapi usage tidak dicatat.
- Akses monitoring lintas akun dilakukan server-side dengan `createAdminClient()`, bukan direct browser read.

## Keamanan Data (RLS Policies)

RLS diaktifkan di seluruh tabel untuk memastikan isolasi data antar user.

| Tabel | Role: Agent | Role: Leader | Role: Trainer/Admin |
|---|---|---|---|
| `profiles` | Read (Own) | Read (All) | Read/Write (All) |
| `results` | Read/Write (Own) | Read (Team) | Read/Update (All) |
| `profiler_*` | No Access | Read (All) | Full CRUD Access |
| `qa_*` | Read (Own/Summary) | Read (Team) | Full CRUD Access |

**Catatan Monitoring AI Usage:**
- `leader` hanya mendapatkan visibilitas usage monitoring dari server action yang sudah di-gate role.
- Editor pricing dan kurs hanya tersedia untuk `trainer` dan `admin`.
- Kontrak akses aplikasi untuk permukaan monitoring dijelaskan lebih detail di `docs/auth-rbac.md` dan `docs/MONITORING_TOKEN_USAGE_BILLING.md`.

### Fungsi Pembantu (Security Definer)
Sistem menggunakan fungsi `public.get_auth_role()` untuk mengambil role user saat ini secara efisien tanpa menyebabkan rekursi pada kebijakan RLS.

## Storage
Aplikasi menggunakan Supabase Storage bucket:
- `profiler-foto`: Menyimpan foto aset peserta (KTP/Profiler).
- `qa-reports`: (Opsional) Tempat penyimpanan dokumen laporan yang di-generate.
