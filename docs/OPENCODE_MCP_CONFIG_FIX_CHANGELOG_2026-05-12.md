# OpenCode MCP Server Configuration Fix & Disable

**Tanggal:** 12 Mei 2026  
**Modul/Konteks:** Integrasi IDE / Konfigurasi OpenCode (`opencode.json`)

## Latar Belakang Masalah
Pengguna mengalami kendala berupa kemunculan notifikasi error berulang dari ekstensi OpenCode di dalam IDE. Analisis awal menunjukkan bahwa error tersebut disebabkan oleh kegagalan inisialisasi dan koneksi ke beberapa MCP server yang dikonfigurasi di dalam file `opencode.json`:
1. **Kesalahan Pembungkusan Token:** Token akses Supabase (`sbp_...`) secara keliru ditulis di dalam format interpolasi variabel lingkungan `{env:sbp_...}`. Hal ini menyebabkan OpenCode mencoba mencari variabel lingkungan bernama token tersebut, yang tentunya bernilai `undefined`, sehingga memicu error autentikasi saat MCP server lokal Supabase dijalankan.
2. **Ketiadaan Flag Non-Interaktif:** Perintah untuk menjalankan `shadcn` via `npx` tidak menyertakan flag instalasi otomatis `-y`. Akibatnya, proses eksekusi di latar belakang tanpa terminal (TTY) mengalami *hang* atau gagal karena `npx` menunggu konfirmasi pengguna untuk mengunduh paket.

## Solusi dan Implementasi
Sesuai instruksi pengguna untuk memperbaiki argumen dan menonaktifkan konfigurasi jika berpotensi terus memicu error, langkah-langkah perbaikan berikut telah diterapkan pada `opencode.json` menggunakan format *unified diff patch*:
- **Koreksi Sintaks Argumen:** Mengubah `{env:sbp_742ef9a2b3b8c69c6d1c2cc63dfaf3e99fbb2819}` menjadi string literal `"sbp_742ef9a2b3b8c69c6d1c2cc63dfaf3e99fbb2819"` pada bagian `args` milik `supabase-mcp-server`.
- **Penambahan Flag `-y`:** Menyisipkan flag `"-y"` sebagai elemen pertama dalam array `args` untuk eksekusi server lokal `shadcn`.
- **Penonaktifan Server (Disable):** Mengubah status `"enabled": true` menjadi `"enabled": false` untuk semua entri di blok `mcp` (`context7`, `supabase-mcp-server`, dan `shadcn`). Tindakan preventif ini memastikan ekstensi OpenCode tidak lagi mencoba menginisialisasi koneksi latar belakang yang gagal, sehingga lingkungan pengembangan IDE pengguna kembali bersih dan bebas dari gangguan notifikasi error.
