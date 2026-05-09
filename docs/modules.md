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
  - **Durable Review Queue**: Review AI berjalan lewat antrean job (`ketik_review_jobs`) dengan status progres yang bisa dipolling. User memicu review secara manual melalui tombol "Mulai Analisis" setelah sesi disimpan.
  - **Indonesian Scoring Rubric (0-100)**: Evaluasi AI menggunakan rubrik Bahasa Indonesia dengan skala `0-100` (90-100: Sangat Baik, 75-89: Baik, 60-74: Cukup, <60: Perlu Coaching). Skor di-clamp di level server untuk konsistensi.
  - **Estimated Progress UI**: Tampilan loading saat analisis digantikan dengan progress bar informatif, persentase yang dianimasikan, estimasi waktu (ETA), dan status tekstual bertahap.
  - **Usage Bulanan**: Quick-view `Usage Bulan Ini` di bawah tombol `Riwayat`, dengan indikator kenaikan biaya sesi (`+Rp`).
- **Catatan Teknis**: KETIK menyimpan history chat sebagai sumber utama di `ketik_history`. Setelah sesi tersimpan, modal review terbuka dan user memicu review manual via tombol `Mulai Analisis`. Endpoint `POST /api/ketik/review` bersifat enqueue-only (idempotent), memasukkan job ke antrean, dan mengembalikan status `processing` (normalisasi dari `queued`) agar user mendapatkan visibilitas instan. Proses review sebenarnya dijalankan oleh worker atau melalui mekanisme pemrosesan terpisah. Endpoint polling (`/api/ketik/review/status`) menormalisasi status internal `queued` menjadi `processing` dan mengembalikan metrik skor secara langsung saat status `completed`. Frontend melakukan hidrasi skor secara instan untuk menghindari flicker bug visual "skor 0". Usage sesi dihitung setelah review manual selesai, diprioritaskan dalam biaya Rupiah (`+Rp`).

- **Dokumen Terkait**: `docs/AI_RELIABILITY_REFACTOR_V2_CHANGELOG_2026-05-08.md`, `docs/KETIK_MANUAL_AI_REVIEW_CHANGELOG_2026-05-08.md`, `docs/KETIK_KNOWN_ISSUE_TIMEOUT_CONTEXT_HISTORY.md`, `docs/KETIK_PDKT_SETTINGS_DRAFT_AUTOCOMMIT.md`, `docs/MONITORING_TOKEN_USAGE_BILLING.md`.

## 3. PDKT (Paham Dulu Kasih Tanggapan)
Workspace untuk latihan korespondensi email yang terstandarisasi.

- **Fungsi**: Simulasi penulisan email balasan untuk keluhan atau pertanyaan pelanggan.
- **Fitur Utama**:
  - **Detail View Inbound**: Email masuk utama tampil sebagai detail view, bukan bubble thread besar.
  - **Composer Reply**: Balasan memakai panel composer-style dengan field read-only untuk `Kepada`, `Cc`, dan `Subjek`.
  - **Riwayat Ringkas**: History sesi bisa di-collapse agar detail utama tetap fokus.
  - **Feedback Analitik**: Evaluasi kualitas bahasa dan ketepatan solusi tetap dipertahankan.
- **Catatan Teknis**: Output model untuk draft email awal dan evaluasi QA divalidasi dulu sebagai string valid sebelum diparse sebagai JSON. Di modal pengaturan, `Simpan Perubahan` ikut meng-commit draft skenario atau karakter yang masih terbuka. PDKT memiliki quick-view `Usage Bulan Ini` dengan akumulasi khusus modul `pdkt`. **Pemilihan Model AI**: PDKT mendukung penggunaan model AI yang sama dengan KETIK, mencakup baik direct Gemini maupun OpenRouter melalui `TEXT_SIMULATION_MODELS`. Default model untuk PDKT adalah direct `gemini-3.1-flash-lite`. Pengaturan model lama yang mengacu pada model yang sudah tidak tersedia akan otomatis dikoersi ke default terbaru saat settings dimuat. Evaluasi async `POST /api/pdkt/evaluate` menggunakan `config.selectedModel` sebagai sumber model kanonik (dengan fallback kompatibilitas ke key lama jika ada). UI selector memisahkan kategori model berdasarkan provider untuk kejelasan penggunaan.
- **Dokumen Terkait**: `docs/PDKT_EMAIL_COMPOSER_REFRESH_V1.md`, `docs/KETIK_PDKT_SETTINGS_DRAFT_AUTOCOMMIT.md`, `docs/MONITORING_TOKEN_USAGE_BILLING.md`.

## 4. TELEFUN (Telephone Fun)
Modul simulasi komunikasi suara untuk melatih intonasi dan kecepatan respon telepon.

- **Fungsi**: Mempersiapkan peserta untuk menangani panggilan telepon melalui simulasi suara berbasis AI.
- **Fitur Utama**:
  - **Live Voice Interface**: Panggilan dimulai dari ringtone, izin mikrofon, dan koneksi WebSocket.
  - **Hold & Mute**: User bisa mute mikrofon dan menahan panggilan.
  - **Recording & History**: Rekaman browser disimpan ke local history dan `telefun_history`.
- **Catatan Teknis**: Sesi live default memakai model transport `gemini-3.1-flash-live-preview`. Untuk flow non-live (`chat_response`, `first_message`, `score_generation`), Telefun sekarang routing provider-aware berdasarkan `selectedModel` (Gemini atau OpenRouter) melalui wrapper server-side terpusat. Pengaturan model Telefun melakukan coercion nilai legacy/invalid ke model yang valid agar tidak gagal diam-diam. Telefun mendukung dua transport: `gemini-live` (default) dan `openai-audio` (belum diimplementasi).
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
