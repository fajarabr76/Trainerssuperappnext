# Supabase Data API Grants Mitigation Task Plan

## Summary

Live audit via Supabase CLI menunjukkan masalah nyata: hampir semua public table masih punya broad grants (`anon_select=true`, authenticated CRUD true), sementara beberapa table seperti `ai_*`, `qa_dashboard_*_summary`, dan backup tables punya `policy_count=0`. Mitigasi utama bukan sekadar menambah grant, tapi merapikan grant supaya explicit, aman, dan tetap kompatibel dengan RLS.

## Status Live Audit
Berdasarkan query audit read-only, berikut adalah snapshot tabel dan fungsi di skema `public` saat ini:
- **Tabel terdampak**: `access_group_items`, `access_groups`, `activity_logs`, `ai_billing_settings`, `ai_pricing_settings`, `ai_usage_logs`, `ketik_history`, `ketik_personas`, `ketik_review_jobs`, `ketik_scenarios`, `ketik_session_reviews`, `ketik_typo_findings`, `leader_access_request_groups`, `leader_access_requests`, `pdkt_history`, `pdkt_mailbox_items`, `pdkt_scenarios`, `profiler_folders`, `profiler_peserta`, `profiler_tim_list`, `profiler_years`, `profiles`, `qa_dashboard_agent_period_summary`, `qa_dashboard_indicator_period_summary`, `qa_dashboard_period_summary`, `qa_findings`, `qa_indicators`, `qa_indicators_backup`, `qa_periods`, `qa_service_rule_indicators`, `qa_service_rule_versions`, `qa_service_weights`, `qa_temuan`, `qa_temuan_backup`, `reports`, `results`, `security_rate_limits`, `telefun_history`, `user_settings`.
- **Fungsi/RPC terdampak**: `_qa_session_scores`, `bulk_reorder_profiler_peserta`, `consume_rate_limit`, `fill_tahun_from_period`, `get_agent_list_with_scores`, `get_auth_role`, `get_leader_approved_scope_items`, `get_my_role`, `get_my_status`, `get_qa_agent_directory_summary`, `get_qa_dashboard_data`, `get_qa_dashboard_range_data`, `get_qa_dashboard_range_trend_data`, `get_qa_trend_data`, `get_service_trend_dashboard`, `get_upcoming_birthdays`, `handle_new_user`, `handle_pdkt_mailbox_updated_at`, `is_approved_trainer`, `is_super_admin`, `log_ketik_activity`, `log_pdkt_activity`, `log_telefun_activity`, `prevent_self_role_status_change`, `publish_rule_version`, `qa_score_agent`, `refresh_qa_dashboard_summary_for_period`, `rls_auto_enable`, `submit_pdkt_mailbox_batch`, `submit_pdkt_mailbox_reply`, `update_updated_at`, `update_updated_at_column`.

## Task Checklist

### Task 0: Preflight Dan Snapshot
- [x] Jalankan `git status --short`; pastikan tidak ada perubahan tak terkait.
- [x] Jalankan CLI health check.
- [x] Jika muncul `ECIRCUITBREAKER`, berhenti retry manual dan tunggu cooldown sebelum query lagi.
- [x] Simpan hasil read-only audit table/function ke catatan kerja lokal, tanpa mencetak token.

### Task 1: Buat Tracking Artifact
- [x] Buat `plan/2026-05-14-supabase-data-api-grants.md`.
- [x] Isi dengan checklist task ini, status live audit, daftar table/function terdampak, dan command verifikasi.
- [ ] Jangan commit file plan jika user nanti minta code-only commit; kalau user minta tracking masuk repo, commit bersama docs.

