# Final Plan: RLS Policy Fix Pasca Explicit Grants

Dokumen ini adalah versi tracked (tidak berada di folder ignored) agar review dan histori perubahan bisa masuk commit normal.

## Goal

Buat RLS policies untuk tabel yang sudah RLS-enabled (oleh `20260514000000`) tapi belum punya policy. Sekaligus memperbaiki transitive break pada `ketik_history` dengan role contract yang eksplisit.

## Scope Implementasi

- `supabase/migrations/20260515010000_fix_remaining_rls_policies_after_explicit_grants.sql`
- `supabase/rollback/20260515010000_fix_remaining_rls_policies_after_explicit_grants.down.sql`
- `supabase/tests/test_remaining_rls_policies_after_explicit_grants.sql`
- `tests/supabase/rls-policies-after-explicit-grants-contracts.test.ts`
- `docs/database.md`
- `docs/SUPABASE_DATA_API_GRANTS_CHANGELOG_2026-05-14.md`

## Tasklist Eksekusi

- [x] Gunakan timestamp migrasi final `20260515010000`.
- [x] Tambahkan helper SECURITY DEFINER untuk scope leader (`leader_has_scope_value`, `leader_can_access_peserta`, `leader_can_access_sidak_temuan`).
- [x] Terapkan policy per role contract pada 11 tabel target.
- [x] Pastikan `qa_temuan` agent policy berbasis `peserta_id` (bukan kolom yang tidak ada).
- [x] Pastikan `qa_periods` dan `qa_indicators` punya `INSERT/UPDATE/DELETE` untuk trainer/admin.
- [x] Tambahkan `DELETE own` pada `ketik_history` dan `pdkt_history`.
- [x] Hindari duplikasi policy untuk access-group tables yang sudah ada.
- [x] Siapkan rollback migration yang membalikkan policy/helper migration ini.
- [x] Tambahkan/validasi SQL smoke test dan static contract test Supabase.
- [x] Update dokumentasi database dan changelog explicit grants.

## Catatan Validasi

- SQL smoke terhadap database real/local tetap membutuhkan migration sudah diterapkan ke target DB.
- Static contracts dan linting tetap wajib dijalankan di CI/locally sebelum merge.
