# Telefun Mute, VAD, and Response Handoff Changelog

## 2026-05-07

- Telefun: `Mute` diposisikan sebagai kontrol mikrofon/noise guard, bukan tombol submit akhir giliran user.
- Telefun Live runtime: transisi `unmuted -> muted` sekarang mengirim `realtimeInput.audioStreamEnd` sekali per transisi untuk menutup stream input audio dengan lebih tegas.
- Telefun Live runtime: local text nudge `clientContent` untuk memaksa jawaban setelah user selesai bicara dihapus dari jalur handoff pertanyaan user.
- VAD tuning: `endOfSpeechSensitivity` dinaikkan ke `END_SENSITIVITY_HIGH`, `silenceDurationMs` disetel ke `950`, dan `turnCoverage` memakai `TURN_INCLUDES_ONLY_ACTIVITY`.
- Observability: timeline client/proxy ditambah untuk `mute_changed`, `audio_stream_end_sent`, `audio_stream_resumed`, `input_transcription_seen`, dan `no_model_response_after_audio_end`.
- Smoke checklist Telefun diperbarui agar validasi fokus pada boundary audio stream dan bukti transkripsi input, bukan lagi `local_turn_nudge_sent`.
