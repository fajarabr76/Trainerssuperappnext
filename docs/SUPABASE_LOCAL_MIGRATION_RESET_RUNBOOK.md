# Supabase Local Migration Reset Runbook

Dokumen ini menjelaskan cara menangani reset database lokal Supabase ketika migration chain gagal karena schema dasar belum ada.

## Ringkasan

Fresh local database hanya menjalankan file di `supabase/migrations/`. Setup script di `supabase/scripts/` tidak otomatis dijalankan oleh `supabase db reset`.

Karena itu schema dasar aplikasi sekarang dilacak melalui:

- `supabase/migrations/20260401000000_create_initial_app_base_schema.sql`

Migration ini membuat tabel dasar seperti `profiles`, `profiler_peserta`, `qa_periods`, `qa_indicators`, `qa_temuan`, `ketik_history`, dan `pdkt_history` sebelum migration SIDAK/PDKT/KETIK yang lebih baru berjalan.

## Cara Verifikasi

```bash
supabase db reset --debug
npx vitest run tests/supabase/base-schema-migration-contracts.test.ts
```

Reset dianggap sehat jika `20260401000000_create_initial_app_base_schema.sql` berjalan sebelum `20260407190000_add_service_weights.sql` dan tidak ada error `relation does not exist`.

## Jika Error Muncul Lagi

1. Baca nama table/function yang hilang dari error Supabase CLI.
2. Cek apakah objek tersebut seharusnya base schema atau sudah punya migration sendiri.
3. Jika base schema, tambahkan ke `20260401000000_create_initial_app_base_schema.sql` secara idempotent.
4. Tambahkan assertion di `tests/supabase/base-schema-migration-contracts.test.ts`.
5. Jalankan ulang `supabase db reset --debug`.

Jangan menambahkan data produksi, backup lokal, atau data PII ke migration baseline.

## Telefun Replay Live Migration Matrix

Untuk perubahan migration Telefun replay, jalankan:

```bash
npm run test:telefun:migration-matrix
```

Command ini membutuhkan Docker, Supabase CLI, dan `psql` (didalam container). Matrix memverifikasi bahwa migration repair Telefun replay dapat converge dari fresh database dan beberapa state partial-apply legacy.
