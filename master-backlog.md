# Master Backlog - SIDAK Dashboard Redesign

> Status: Redesign for SIDAK dashboard implemented.
> Fokus: meningkatkan tampilan, hierarchy informasi, dan UX dashboard SIDAK tanpa mengubah kontrak data utama.

## 1. UX Audit & Visual Direction [DONE]
- Audit tampilan dashboard SIDAK saat ini: hierarchy terlalu berat ke hero dan kartu, konteks filter belum cukup kuat, dan insight belum cukup cepat dipindai.
- Tetapkan arah visual SIDAK sebagai `workspace analitik operasional`, bukan dashboard marketing-style.
- Definisikan aturan desain khusus:
  - utility copy over hero copy
  - satu aksen utama SIDAK
  - layout lebih rapat dan terarah
  - section harus punya satu tugas jelas
- Susun acceptance criteria untuk desktop dan mobile: [DONE]
  - user paham konteks dashboard dalam satu layar pertama
  - filter aktif mudah dikenali
  - KPI utama terbaca cepat
  - tren dan root cause lebih mudah dieksplorasi

## 2. Dashboard Shell & Filter Bar [DONE]
- Rombak shell dashboard agar lebih tenang dan fokus:
  - header utilitarian
  - breadcrumb/context line
  - status scope data
  - action sekunder bila diperlukan
- Ubah filter area menjadi command bar yang ringkas, sticky, dan mudah discan.
- Pertahankan sinkronisasi URL dan perilaku filter existing:
  - `start_month`
  - `end_month`
  - `folder`
  - `service`
  - `year`
- Tambahkan feedback yang lebih jelas untuk:
  - loading state saat filter berubah
  - reset/clear scope
  - filter aktif vs scope default
- Acceptance: [DONE]
  - user dapat memahami layanan, tim, tahun, dan rentang bulan tanpa scroll panjang
  - perubahan filter tetap terasa cepat dan konsisten

## 3. Analytic Workspace Layout [DONE]
- Refactor area KPI agar lebih padat dan lebih informatif:
  - metrik utama tetap terlihat
  - delta/status lebih jelas
  - sparkline hanya dipakai jika benar-benar membantu
- Susun dashboard menjadi alur baca yang lebih operasional:
  - summary
  - trend
  - root cause
  - follow-up/action
- Ubah section analitik menjadi layout dua lajur pada desktop:
  - lane utama untuk trend dan analisis parameter
  - lane samping untuk top agents dan insight pendukung
- Rapikan empty/loading/error state agar tetap memberi konteks keputusan.
- Acceptance: [DONE]
  - dashboard terasa seperti workspace analitik, bukan kumpulan widget
  - user dapat pindah dari ringkasan ke investigasi tanpa kebingungan

## 4. Preview Page, QA, and Roll-in [DONE]
- Buat halaman preview khusus untuk SIDAK redesign agar bisa review sebelum diterapkan penuh ke route produksi. [DONE]
- Lakukan QA pada: [DONE]
  - responsive mobile/tablet/desktop
  - aksesibilitas dasar
  - filter behavior
  - state loading/empty/error
- Roll-in redesign ke route utama `QaDashboardClient.tsx`. [DONE]

## Notes
- Redesign SIDAK dashboard selesai dan telah diterapkan ke route produksi.
- Filter URL dan kontrak data utama berhasil dipertahankan tanpa perubahan backend.
- Menambahkan varian `toolbar` pada `MonthRangePicker` untuk mendukung desain command bar yang lebih ringkas.
