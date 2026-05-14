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

## Pencegahan

- Setiap migrasi yang mengubah grants pada tabel dengan RLS aktif harus memastikan policy SELECT yang sesuai tetap ada.
- Static contract test di `tests/access-control/profile-auth-hardening-contracts.test.ts` memverifikasi keberadaan policy SELECT dan normalisasi `get_auth_role()`.

## File Terkait

- `supabase/migrations/20260514230000_fix_profiles_select_rls_policies.sql` — corrective migration
- `supabase/scripts/supabase_rbac_setup.sql` — provisioning script (updated)
- `tests/access-control/profile-auth-hardening-contracts.test.ts` — static contract tests
- `supabase/tests/test_profiles_select_rls_bug.sql` — SQL smoke test (bug condition)
- `supabase/tests/test_profiles_preservation.sql` — SQL smoke test (preservation)
