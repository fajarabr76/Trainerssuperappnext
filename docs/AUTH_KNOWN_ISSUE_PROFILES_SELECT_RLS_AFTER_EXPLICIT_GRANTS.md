# Known Issue: Profiles SELECT RLS Blocking After Explicit Grants

## Ringkasan

Setelah migrasi `20260514000000_explicit_public_data_api_grants.sql` diterapkan, semua user authenticated mendapati redirect ke `/waiting-approval` meskipun akun sudah `approved`. Ini terjadi karena query `SELECT` ke tabel `public.profiles` mengembalikan 0 baris, menyebabkan middleware mendeteksi "Ghost Profile".

## Timeline

| Tanggal | Kejadian |
|---|---|
| 14 Mei 2026 | `20260514000000_explicit_public_data_api_grants.sql` di-deploy |
| 14 Mei 2026 | Login regression terdeteksi — semua user redirected ke `/waiting-approval` |
| 14 Mei 2026 | `20260514230000_fix_profiles_select_rls_policies.sql` dibuat dan siap deploy |

## Akar Masalah

PostgreSQL RLS memiliki dua lapisan kontrol akses:

1. **Table-level grant** — mengizinkan koneksi Data API mengakses tabel (misal: `GRANT SELECT ON profiles TO authenticated`).
2. **Row-Level Security policy** — mendefinisikan baris mana yang boleh dibaca oleh user tertentu.

Kedua lapisan harus ada. Migrasi `20260514000000` menyediakan lapisan 1 (table grant) untuk `profiles` tetapi tidak menyediakan lapisan 2 (RLS SELECT policy). Akibatnya, semua query SELECT dari user authenticated mengembalikan 0 baris.

Selain itu, tiga masalah ikut memperparah:

1. **EXECUTE pada `get_auth_role()` direvoke**: Migrasi `20260514000000` merevoke EXECUTE pada semua fungsi public dari `authenticated`. Fungsi `get_auth_role()` yang dipakai oleh policy SELECT (jika ada) tidak bisa dijalankan.
2. **Case-sensitive comparison**: Policy SELECT yang ada di setup script menggunakan `get_auth_role() = 'Trainer'` (huruf besar), sementara role disimpan sebagai `'trainer'` (huruf kecil) setelah migrasi `20260417110001`.
3. **Tidak ada admin policy**: Setup script tidak memiliki policy untuk role `admin`.

## Solusi

Migrasi `20260514230000_fix_profiles_select_rls_policies.sql`:

1. **`get_auth_role()` diperbaiki**:
   - Mengembalikan `lower(coalesce(role, ''))` — selalu lowercase, aman untuk NULL.
   - Ditandai `SECURITY DEFINER STABLE SET search_path = public, pg_temp`.
   - EXECUTE hanya untuk `authenticated` dan `service_role`; `PUBLIC` dan `anon` direvoke.

2. **SELECT policies dibuat**:
   - `"Users can view own profile"`: `auth.uid() = id`
   - `"Admins can view all profiles"`: `get_auth_role() = 'admin'`
   - `"Trainers can view all profiles"`: `get_auth_role() IN ('trainer', 'trainers')`
   - `"Leaders can view all profiles"`: `get_auth_role() = 'leader'`

## Follow-up Bug: Stale RLS Policy Mereferensikan `get_my_role()` (15 Mei 2026)

Setelah fix `20260514230000` diterapkan, semua user masih stuck di `/waiting-approval`. Akar masalah tambahan:

- Migration `20260514000000` juga merevoke EXECUTE pada legacy function `get_my_role()` dari `authenticated`.
- Stale RLS policy `profiles_select_policy` masih mereferensikan `get_my_role()` di USING clause.
- PostgreSQL mengevaluasi SEMUA RLS policies (OR logic). Error dari satu policy menyebabkan seluruh query gagal.
- Safety sweep menemukan 12 stale policies lain di berbagai tabel yang juga mereferensikan `get_my_role()`.

**Fix:** Migration `20260515000000_drop_stale_rls_policies_and_legacy_functions.sql`:
1. DROP semua stale policies yang mereferensikan `get_my_role()` di semua tabel.
2. DROP legacy functions `get_my_role()` dan `get_my_status()` (tidak digunakan di codebase).
3. Verifikasi 6 valid policies tetap intact.
4. Verifikasi `get_auth_role()` EXECUTE untuk authenticated tetap ada.

## Pencegahan

- Setiap migrasi yang mengubah grants pada tabel dengan RLS aktif harus memastikan policy SELECT yang sesuai tetap ada.
- Setiap migrasi yang merevoke function EXECUTE harus memeriksa apakah ada stale policies yang mereferensikan fungsi tersebut.
- Static contract test di `tests/access-control/profile-auth-hardening-contracts.test.ts` memverifikasi keberadaan policy SELECT dan normalisasi `get_auth_role()`.

## File Terkait

- `supabase/migrations/20260514230000_fix_profiles_select_rls_policies.sql` — corrective migration (round 1)
- `supabase/migrations/20260515000000_drop_stale_rls_policies_and_legacy_functions.sql` — corrective migration (round 2: stale policy cleanup)
- `supabase/rollback/20260515000000_drop_stale_rls_policies_and_legacy_functions.down.sql` — rollback
- `supabase/scripts/supabase_rbac_setup.sql` — provisioning script (updated)
- `supabase/tests/exploration_stale_rls_policy.sql` — bug condition exploration test
- `supabase/tests/preservation_profiles_policies.sql` — preservation property tests
- `tests/access-control/profile-auth-hardening-contracts.test.ts` — static contract tests
- `supabase/tests/test_profiles_select_rls_bug.sql` — SQL smoke test (bug condition)
- `supabase/tests/test_profiles_preservation.sql` — SQL smoke test (preservation)

## Timeline

| Tanggal | Kejadian |
|---|---|
| 14 Mei 2026 | `20260514000000_explicit_public_data_api_grants.sql` di-deploy |
| 14 Mei 2026 | Login regression terdeteksi — semua user redirected ke `/waiting-approval` |
| 14 Mei 2026 | `20260514230000_fix_profiles_select_rls_policies.sql` dibuat dan di-deploy |
| 15 Mei 2026 | Login masih broken — stale policy `profiles_select_policy` masih refer `get_my_role()` |
| 15 Mei 2026 | `20260515000000_drop_stale_rls_policies_and_legacy_functions.sql` di-deploy — fix complete
