# Panduan Modul Aplikasi

Dokumen ini merinci fitur dan fungsi dari setiap modul utama yang tersedia di Trainers SuperApp.

Konvensi nama modul:

- **KETIK** = Kelas Etika & Trik Komunikasi
- **PDKT** = Paham Dulu Kasih Tanggapan
- **TELEFUN** = Telephone Fun
- **KTP** = Kotak Tool Profil
- **SIDAK** = Sistem Informasi Data Analisis Kualitas

## 1. Unified Dashboard
Dashboard tunggal yang berfungsi sebagai pusat informasi bagi semua tingkatan user.

- **Fungsi**: Menampilkan KPI ringkasan, grafik tren, dan log aktivitas terbaru.
- **Fitur Utama**:
  - **KPI Cards**: Ringkasan Total Temuan, Average Findings, Fatal Error Rate, dsb.
  - **Quick Shortcuts**: Navigasi cepat ke modul kerja sesuai role.
  - **Monitoring**: (Trainer/Leader/Admin) Memantau histori simulasi lintas akun, agregasi penggunaan token bulanan, dan editor harga/kurs untuk role yang diizinkan.
  - **User Management**: (Hanya Admin) Menyetujui pendaftaran, mengubah role, atau menghapus akun.
- **Catatan Teknis**: Halaman `/dashboard/monitoring` tetap menjadi permukaan terproteksi utama untuk histori simulasi dan usage billing bulanan. Periode default penggunaan token selalu mengikuti WIB / `Asia/Jakarta`, bukan timezone browser.
- **Dokumen Terkait**: `docs/MONITORING_TOKEN_USAGE_BILLING.md`, `docs/auth-rbac.md`.

## 2. KETIK (Kelas Etika & Trik Komunikasi)
Ruang simulasi untuk melatih kemampuan komunikasi tertulis melalui media chat.

- **Fungsi**: Peserta berinteraksi dengan AI yang berperan sebagai pelanggan dalam berbagai skenario.
- **Fitur Utama**:
  - **Skenario Dinamis**: Latihan berdasarkan berbagai tingkat kesulitan.
  - **Roleplay Konsumen**: Balasan AI difokuskan sebagai konsumen chat natural, bukan evaluator.
  - **Riwayat Sesi**: Peserta bisa meninjau kembali percakapan sebelumnya dari `ketik_history`.
  - **Usage Bulanan**: Quick-view `Usage Bulan Ini` di bawah tombol `Riwayat`.
- **Catatan Teknis**: KETIK tidak menjalankan evaluasi/scoring otomatis seperti PDKT; modul ini menyimpan history chat sebagai sumber utama dan tetap membuat row `results` kompatibilitas dengan `legacy_history_id`. Respons AI divalidasi sebagai string terlebih dahulu lalu disanitasi sebelum ditampilkan atau dipakai sebagai balasan konsumen. Di modal pengaturan, `Simpan Perubahan` ikut meng-commit draft skenario atau karakter yang masih terbuka; draft yang belum lengkap akan memblok save dan menampilkan peringatan. Timeout closing sekarang branch-aware: bila pesan terakhir berasal dari `consumer`, konsumen tetap menutup chat tanpa mengonfirmasi solusi yang tidak ada; bila pesan terakhir dari `agent`, acknowledgement singkat hanya boleh muncul jika solusi eksplisit memang terdeteksi. Setelah sesi selesai, tombol dan modal menampilkan indikator kenaikan biaya sesi terakhir (`+Rp`) berdasarkan selisih total usage bulan berjalan sebelum-vs-sesudah sesi.
- **Dokumen Terkait**: `docs/KETIK_KNOWN_ISSUE_TIMEOUT_CONTEXT_HISTORY.md`, `docs/KETIK_PDKT_SETTINGS_DRAFT_AUTOCOMMIT.md`, `docs/MONITORING_TOKEN_USAGE_BILLING.md`.

## 3. PDKT (Paham Dulu Kasih Tanggapan)
Workspace untuk latihan korespondensi email yang terstandarisasi.

- **Fungsi**: Simulasi penulisan email balasan untuk keluhan atau pertanyaan pelanggan.
- **Fitur Utama**:
  - **Detail View Inbound**: Email masuk utama tampil sebagai detail view, bukan bubble thread besar.
  - **Composer Reply**: Balasan memakai panel composer-style dengan field read-only untuk `Kepada`, `Cc`, dan `Subjek`.
  - **Riwayat Ringkas**: History sesi bisa di-collapse agar detail utama tetap fokus.
  - **Feedback Analitik**: Evaluasi kualitas bahasa dan ketepatan solusi tetap dipertahankan.
- **Catatan Teknis**: Output model untuk draft email awal dan evaluasi QA divalidasi dulu sebagai string valid sebelum diparse sebagai JSON. Subject email awal dijaga realistis, boleh kosong, dan tidak boleh menjadi clue utama inti masalah. Di modal pengaturan, `Simpan Perubahan` ikut meng-commit draft skenario atau karakter yang masih terbuka; draft yang belum lengkap akan memblok save dan menampilkan peringatan. PDKT sekarang juga memiliki quick-view `Usage Bulan Ini` di bawah tombol `Riwayat`, dengan akumulasi khusus modul `pdkt`. Setelah sesi selesai, tombol dan modal menampilkan indikator kenaikan biaya sesi terakhir (`+Rp`) berdasarkan selisih total usage bulan berjalan sebelum-vs-sesudah sesi. Untuk sesi yang evaluasinya masih async, ditampilkan delta provisional + label "masih diproses" yang auto-update saat evaluasi selesai.
- **Dokumen Terkait**: `docs/PDKT_EMAIL_COMPOSER_REFRESH_V1.md`, `docs/KETIK_PDKT_SETTINGS_DRAFT_AUTOCOMMIT.md`, `docs/MONITORING_TOKEN_USAGE_BILLING.md`.