### Task 2: Tambah Static Contract Test
- [x] Buat `tests/supabase/public-data-api-grants.test.ts`.
- [x] Test harus scan `.from('...')` di `app/` dan `apps/`, exclude Storage buckets `profiler-foto` dan `telefun-recordings`.
- [x] Test harus scan `.rpc('...')` dan mengunci daftar RPC: `bulk_reorder_profiler_peserta`, `consume_rate_limit`, `get_leader_approved_scope_items`, `get_qa_agent_directory_summary`, `get_qa_dashboard_data`, `get_qa_dashboard_range_data`, `get_qa_dashboard_range_trend_data`, `get_service_trend_dashboard`, `publish_rule_version`, `refresh_qa_dashboard_summary_for_period`, `submit_pdkt_mailbox_batch`, `submit_pdkt_mailbox_reply`.
- [x] Test harus gagal jika ada `GRANT ... TO anon` untuk application tables.
- [x] Test harus memastikan `profiles` tidak mendapat broad authenticated update; hanya `UPDATE (full_name)`.
- [x] Jalankan vitest run.

### Task 3: Hilangkan Kebutuhan `anon` Ke `profiles`
- [x] Ubah `app/components/AuthModal.tsx`.
- [x] Hapus pre-check register yang membaca `profiles` berdasarkan email sebelum `signUp`.
- [x] Biarkan `signUp` menjadi sumber kebenaran duplicate email.
- [x] Setelah `signUp`, insert `profiles` sebagai authenticated user.
- [x] Gunakan pesan generic untuk duplicate/pending/rejected agar tidak membuka email/profile enumeration.
- [x] Update `tests/access-control/profile-auth-hardening-contracts.test.ts`.

### Task 4: Migration Explicit Grants Dan RLS
- [x] Buat `supabase/migrations/20260514000000_explicit_public_data_api_grants.sql`.
- [x] Revoke broad grants dari `anon` dan `public` untuk semua app tables.
- [x] Revoke broad authenticated privileges dari service-only tables.
- [x] Terapkan table grants eksplisit sesuai spesifikasi.
- [x] Enable/add policies for tables currently policy-less but app-relevant.
- [x] Use `to_regclass(...) IS NOT NULL` guards.

### Task 5: Function/RPC Grants
- [x] Revoke execute dari `public` dan `anon` untuk semua app RPCs.
- [x] Grant `authenticated` execute untuk user-facing RPCs.
- [x] Grant `service_role` execute untuk semua app RPCs.
- [x] Keep `consume_rate_limit` service_role-only.
- [x] Treat `get_service_trend_dashboard` as legacy optional.

### Task 6: Rollback
- [x] Buat `supabase/rollback/20260514000000_explicit_public_data_api_grants.down.sql`.
- [x] Rollback hanya revoke grants/drop policies yang migration ini tambahkan.
- [x] Jangan disable RLS di rollback.

### Task 7: Update Provisioning Scripts
- [x] Update `supabase/scripts/supabase_rbac_setup.sql`.
- [x] Update `supabase/scripts/supabase-profiler-schema.sql`.
- [x] Patch section setelah RLS enable block.

### Task 8: Documentation
- [x] Update `docs/database.md`.
- [x] Buat `docs/SUPABASE_DATA_API_GRANTS_CHANGELOG_2026-05-14.md`.
- [x] Update `docs/README.md`.
- [x] Update `AGENTS.md`.

### Task 9: Local Verification
- [x] Jalankan verifikasi test, lint, type-check, diff check.

### Task 10: Staging/Live Verification
- [x] Apply migration `20260514120000_fix_qa_summary_refresh_security_definer.sql` ke linked Supabase project.
- [x] Jalankan live audit untuk memastikan `refresh_qa_dashboard_summary_for_period.prosecdef = true`.
- [x] Smoke test SIDAK mutation yang memanggil summary refresh.
- [x] Local verification sudah selesai: targeted vitest, lint, dan type-check.

Catatan: Migration `20260514120000` berhasil di-apply ke remote pada 14 Mei 2026. `security_definer = true` terverifikasi via live audit. Sebelumnya, 18 intermediate migrations yang sudah ada di local tetapi belum tercatat di remote ditandai via `supabase migration repair --status applied`.
