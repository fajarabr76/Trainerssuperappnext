# KETIK Response Pacing v1

## Status

- Selesai

## Ringkasan

Tambahkan pacing engine terkontrol di KETIK agar balasan konsumen tidak lagi terasa instan, tetapi tetap patuh ke timer sesi dan mudah diaudit. v1 memakai preset global di Settings, bukan pengaturan per skenario, dan pacing diterapkan di layer UI scheduling, bukan di prompt AI. Ini menjaga realism tanpa membuat model bebas melanggar skenario atau waktu sesi.

## Perubahan Utama

- Tambahkan preset pacing global pada settings KETIK:
  - `realistic` sebagai default baru.
  - `training_fast` sebagai opsi cepat untuk user yang tidak ingin menunggu lama.
- Perluas interface settings dan session:
  - `AppSettings.responsePacingMode?: 'realistic' | 'training_fast'`
  - `SessionConfig.responsePacingMode: 'realistic' | 'training_fast'`
- Perluas `ChatMessage` dengan metadata opsional untuk audit ringan:
  - `pacingMeta?: { mode: 'realistic' | 'training_fast'; band: 'short' | 'normal' | 'long' | 'slow' | 'follow_up'; plannedDelayMs: number; timerClamped: boolean }`
- Simpan metadata itu langsung di array `messages` yang sudah dipersist ke `ketik_history` dan `results.details.messages`; tidak perlu migrasi DB karena kolomnya JSON dan pembaca lama akan mengabaikan field tambahan.
- Tambah helper pacing terpusat di service KETIK untuk:
  - mengklasifikasikan bagian pesan menjadi `short`, `normal`, atau `long` dari panjang teks,
  - memilih delay bounded sesuai preset,
  - mengatur follow-up untuk pesan `[BREAK]`,
  - menerapkan guardrail timer dan batas slow response.

## Detail Perilaku

- v1 tidak menambah kontrol per skenario dan tidak mengubah prompt AI. AI tetap menghasilkan isi balasan; sistem hanya mengatur kapan balasan ditampilkan.
- Klasifikasi band untuk `realistic`:
  - `short`: teks `<= 25` karakter, delay `1-3 detik`
  - `normal`: teks `26-90` karakter, delay `5-10 detik`
  - `long`: teks `> 90` karakter, delay `10-20 detik`
  - `slow`: hanya untuk pesan pertama pada satu turn, delay `20-30 detik`
- Aturan `slow` untuk `realistic`:
  - hanya eligible mulai turn konsumen ke-3,
  - peluang `15%` pada turn eligible,
  - tidak boleh dua kali berturut-turut,
  - maksimal `1` kali untuk sesi `5 menit`,
  - maksimal `2` kali untuk sesi `10-15 menit`,
  - otomatis nonaktif bila `remainingSeconds < 45`.
- Aturan follow-up `[BREAK]`:
  - pesan pertama memakai band utama,
  - pesan kedua/ketiga memakai `follow_up` gap `1.2-2.5 detik`,
  - tidak pernah memakai band `slow`.
- Rule solusi panjang:
  - jika pesan agen terakhir terlihat seperti memberi solusi karena teksnya panjang (`> 90` karakter), balasan pertama konsumen harus punya delay minimal `10 detik`
  - rule ini berlaku di semua preset pacing, termasuk `training_fast`
  - rule ini hanya berlaku untuk pesan pertama pada turn konsumen, bukan follow-up `[BREAK]`
- Guardrail timer:
  - bila `remainingSeconds < 20`, semua balasan dipaksa ke `1-3 detik`,
  - planned delay selalu di-clamp agar masih menyisakan minimal `5 detik` untuk timeout-close path,
  - balasan penutupan karena timeout selalu cepat: pesan pertama `1-3 detik`, follow-up `1.2-2.5 detik`.
- Preset `training_fast`:
  - `short 0.8-1.5 detik`
  - `normal 2-4 detik`
  - `long 4-7 detik`
  - tanpa band `slow`
  - follow-up tetap `0.8-1.5 detik`
- UI Settings:
  - tambahkan satu section baru di tab `Sistem` dengan dua preset: `Realistis` dan `Cepat untuk Latihan`
  - copy harus menjelaskan bahwa preset ini memengaruhi tempo balasan konsumen, bukan isi skenario
  - default parsing settings lama tanpa field baru harus jatuh ke `realistic`

## Pengujian

- Unit atau pure-function test untuk helper pacing:
  - klasifikasi `short/normal/long`
  - `slow` tidak muncul pada turn yang tidak eligible
  - `slow` tidak pernah dua kali berturut-turut
  - pesan agen panjang memicu floor `10 detik` pada balasan pertama konsumen
  - rule floor `10 detik` berlaku di `realistic` dan `training_fast`
  - clamp aktif saat sisa waktu mepet
  - follow-up `[BREAK]` selalu memakai gap pendek
- Smoke test manual KETIK:
  - preset `Realistis` menghasilkan variasi tempo yang terasa manusiawi
  - preset `Cepat untuk Latihan` tetap lebih cepat dari `Realistis`
  - sesi tidak bentrok dengan timeout close saat waktu habis
  - riwayat sesi tetap bisa dibuka atau direview tanpa error walau `messages` punya `pacingMeta`
  - monitoring/history tetap aman karena hanya memakai field dasar `timestamp/sender/text`
- Validasi repo:
  - `npm run lint`
  - `npm run type-check`

## Asumsi

- v1 sengaja tidak membaca pacing dari skenario agar tracking tetap konsisten dan implementasi tidak bergantung pada kepatuhan model.
- Metadata pacing disimpan tetapi tidak ditampilkan dulu di UI history/review; fungsinya audit dan debugging internal.
- Definisi awal “agen memberi solusi” di v1 memakai heuristic panjang teks saja, bukan keyword atau classifier semantic.
- Persona konsumen seperti `terburu-buru` atau `marah` belum memodifikasi pacing di v1; jika nanti dibutuhkan, itu jadi layer bias tambahan di atas engine ini, bukan pengganti aturan timer.
