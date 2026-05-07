# Telefun Smoke Test Checklist

Checklist ini dipakai setelah perubahan runtime live voice Telefun (timeline observability, interruption guard, stalled recovery, session state machine internal).

## Prasyarat

1. Frontend berjalan (`npm run dev`) dan proxy Telefun berjalan (`npm run telefun:dev` atau service Railway aktif).
2. `NEXT_PUBLIC_TELEFUN_WS_URL` valid.
3. Browser console terbuka untuk melihat `[Telefun][Timeline]`.
4. Log proxy tersedia untuk melihat `[Telefun][ProxyTimeline]`.

## Skenario 1: Short Acknowledgment Tidak Menghentikan AI

1. Mulai call hingga status `Tersambung`.
2. Saat AI bicara, jawab singkat: `iya`, `oke`, `hmm`.
3. Verifikasi:
   - AI tetap lanjut bicara.
   - Tidak ada stop prematur yang terasa seperti interupsi valid.
   - Timeline menunjukkan candidate pendek tidak berujung stop AI.

## Skenario 1B: Konsumen Merespon Pertanyaan User

1. Mulai call hingga status `Tersambung`.
2. Ajukan pertanyaan jelas selama 2-4 detik, lalu diam.
3. Verifikasi:
   - Timeline client menampilkan `local_user_turn_end_detected`.
   - Jika model mendukung transkripsi input, ada `input_transcription_seen` di client/proxy.
   - Konsumen mulai menjawab setelah user selesai bicara.
4. Ulangi dengan menekan mute setelah selesai bertanya.
5. Verifikasi:
   - Muncul `mute_changed` lalu `audio_stream_end_sent` satu kali per transisi mute.
   - Konsumen tetap mulai menjawab meskipun user menekan mute.

## Skenario 2: Interupsi Valid Menghentikan AI Sekali

1. Saat AI bicara, lakukan interupsi lebih panjang dan jelas (durasi > pendek acknowledgment).
2. Verifikasi:
   - AI berhenti satu kali secara natural.
   - Tidak ada repeated interruption loop.
   - Timeline menunjukkan jalur interruption valid.

## Skenario 3: Setup Sukses Tapi Model Diam Masuk Recovery

1. Bangun kondisi dimana setup selesai tetapi respons model tidak mulai (contoh: jaringan upstream melambat).
2. Verifikasi:
   - Ada `setup_complete_received`.
   - Tidak ada `first_model_audio_chunk` dalam waktu timeout response-start.
   - Timeline memunculkan `stalled_response_detected` dengan `timeoutType: response_start`.
   - Recovery berjalan bertahap (`mark_recovering` -> `no_model_response_after_audio_end` -> terminate bila tetap macet).

## Skenario 3B: Connect/Setup Timeout

1. Simulasikan koneksi yang tidak pernah mencapai `setup_complete_received`.
2. Verifikasi:
   - Session berhenti dengan reason `connect_setup_timeout`.
   - Timeout ini terpisah dari stall setelah setup selesai.

## Skenario 4: Mid-Response Stream Timeout

1. Saat AI sudah bicara, simulasikan stream berhenti mendadak.
2. Verifikasi:
   - Timeline menandai stall dengan `timeoutType: mid_response`.
   - Klasifikasi bukan dianggap setup timeout.

## Skenario 5: Bedakan Transport vs Playback vs Turn-Taking Failure

1. Verifikasi log pairing client-proxy dengan `correlationId` (`cid`).
2. Jika model turn masuk tapi audio gagal diputar:
   - Proxy punya `first_model_turn`.
   - Client punya `first_model_audio_chunk`.
   - Tidak ada `playback_start`, atau ada penanda `playback_layer_failure`.
3. Jika transport putus:
   - Cek `close_path` proxy dan `ws_close` client.

## Kriteria Lulus Smoke

1. Short acknowledgment tidak lagi menghentikan AI.
2. Interupsi valid menghentikan AI sekali tanpa loop.
3. Stalled-response recovery terlihat jelas dan terklasifikasi (`response_start` vs `mid_response`).
4. Incident bisa dipetakan dari timeline ke salah satu bucket:
   - connect/setup timeout
   - transport/socket failure
   - playback-layer issue
   - turn-taking/interruption issue

## Skenario 6: Voice Assessment Integrity

1. Selesaikan satu call sampai sesi tersimpan di histori.
2. Buka `Review Modal` -> tab `Kualitas Suara AI` -> klik `Mulai Analisis`.
3. Verifikasi:
   - hasil analisis tampil dan skor menggunakan format `/10`.
   - chart radar muncul normal (lazy loaded) tanpa memblokir render modal.
4. Uji sesi yang tidak memiliki `agent_only` recording path.
5. Verifikasi:
   - tombol analisis disabled.
   - UI menampilkan pesan bahwa rekaman suara agen belum tersedia.
