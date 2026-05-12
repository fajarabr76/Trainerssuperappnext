# Changelog: Finalisasi Persistensi Durasi Simulasi Telefun (2026-05-12)

## Deskripsi Perubahan
Modul **Telefun** dan **Ketik** telah diperbarui untuk mendukung pelacakan, persistensi, dan pemulihan batas durasi kustom yang dikonfigurasi oleh pelatih/pengguna (1–60 menit) di seluruh siklus hidup riwayat sesi. Implementasi ini memisahkan batas durasi simulasi kustom dari batas tabel riwayat inti dengan menyimpannya dalam objek metadata JSON, memastikan skalabilitas tanpa memerlukan migrasi skema yang berisiko pada tabel SQL lama.

## Detail Implementasi
1. **Persistensi Metadata Sesi (`actions.ts` & `types.ts`):**
   - Menambahkan field `configuredDuration` ke antarmuka `CallRecord` dan parameter penyimpanan sesi.
   - Mengubah `persistTelefunSession` agar menyimpan `configuredDuration` di dalam field JSON `details` pada tabel `results` bersama parameter skenario dan metrik sesi.

2. **Hidrasi Riwayat Pemutaran (`loadTelefunHistory`):**
   - Menggabungkan data riwayat `telefun_history` dengan catatan `results` terkait melalui mekanisme lookup/peta gabungan di server untuk menyuntikkan `configured_duration` ke setiap baris riwayat panggilan.
   - Mendukung kompatibilitas penuh dengan sesi lama (legacy) yang belum memiliki nilai batas waktu kustom.

3. **Penyelarasan UI Klien (`TelefunClient.tsx`, `HistoryModal.tsx`, `ReviewModal.tsx`):**
   - Memetakan field `configuredDuration` pada saat inisialisasi riwayat dari server dan fallback pemulihan lokal.
   - Menambahkan indikator batas waktu kustom (`Limit: Xm`) pada daftar item di modal riwayat serta kolom durasi ekspor CSV.
   - Menyempurnakan blok tampilan detail sesi pada `ReviewModal` untuk menampilkan format batas durasi kustom bersanding dengan durasi aktual panggilan.

4. **Pengujian Validasi Properti (`duration-validation.property.test.ts`):**
   - Menambahkan Property 8 (`Session persistence options retain custom simulated limits exactly as configured`) menggunakan framework `fast-check` untuk memverifikasi integritas parameter durasi yang disimpan dan dihidrasi ulang.
   - Menjalankan seluruh 10 test properti kustom dengan tingkat kelulusan 100% tanpa regresi.
