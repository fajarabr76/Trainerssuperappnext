# Telefun Operational Runbook

Dokumen ini adalah sumber operasional untuk Telefun pada snapshot sekarang. Gunakan bersama `docs/modules.md` untuk gambaran fitur, `docs/TELEFUN_RANDOM_GENDER_CHANGELOG_2026-05-12.md` dan `docs/TELEFUN_MUTE_VAD_RESPONSE_HANDOFF_CHANGELOG_2026-05-07.md` untuk ringkasan perubahan user-facing terbaru, `docs/TELEFUN_KNOWN_ISSUE_RAILWAY_STALE_DIST.md` untuk regresi Railway stale build, dan `docs/TELEFUN_SMOKE_TEST_CHECKLIST.md` untuk uji manual pasca-perubahan runtime.

## Ringkasan Runtime

Telefun terdiri dari dua runtime:

- Next.js route `/telefun` di `app/(main)/telefun`.
- Node WebSocket proxy di `apps/telefun-server` untuk koneksi Gemini Live.

Flow live call:

1. User melewati maintenance/warning gate Telefun.
2. `startCall` di `page.tsx` memilih skenario aktif, tipe konsumen, dan menyelesaikan identitas final via `resolveFinalIdentity()`.
3. `PhoneInterface` meminta izin mikrofon dan membuat `LiveSession` dengan `SessionConfig` final.
4. `LiveSession` membaca Supabase session browser dan membuka `NEXT_PUBLIC_TELEFUN_WS_URL?token=<access_token>`.
5. Proxy memvalidasi origin, path `/` atau `/ws`, dan access token Supabase.
6. Proxy membuka WebSocket Gemini Live API dan meneruskan setup/audio dua arah.
7. UI baru masuk status `Tersambung` setelah Gemini mengirim `setupComplete`.

## Identitas Konsumen Default

Telefun tidak lagi menampilkan fallback generik (`Konsumen Simulasi`, `Nomor tidak tersedia`, `Kota belum diatur`).

### Pool Profil Default

File `app/(main)/telefun/constants.ts` menyimpan `DEFAULT_IDENTITY_POOL` berisi 12 profil konsumen Indonesia (nama, nomor telepon, kota, gender). Pool ini bersifat runtime-only dan tidak memerlukan migration database.

### Logika Resolusi Identitas

Fungsi `resolveFinalIdentity(identitySettings)` diterapkan di `startCall` sebelum layar panggilan muncul:

- **Semua field kosong** → pilih satu profil acak dari pool; semua atribut (nama, nomor, kota, gender) diambil dari profil yang sama.
- **Semua field terisi** → gunakan identitas custom trainer apa adanya. Jika field *gender* di-set ke **Acak (`random`)**, ia akan dievaluasi secara on-the-fly (`Math.random() > 0.5`) menjadi Laki-laki atau Perempuan sebelum sesi dimulai.
- **Sebagian terisi** → isi bagian yang kosong dari satu profil default acak, sehingga identitas tetap lengkap dan konsisten dalam satu sesi. Masing-masing diisikan secara berimbang sesuai atribut default.

### Konsistensi Identitas Final

`SessionConfig` final disimpan di state `activeSessionConfig` dan dipakai konsisten oleh:

- `PhoneInterface` (nama, nomor, kota, inisial avatar)
- Gemini Live prompt (`buildSystemInstruction`) — NAMA, LOKASI/DOMISILI, NOMOR HP, gender
- Gemini Live voice selection (Mendukung 10 pilihan suara dinamis: 5 Laki-laki: `Fenrir`, `Charon`, `Dipper`, `Puck`, `Ursa`; 5 Perempuan: `Kore`, `Aoede`, `Capella`, `Lyra`, `Vega`)
- Scoring (`generateScore`)
- Recording callback dan histori (`persistTelefunSession`, `telefun_history`)

Voice Gemini Live sekarang dipilih berdasarkan `config.identity.gender` dan `config.identity.voiceName`. Sistem menerapkan validasi *cross-gender* yang ketat via `resolveVoiceForGender()`: jika suara yang dipilih tidak sesuai dengan kelompok gender yang aktif (misalnya akibat *fallback* penentuan acak), sistem akan memilih satu suara secara acak dari kelompok gender yang benar, mencegah kebocoran/ketidaksesuaian suara dengan profil konsumen.

## Tempo Respons Konsumen

Telefun sekarang membawa pengaturan tempo respons yang mengikuti pola settings KETIK:

