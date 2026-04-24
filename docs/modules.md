# Panduan Modul Aplikasi

Dokumen ini merinci fitur dan fungsi dari setiap modul utama yang tersedia di Trainers SuperApp.

## 1. Unified Dashboard
Dashboard tunggal yang berfungsi sebagai pusat informasi bagi semua tingkatan user.

- **Fungsi**: Menampilkan KPI ringkasan, grafik tren, dan log aktivitas terbaru.
- **Fitur Utama**:
  - **KPI Cards**: Ringkasan Total Temuan, Average Findings, Fatal Error Rate, dsb.
  - **Quick Shortcuts**: Navigasi cepat ke modul kerja sesuai role.
  - **Monitoring**: (Trainer/Leader/Admin) Memantau histori simulasi lintas akun, agregasi penggunaan token bulanan, dan editor harga/kurs untuk role yang diizinkan.
  - **User Management**: (Hanya Admin) Menyetujui pendaftaran, mengubah role, atau menghapus akun.
- **Catatan Teknis**: Halaman `/dashboard/monitoring` tetap menjadi permukaan terproteksi utama untuk histori simulasi dan usage billing bulanan. Periode default penggunaan token selalu mengikuti WIB / `Asia/Jakarta`, bukan timezone browser.

## 2. KETIK (Simulation Chat)
Ruang simulasi untuk melatih kemampuan komunikasi tertulis melalui media chat.

- **Fungsi**: Peserta berinteraksi dengan AI yang berperan sebagai pelanggan dalam berbagai skenario.
- **Fitur Utama**:
  - **Skenario Dinamis**: Latihan berdasarkan berbagai tingkat kesulitan.
  - **AI feedback**: Analisis otomatis terhadap respon peserta menggunakan model Gemini.
  - **Riwayat Sesi**: Peserta bisa meninjau kembali percakapan sebelumnya.
- **Catatan Teknis**: Respons AI divalidasi sebagai string terlebih dahulu lalu disanitasi sebelum ditampilkan atau dipakai sebagai balasan konsumen. Di modal pengaturan, `Simpan Perubahan` ikut meng-commit draft skenario atau karakter yang masih terbuka; draft yang belum lengkap akan memblok save dan menampilkan peringatan. Timeout closing sekarang branch-aware: bila pesan terakhir berasal dari `consumer`, konsumen tetap menutup chat tanpa mengonfirmasi solusi yang tidak ada; bila pesan terakhir dari `agent`, acknowledgement singkat hanya boleh muncul jika solusi eksplisit memang terdeteksi. KETIK sekarang juga memiliki quick-view `Usage Bulan Ini` di bawah tombol `Riwayat`, dengan akumulasi khusus modul `ketik`. Setelah sesi selesai, tombol dan modal menampilkan indikator kenaikan biaya sesi terakhir (`+Rp`) berdasarkan selisih total usage bulan berjalan sebelum-vs-sesudah sesi.

## 3. PDKT (Email Simulation)
Workspace untuk latihan korespondensi email yang terstandarisasi.

- **Fungsi**: Simulasi penulisan email balasan untuk keluhan atau pertanyaan pelanggan.
- **Fitur Utama**:
  - **Detail View Inbound**: Email masuk utama tampil sebagai detail view, bukan bubble thread besar.
  - **Composer Reply**: Balasan memakai panel composer-style dengan field read-only untuk `Kepada`, `Cc`, dan `Subjek`.
  - **Riwayat Ringkas**: History sesi bisa di-collapse agar detail utama tetap fokus.
  - **Feedback Analitik**: Evaluasi kualitas bahasa dan ketepatan solusi tetap dipertahankan.
- **Catatan Teknis**: Output model untuk draft email awal dan evaluasi QA divalidasi dulu sebagai string valid sebelum diparse sebagai JSON. Subject email awal dijaga realistis, boleh kosong, dan tidak boleh menjadi clue utama inti masalah. Di modal pengaturan, `Simpan Perubahan` ikut meng-commit draft skenario atau karakter yang masih terbuka; draft yang belum lengkap akan memblok save dan menampilkan peringatan. PDKT sekarang juga memiliki quick-view `Usage Bulan Ini` di bawah tombol `Riwayat`, dengan akumulasi khusus modul `pdkt`. Setelah sesi selesai, tombol dan modal menampilkan indikator kenaikan biaya sesi terakhir (`+Rp`) berdasarkan selisih total usage bulan berjalan sebelum-vs-sesudah sesi. Untuk sesi yang evaluasinya masih async, ditampilkan delta provisional + label "masih diproses" yang auto-update saat evaluasi selesai.

## 4. TELEFUN (Phone Simulation)
Modul simulasi komunikasi suara untuk melatih intonasi dan kecepatan respon telepon.

- **Fungsi**: Mempersiapkan peserta untuk menangani panggilan masuk/keluar (saat ini dalam tahap pengembangan/pembatasan fitur tertentu).
- **Fitur Utama**:
  - **Voice Interface**: Simulasi visual panggilan telepon.
  - **Context Modal**: Informasi data pelanggan yang muncul saat panggilan berlangsung.
- **Catatan Teknis**: Response AI untuk pembuka panggilan, balasan konsumen, dan scoring memakai fallback aman bila provider mengembalikan payload kosong atau tidak valid. Call AI Telefun sekarang ikut tercatat ke usage billing bulanan melalui action `voice_tts`, `chat_response`, `first_message`, dan `score_generation`, tetapi belum memiliki quick-view modal tersendiri.

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
- **Catatan Teknis**: Flow narasi/laporan berbasis AI memanfaatkan server action terpusat agar handling provider dan validasi output tetap konsisten. Narasi AI SIDAK untuk laporan sekarang ikut tercatat ke usage billing bulanan dengan action `report_generation`, tetapi tidak menambah quick-view usage di halaman SIDAK.
- **Catatan Stabilitas SIDAK**: Untuk mencegah regresi skor/kepatuhan dan clean-session handling, ikuti guardrails di `docs/SIDAK_SCORING_GUARDRAILS.md` sebelum merge dan sebelum deploy.
- **Catatan Clean Session**: Sesi tanpa temuan tetap dianggap audit valid untuk skor dan audited population, tetapi tidak boleh menambah total temuan, pareto, donut, atau defect ranking.
- **Riwayat Isu**: Investigasi mismatch skor detail agent sudah ditutup. Ringkasan penutupan ada di `docs/SIDAK_KNOWN_ISSUE_AGENT_DETAIL_SCORE.md`.
