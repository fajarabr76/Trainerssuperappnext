# Monitoring Token Bulanan dan Usage Billing v1

## Status

- Sudah dijalankan (iterasi awal + corrective fix)

## Ringkasan

Tambahkan sistem monitoring token yang mencatat usage setiap AI call sukses, menghitung estimasi billing Rupiah saat request terjadi, lalu menampilkannya di dua permukaan:

- `/dashboard/monitoring` untuk melihat rekap bulanan semua akun yang ada
- halaman `Ketik` dan `PDKT` untuk melihat usage bulan berjalan user login lewat tombol baru di bawah `Riwayat`

Periode bulanan selalu memakai WIB / `Asia/Jakarta`:
- awal bulan: `tanggal 1 00:00:00 WIB`
- akhir bulan: `hari terakhir bulan 23:59:59.999 WIB`

## Perubahan Utama

- Tambahkan tabel `ai_usage_logs` untuk 1 row per AI call sukses final.
- Simpan data log: `user_id`, `provider`, `model_id`, `module`, `action`, `input_tokens`, `output_tokens`, `total_tokens`, `input_price_usd_per_million`, `output_price_usd_per_million`, `usd_to_idr_rate`, `estimated_cost_usd`, `estimated_cost_idr`, `created_at`, dan `request_id` unik agar tidak double-log saat retry.
- Tambahkan tabel pricing:
  - `ai_pricing_settings` untuk harga input/output per normalized model ID
  - `ai_billing_settings` untuk kurs global USD ke IDR
- Histori billing tidak boleh dihitung ulang dari setting terbaru. Setiap row usage harus menyimpan snapshot harga dan kurs saat request terjadi.
- Semua lookup model wajib lewat `normalizeModelId()` agar alias model lama tetap jatuh ke pricing yang benar.
- Semua akses usage dan pricing dilakukan server-side dengan `createAdminClient()` dan role gate eksplisit.

## Perubahan Interface dan Perilaku

- Tambahkan `usageContext` ke `generateGeminiContent()` dan `generateOpenRouterContent()`.
- Bentuk minimal:
  - `module`: `'ketik' | 'pdkt' | 'telefun' | 'qa-analyzer'`
  - `action`: string stabil per use case
- Caller modul wajib mengirim context agar log bisa dipetakan per modul dan per aksi.
- Aturan logging:
  - hanya dicatat setelah response sukses final
  - retry/fallback internal tidak boleh menghasilkan row tambahan
  - request gagal, timeout, atau 429 final tidak dicatat
  - jika provider tidak memberi metadata token, flow user tetap lanjut tetapi usage tidak dicatat dan server menulis warning terstruktur

- Monitoring di `/dashboard/monitoring` tetap satu route dengan 3 tab:
  - `Riwayat Simulasi`
  - `Penggunaan Token`
  - `Harga & Kurs`
- Tab `Penggunaan Token`:
  - default bulan berjalan WIB
  - filter `bulan`, `akun/user`, dan `module`
  - tabel utama menampilkan agregasi per akun: jumlah call sukses, input tokens, output tokens, total tokens, billing IDR
  - saat user dipilih, tampilkan breakdown tambahan per model
  - data menampilkan semua akun yang punya usage pada bulan terpilih
- Tab `Harga & Kurs`:
  - hanya untuk `trainer` dan `admin`
  - `leader` tetap bisa melihat usage tetapi tidak bisa mengubah pricing

- Tambahkan tombol baru `Usage Bulan Ini` di `Ketik` dan `PDKT`, tepat di bawah tombol `Riwayat`
- Tombol membuka modal baru dengan pola yang konsisten dengan `Riwayat`
- Isi modal bersifat modul aktif saja:
  - di `Ketik`: usage bulan berjalan user login untuk modul `ketik`
  - di `PDKT`: usage bulan berjalan user login untuk modul `pdkt`
- Isi modal:
  - input token bulan berjalan
  - output token bulan berjalan
  - total token bulan berjalan
  - estimasi billing Rupiah bulan berjalan
  - jumlah call sukses bulan berjalan
  - label periode aktif, misalnya `1 April 2026 - 30 April 2026 WIB`
- Setelah sesi selesai, tombol `Usage Bulan Ini` dan bagian atas modal menampilkan indikator kenaikan biaya sesi terakhir (`+Rp`) berdasarkan selisih total usage bulan berjalan sebelum-vs-sesudah sesi.
- Khusus PDKT, jika evaluasi masih async saat sesi ditutup:
  - tampilkan delta provisional + label `masih diproses`
  - lanjut polling ringan untuk recompute delta final saat evaluasi selesai
  - gunakan session-run guard (`sessionRunIdRef`) agar baseline, delta, dan cleanup polling tidak tertukar antar sesi

