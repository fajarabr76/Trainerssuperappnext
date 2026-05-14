# Catatan Perubahan Keamanan Database: Hak Akses Data API Eksplisit (14 Mei 2026)

Dokumen ini mendokumentasikan pembaruan penting pada arsitektur keamanan database Trainers SuperApp untuk beralih dari model hak akses bawaan yang terbuka ke model akses eksplisit (Deny-by-Default).

---

## 🌟 Ringkasan untuk Pengguna Umum dan Manajemen (Human-Readable Summary)

### Apa Perubahan yang Terjadi?
Sebelumnya, sistem database kami memiliki pintu depan yang cukup terbuka bagi siapa saja yang mengetahui alamat Supabase kami, meskipun mereka masih harus melewati verifikasi data di setiap barisnya. Kini, kami telah memasang **gerbang pengaman berlapis** di depan seluruh tabel dan fungsi. Tanpa otentikasi (masuk akun) yang sah, pihak luar bahkan tidak dapat mencoba mengetuk atau melihat keberadaan tabel aplikasi.

### Kegunaan dan Manfaat Utama:
1. **Pencegahan Penyalahgunaan Akses:** Mencegah program otomatis (*bots*) atau pihak tak bertanggung jawab memanfaatkan hak akses publik untuk memindai, menebak, atau menarik data sensitif dari sistem.
2. **Kerahasiaan Alamat Email Pengguna:** Alur pendaftaran akun kini menggunakan respons standar yang seragam untuk semua skenario. Hal ini menutup celah bagi pihak luar yang mencoba mencari tahu apakah email tertentu sudah terdaftar di Trainers SuperApp.
3. **Pemisahan Jalur Komunikasi:** Data internal untuk pemantauan sistem (seperti log penggunaan AI dan pengaturan tarif) kini ditempatkan di ruang kedap yang hanya dapat diakses langsung oleh server kami. Klien di peramban web sama sekali tidak memiliki akses ke ruang tersebut.

---

## 🛠️ Rincian Teknis untuk Pengembang dan Agen AI (Technical Implementation Details)

### 1. Hardening Alur Otentikasi (Auth Modal)
- **Penghapusan Kueri Profil Klien:** Menghapus pengecekan keberadaan profil (`from('profiles').select()`) yang dijalankan sebelum proses pendaftaran di `AuthModal.tsx`.
- **Mitigasi Enumerasi Email:** Mengubah pesan umpan balik pada saat pendaftaran menjadi pesan sukses generik, baik saat pendaftaran baru berhasil, profil duplikat dengan status *pending/rejected*, maupun kegagalan pengiriman email konfirmasi.

### 2. Pencabutan Hak Akses Luas (Revocation of Broad Grants)
Menjalankan migrasi SQL `20260514000000_explicit_public_data_api_grants.sql` untuk:
- Mencabut seluruh hak akses bawaan (`REVOKE ALL ON ... FROM authenticated, anon, public`) di semua tabel aplikasi utama untuk memastikan status bersih dari kebocoran hak akses.
- Mencabut secara eksplisit akses peran `authenticated` pada tabel-tabel khusus layanan internal (seperti `ai_usage_logs`, `ai_billing_settings`, dan tabel *backup*) guna mencegah eskalasi hak akses.
- Menutup celah eksekusi fungsi jarak jauh (`REVOKE EXECUTE ON FUNCTION ... FROM authenticated, public, anon`) pada seluruh fungsi publik internal dan hanya membuka akses pada daftar spesifik Remote Procedure Call (RPC) klien.

### 3. Pemberian Hak Akses Terperinci (Granular Explicit Grants)
- **Tabel Aplikasi Klien:** Memberikan izin `SELECT`, `INSERT`, `UPDATE`, atau `DELETE` secara ketat kepada peran `authenticated` sesuai dengan kebutuhan fungsional.
- **Kolom Sensitif:** Membatasi pembaruan profil di sisi klien hanya pada kolom `full_name`.
- **Tabel Ringkasan Dasbor:** Memberikan hak akses `SELECT` dan `DELETE` kepada peran `authenticated` pada tabel ringkasan dasbor SIDAK (`qa_dashboard_*_summary`) untuk mendukung alur invalidasi *cache* di lapisan logika aplikasi.
- **Tabel Tertutup (Zero Client Access):** Tabel layanan seperti `ai_usage_logs` dan sejenisnya tidak memiliki *grant* apa pun untuk peran `authenticated` maupun `anon` (hanya `service_role`).

### 4. Pelengkap Kebijakan RLS (RLS Coverage Completion)
Menambahkan kebijakan RLS yang aman secara idempoten (menggunakan mekanisme `DROP POLICY IF EXISTS` dan `to_regclass`) pada tabel ringkasan dasbor:
- `qa_dashboard_period_summary` (mendukung `SELECT` dan `DELETE` untuk pengguna terotentikasi)
- `qa_dashboard_indicator_period_summary` (mendukung `SELECT` dan `DELETE` untuk pengguna terotentikasi)
- `qa_dashboard_agent_period_summary` (mendukung `SELECT` dan `DELETE` untuk pengguna terotentikasi)