- `responsePacingMode: 'realistic' | 'training_fast'`
- Default aktif untuk Telefun adalah `realistic`
- Settings lama yang belum punya field ini akan dibaca sebagai `realistic`
- Pengaturan ini memengaruhi tempo bicara konsumen di voice live, bukan isi skenario atau identitas
- Mode `realistic` memakai pacing lebih natural dan instruksi prompt yang mendorong jeda, respons bertahap, dan interupsi yang tidak terlalu agresif
- Mode `training_fast` mempertahankan tempo yang lebih cepat untuk latihan berulang

Implementasi runtime-nya berada di `app/(main)/telefun/components/SettingsModal.tsx`, `app/(main)/telefun/page.tsx`, dan `app/(main)/telefun/services/geminiService.ts`.

## Skrip Percakapan Skenario

Settings skenario Telefun sekarang membedakan dua mode perilaku:

- `Ikuti Skrip`: field `scenario.script` aktif dan prompt Gemini Live memakai skrip itu sebagai panduan alur, fakta penting, emosi, dan urutan eskalasi.
- `Sangat Kreatif`: field skrip nonaktif dan save harus menulis `scenario.script = ''`, sehingga konsumen lebih bebas merespons dari judul, deskripsi, dan persona.

Format skrip yang didukung operasional:

- format dialog, misalnya `Agent:` dan `Konsumen:`
- format poin alur, misalnya `Awal:`, `Jika agen bertanya:`, `Akhir:`

Guardrail penting:

- Toggle `Ikuti Skrip` adalah bagian dari draft aktif. Mengubah toggle tanpa mengubah teks skrip tetap harus dianggap perubahan belum disimpan.
- Pada flow edit skenario, mematikan toggle lalu menekan `Simpan Perubahan` wajib ikut menghapus `scenario.script` di hasil akhir; perubahan ini tidak boleh hilang hanya karena teks skrip tidak ikut diubah.

## Sensitivitas Bicara Live

Gemini Live di Telefun sekarang memakai `realtimeInputConfig.automaticActivityDetection` untuk membuat endpointing lebih stabil saat user memberi respons pendek.

- `startOfSpeechSensitivity`: `START_SENSITIVITY_LOW`
- `endOfSpeechSensitivity`: `END_SENSITIVITY_HIGH`
- `prefixPaddingMs`: `300`
- `silenceDurationMs`: `950`
- `turnCoverage`: `TURN_INCLUDES_ONLY_ACTIVITY`
- `inputAudioTranscription`: aktif (`{}`)

Efek operasionalnya:

- akhir giliran user lebih cepat ditutup saat user benar-benar berhenti bicara, sehingga respons konsumen tidak terlalu lama menunggu boundary
- `turnCoverage: TURN_INCLUDES_ONLY_ACTIVITY` mengurangi noise dari segmen hening panjang yang tidak relevan ke user turn
- ini terpisah dari dead-air detector internal yang hanya memicu prompt saat user benar-benar diam terlalu lama

Kalau user melaporkan "sudah bertanya tapi konsumen diam", cek first-level ini dulu sebelum menyimpulkan masalah ada di prompt atau runtime proxy.

## Command

Dari root repo:

```bash
npm run telefun:dev
npm run telefun:build
npm run telefun:start
```

Dari folder server:

```bash
cd apps/telefun-server
npm install
npm run dev
npm run build
npm run start
```

`npm run start` menjalankan `node dist/server.js`, jadi production deploy wajib build ulang sebelum start.

## Environment

Frontend Next.js (`.env.local` di root repo):

```env
NEXT_PUBLIC_TELEFUN_WS_URL=wss://<telefun-server-domain>/ws
```

Untuk lokal, kedua service harus berjalan bersamaan:

```env
# .env.local di root project
NEXT_PUBLIC_TELEFUN_WS_URL=ws://localhost:3001/ws
```

Telefun server (`.env` di folder `apps/telefun-server`):

```env
PORT=3001
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
GEMINI_API_KEY=<gemini-api-key>
ALLOWED_ORIGINS=http://localhost:3000,https://<vercel-domain>
```

`ALLOWED_ORIGINS=*` valid untuk development, tetapi production sebaiknya dibatasi ke origin aplikasi.

### Menjalankan Telefun di Localhost

1. Pastikan `.env.local` root sudah berisi `NEXT_PUBLIC_TELEFUN_WS_URL=ws://localhost:3001/ws`.
2. Jalankan proxy server di terminal terpisah:
   ```bash
   cd apps/telefun-server
   npm install
   npm run dev
   ```
