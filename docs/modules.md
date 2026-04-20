# Panduan Modul Aplikasi

Dokumen ini merinci fitur dan fungsi dari setiap modul utama yang tersedia di Trainers SuperApp.

## 1. Unified Dashboard
Dashboard tunggal yang berfungsi sebagai pusat informasi bagi semua tingkatan user.

- **Fungsi**: Menampilkan KPI ringkasan, grafik tren, dan log aktivitas terbaru.
- **Fitur Utama**:
  - **KPI Cards**: Ringkasan Total Temuan, Average Findings, Fatal Error Rate, dsb.
  - **Quick Shortcuts**: Navigasi cepat ke modul kerja sesuai role.
  - **Monitoring**: (Hanya Trainer/Leader) Memantau aktivitas login dan operasional user lain.
  - **User Management**: (Hanya Admin) Menyetujui pendaftaran, mengubah role, atau menghapus akun.

## 2. KETIK (Simulation Chat)
Ruang simulasi untuk melatih kemampuan komunikasi tertulis melalui media chat.

- **Fungsi**: Peserta berinteraksi dengan AI yang berperan sebagai pelanggan dalam berbagai skenario.
- **Fitur Utama**:
  - **Skenario Dinamis**: Latihan berdasarkan berbagai tingkat kesulitan.
  - **AI feedback**: Analisis otomatis terhadap respon peserta menggunakan model Gemini.
  - **Riwayat Sesi**: Peserta bisa meninjau kembali percakapan sebelumnya.
- **Catatan Teknis**: Respons AI divalidasi sebagai string terlebih dahulu lalu disanitasi sebelum ditampilkan atau dipakai sebagai balasan konsumen.

## 3. PDKT (Email Simulation)
Workspace untuk latihan korespondensi email yang terstandarisasi.

- **Fungsi**: Simulasi penulisan email balasan untuk keluhan atau pertanyaan pelanggan.
- **Fitur Utama**:
  - **Rich Text Editor**: Interface penulisan email yang profesional.
  - **Struktur Formal**: Melatih penggunaan template, greeting, dan closing yang benar.
  - **Feedback Analitik**: Evaluasi kualitas bahasa dan ketepatan solusi.
- **Catatan Teknis**: Output model untuk draft email awal dan evaluasi QA divalidasi dulu sebagai string valid sebelum diparse sebagai JSON.

## 4. TELEFUN (Phone Simulation)
Modul simulasi komunikasi suara untuk melatih intonasi dan kecepatan respon telepon.

- **Fungsi**: Mempersiapkan peserta untuk menangani panggilan masuk/keluar (saat ini dalam tahap pengembangan/pembatasan fitur tertentu).
- **Fitur Utama**:
  - **Voice Interface**: Simulasi visual panggilan telepon.
  - **Context Modal**: Informasi data pelanggan yang muncul saat panggilan berlangsung.
- **Catatan Teknis**: Response AI untuk pembuka panggilan, balasan konsumen, dan scoring memakai fallback aman bila provider mengembalikan payload kosong atau tidak valid.

## 5. KTP / Profiler (Database Peserta)
Sistem manajemen database terstruktur untuk peserta training dan agen aktif.

- **Fungsi**: Penyimpanan terpusat data diri, riwayat training, dan penugasan tim.
- **Fitur Utama**:
  - **Struktur Hierarki**: Pengelompokan berdasarkan Tahun -> Folder (Batch) -> Sub-folder.
  - **Import/Export**: Mendukung pemrosesan data massal via Excel (ExcelJS).
  - **Profile Slides**: Representasi visual profil peserta yang bisa diekspor sebagai gambar.
  - **Team Management**: Pengaturan daftar tim yang dinamis.

## 6. SIDAK (QA Analyzer)
Platform analytics kualitas untuk memantau performa agent secara mendalam.

- **Fungsi**: Mengolah data temuan QA menjadi wawasan yang dapat ditindaklanjuti.
- **Fitur Utama**:
  - **Path to Zero**: Filosofi dashboard yang mendorong penurunan angka temuan setiap periode.
  - **Pareto Chart**: Identifikasi 80% masalah dari 20% penyebab utama (root cause).
  - **Ranking & Leaderboard**: Memantau agent dengan performa terbaik dan area yang butuh perbaikan.
  - **Input Temuan**: Form input terstandarisasi untuk trainer memasukkan hasil audit.
  - **Periode & Parameter**: Pengaturan periode penilaian dan bobot indikator penilaian.
- **Catatan Teknis**: Flow narasi/laporan berbasis AI memanfaatkan server action terpusat agar handling provider dan validasi output tetap konsisten.