### 5. Follow-up: SIDAK Summary Refresh RPC Guard

Migration lanjutan `20260514120000_fix_qa_summary_refresh_security_definer.sql` disiapkan untuk membuat RPC `refresh_qa_dashboard_summary_for_period` berjalan sebagai `SECURITY DEFINER`, tanpa membuka `INSERT` langsung ke tabel `qa_dashboard_*_summary`.

Guard yang wajib ada:
- `SET search_path = public, pg_temp`.
- `p_folder_key` dikunci ke `__ALL__`.
- Caller non-`service_role` harus memiliki profil aktif dengan role `trainer`, `trainers`, atau `admin`.
- Profil caller harus `status = approved` dan `is_deleted = false`.

Status saat ini: migration sudah diterapkan ke remote Supabase pada 14 Mei 2026, dengan `security_definer = true` terverifikasi via live query (`pg_proc.prosecdef`).

#### Deployment ke Remote

Gunakan `supabase db push`, bukan `supabase migration up` (yang default ke local database tanpa `--linked`):

```bash
# Dry-run untuk review
npx supabase db push --dry-run

# Apply ke linked Supabase project
npx supabase db push
```

> **Catatan:** Jika ada migrasi lokal yang belum tercatat di remote, gunakan `supabase migration repair --status applied <version>` untuk menandainya sebagai sudah dijalankan sebelum `supabase db push`.

#### Audit Post-Deploy

Setelah apply, verifikasi dengan query berikut:

```sql
select p.proname, p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'refresh_qa_dashboard_summary_for_period';
```

Expected: `security_definer = true`.

Hasil live audit: ✅ `security_definer = true` terverifikasi.

### 6. Kontrak Pengujian Otomatis (Static Security Contracts)
- Mengembangkan `tests/access-control/profile-auth-hardening-contracts.test.ts` untuk memverifikasi secara statis bahwa komponen UI dan API tidak lagi melakukan pembacaan tabel `profiles` secara tidak terotentikasi atau tanpa perlindungan.
- Mengembangkan `tests/supabase/public-data-api-grants.test.ts` untuk memastikan tidak ada tabel baru yang terbuka tanpa disengaja di masa depan.
- Contract test untuk `20260514120000` memverifikasi adanya guard folder key, auth.role() bypass, profile role/status/is_deleted checks, dan tidak adanya INSERT grant untuk authenticated.

### 7. Follow-up: Login Regression — Missing Profiles SELECT RLS Policies

**Migrasi:** `20260514230000_fix_profiles_select_rls_policies.sql`

**Masalah:** Migrasi `20260514000000` melakukan `REVOKE ALL ON public.profiles FROM authenticated, anon, public` lalu `GRANT SELECT, INSERT ON public.profiles TO authenticated`. Namun, setelah RLS diaktifkan, **table grant SELECT saja tidak cukup** — PostgreSQL RLS membutuhkan policy SELECT yang eksplisit agar baris dapat dibaca. Tanpa policy SELECT, semua query authenticated ke `profiles` mengembalikan 0 baris, menyebabkan middleware mendeteksi "Ghost Profile" dan me-redirect semua user ke `/waiting-approval`.

**Akar Masalah:**
1. SELECT policies untuk `profiles` hanya ada di `supabase/scripts/supabase_rbac_setup.sql` (setup script), bukan di migrasi mana pun.
2. `get_auth_role()` menggunakan perbandingan case-sensitive ('Trainer' vs 'trainer').
3. `get_auth_role()` EXECUTE direvoke dari `authenticated` oleh migrasi `20260514000000`.
4. Tidak ada admin-specific SELECT policy yang pernah ada.

**Perbaikan:**
1. `get_auth_role()` direcreate dengan `SECURITY DEFINER STABLE SET search_path = public, pg_temp` dan mengembalikan `lower(coalesce(role, ''))`.
2. `REVOKE ALL ON FUNCTION public.get_auth_role() FROM PUBLIC, anon` lalu `GRANT EXECUTE` ke `authenticated` dan `service_role`.
3. Empat SELECT policies dibuat di `profiles`: own-profile, admin-all, trainer-all, leader-all, semuanya scoped `TO authenticated`.

**Detail selengkapnya:** `docs/AUTH_KNOWN_ISSUE_PROFILES_SELECT_RLS_AFTER_EXPLICIT_GRANTS.md`

### 9. Follow-up: Remaining RLS Policies for 11 Tables Missing After Grant Migration

**Migrasi:** `20260515010000_fix_remaining_rls_policies_after_explicit_grants.sql`

**Masalah:** Migration `20260514000000` mengaktifkan RLS pada 33+ tabel dan merevoke semua grants, namun 11 tabel aplikasi tidak memiliki satupun `CREATE POLICY` di migrasi mana pun. Tanpa RLS policy, semua query authenticated ke tabel-tabel ini mengembalikan 0 baris (RLS default-deny). Termasuk `ketik_history` yang merupakan transitive dependency bagi `ketik_session_reviews`, `ketik_typo_findings`, dan `ketik_review_jobs`.