3. Jalankan frontend Next.js:
   ```bash
   npm run dev
   ```
4. Buka `http://localhost:3000/telefun` dan mulai panggilan.

Tanpa proxy server yang aktif, `LiveSession.connect()` akan gagal dengan error WebSocket atau `NEXT_PUBLIC_TELEFUN_WS_URL tidak terkonfigurasi`.

## Railway Deploy

Konfigurasi Railway yang diharapkan:

- Root Directory: `apps/telefun-server`
- Build Command: `npm install && npm run build`
- Start Command: `npm run start`

Health check tersedia di:

```text
GET /health
```

Response sehat mengembalikan `status: "ok"` dan flag config untuk Supabase/Gemini.

## Log Sehat

Urutan log healthy call:

```text
[Telefun] User connected: ...
[Telefun] Connected to Gemini Live API
[Telefun] Client setup message received, model: models/gemini-3.1-flash-live-preview
[Telefun] Gemini setupComplete received
```

Jika dua log pertama muncul tetapi `Client setup message received` tidak muncul, cek `docs/TELEFUN_KNOWN_ISSUE_RAILWAY_STALE_DIST.md`.

## Timeline Observability (Client + Proxy)

Runtime Telefun sekarang menambahkan timeline event terstruktur untuk investigasi jalur live voice.

### Correlation ID

- Client membuat `sessionId` per call.
- `sessionId` dikirim ke proxy sebagai query param `cid` pada WebSocket URL.
- Proxy memakai `cid` sebagai `correlationId` agar log browser dan server bisa dipasangkan untuk sesi yang sama.

### Prefix Log

- Client runtime: `[Telefun][Timeline]`
- Proxy server: `[Telefun][ProxyTimeline]`

### Event Kunci

Client timeline:
- `connect_start`, `mic_ready`, `ws_open`, `setup_sent`, `setup_complete_received`
- `audio_chunk_send` (cadence ringkas), `audio_stream_end_sent`, `audio_stream_resumed`, `mute_changed`
- `first_model_audio_chunk`, `turn_complete_received`, `interrupted_received`
- `local_user_turn_end_detected`, `input_transcription_seen`
- `playback_start`, `playback_end`
- `dead_air_prompt_sent`, `interruption_prompt_sent`
- `stalled_response_detected`, `recovering`, `no_model_response_after_audio_end`, `disconnect`

Proxy timeline:
- `client_connected`, `auth_passed`, `gemini_ws_open`
- `client_setup_forwarded`, `pending_message_flushed`, `usage_metadata_seen`
- `first_model_turn`, `input_transcription_seen`, `turn_complete`, `interrupted`, `gemini_error`, `close_path`

### Cara Baca Gejala

- **Connect/setup timeout**: sesi berhenti dengan reason `connect_setup_timeout` sebelum `setup_complete_received`.
- **Setup sukses tapi model diam**: ada `setup_complete_received` namun tidak ada `first_model_audio_chunk`/`first_model_turn`, lalu muncul `stalled_response_detected`.
- **Model respons ada tapi playback gagal**: ada `first_model_turn`/`first_model_audio_chunk` tapi tidak ada `playback_start`.
- **AI berhenti karena interupsi**: ada `interrupted_received` pada client atau `interrupted` pada proxy.
- **Diam karena dead-air path**: ada `dead_air_prompt_sent` tanpa error transport.
- **Transport failure**: reason `websocket_transport_failure` atau `ws_close_*` pada client, lalu korelasikan dengan `close_path` (client/gemini/server) di proxy.

### End-Of-Turn Semantics (VAD + Audio Stream)

Telefun tidak lagi mengandalkan `clientContent` nudge lokal untuk memaksa respons model setelah user selesai bicara. Alur yang dipakai:
- default: automatic VAD Gemini menutup giliran user
- fallback observability lokal: saat user selesai bicara dan hening sekitar 1 detik, state dipindah ke `ai_thinking` agar watchdog bisa mulai memantau response-start
- saat user transisi **unmuted -> muted**, client mengirim `realtimeInput.audioStreamEnd` sekali untuk flush audio cache upstream

Dengan model ini, `Mute` tetap menjadi kontrol mikrofon/noise guard, bukan tombol submit teks.

## Data Persistence

Telefun memakai tiga lapisan data:

- `localStorage.telefun_app_settings_v1`: settings local-first.
- `user_settings.settings.telefun`: settings per user saat login.
- `telefun_history`: riwayat sesi Telefun utama untuk user login.

