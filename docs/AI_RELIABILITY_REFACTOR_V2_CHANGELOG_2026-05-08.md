# AI Reliability Refactor v2 (Loophole-Closed) - 2026-05-08

## Ringkasan Eksekutif
Refactor V2 menyelesaikan kelemahan di pipeline review AI, khususnya pada modul KETIK, dengan memisahkan antrean (queueing) dari pemrosesan (processing). Pendekatan sinkron ("fire-and-forget") yang rentan terhadap timeout Vercel atau kegagalan sementara kini digantikan dengan alur kerja berbasis *job queue*, memastikan tidak ada status *stuck* tanpa hasil.

## Perubahan Kunci (Key Changes)

### 1. KETIK Durable Review Pipeline
- Menambahkan tabel `ketik_review_jobs` sebagai antrean untuk review AI KETIK dengan batas *lease* untuk memastikan job tidak dieksekusi berkali-kali secara bersamaan.
- Endpoint `POST /api/ketik/review` kini hanya melakukan *enqueue* (antre) secara idempoten dan mengembalikan status `processing`.
- Polling status dilakukan otomatis di UI selama sesi berada dalam status `pending` atau `processing`. UI mengunci tombol (menampilkan "Menganalisis Sesi...") untuk mencegah klik berulang.

### 2. KETIK Worker & Auto-heal
- Worker (`app/api/ketik/worker/route.ts`) kini berjalan terpisah, mengambil job yang pending atau *lease*-nya telah kedaluwarsa, memanggil Gemini API, dan menyimpan hasil dengan struktur atomic (menyimpan `ketik_session_reviews` terlebih dahulu sebelum mengupdate skor di `ketik_history`).
- **Auto-heal Mechanism:** Polling endpoint (`app/api/ketik/review/status/route.ts`) akan memeriksa sinkronisasi data. Jika `ketik_history` menyatakan 'completed' tetapi tidak ada baris review, status otomatis disetel kembali ke 'failed', memungkinkan user untuk memicu ulang.

### 3. Standarisasi Routing AI (PDKT & Telefun)
- Endpoint evaluasi PDKT dan alur AI Text di Telefun sekarang sepenuhnya menggunakan fungsi sentralisasi `normalizeModelId` dan merutekan *call* ke `gemini` atau `openrouter` sesuai dengan *provider* yang telah di-*mapping*.
- Pengaturan Telefun yang lama dengan ID model kedaluwarsa (`gemini-3.1-flash-lite-preview`) dikonversi secara otomatis ke standar ID terbaru.

### 4. Standarisasi Taksonomi Error
- Seluruh endpoint yang merutekan AI mematuhi konvensi pengembalian error: `{ success: false, error: string }`. Mekanisme *retry* hanya memproses error *transient* (misal timeout atau 429), sementara error skema/fatal akan langsung menggagalkan percobaan.

## Migration Details
Migrasi `20260508110000_ketik_review_jobs.sql` telah ditambahkan, membuat tabel `ketik_review_jobs` lengkap dengan Row Level Security dan Unique Index berbasis `session_id`.