**Perbaikan:**
1. Membuat 3 fungsi helper SECURITY DEFINER untuk RLS-scoped leader access:
   - `leader_has_scope_value(p_module, p_field_name, p_field_value)` — cek scope item via `get_leader_approved_scope_items`
   - `leader_can_access_peserta(p_peserta_id, p_module)` — cek akses peserta via scope (peserta_id, batch_name, tim)
   - `leader_can_access_sidak_temuan(p_peserta_id, p_service_type)` — cek akses temuan SIDAK via peserta + optional service_type scope
2. Menambahkan RLS policies ke 11 tabel sesuai role contract:
   - `activity_logs`: all authenticated INSERT, trainer/admin SELECT/DELETE
   - `ketik_history`: user SELECT/INSERT/UPDATE/DELETE own, service_role ALL
   - `pdkt_history`: user SELECT/INSERT/UPDATE/DELETE own, service_role ALL
   - `user_settings`: user ALL own
   - `profiler_years`: trainer/admin ALL, leader SELECT with approved KTP scope
   - `profiler_folders`: trainer/admin ALL, leader SELECT via `leader_has_scope_value('ktp', 'batch_name', name)`
   - `profiler_tim_list`: trainer/admin ALL, leader SELECT via `leader_has_scope_value('ktp', 'tim', nama)`
   - `profiler_peserta`: trainer/admin ALL, leader SELECT via `leader_can_access_peserta(id, 'ktp')`
   - `qa_periods`: all authenticated SELECT, trainer/admin INSERT/UPDATE/DELETE
   - `qa_indicators`: all authenticated SELECT, trainer/admin INSERT/UPDATE/DELETE
   - `qa_temuan`: trainer/admin ALL, leader SELECT via `leader_can_access_sidak_temuan(peserta_id, service_type)`, agent SELECT own via `profiler_peserta.email_ojk = profiles.email`

**Tabel yang TIDAK disentuh (policies sudah ada di migrasi sebelumnya):**
`profiles`, `results`, `telefun_history`, `pdkt_mailbox_items`, `ketik_review_jobs`, `ketik_session_reviews`, `ketik_typo_findings`, `access_groups`, `access_group_items`, `leader_access_requests`, `leader_access_request_groups`, dashboard summary, reports, AI billing/usage, storage.

**Perbedaan dari versi sebelumnya (v2 plan):**
- `qa_temuan` agent policy menggunakan `peserta_id`, bukan `agent_id`
- `ketik_history` dan `pdkt_history` mendapat DELETE own policy (UI punya clear/delete history)
- `qa_periods` dan `qa_indicators` mendapat trainer INSERT/UPDATE/DELETE (tidak hanya SELECT)
- Access-group tables TIDAK dibuat ulang (policies sudah ada di `20260502133224`)
- Leader policies menggunakan RLS-scoped helper, bukan SELECT-all

### 8. Follow-up: Stale RLS Policy — Legacy `get_my_role()` Function

**Migrasi:** `20260515000000_drop_stale_rls_policies_and_legacy_functions.sql`

**Masalah:** Meskipun fix round 1 (`20260514230000`) sudah membuat SELECT policies yang benar, semua user masih stuck di `/waiting-approval`. Penyebabnya adalah stale RLS policy `profiles_select_policy` yang masih mereferensikan legacy function `get_my_role()` di USING clause. Karena migration `20260514000000` merevoke EXECUTE dari semua public functions untuk `authenticated`, `get_my_role()` tidak bisa dijalankan. PostgreSQL mengevaluasi SEMUA RLS policies — jika SATU policy error, SELURUH query gagal.

**Akar Masalah:**
1. Stale policy `profiles_select_policy` menggunakan `get_my_role()` — legacy function yang tidak ada di migration files.
2. `get_my_role()` kehilangan EXECUTE permission (direvoke oleh `20260514000000`).
3. PostgreSQL OR logic: error propagasi dari satu policy membatalkan seluruh query.

**Perbaikan:**
1. DROP stale policy `profiles_select_policy` dan 12 stale policies lain di berbagai tabel yang juga mereferensikan `get_my_role()`.
2. DROP legacy functions `get_my_role()` dan `get_my_status()` — tidak digunakan di codebase.
3. Verifikasi 6 valid policies (SELECT/INSERT/UPDATE) tetap intact.
4. Verifikasi `get_auth_role()` EXECUTE untuk authenticated tetap ada.

**Pencegahan ke depan:**
- Setiap migrasi yang merevoke function EXECUTE harus memeriksa apakah ada stale policies yang mereferensikan fungsi tersebut.
- Safety sweep query `pg_policies` sebelum deployment migration permission changes.

**Detail selengkapnya:** `docs/AUTH_KNOWN_ISSUE_PROFILES_SELECT_RLS_AFTER_EXPLICIT_GRANTS.md`
