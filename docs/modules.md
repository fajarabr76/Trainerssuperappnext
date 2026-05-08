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
  - **Riwayat Sesi**: Peserta bisa meninjau kembali percakapan sebelumnya dari `ketik_history`, termasuk AI review setelah sesi selesai.
  - **Usage Bulanan**: Quick-view `Usage Bulan Ini` di bawah tombol `Riwayat`.
- **Catatan Teknis**: KETIK menyimpan history chat sebagai sumber utama di `ketik_history`. Setelah sesi tersimpan, modal review terbuka dalam status `pending`. User harus memicu AI review secara manual melalui tombol di dalam modal. Ini memanggil `POST /api/ketik/review` dan memperbarui riwayat sesi dengan skor serta umpan balik secara dinamis. Jika review gagal sebelum selesai, status sesi ditandai `failed` agar tidak menggantung. Usage sesi dihitung setelah review manual selesai, sehingga request AI review ikut masuk ke delta token/call KETIK. Respons AI divalidasi sebagai string terlebih dahulu lalu disanitasi sebelum ditampilkan. Skor simulasi disembunyikan hingga proses analisis manual selesai untuk menghindari tampilan angka nol palsu. Di modal pengaturan, `Simpan Perubahan` ikut meng-commit draft skenario atau karakter yang masih terbuka. Saat timer habis, sesi masuk `expired`: user tetap bisa kirim pesan, tetapi konsumen tidak membalas lagi. **Pemilihan Model AI**: KETIK mendukung penggunaan model direct Gemini dan model via OpenRouter melalui daftar yang terkurasi khusus untuk simulasi teks (`TEXT_SIMULATION_MODELS`). Default model yang digunakan adalah direct `gemini-3.1-flash-lite`. UI pada pengaturan membedakan pilihan antara provider direct Gemini dan OpenRouter untuk memudahkan identifikasi.
- **Dokumen Terkait**: `docs/KETIK_MANUAL_AI_REVIEW_CHANGELOG_2026-05-08.md`, `docs/KETIK_KNOWN_ISSUE_TIMEOUT_CONTEXT_HISTORY.md`, `docs/KETIK_PDKT_SETTINGS_DRAFT_AUTOCOMMIT.md`, `docs/MONITORING_TOKEN_USAGE_BILLING.md`.

## 3. PDKT (Paham Dulu Kasih Tanggapan)
Workspace untuk latihan korespondensi email yang terstandarisasi.

- **Fungsi**: Simulasi penulisan email balasan untuk keluhan atau pertanyaan pelanggan.
- **Fitur Utama**:
  - **Detail View Inbound**: Email masuk utama tampil sebagai detail view, bukan bubble thread besar.
  - **Composer Reply**: Balasan memakai panel composer-style dengan field read-only untuk `Kepada`, `Cc`, dan `Subjek`.
  - **Riwayat Ringkas**: History sesi bisa di-collapse agar detail utama tetap fokus.
  - **Feedback Analitik**: Evaluasi kualitas bahasa dan ketepatan solusi tetap dipertahankan.
- **Catatan Teknis**: Output model untuk draft email awal dan evaluasi QA divalidasi dulu sebagai string valid sebelum diparse sebagai JSON. Di modal pengaturan, `Simpan Perubahan` ikut meng-commit draft skenario atau karakter yang masih terbuka. PDKT memiliki quick-view `Usage Bulan Ini` dengan akumulasi khusus modul `pdkt`. **Pemilihan Model AI**: PDKT mendukung penggunaan model AI yang sama dengan KETIK, mencakup baik direct Gemini maupun OpenRouter melalui `TEXT_SIMULATION_MODELS`. Default model untuk PDKT adalah direct `gemini-3.1-flash-lite`. Pengaturan model lama yang mengacu pada model yang sudah tidak tersedia akan otomatis dikoersi ke default terbaru saat settings dimuat. UI selector memisahkan kategori model berdasarkan provider untuk kejelasan penggunaan.
- **Dokumen Terkait**: `docs/PDKT_EMAIL_COMPOSER_REFRESH_V1.md`, `docs/KETIK_PDKT_SETTINGS_DRAFT_AUTOCOMMIT.md`, `docs/MONITORING_TOKEN_USAGE_BILLING.md`.

## 4. TELEFUN (Telephone Fun)
Modul simulasi komunikasi suara untuk melatih intonasi dan kecepatan respon telepon.

- **Fungsi**: Mempersiapkan peserta untuk menangani panggilan telepon melalui simulasi suara berbasis AI.
- **Fitur Utama**:
  - **Live Voice Interface**: Panggilan dimulai dari ringtone, izin mikrofon, dan koneksi WebSocket.
  - **Hold & Mute**: User bisa mute mikrofon dan menahan panggilan.
  - **Recording & History**: Rekaman browser disimpan ke local history dan `telefun_history`.
- **Catatan Teknis**: Sesi live default memakai model transport `gemini-3.1-flash-live-preview`. Pembuka/respons fallback/scoring non-live tetap lewat wrapper server-side `generateGeminiContent()` dengan model `gemini-3.1-flash-lite`. Telefun mendukung dua transport: `gemini-live` (default) dan `openai-audio` (belum diimplementasi).
- **Dokumen Terkait**: `docs/TELEFUN_OPERATIONAL_RUNBOOK.md`, `docs/TELEFUN_VOICE_ASSESSMENT.md`, `docs/TELEFUN_MUTE_VAD_RESPONSE_HANDOFF_CHANGELOG_2026-05-07.md`, `docs/TELEFUN_VOICE_ASSESSMENT_CHANGELOG_2026-05-07.md`, `docs/TELEFUN_KNOWN_ISSUE_RAILWAY_STALE_DIST.md`, `docs/MONITORING_TOKEN_USAGE_BILLING.md`.

## 5. KTP / Profiler (Kotak Tool Profil)
Sistem manajemen database terstruktur untuk peserta training dan agen aktif.

- **Fungsi**: Penyimpanan terpusat data diri, riwayat training, dan penugasan tim.
- **Catatan Teknis**: File peserta/foto memakai Supabase Storage bucket `profiler-foto`.
- **Dokumen Terkait**: `docs/architecture.md`.

## 6. SIDAK (Sistem Informasi Data Analisis Kualitas)
Platform analytics kualitas untuk memantau performa agent secara mendalam.

- **Fungsi**: Mengolah data temuan QA menjadi wawasan yang dapat ditindaklanjuti.
- **Dokumen Terkait**: `docs/SIDAK_LOGIC_AND_SCORING.md`, `docs/SIDAK_SCORING_GUARDRAILS.md`.
