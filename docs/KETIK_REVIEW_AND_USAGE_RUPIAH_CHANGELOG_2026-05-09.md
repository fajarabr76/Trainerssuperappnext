# Changelog: Perbaikan Review AI KETIK dan Usage Rupiah (2026-05-09)

## Ringkasan Perubahan

Perubahan ini bertujuan untuk membuat proses review AI di modul KETIK lebih responsif dan transparan, serta mengalihkan fokus metrik penggunaan AI dari jumlah teknis (call/token) ke metrik biaya bisnis (Rupiah).

### 1. KETIK Review Pipeline
- **Manual-Only Trigger**: Proses review AI tetap tidak dipicu otomatis saat sesi selesai; user memegang kendali penuh melalui tombol "Mulai Analisis".
- **Manual Trigger Execution**: Endpoint `POST /api/ketik/review` tetap membuat/menyegarkan job durable, lalu langsung mencoba `claimAndProcessKetikReviewJob` dari request manual tersebut. Ini mencegah sesi berhenti permanen di status loading ketika tidak ada cron/worker eksternal yang sedang berjalan.
- **Retry Failed Job**: Job yang sudah `failed` akan di-reset ke `queued` saat user menekan ulang tombol analisis, lalu diklaim ulang secara aman.
- **Pending Is Actionable**: Status `pending` sekarang merepresentasikan sesi yang belum dianalisis, bukan loading. Modal tetap menampilkan tombol "Mulai Analisis" untuk sesi fresh `pending`, sedangkan spinner hanya muncul untuk `processing`/request yang sedang berjalan.
- **Status Normalization**: Status internal `queued` kini dinormalisasi menjadi `processing` di level API polling (`/api/ketik/review/status`) dan UI, menghilangkan kebingungan user tentang status "antre".
- **Polling Robustness**: UI `KetikClient` kini lebih cerdas dalam mendeteksi hasil yang sudah siap (`resultReady`), termasuk jika status lokal sudah `completed` tetapi data review belum sempat dimuat. Sesi fresh `pending` tidak lagi dipolling agar tidak terlihat seperti loading tanpa akhir.
- **UI Interaction**: Tombol analisis di `SessionReviewModal` kini terkunci (disabled) dengan spinner hanya saat analisis benar-benar sedang berjalan, mencegah multiple trigger tanpa memblokir sesi yang belum dianalisis.

### 2. Usage & Billing (Rupiah First & Backfill)
- **Consistent Badge Format**: Indikator delta usage (`+Rp`) di modul KETIK, PDKT, dan Telefun kini selalu memprioritaskan biaya Rupiah. Fallback ke `+N call` telah dihapus; jika biaya adalah 0, badge tetap menampilkan `+Rp0`.
- **Usage Modal Redesign**:
  - "Estimasi Biaya Bulan Ini" kini menjadi metrik paling menonjol.
  - "Kenaikan Biaya Sesi Terakhir" diletakkan di bagian atas modal.
  - Metrik teknis (Call AI, Total Tokens) digeser ke posisi sekunder.
- **Limited Monthly Backfill**: Penambahan kebijakan backfill terbatas untuk log penggunaan bulan berjalan yang bernilai `Rp0`. Row historis lama dengan snapshot biaya non-zero tetap dipertahankan.
- **Copy Alignment**: Footer dan label modal diperbarui untuk menegaskan bahwa "usage" diukur sebagai estimasi biaya dari token AI.

## Detail Teknis
- Penambahan helper `claimAndProcessKetikReviewJob` di `app/actions/ketik-ai-review.ts` untuk standarisasi logika worker dan reuse oleh manual review route.
- `POST /api/ketik/review` sekarang mengembalikan status aktual dari claim/process manual (`completed`, `processing`, atau `failed`) alih-alih hanya feedback enqueue.
- Penambahan helper `formatUsageDeltaLabel` di `app/lib/usage-snapshot.ts` untuk standarisasi label rupiah di seluruh UI.
- Penambahan migration `20260509100000_correct_pricing_and_backfill.sql` untuk koreksi harga dan backfill log `Rp0`.


### 3. Reliability & UI Polish
- **Score Hydration & Zero-Score Fix**: Endpoint `/api/ketik/review/status` kini mengembalikan metrik skor (`final_score`, `empathy_score`, dsb.) secara langsung saat status `completed`. Frontend `KetikClient` melakukan hidrasi skor ke state sesi lokal secara instan, memperbaiki bug visual di mana skor tampil `0` meskipun analisis selesai.
- **Indonesian Scoring Rubric (0-100)**: Prompt AI diperbarui menggunakan rubrik Bahasa Indonesia dengan skala `0-100` yang ketat (90-100: Sangat Baik, 75-89: Baik, 60-74: Cukup, <60: Perlu Coaching). Skor di-clamp di level server untuk menjamin integritas data.
- **Estimated Progress UI**: Spinner sederhana di `SessionReviewModal` digantikan dengan progress bar yang informatif, persentase (smoothly animated), estimasi waktu (ETA), dan status tekstual dalam Bahasa Indonesia (misal: "Menganalisis pesan...", "Menyusun ringkasan...").
- **Review Transition & Flicker Fix**: Menghilangkan flicker UI saat transisi dari proses analisis ke tampilan hasil dengan memperkenalkan phase `loading-result`. `KetikClient` kini tidak lagi menghapus state review lama secara prematur dan modal tetap menampilkan status progres stabil hingga seluruh data detail review dan typo benar-benar termuat di state.
- **Console Noise Cleanup**:
  - Memperbarui CSP di `next.config.ts` untuk mengizinkan Vercel Speed Insights script (`va.vercel-scripts.com`).
  - Menggunakan prop `unoptimized` pada `DiceBearAvatar` untuk menghindari error 400 dan konflik CSP pada avatar SVG eksternal.
  - Membatasi log debug (seperti `QuickTemplate Debug` dan status simpan settings) hanya pada environment development.

## Verifikasi
- [x] Review manual KETIK dari sesi `pending` dapat ditekan, mengklaim job, dan mengembalikan hasil `completed` tanpa menunggu worker eksternal.
- [x] Hidrasi skor berjalan otomatis; modal review tidak lagi menampilkan skor 0 setelah analisis selesai.
- [x] Progress bar dan ETA muncul selama proses analisis AI.
- [x] Tidak ada warning CSP terkait Speed Insights atau error 400 pada avatar DiceBear.
- [x] Job `failed` dapat di-retry dari modal review.
- [x] Badge `+Rp` muncul di seluruh modul yang terdampak.
- [x] Modal usage menampilkan estimasi biaya sebagai metrik utama.
- [x] Dokumentasi `MONITORING_TOKEN_USAGE_BILLING.md` dan `modules.md` telah diperbarui.
