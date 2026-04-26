# QA Dashboard Summary Rollup Staging

Dokumen ini mencatat scope commit, dampak file Supabase, dan checklist testing staging untuk implementasi `QA Analyzer Dashboard Summary Rollup + Cache v1`.

## Scope Yang Relevan

Perubahan yang termasuk scope plan `plan/qa-analyzer-dashboard-summary-rollup-cache-v1.md`:

- `supabase/migrations/20260426000000_qa_dashboard_summary_tables.sql`
- `app/(main)/qa-analyzer/services/summaryReader.server.ts`
- `app/(main)/qa-analyzer/services/qaService.server.ts`
- `app/(main)/qa-analyzer/actions.ts`
- `tests/sidak/summary-reader.test.ts`
- `plan/qa-analyzer-dashboard-summary-rollup-cache-v1.md`

Commit `a095af6 feat(qa-analyzer): dashboard summary rollup cache v1` sudah memuat scope implementasi tersebut.

## File Supabase CLI Yang Tidak Wajib Masuk Scope

File berikut bisa muncul saat menjalankan Supabase CLI, tetapi tidak otomatis bagian dari plan dashboard summary:

- `supabase/config.toml`
- `supabase/.gitignore`

Keduanya tidak mengubah runtime Next.js dan tidak mengubah schema database staging. Jika tujuan commit hanya QA dashboard summary rollup, jangan stage file ini kecuali repo memang memutuskan untuk mulai tracking konfigurasi Supabase CLI lokal.

Rename migration `20260417110000_remove_superadmin_role_and_promote_fajar.sql` ke `20260417110001_remove_superadmin_role_and_promote_fajar.sql` hanya relevan bila diperlukan untuk menghindari konflik timestamp migration. Sebelum publish ke environment lain, cek dulu status migration history Supabase target agar rename migration lama tidak dianggap perubahan schema baru yang tidak diinginkan.

## Status Staging

Staging database project `kkeiiwyyefaofljippnj` sudah menerima migration summary:

- `qa_dashboard_period_summary`
- `qa_dashboard_indicator_period_summary`
- `qa_dashboard_agent_period_summary`
- `_qa_session_scores()`
- `refresh_qa_dashboard_summary_for_period()`

Migration history staging dilaporkan clean dan synced.

## Checklist Testing Staging

Lakukan testing di `/qa-analyzer/dashboard`:

- Global scope tanpa folder filter: ubah service, year, dan month range.
- Folder filter aktif: pastikan dashboard tetap jalan melalui fallback lama.
- Mutasi input: buat, update, dan delete temuan di `/qa-analyzer/input`, lalu cek dashboard berubah setelah cache invalidation.
- Delete terakhir: hapus temuan terakhir untuk satu service/periode, lalu pastikan dashboard tidak menampilkan angka stale.
- Clean session: pastikan sesi tanpa temuan tetap dihitung sebagai audit valid, tetapi tidak menambah total temuan, Pareto, donut, atau defect ranking.
- Service comparison: pastikan data perbandingan service tidak partial; bila summary belum lengkap, dashboard harus fallback ke RPC lama.

## Verifikasi Lokal Minimum

Sebelum commit atau push perubahan SIDAK sejenis:

- `npm run test:sidak`
- `npm run lint`
- `npm run type-check` bila perubahan menyentuh contract build atau service server.
- `git diff --check`

## Keputusan Operasional

Untuk testing staging saat ini, perubahan sudah layak diuji karena migration staging berhasil, summary reader punya fallback ke RPC lama, dan verifikasi lokal sebelumnya lulus.

Untuk commit dokumentasi ini, jangan ikut stage `supabase/config.toml` dan `supabase/.gitignore` bila hanya ingin menutup catatan operasional QA dashboard summary rollup.