## 4. TELEFUN (Telephone Fun)
Modul simulasi komunikasi suara untuk melatih intonasi dan kecepatan respon telepon.

- **Fungsi**: Mempersiapkan peserta untuk menangani panggilan masuk/keluar melalui simulasi suara berbasis AI.
- **Fitur Utama**:
  - **Voice Interface**: Simulasi visual panggilan telepon.
  - **Context Modal**: Informasi data pelanggan yang muncul saat panggilan berlangsung.
- **Catatan Teknis**: Response AI untuk pembuka panggilan, balasan konsumen, dan scoring memakai fallback aman bila provider mengembalikan payload kosong atau tidak valid. Call AI Telefun sekarang ikut tercatat ke usage billing bulanan melalui action `voice_tts`, `chat_response`, `first_message`, dan `score_generation`, tetapi belum memiliki quick-view modal tersendiri.
- **Dokumen Terkait**: `docs/MONITORING_TOKEN_USAGE_BILLING.md`.

## 5. KTP / Profiler (Kotak Tool Profil)
Sistem manajemen database terstruktur untuk peserta training dan agen aktif.

- **Fungsi**: Penyimpanan terpusat data diri, riwayat training, dan penugasan tim.
- **Fitur Utama**:
  - **Struktur Hierarki**: Pengelompokan berdasarkan Tahun -> Folder (Batch) -> Sub-folder.
  - **Import/Export**: Mendukung pemrosesan data massal via Excel (ExcelJS).
  - **Profile Slides**: Representasi visual profil peserta yang bisa diekspor sebagai gambar.
  - **Team Management**: Pengaturan daftar tim yang dinamis.
- **Catatan Teknis**: File peserta/foto memakai Supabase Storage bucket `profiler-foto`. Flow export/slide bergantung pada route protected dan beberapa halaman profiler memakai rendering dinamis agar data terbaru terbaca.

## 6. SIDAK (Sistem Informasi Data Analisis Kualitas)
Platform analytics kualitas untuk memantau performa agent secara mendalam.

- **Fungsi**: Mengolah data temuan QA menjadi wawasan yang dapat ditindaklanjuti.
- **Fitur Utama**:
  - **Path to Zero**: Filosofi dashboard yang mendorong penurunan angka temuan setiap periode.
  - **Pareto Chart**: Identifikasi 80% masalah dari 20% penyebab utama (root cause).
  - **Ranking & Leaderboard**: Memantau agent dengan performa terbaik dan area yang butuh perbaikan.
  - **Input Temuan**: Form input terstandarisasi untuk trainer memasukkan hasil audit, termasuk mode data keseluruhan untuk input periode lama agent historis/excluded.
  - **Periode & Parameter**: Pengaturan periode penilaian dan bobot indikator penilaian.
- **Catatan Teknis**: Flow narasi/laporan berbasis AI memanfaatkan server action terpusat agar handling provider dan validasi output tetap konsisten. Narasi AI SIDAK untuk laporan sekarang ikut tercatat ke usage billing bulanan dengan action `report_generation`, tetapi tidak menambah quick-view usage di halaman SIDAK.
- **Catatan Dashboard Summary**: Dashboard SIDAK memakai summary rollup durable untuk scope global tanpa folder filter, dengan fallback ke RPC lama bila summary belum lengkap atau folder filter aktif. Scope commit dan checklist testing staging ada di `docs/QA_DASHBOARD_SUMMARY_ROLLUP_STAGING.md`.
- **Catatan Stabilitas SIDAK**: Untuk mencegah regresi skor/kepatuhan dan clean-session handling, ikuti guardrails di `docs/SIDAK_SCORING_GUARDRAILS.md` sebelum merge dan sebelum deploy.
- **Catatan Clean Session**: Sesi tanpa temuan tetap dianggap audit valid untuk skor dan audited population, tetapi tidak boleh menambah total temuan, pareto, donut, atau defect ranking.
- **Catatan Historical Agent Input**: Directory dan input SIDAK tetap filtered secara default. Toggle `Tampilkan Data Keseluruhan` dipakai untuk agent yang sudah excluded karena promosi/pindah jabatan, dan tombol `INPUT AUDIT` dari detail agent harus menuju `/qa-analyzer/input`.
- **Dokumentasi Logika**: Rincian logika, rumus, dan contoh perhitungan ada di `docs/SIDAK_LOGIC_AND_SCORING.md`.
- **Riwayat Isu**: Investigasi mismatch skor detail agent sudah ditutup. Ringkasan penutupan ada di `docs/SIDAK_KNOWN_ISSUE_AGENT_DETAIL_SCORE.md`.
- **Dokumen Terkait**: `docs/QA_DASHBOARD_SUMMARY_ROLLUP_STAGING.md`, `docs/SIDAK_SCORING_GUARDRAILS.md`, `docs/QA_SMOKE_TEST_VERSIONED_RULES.md`, `docs/SIDAK_KNOWN_ISSUE_SERVICE_DEFAULT_CSO_CALL.md`, `docs/SIDAK_KNOWN_ISSUE_RANKING_COMPLETENESS_PARAMETER_ORDER.md`, `docs/SIDAK_KNOWN_ISSUE_HISTORICAL_AGENT_INPUT.md`.
