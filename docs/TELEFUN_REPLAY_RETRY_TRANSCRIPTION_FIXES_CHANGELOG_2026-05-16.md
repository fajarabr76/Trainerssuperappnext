# Telefun Replay & Transcription Fix Changelog

> **Tanggal:** 2026-05-16
> **Perubahan:** Bug fix + hardening

## Perbaikan

### 1. `geminiService.ts` — Per-turn transcription tidak bertahan ke `onModelTurnComplete`
- **Bug:** Setelah `turnComplete` di state `user_speaking`, `currentTurnTranscription` di-reset ke `null`. Saat `turnComplete` berikutnya di `ai_speaking`, `onModelTurnComplete()` menerima `undefined` sehingga evaluasi disruption kehilangan transkrip agent.
- **Fix:** Reset `currentTurnTranscription` hanya di branch `ai_speaking` dan `recovering`, bukan setelah `user_speaking`.
- **Test:** `tests/telefun/handle-message-transcription.test.ts` (2 test: preservation + interrupted clear)

### 2. `replayAnnotation.ts` — Query error dibungkam + summary backfill gagal menghilangkan anotasi
- **Bug 2a:** Error baca `telefun_replay_annotations` dan `telefun_coaching_summary` diabaikan (fallback ke `[]`/`null`), menyebabkan regenerasi AI dan duplikasi.
- **Bug 2b:** Saat AI annotations sudah ada tapi summary belum, kegagalan download/Gemini mengakibatkan return `{ success: false }` padahal annotations bisa langsung dikembalikan.
- **Bug 2c:** Kegagalan persist hasil generasi AI (`insert` anotasi atau RPC summary) hanya di-log, tetapi action tetap return `{ success: true }`, sehingga UI terlihat sukses padahal data belum durable.
- **Fix 2a:** Propagate error select sebagai `{ success: false }`.
- **Fix 2b:** Saat regenerasi/backfill gagal, action mengembalikan partial persisted/generated data via `result`, tetapi tetap menandai `success: false` dan menyertakan `error` agar UI tetap bisa retry.
- **Fix 2c:** Kegagalan persist hasil generasi AI sekarang menjadi partial failure eksplisit, bukan silent success.
- **Test:** `tests/telefun/replay-annotation-persistence.test.ts` (9 test: fail-fast, partial fallback, backfill, regenerasi, persistence failure)

### 3. `ReviewModal.tsx` / `ReplayAnnotator.tsx` — Cached voice dashboard metrics direfetch ulang sia-sia + partial replay data tidak tampil baik
- **Bug:** `voiceDashboardLoaded` selalu di-reset ke `false` saat modal buka, meskipun `record.voiceDashboardMetrics` sudah terisi. Saat tab Voice Dashboard dibuka, metrik cache direfetch ulang.
- **Bug:** Saat replay generation gagal tapi partial data tersedia, modal sebelumnya berisiko menandai replay sebagai loaded penuh atau menyembunyikan rekomendasi yang sudah ada.
- **Bug:** Jika action mengembalikan `success: true` tetapi `result` tidak ada, UI bisa masuk silent state (`loaded=false`, `error=undefined`) dan retry behavior menjadi ambigu.
- **Fix:** Inisialisasi `voiceDashboardLoaded` dari `!!record.voiceDashboardMetrics`. Saat retry, metric/data yang ada tidak dihapus. Replay partial data sekarang tetap dihydrate ke UI sambil mempertahankan status error + retry, dan error state `ReplayAnnotator` juga tetap menampilkan rekomendasi yang sudah tersedia.
- **Test:** `tests/telefun/review-modal-loading.test.ts` + `tests/telefun/replay-annotator-error-state.test.tsx` (10 test total)

### 4. Migration — Resequencing dirapikan dan repair dibuat self-sufficient
- Merge tiga file `20260516000000_*` menjadi satu file idempoten (`create_telefun_replay_support.sql`) dan perluas repair di `20260516000001` untuk recovery dari semua partial-apply state akibat duplicate timestamp. Repair migration (`20260516000001`) sekarang mencakup:
  - `CREATE TABLE IF NOT EXISTS telefun_coaching_summary`
  - restore RLS/grants/indexes/execute grant untuk coaching summary
  - `DROP POLICY IF EXISTS` untuk idempotensi
  - `INSERT` policy dengan sesi ownership check
  - `service_role` resolution di RPC `upsert_telefun_coaching_summary`
  - `CREATE TABLE IF NOT EXISTS telefun_replay_annotations`
  - `session_duration_ms` column
- **Test:** `tests/supabase/telefun-replay-migrations-contracts.test.ts` (12 test)

## Verifikasi

- `npx vitest run tests/telefun tests/telefun-realistic tests/supabase` → **35 files, 384 tests passed**
- `npm run lint` → **0 errors**, 14 warnings (pre-existing)
- `npm run type-check` → **build succeeded**

## Quick-Win Fixes (Batch 2)