Saat sesi selesai, `persistTelefunSession()` menyimpan row `telefun_history`, lalu membuat row `results` kompatibilitas dengan `module = 'telefun'` dan `details.legacy_history_id`.

Rekaman browser saat ini dibuat sebagai blob URL oleh `MediaRecorder`. Bucket Supabase `telefun-recordings` harus tetap ikut backup Storage karena fitur rekaman/upload Telefun memakai bucket tersebut saat object audio sudah dipersist ke Storage.

### Voice Assessment Cache Contract

- Voice assessment dibaca dari kolom `telefun_history.voice_assessment`.
- Cache hanya dianggap valid bila lolos validator server-side (`validateAssessment`) dengan struktur aspek wajib lengkap.
- Payload cache yang korup tidak dikembalikan ke UI; action akan lanjut re-analyze dari `agent_only.webm`.
- Semua skor quality (`overallScore` dan skor per-aspek) dikontrakkan pada rentang `0-10`.

## Usage Billing

Telefun memiliki quick-view `Usage` di halaman utama dan tercatat di `/dashboard/monitoring` untuk module `telefun`.

Action usage aktif:

- `voice_live`
- `voice_tts`
- `chat_response`
- `first_message`
- `score_generation`

Catatan penting: stream Gemini Live via WebSocket proxy sekarang tercatat secara otomatis. Proxy menangkap `usageMetadata` dari pesan upstream Gemini, melacak snapshot token terbesar selama sesi aktif, dan meng-flush satu row `voice_live` ke `ai_usage_logs` saat koneksi ditutup. Row non-live tetap tercatat dari call yang melewati wrapper server-side `generateGeminiContent()` dengan `usageContext`.

Pricing resmi Gemini Live (Google billing per modality):
- input text   $0.75 / 1M tokens
- input audio  $3.00 / 1M tokens ($0.005 / minute)
- input image  $1.00 / 1M tokens ($0.002 / minute)
- output text  $4.50 / 1M tokens
- output audio $12.00 / 1M tokens ($0.018 / minute)

Karena schema `ai_pricing_settings` saat ini menyimpan satu harga input dan satu harga output per model (blended rate), Telefun v1 memakai rate audio sebagai default operasional: input $3.00 / 1M token, output $12.00 / 1M token. Billing tetap estimasi sampai schema mendukung breakdown token per modality.

## Audio Lifecycle & Mute

- `PhoneInterface` memulai koneksi **sekali saja** saat `config` sesi berubah (panggilan baru).
- Klik **Mute/Unmute** hanya memanggil `LiveSession.setMute(...)` tanpa me-restart call, memutus WebSocket, atau memutar ulang ringtone.
- Saat transisi **unmuted -> muted**, runtime mengirim `audio_stream_end_sent` (`realtimeInput.audioStreamEnd: true`) satu kali agar Gemini menutup stream input dengan benar.
- Saat unmute dan audio chunk pertama kembali terkirim, timeline mencatat `audio_stream_resumed`.
- Callback `onRecordingReady` dan `onEndSession` distabilkan melalui `useRef` agar tidak memicu re-mount efek koneksi.

## Indikator Input Suara

- Indikator volume di `PhoneInterface` membaca nilai dari `LiveSession.analyzeVolume()`.
- Perhitungan menggunakan **RMS (time-domain)** dari `analyser.getByteTimeDomainData()` dengan `fftSize = 1024`, bukan frequency average. Ini lebih responsif terhadap level suara manusia.
- Kalibrasi indikator sekarang memakai:
  - **Noise gate** `VOLUME_NOISE_FLOOR = 0.005` untuk meredam hum/noise ringan saat user diam.
  - **EMA smoothing** `alpha = 0.3` agar bar tidak flicker tetapi tetap responsif saat user mulai bicara.
  - **Sensitivity scale** `VOLUME_SENSITIVITY_SCALE = 500` agar rentang bicara pelan-keras terbaca lebih jelas di UI.
- Loop volume memakai `requestAnimationFrame` dengan throttle ringan dan disimpan ke `volumeAnimationFrameId`; saat `disconnect()` loop ini di-`cancelAnimationFrame` agar tidak ada RAF yatim setelah sesi berakhir.
- Saat **mute aktif**, indikator tetap menunjukkan `0` dan label UI menampilkan **"Mic Mute"**.
- Saat level benar-benar senyap (`volume <= 0`), UI bar dirender baseline kecil **2%** supaya state diam terlihat tegas.

