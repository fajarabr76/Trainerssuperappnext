# Telefun Gap Priority v1

## Status

- ✅ P0 selesai
- ⏳ P1-P3 belum dikerjakan
- Draft prioritas disusun dari gap analysis Telefun vs Ketik

## Ringkasan

Plan ini menetapkan urutan perbaikan Telefun berdasarkan risiko data, kontinuitas sesi, dan nilai pengguna. Prioritas utama bukan penyeragaman fitur kosmetik, tetapi menjaga history tetap durable, akses tetap benar, dan sesi review bisa dipakai ulang setelah browser berganti atau localStorage hilang.

## Prioritas

### ✅ P0 - Data Integrity History

- ✅ Pindahkan history Telefun ke Supabase sebagai source of truth utama.
- ✅ Saat mount, load `telefun_history` dari server untuk user login; `localStorage` hanya fallback sementara.
- ✅ Delete item history harus menghapus row Supabase yang terkait, bukan hanya menghapus cache lokal.
- ✅ Clear all history harus mengosongkan Supabase dan local cache secara sinkron.
- ✅ Pastikan row `results` kompatibilitas tetap terhapus atau terhubung dengan benar lewat `legacy_history_id` agar monitoring tidak drift.

### ✅ P0 - Auth Readiness

- ✅ Tambahkan guard readiness yang setara dengan Ketik sebelum user memulai call atau menyimpan data sesi.
- ✅ Jangan izinkan action yang bergantung ke user/session berjalan saat status auth belum siap dibaca penuh.
- ✅ Pertahankan `requirePageAccess()` server-side; fokus perubahan di client gating dan state readiness.

### P1 - Review / Replay

- Tambahkan mode review untuk membuka sesi Telefun lama secara stabil dari history server.
- Minimal v1: replay metadata, transcript, dan recording link.
- Jika transcript belum tersedia untuk sesi lama, tampilkan fallback yang jelas tanpa memutus alur review.

### P1 - Export

- Tambahkan ekspor data history Telefun ke CSV atau format lain yang mudah dipakai operasional.
- Prioritaskan metadata yang sudah durable: tanggal, skenario, nama konsumen, durasi, skor, feedback, recording URL.
- Tunda ekspor transcript penuh sampai model penyimpanan transcript memang ada.

### P2 - Quality Pacing dan Timeout

- Evaluasi apakah pacing Telefun perlu setara Ketik atau cukup dipertahankan sebagai voice-only pacing.
- Tambahkan timeout / dead-air semantics yang lebih eksplisit bila diperlukan, tetapi jangan menyalin logic chat Ketik mentah-mentah.

### P3 - Cleanup

- Rapikan field yang tidak dipakai penuh, seperti `selectedModel` pada path LiveSession jika tetap hardcode.
- Evaluasi `activeConsumerTypeId` vs `preferredConsumerTypeId` agar tidak ada state yang terlihat tersimpan tetapi sebenarnya tidak dipakai.
- Tambahkan penggunaan `scenario.images` hanya jika benar-benar masuk ke prompt atau sesi live.

## Implementasi

- ✅ Fase 1: history durable dan sinkronisasi delete/clear.
- ✅ Fase 2: auth readiness gating.
- ⏳ Fase 3: export history.
- ⏳ Fase 4: pacing, timeout, dan cleanup.

### Detail Implementasi P0

**Data Integrity History:**
- `actions.ts` — tambah `loadTelefunHistory()`, `deleteTelefunSession()`, `clearTelefunHistory()` server actions
- `page.tsx` — dipisah jadi server component wrapper (`requirePageAccess()`) + `TelefunClient.tsx`
- `TelefunClient.tsx` — mount load dari `loadTelefunHistory()`, localStorage fallback; delete/clear via server actions lalu sync localStorage
- `deleteTelefunSession()` — hapus dari `telefun_history` + `results` (via `legacy_history_id` di `details` JSONB)
- `clearTelefunHistory()` — hapus dari `telefun_history` + `results` untuk user
- Optimistic entry: direplace oleh server record setelah persist sukses, tidak duplikat

**Auth Readiness:**
- `page.tsx` — `requirePageAccess()` server-side
- `TelefunClient.tsx` — `isAuthReady` state via `getUser()`, tombol "Mulai Panggilan" disabled hingga siap
- `HistoryModal.tsx` — props async `Promise<void>`, loading state saat delete/clear

## Test Plan

- ✅ `npm run lint`
- ✅ `npm run type-check`
- ⏳ Smoke test login/logout dan buka `/telefun`
- ⏳ Simpan sesi Telefun, reload browser, lalu pastikan history tetap muncul dari Supabase
- ⏳ Delete satu sesi dan clear all history, lalu pastikan Supabase dan UI konsisten
- ⏳ Buka sesi lama dari review mode dan pastikan replay tidak bergantung ke localStorage
- ⏳ Export history dan cek kolom CSV sesuai data session

## Asumsi

- Telefun tetap memakai `telefun_history` sebagai sumber riwayat utama.
- `localStorage` boleh tetap dipakai sebagai cache lokal, tetapi tidak boleh menjadi satu-satunya penyimpanan history.
- Review/replay tidak harus mengulang live audio secara penuh pada v1; metadata dan recording saja sudah cukup untuk prioritas awal.
- Penyeragapan ke Ketik hanya dilakukan bila tidak mengganggu kontrak voice live Telefun.
