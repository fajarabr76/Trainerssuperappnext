# Telefun Voice Assessment Changelog

## 2026-05-07

### Review Modal Auto-Open Fix

- Auto-open review modal setelah call selesai kini menggunakan server record (bukan optimistic record), sehingga `agentRecordingPath` tersedia dan tombol "Mulai Analisis" aktif.
- Sebelumnya, review modal dibuka dengan optimistic record (ID timestamp) yang tidak pernah match dengan server record (ID UUID), menyebabkan `agentRecordingPath` selalu undefined.
- Fallback review modal ditambahkan untuk 3 edge case: (1) server persist gagal, (2) user tidak terautentikasi, (3) server record sudah ada di state (`alreadyHasServerRecord`).
- Setiap fallback path dilengkapi `console.warn` terstruktur untuk observability.
- Bug scope `finalConsumerName` yang menyebabkan build error di Vercel juga diperbaiki.

### Voice Assessment Core

- Validator assessment suara kini fail-closed: payload non-object atau aspek wajib yang hilang tidak lagi disimpan ke database.
- Kontrak skor voice assessment diseragamkan ke rentang `0-10` di prompt AI, validator sanitasi, dan UI (`/10`).
- Cache `voice_assessment` yang korup tidak lagi dianggap valid; server action akan re-run analisis untuk session terkait.
- Mapping riwayat Telefun sekarang menyertakan `recordingPath` dan `agentRecordingPath`, sehingga UI bisa mendeteksi ketersediaan rekaman agent-only sebelum analisis.
- `VoiceRadarChart` dipindah ke lazy loading via `next/dynamic` untuk menekan bundle awal pada modal review.
- Validasi path rekaman dipisah ke util non-server-action (`app/(main)/telefun/recordingPath.ts`) agar helper tetap testable tanpa mengekspos endpoint server action.
