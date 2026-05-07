# Telefun Voice Assessment Changelog

## 2026-05-07

- Validator assessment suara kini fail-closed: payload non-object atau aspek wajib yang hilang tidak lagi disimpan ke database.
- Kontrak skor voice assessment diseragamkan ke rentang `0-10` di prompt AI, validator sanitasi, dan UI (`/10`).
- Cache `voice_assessment` yang korup tidak lagi dianggap valid; server action akan re-run analisis untuk session terkait.
- Mapping riwayat Telefun sekarang menyertakan `recordingPath` dan `agentRecordingPath`, sehingga UI bisa mendeteksi ketersediaan rekaman agent-only sebelum analisis.
- `VoiceRadarChart` dipindah ke lazy loading via `next/dynamic` untuk menekan bundle awal pada modal review.
- Validasi path rekaman dipisah ke util non-server-action (`app/(main)/telefun/recordingPath.ts`) agar helper tetap testable tanpa mengekspos endpoint server action.
