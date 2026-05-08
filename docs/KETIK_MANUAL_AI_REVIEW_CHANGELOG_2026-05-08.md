# KETIK Manual AI Review - Changelog 2026-05-08

## Perubahan Utama
Modul **KETIK** (Kelas Etika & Trik Komunikasi) telah diperbarui untuk mengubah alur penilaian AI (AI Review) dari otomatis menjadi manual.

### Alasan Perubahan
- **Optimasi Performa**: Mengurangi waktu tunggu (loading) setelah simulasi chat selesai.
- **Efisiensi Token**: Menghindari penggunaan AI yang tidak perlu jika user tidak berniat melihat penilaian pada saat itu juga.
- **User Control**: Memberikan kendali penuh kepada user untuk menentukan kapan sesi mereka siap dinilai.

### Detail Implementasi
1.  **Pemisahan Lifecycle**: Alur simpan sesi (`persistKetikSession`) dan alur penilaian AI (`triggerKetikAIReview`) kini terpisah secara total di sisi klien.
2.  **UI Manual Trigger**: Menambahkan tombol "Mulai Analisis" di dalam `SessionReviewModal`. Tombol ini hanya muncul jika sesi belum dinilai atau penilaian sebelumnya gagal.
3.  **Hiding Zero Scores**: Komponen skor (Final Score, Empathy, Probing, dll.) sekarang disembunyikan hingga data review tersedia. Ini memperbaiki bug visual di mana sesi yang belum dinilai menampilkan angka "0".
4.  **Optimistic State Update**: Setelah user memicu analisis manual, sistem akan melakukan _refresh_ parsial pada state riwayat lokal untuk memastikan data terbaru tampil tanpa perlu memuat ulang seluruh halaman.

### Dampak Teknis
- Fungsi `endSession` di `KetikClient.tsx` tidak lagi melakukan _fetch_ ke `/api/ketik/review`.
- Properti `onStartReview` ditambahkan ke `SessionReviewModal` untuk menangani pemicu manual.
- Fungsi `handleViewReview` diperbarui untuk hanya membuka modal tanpa pemicu otomatis jika status masih `pending`.

## Verifikasi
- [x] Simulasi selesai langsung membuka modal status _pending_.
- [x] Tombol "Mulai Analisis" berfungsi dan menampilkan data skor setelah selesai.
- [x] Tidak ada skor "0" yang muncul di modal sebelum analisis dilakukan.
- [x] `npm run lint` dan `npm run type-check` lulus verifikasi.
