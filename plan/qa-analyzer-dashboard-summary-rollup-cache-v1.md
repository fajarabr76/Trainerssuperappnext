# QA Analyzer Dashboard Summary Rollup + Cache v1

## Status

- Selesai (v1 implemented)
- Fixes applied: stale summary cleanup, serviceData completeness validation, proper Supabase error handling

## Ringkasan

Dashboard QA/SIDAK di Trainers Superapp sudah lebih baik dari raw-loop penuh karena route dashboard memakai RPC + `unstable_cache`. Namun fallback TypeScript masih bisa membaca `qa_temuan` besar, dan RPC existing masih membangun temp table dari raw rows setiap cache miss.

V1 ini menambahkan lapisan summary yang durable untuk KPI dashboard, Pareto/trend, dan top agents, lalu mempertahankan response shape yang sudah dipakai frontend. Tujuannya bukan mengubah business logic, tetapi memindahkan beban hitung ke summary layer yang lebih stabil untuk data operasional yang terus tumbuh.

## Kondisi Saat Ini

- `app/(main)/qa-analyzer/dashboard/page.tsx` memanggil `qaServiceServer.getDashboardRangeData()` dan `getDashboardRangeTrendData()`.
- `app/(main)/qa-analyzer/services/qaService.server.ts` sudah memakai `unstable_cache` dan RPC `get_qa_dashboard_range_data` / `get_qa_dashboard_range_trend_data`, tetapi fallback-nya masih paginate raw `qa_temuan`.
- Migration existing sudah punya versioned rules (`rule_version_id`, `rule_indicator_id`) dan logic scoring yang bergantung pada session grouping per periode.
- Belum ada tabel summary/materialized view khusus dashboard.

## Perubahan Utama

- Tambahkan 3 tabel summary:
  - `qa_dashboard_period_summary`
  - `qa_dashboard_indicator_period_summary`
  - `qa_dashboard_agent_period_summary`
- Pakai key utama `period_id`, `service_type`, dan `folder_key`.
  - Gunakan sentinel `folder_key = '__ALL__'` untuk scope global.
  - Hindari desain yang bergantung pada `NULL` sebagai key unik utama.
- Simpan data snapshot yang cukup untuk parity:
  - period summary: `total_agents`, `total_defects`, `avg_defects_per_audit`, `zero_error_count`, `zero_error_rate`, `avg_agent_score`, `compliance_count`, `compliance_rate`, `critical_count`, `non_critical_count`
  - indicator summary: `indicator_key`, `rule_indicator_id`, `legacy_indicator_id`, `indicator_name`, `indicator_category`, `total_defects`
  - agent summary: `peserta_id`, `nama`, `tim`, `batch_name`, `jabatan`, `defects`, `session_count`, `session_scores`, `score`, `has_critical`
- Tambahkan rebuild RPC/server helper:
  - `refresh_qa_dashboard_summary_for_period(period_id)`
  - optional range wrapper jika diperlukan untuk backfill atau rebuild batch
- Update reader path agar summary dipakai lebih dulu.
  - Jika summary belum lengkap atau error, return `NULL` dan biarkan TypeScript fallback lama tetap jalan.
  - `unstable_cache` tetap dipakai sebagai cache response final, bukan pengganti summary.
- Wire invalidation/rebuild ke semua mutasi QA yang relevan di `app/(main)/qa-analyzer/actions.ts`.
  - create/update/delete temuan
  - import batch
  - create perfect score session
  - publish rule version
  - update service weights
- Jangan ubah UI dashboard kecuali jika ada penyesuaian kecil untuk menjaga response contract.
- Jangan menambah dependency baru atau frontend store baru di V1.

## Aturan Data dan Parity

- `totalDefects` tetap dihitung dari countable findings, bukan dari phantom padding.
- `zeroErrorRate` tetap berarti agent dengan total defect `0` dibagi total agent yang diaudit dalam range.
- `avgAgentScore` dan `complianceRate` harus tetap mengikuti score per-agent yang sama dengan logic lama.
- `session_scores` harus di-merge lintas periode lalu diurutkan ascending, dipotong 5 terendah, dan dipad dengan `100` bila kurang dari 5.
  - Ini menjaga parity dengan semantics `qa_score_agent` yang sudah ada.
- Pareto, donut, dan trend parameter tetap memakai total temuan countable saja.
- Sorting dataset harus deterministik:
  - total defects desc
  - nama asc jika tie
- Phantom-only clean session tetap valid sebagai audit presence, tetapi tidak boleh menambah defect totals.

## Urutan Implementasi

1. Tambahkan migration summary tables + index/unique key yang diperlukan.
2. Tambahkan RPC/helper rebuild summary per periode.
3. Ubah reader dashboard range/trend agar summary dipakai dulu.
4. Hubungkan mutasi QA ke rebuild + invalidation.
5. Tambahkan fixture parity tests dan verifikasi output legacy vs summary.

## File yang Paling Mungkin Berubah

- `app/(main)/qa-analyzer/services/qaService.server.ts`
- `app/(main)/qa-analyzer/actions.ts`
- `supabase/migrations/*`
- `tests/sidak/*` atau fixture parity test baru yang setara

## Pengujian

- Jalankan `npm run test:sidak`
- Jalankan `npm run lint`
- Jalankan `npm run type-check`
- Tambahkan parity test untuk kasus berikut:
  - phantom-only clean session
  - mixed critical/non-critical session
  - multi-period agent
  - folder filter vs global filter
  - versioned rules via `rule_indicator_id`
- Smoke manual:
  - buka `/qa-analyzer/dashboard`
  - ganti year, month range, folder, dan service
  - pastikan angka dashboard tetap sama dengan logic lama
  - pastikan cache terinvalidation setelah mutasi QA

## Asumsi

- V1 tidak memakai Redis/Upstash.
- V1 tidak menambah React Query, SWR, atau Zustand.
- V1 tidak mengganti contract response dashboard.
- Raw TypeScript fallback tetap dipertahankan sebagai safety net sampai parity summary terbukti.
- Rebuild summary boleh sinkron setelah mutasi pada tahap awal; jika terlalu berat, tahap lanjutan bisa memindahkannya ke job async.
