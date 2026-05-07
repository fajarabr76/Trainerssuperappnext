# Telefun Voice Assessment Changelog

## 2026-05-07

### Review Modal Auto-Open Fix

- Auto-open review modal setelah call selesai kini menggunakan server record (bukan optimistic record), sehingga `agentRecordingPath` tersedia dan tombol "Mulai Analisis" aktif.
- Sebelumnya, review modal dibuka dengan optimistic record (ID timestamp) yang tidak pernah match dengan server record (ID UUID), menyebabkan `agentRecordingPath` selalu undefined.
- Fallback review modal ditambahkan untuk 3 edge case: (1) server persist gagal, (2) user tidak terautentikasi, (3) server record sudah ada di state (`alreadyHasServerRecord`).
- Setiap fallback path dilengkapi `console.warn` terstruktur untuk observability.
- Bug scope `finalConsumerName` yang menyebabkan build error di Vercel juga diperbaiki.

### History & Recording Persistence Fix

- **Resilient History Loading**: `loadTelefunHistory` kini mendukung fallback otomatis jika kolom database baru (`recording_path`, `session_metrics`, dll) belum tersedia. Ini mencegah daftar riwayat menjadi kosong jika migration belum dijalankan.
- **Resilient Session Persistence**: `persistTelefunSession` akan mencoba melakukan insert ulang tanpa kolom `session_metrics` jika terjadi error schema, memastikan sesi tetap tersimpan meskipun database tertinggal satu versi.
- **Persistent Audio Downloads**: `HistoryModal` kini menggunakan Signed URL dari Supabase Storage untuk mengunduh rekaman. Ini memperbaiki bug di mana rekaman tidak bisa diakses/diunduh setelah halaman direfresh karena URL `blob:` browser sudah kedaluwarsa.
- **Local-Server History Sync**: Memperbaiki logika inisialisasi di `TelefunClient` yang menggabungkan riwayat `localStorage` (guest) dengan riwayat server secara transparan, mencegah hilangnya data sesi saat user baru login atau refresh.

- Kontrak skor voice assessment diseragamkan ke rentang `0-10` di prompt AI, validator sanitasi, dan UI (`/10`).
- Cache `voice_assessment` yang korup tidak lagi dianggap valid; server action akan re-run analisis untuk session terkait.
- Mapping riwayat Telefun sekarang menyertakan `recordingPath` dan `agentRecordingPath`, sehingga UI bisa mendeteksi ketersediaan rekaman agent-only sebelum analisis.
- `VoiceRadarChart` dipindah ke lazy loading via `next/dynamic` untuk menekan bundle awal pada modal review.
- Validasi path rekaman dipisah ke util non-server-action (`app/(main)/telefun/recordingPath.ts`) agar helper tetap testable tanpa mengekspos endpoint server action.