## Dead-Air Detector

`LiveSession` memiliki detektor diam otomatis untuk mencegah call mandeg saat user tidak berbicara:

- **Trigger**: level mikrofon RMS di bawah `0.01` atau mute aktif selama **~7 detik** berturut-turut saat call sudah `Tersambung`.
- **Cooldown**: minimal **12 detik** antar prompt dead-air agar konsumen tidak spam.
- **Guard conditions**: tidak aktif saat:
  - call sedang **hold** (`isHeld === true`)
  - AI sedang berbicara (`isAiSpeaking === true`)
  - call belum/belum lagi tersambung
- **Prompt**: dikirim melalui WebSocket yang sama menggunakan payload `clientContent` turn teks ke Gemini Live. Konsumen memanggil user secara natural sesuai persona (misal: *"Halo, masih terhubung?"*, *"Kok diam aja sih?"*).
- Timer dead-air direset otomatis saat user mulai berbicara lagi (RMS naik di atas threshold).

> Edge-case hold: saat `setHold(true)` dipanggil, internal state `isAiSpeaking` langsung direset ke `false` agar dead-air detector bisa aktif dengan benar setelah resume (jika memang seharusnya).

## Long-Speech Interruption Detector

`LiveSession` memiliki detektor bicara panjang otomatis untuk mencegah agen mendominasi percakapan tanpa jeda:

- **Trigger**: konsumen (user) berbicara terus-menerus tanpa diam selama **60 detik** berturut-turut saat call sudah `Tersambung`.
- **Cooldown**: minimal **60 detik** antar prompt interupsi agar tidak spam.
- **Guard conditions**: tidak aktif saat:
  - call sedang **hold** (`isHeld === true`)
  - call sedang **mute** (`isMuted === true`)
  - AI sedang berbicara (`isAiSpeaking === true`)
  - call terputus atau tidak ada sesi aktif
- **Reset**: timer bicara panjang direset saat user diam (RMS di bawah threshold dead-air) atau saat guard condition aktif.
- **Prompt**: dikirim melalui WebSocket yang sama dengan payload `clientContent` turn teks. Konsumen menyela secara natural sesuai persona untuk meminta agen bicara lebih pelan atau satu per satu.
- **Tone adaptif**: prompt menyela disesuaikan dengan tipe konsumen — konsumen marah/kesal akan menyela dengan nada tidak sabar, konsumen bingung/takut dengan nada ragu, konsumen sedih dengan nada lemah, dan konsumen netral dengan nada wajar.

> Edge-case: `nonSilentStartTime` dan `lastInterruptionTime` di-reset saat `disconnect()` agar state tidak bocor antar sesi.

### Beda dengan Dead-Air Detector

| Aspek | Dead-Air Detector | Long-Speech Interruption |
|---|---|---|
| **Trigger** | User diam > 7 detik | User bicara > 60 detik nonstop |
| **Cooldown** | 12 detik | 60 detik |
| **Tujuan** | Mencegah call mandeg | Mencegah agen bicara terlalu panjang |
| **Prompt tone** | Panggil user supaya bicara | Sela agen secara sopan |

## Pre-Timeout Closing Cues

Telefun mengirim isyarat penutupan natural ke AI saat call mendekati batas durasi maksimum:

- **Cue 30 detik**: dikirim sekali saat sisa waktu ≤ 30 detik (`remaining > 20`). Isyarat: *"Bersiaplah untuk menutup telepon sebentar lagi secara natural."*
- **Cue 20 detik**: dikirim sekali saat sisa waktu ≤ 20 detik (`remaining > 0`). Isyarat: *"PRIORITAS TINGGI: Kamu HARUS menutup telepon sekarang juga."*
- **Guard conditions**:
  - Hanya aktif saat `maxCallDuration > 0` (timer diaktifkan di settings).
  - Hanya saat call sudah `Tersambung`.
  - Masing-masing cue dikirim **sekali** per sesi panggilan (flag `timeCue30Sent` / `timeCue20Sent` di-reset saat panggilan baru dimulai).
- **Prompt tone**: disesuaikan dengan tipe konsumen (marah → kesal, sedih → pasrah, netral → sopan). AI tidak menyebutkan timer, waktu, atau angka — penutupan dilakukan secara natural dalam karakter konsumen.
- **Implementasi**: logika threshold di `timingGuards.ts` (`getTelefunTimeCueThreshold`), pengiriman cue di `PhoneInterface.tsx` via `sessionRef.current?.sendTimeCue()`, dan konstruksi prompt di `geminiService.ts` (`sendTimeCue`).