## Pengujian

- `npm run lint`
- `npm run type-check`

- Smoke test:
  - Ketik dengan Gemini menghasilkan row usage modul `ketik`
  - PDKT dengan OpenRouter menghasilkan row usage modul `pdkt`
  - Retry OpenRouter yang akhirnya sukses hanya membuat 1 row
  - Request gagal tidak membuat row usage
  - Monitoring menampilkan seluruh akun yang punya usage pada bulan terpilih
  - Boundary WIB benar: request dekat pergantian bulan masuk ke bulan WIB yang sesuai
  - Ubah kurs atau harga model, lalu request baru memakai harga baru tanpa mengubah histori lama
  - Tombol `Usage Bulan Ini` di Ketik hanya menampilkan akumulasi `ketik`
  - Tombol `Usage Bulan Ini` di PDKT hanya menampilkan akumulasi `pdkt`
  - Setelah sesi KETIK selesai, badge `+Rp` muncul di tombol dan modal menunjukkan blok `Kenaikan setelah sesi terakhir`
  - Saat sesi PDKT ditutup ketika evaluasi masih `processing`, tampilkan delta provisional + label `masih diproses`, lalu auto-update setelah evaluasi selesai
  - Jika sesi baru dimulai sebelum fetch baseline/polling sesi sebelumnya selesai, delta yang tampil tetap milik sesi terbaru
  - `leader` bisa melihat tab usage monitoring tetapi tidak bisa melihat atau submit editor pricing

## Asumsi

- v1 tidak melakukan backfill histori lama; hanya usage setelah fitur rilis yang tercatat
- v1 tidak menambah export CSV/XLSX untuk usage
- Model di luar pricing table tidak memblokir request user, tetapi usage tidak dicatat sampai pricing tersedia
- Telefun dan QA Analyzer tetap ikut instrumentasi logging, walau quick-view hanya ditambahkan ke Ketik dan PDKT
- Delta sesi dihitung dari selisih total usage bulan berjalan, bukan dari satu `request_id` individual

## Corrective Fix Summary

- Boundary WIB diperbaiki: `getWibMonthBounds` sekarang mengonversi WIB ke UTC dengan `setUTCHours(-7)` sehingga query `created_at` tepat
- Tab `Penggunaan Token` sekarang benar-benar refetch data saat filter bulan/tahun/modul berubah lewat server action `getFilteredUsage`
- Tab `Harga & Kurs` sekarang memiliki editor pricing per model dan editor kurs USD/IDR dengan role gate eksplisit (`trainer`/`admin` only)
- Instrumentasi usage ditambahkan untuk Telefun (`voice_tts`, `chat_response`, `first_message`, `score_generation`) dan QA Analyzer (`report_generation`)
- Logging diubah dari `void` ke `await` agar durability terjamin
- Default filter bulan/tahun di MonitoringClient berasal dari WIB server, bukan timezone browser
- `logAiUsage()` dan `flushLiveUsage()` tidak lagi skip recording saat pricing model belum dikonfigurasi. Token tetap tercatat dengan biaya 0 IDR + warning, sehingga admin bisa lihat usage lalu mengisi pricing. Sebelumnya, seluruh row usage hilang jika pricing tidak ada.
- `getUsageAggregationInternal()` sekarang menangkap error query `profiles` dan melanjutkan agregasi tanpa gagal diam-diam.
- Instrumentasi usage untuk agent sebelumnya gagal karena `supabase.auth.getUser()` return `null` di server action context untuk role agent, menyebabkan `logAiUsage()` tidak pernah dipanggil meskipun AI call sukses. Perbaikan:
  - `generateGeminiContent()` dan `generateOpenRouterContent()` menerima `userId` opsional dari client (KetikClient → ChatInterface → geminiService → server action).
  - Server action resolve identity dengan `resolvedUserId = getUser() || getSession() || options.userId` — server-verified diutamakan, client-passed sebagai fallback terakhir.
  - Cross-check: jika `options.userId` tidak cocok dengan `getUser()`, log warning dan tetap pakai identity server.
  - Ketik, PDKT (termasuk `api/pdkt/evaluate`), dan Telefun HTTP sudah di-thread userId dari client ke server action.