### 5. RLS — Klien tidak bisa membuat replay annotation AI palsu
- **Bug:** INSERT policy `telefun_replay_annotations` hanya memeriksa kepemilikan sesi. Klien bisa insert `is_manual = false`, dan recovery logic menganggap semua row non-manual sebagai AI-generated — memungkinkan forged row mematikan regenerasi AI secara permanen.
- **Fix:** Tambah `AND is_manual = true` pada WITH CHECK policy, sehingga klien hanya bisa insert row `is_manual = true`.
- **File:** `supabase/migrations/20260516000000_create_telefun_replay_support.sql`, `20260516000001_telefun_replay_rls_repair.sql`
- **Test:** `tests/supabase/telefun-replay-migrations-contracts.test.ts` (assert `is_manual = true` di INSERT policy)

### 6. Voice Dashboard — Transient download failure terkunci di empty state tanpa retry
- **Bug:** `computeVoiceDashboardMetrics()` return `success: true, metrics: null, notice: '...Silakan coba lagi.'` saat download gagal. Modal set `voiceDashboardLoaded = true`, sehingga auto-load tidak coba ulang. Empty state tidak punya tombol retry.
- **Fix:** Tambah `resolveVoiceDashboardResult()` di `reviewModalLoadState.ts`. Jika notice mengandung `Silakan coba lagi`, resolver return `loaded: false` dan `error`, sehingga ErrorState dengan retry muncul.
- **File:** `app/(main)/telefun/components/reviewModalLoadState.ts`, `ReviewModal.tsx`
- **Test:** `tests/telefun/review-modal-loading.test.ts` (4 test baru untuk voice dashboard resolver)

### 7. ReplayAnnotator — Rekomendasi coaching hilang saat retry
- **Bug:** Loading state hanya render partial content saat `annotations.length > 0`. Jika sesi hanya punya persisted coaching summary, retry akan menyembunyikan rekomendasi sampai request selesai.
- **Fix:** Ubah kondisi jadi `annotations.length > 0 || recommendations.length > 0`.
- **File:** `app/(main)/telefun/components/ReplayAnnotator.tsx`
- **Test:** `tests/telefun/replay-annotator-error-state.test.tsx` (2 test baru untuk loading state)

### 8. RPC `upsert_telefun_coaching_summary` — Validasi shape recommendation diperketat
- **Bug:** Validasi hanya mencakup jumlah item (max 5), tetapi tidak memeriksa isi tiap item. Client bisa mengirim JSON malformed (misal: object kosong atau field priority di luar range).
- **Fix:** Tambahkan loop validasi di RPC untuk memastikan tiap item adalah object dengan field `text` (string, max 200) dan `priority` (integer 1-5). Extra keys juga ditolak untuk menjaga integritas shape.
- **File:** `supabase/migrations/20260517000000_enforce_telefun_coaching_summary_shape.sql`
- **Test:** `tests/supabase/telefun-replay-migrations-contracts.test.ts` (assert validation logic di RPC)

## Follow-up Fixes (AI Annotation Completeness)

### 9. Replay annotations - cache AI tidak lagi dianggap lengkap hanya karena ada 1 row
- **Bug:** `generateReplayAnnotations()` sebelumnya menganggap cache AI lengkap ketika ada minimal satu row non-manual. Jika database pernah partial-apply, row AI terhapus sebagian, atau repair meninggalkan set parsial, replay tidak akan regenerasi walau datanya tidak lengkap.
- **Fix:** `telefun_coaching_summary` sekarang menyimpan metadata `ai_annotation_count`, `ai_annotation_checksum`, dan `ai_annotation_completed_at`. Action hanya short-circuit ketika metadata itu cocok dengan row AI non-manual saat ini. Jika tidak cocok, action regenerasi dari rekaman, mempertahankan anotasi manual, mengganti row AI lama, lalu menyimpan metadata baru.
- **Test:** `tests/telefun/replay-annotation-completeness.test.ts`, `tests/telefun/replay-annotation-persistence.test.ts`, dan `tests/supabase/telefun-replay-migrations-contracts.test.ts`.

## Verifikasi (Final Replay Integrity)

- `npx vitest run tests/telefun tests/telefun-realistic tests/supabase` → **36 files, 409 tests passed**
- `npm run lint` → **0 errors**, 14 warnings (pre-existing)
- `npm run type-check` → **build succeeded**

## Known Issues (Sengaja Tidak Disentuh)

- **Live migration matrix:** Belum dijalankan karena butuh akses Docker/Postgres. Hanya terverifikasi melalui static contract test string.
- **DELETE grant ke authenticated:** Client bisa hapus AI-generated annotations langsung via API tanpa guard — hanya pemeriksaan `user_id`.
- **Ordering replay result:** Action return annotations dalam urutan insertion, bukan timestamp. UI timeline sudah sort sendiri, jadi tidak ada bug visual, tapi API contract tidak eksplisit.
- **Tidak ada integrasi test untuk `ReviewModal` + `VoiceEvaluationDashboard`:** Test hanya unit-level untuk fungsi helper dan render static markup. Transient notice → error retry belum diuji di level komponen penuh dengan mock server.
