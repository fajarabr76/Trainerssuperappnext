# Changelog: Perbaikan Review AI KETIK dan Usage Rupiah (2026-05-09)

## Ringkasan Perubahan

Perubahan ini bertujuan untuk membuat proses review AI di modul KETIK lebih responsif dan transparan, serta mengalihkan fokus metrik penggunaan AI dari jumlah teknis (call/token) ke metrik biaya bisnis (Rupiah).

### 1. KETIK Review Pipeline
- **Manual-Only Trigger**: Endpoint `POST /api/ketik/review` kini murni bersifat enqueue-only. Proses review AI tidak lagi dipicu secara otomatis; user memegang kendali penuh melalui tombol "Mulai Analisis".
- **Status Normalization**: Status internal `queued` kini dinormalisasi menjadi `processing` di level API polling (`/api/ketik/review/status`) dan UI, menghilangkan kebingungan user tentang status "antre".
- **Polling Robustness**: UI `KetikClient` kini lebih cerdas dalam mendeteksi hasil yang sudah siap (`resultReady`), termasuk jika status lokal sudah `completed` tetapi data review belum sempat dimuat.
- **UI Interaction**: Tombol "Mulai Analisis" di `SessionReviewModal` kini benar-benar terkunci (disabled) dengan spinner saat analisis sedang berlangsung, mencegah multiple trigger.

### 2. Usage & Billing (Rupiah First & Backfill)
- **Consistent Badge Format**: Indikator delta usage (`+Rp`) di modul KETIK, PDKT, dan Telefun kini selalu memprioritaskan biaya Rupiah. Fallback ke `+N call` telah dihapus; jika biaya adalah 0, badge tetap menampilkan `+Rp0`.
- **Usage Modal Redesign**:
  - "Estimasi Biaya Bulan Ini" kini menjadi metrik paling menonjol.
  - "Kenaikan Biaya Sesi Terakhir" diletakkan di bagian atas modal.
  - Metrik teknis (Call AI, Total Tokens) digeser ke posisi sekunder.
- **Limited Monthly Backfill**: Penambahan kebijakan backfill terbatas untuk log penggunaan bulan berjalan yang bernilai `Rp0`. Row historis lama dengan snapshot biaya non-zero tetap dipertahankan.
- **Copy Alignment**: Footer dan label modal diperbarui untuk menegaskan bahwa "usage" diukur sebagai estimasi biaya dari token AI.

## Detail Teknis
- Penambahan helper `claimAndProcessKetikReviewJob` di `app/actions/ketik-ai-review.ts` untuk standarisasi logika worker.
- Penambahan helper `formatUsageDeltaLabel` di `app/lib/usage-snapshot.ts` untuk standarisasi label rupiah di seluruh UI.
- Penambahan migration `20260509100000_correct_pricing_and_backfill.sql` untuk koreksi harga dan backfill log `Rp0`.


## Verifikasi
- [x] Review manual KETIK memicu status `processing` dan polling hingga `completed`.
- [x] Badge `+Rp` muncul di seluruh modul yang terdampak.
- [x] Modal usage menampilkan estimasi biaya sebagai metrik utama.
- [x] Dokumentasi `MONITORING_TOKEN_USAGE_BILLING.md` dan `modules.md` telah diperbarui.