## Smoke Test

Checklist manual setelah deploy:

1. Buka `/telefun` sebagai trainer/admin, lanjutkan dari warning modal.
2. Pastikan browser meminta izin mikrofon.
3. **Identitas default**: Kosongkan semua field identitas di Settings → Identitas, mulai panggilan, dan pastikan UI menampilkan nama, nomor, dan kota nyata dari pool default (bukan `Konsumen Simulasi`).
4. **Identitas custom**: Isi identitas custom lengkap, mulai panggilan, dan pastikan UI menampilkan identitas custom tersebut.
5. **Konsistensi gender & suara**: Dengan identitas perempuan, pastikan suara Gemini Live keluar dalam nada dari kelompok perempuan (misal: `Kore`, `Aoede`, `Capella`, `Lyra`, `Vega`); dengan laki-laki, dari kelompok laki-laki (misal: `Fenrir`, `Charon`, `Dipper`, `Puck`, `Ursa`). Pilihan suara kustom di SettingsModal wajib dihormati selama konsisten dengan gender.
6. Mulai panggilan dan cek UI berpindah dari `Memanggil...` ke `Menghubungkan...` lalu `Tersambung`.
7. Di Railway, pastikan log healthy call berurutan sampai `Gemini setupComplete received`.
8. Uji mute dan hold, lalu resume panggilan. Pastikan **mute tidak me-restart call atau memutar ringtone ulang**.
9. Pastikan **indikator input suara naik saat bicara** dan turun saat diam/mute.
10. Saat user benar-benar diam, pastikan indikator tetap berada di baseline senyap (sekitar 2%), tidak berkedip acak karena noise ruangan.
11. Ucapkan respons singkat seperti `iya`, `baik`, atau `kemudian`; pastikan sesi tidak berhenti mendadak dan percakapan tetap lanjut.
12. Edit skenario yang sudah punya skrip, matikan toggle `Ikuti Skrip`, lalu langsung tekan `Simpan Perubahan`. Buka ulang settings dan pastikan skrip benar-benar nonaktif dan tidak muncul lagi sebagai `scenario.script`.
13. Edit skenario yang sama, aktifkan lagi `Ikuti Skrip`, isi skrip format dialog atau poin alur, simpan, lalu buka ulang settings. Pastikan toggle menyala dan isi skrip ter-load kembali.
14. Biarkan mute/diam sekitar 7 detik setelah tersambung; pastikan konsumen memanggil user secara natural tanpa memutus telepon.
15. Aktifkan hold; pastikan dead-air prompt **tidak muncul selama hold**.
16. Akhiri panggilan dan pastikan riwayat muncul di modal `Riwayat` dengan nama konsumen yang sama dengan UI saat panggilan.
17. Untuk user login, cek `telefun_history` terisi dan monitoring histori menampilkan sesi Telefun.
18. Jalankan panggilan singkat, akhiri sesi, lalu cek `ai_usage_logs` bertambah 1 row `telefun / voice_live`. Buka modal `Usage` dan cek module `telefun` bertambah.
19. **Long-speech interruption**: Bicaralah terus-menerus tanpa jeda selama ~60 detik. Pastikan konsumen menyela secara natural (misal: *"Bisa bicara lebih pelan?"*, *"Satu-satu dulu deh..."*) sesuai persona.
20. **Pre-timeout cue**: Aktifkan durasi panggilan (misal 2 menit) di Settings → Durasi. Mulai panggilan, biarkan berjalan hingga 30 detik terakhir — pastikan konsumen mulai memberi isyarat penutupan natural tanpa menyebut timer.
21. Di 20 detik terakhir, pastikan konsumen beralih ke nada lebih mendesak dan benar-benar menutup telepon sebelum timer habis.

## Debug Cepat

- `NEXT_PUBLIC_TELEFUN_WS_URL tidak terkonfigurasi`: set env frontend dan redeploy Next.js.
- Close code `4001`: token Supabase hilang/tidak valid; login ulang dan cek env Supabase proxy.
- Close code `4003`: origin Vercel belum masuk `ALLOWED_ORIGINS`.
- Close code `1006`: server proxy tidak reachable atau koneksi WebSocket putus mendadak.
- Close code `1011`: proxy gagal menghubungi Gemini atau Gemini mengembalikan error payload.
