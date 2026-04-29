# Telefun Operational Runbook

Dokumen ini adalah sumber operasional untuk Telefun pada snapshot sekarang. Gunakan bersama `docs/modules.md` untuk gambaran fitur dan `docs/TELEFUN_KNOWN_ISSUE_RAILWAY_STALE_DIST.md` untuk regresi Railway stale build.

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
- **Semua field terisi** → gunakan identitas custom trainer apa adanya.
- **Sebagian terisi** → isi bagian yang kosong dari satu profil default acak, sehingga identitas tetap lengkap dan konsisten dalam satu sesi.

### Konsistensi Identitas Final

`SessionConfig` final disimpan di state `activeSessionConfig` dan dipakai konsisten oleh:

- `PhoneInterface` (nama, nomor, kota, inisial avatar)
- Gemini Live prompt (`buildSystemInstruction`) — NAMA, LOKASI/DOMISILI, NOMOR HP, gender
- Gemini Live voice selection (`Fenrir` untuk laki-laki, `Kore` untuk perempuan)
- Scoring (`generateScore`)
- Recording callback dan histori (`persistTelefunSession`, `telefun_history`)

Voice Gemini Live sekarang dipilih berdasarkan `config.identity.gender`, bukan berdasarkan `consumerType.id`.

## Tempo Respons Konsumen

Telefun sekarang membawa pengaturan tempo respons yang mengikuti pola settings KETIK:

- `responsePacingMode: 'realistic' | 'training_fast'`
- Default aktif untuk Telefun adalah `realistic`
- Settings lama yang belum punya field ini akan dibaca sebagai `realistic`
- Pengaturan ini memengaruhi tempo bicara konsumen di voice live, bukan isi skenario atau identitas
- Mode `realistic` memakai pacing lebih natural dan instruksi prompt yang mendorong jeda, respons bertahap, dan interupsi yang tidak terlalu agresif
- Mode `training_fast` mempertahankan tempo yang lebih cepat untuk latihan berulang

Implementasi runtime-nya berada di `app/(main)/telefun/components/SettingsModal.tsx`, `app/(main)/telefun/page.tsx`, dan `app/(main)/telefun/services/geminiService.ts`.

## Sensitivitas Bicara Live

Gemini Live di Telefun sekarang memakai `realtimeInputConfig.automaticActivityDetection` untuk membuat endpointing lebih stabil saat user memberi respons pendek.

- `startOfSpeechSensitivity`: `START_SENSITIVITY_LOW`
- `endOfSpeechSensitivity`: `END_SENSITIVITY_LOW`
- `prefixPaddingMs`: `300`
- `silenceDurationMs`: `800`

Efek operasionalnya:

- kata singkat seperti `iya`, `baik`, `oke`, atau `kemudian` tidak mudah dianggap sebagai akhir giliran bicara
- percakapan tetap mengandalkan konteks prompt dan audio runtime, bukan deteksi diam yang terlalu agresif
- ini terpisah dari dead-air detector internal yang hanya memicu prompt saat user benar-benar diam terlalu lama

Kalau user melaporkan sesi berhenti saat merespons singkat, cek first-level ini dulu sebelum menyimpulkan masalah ada di prompt atau runtime proxy.

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

## Data Persistence

Telefun memakai tiga lapisan data:

- `localStorage.telefun_app_settings_v1`: settings local-first.
- `user_settings.settings.telefun`: settings per user saat login.
- `telefun_history`: riwayat sesi Telefun utama untuk user login.

Saat sesi selesai, `persistTelefunSession()` menyimpan row `telefun_history`, lalu membuat row `results` kompatibilitas dengan `module = 'telefun'` dan `details.legacy_history_id`.

Rekaman browser saat ini dibuat sebagai blob URL oleh `MediaRecorder`. Bucket Supabase `telefun-recordings` harus tetap ikut backup Storage karena fitur rekaman/upload Telefun memakai bucket tersebut saat object audio sudah dipersist ke Storage.

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
- Callback `onRecordingReady` dan `onEndSession` distabilkan melalui `useRef` agar tidak memicu re-mount efek koneksi.

## Indikator Input Suara

- Indikator volume di `PhoneInterface` membaca nilai dari `LiveSession.analyzeVolume()`.
- Perhitungan menggunakan **RMS (time-domain)** dari `analyser.getByteTimeDomainData()` dengan `fftSize = 1024`, bukan frequency average. Ini lebih responsif terhadap level suara manusia.
- Saat **mute aktif**, indikator tetap menunjukkan `0` dan label UI menampilkan **"Mic Mute"**.

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

## Smoke Test

Checklist manual setelah deploy:

1. Buka `/telefun` sebagai trainer/admin, lanjutkan dari warning modal.
2. Pastikan browser meminta izin mikrofon.
3. **Identitas default**: Kosongkan semua field identitas di Settings → Identitas, mulai panggilan, dan pastikan UI menampilkan nama, nomor, dan kota nyata dari pool default (bukan `Konsumen Simulasi`).
4. **Identitas custom**: Isi identitas custom lengkap, mulai panggilan, dan pastikan UI menampilkan identitas custom tersebut.
5. **Konsistensi gender & suara**: Dengan identitas perempuan, pastikan suara Gemini Live keluar dalam nada perempuan (`Kore`); dengan laki-laki, nada laki-laki (`Fenrir`).
6. Mulai panggilan dan cek UI berpindah dari `Memanggil...` ke `Menghubungkan...` lalu `Tersambung`.
7. Di Railway, pastikan log healthy call berurutan sampai `Gemini setupComplete received`.
8. Uji mute dan hold, lalu resume panggilan. Pastikan **mute tidak me-restart call atau memutar ringtone ulang**.
9. Pastikan **indikator input suara naik saat bicara** dan turun saat diam/mute.
10. Ucapkan respons singkat seperti `iya`, `baik`, atau `kemudian`; pastikan sesi tidak berhenti mendadak dan percakapan tetap lanjut.
11. Biarkan mute/diam sekitar 7 detik setelah tersambung; pastikan konsumen memanggil user secara natural tanpa memutus telepon.
12. Aktifkan hold; pastikan dead-air prompt **tidak muncul selama hold**.
13. Akhiri panggilan dan pastikan riwayat muncul di modal `Riwayat` dengan nama konsumen yang sama dengan UI saat panggilan.
14. Untuk user login, cek `telefun_history` terisi dan monitoring histori menampilkan sesi Telefun.
15. Jalankan panggilan singkat, akhiri sesi, lalu cek `ai_usage_logs` bertambah 1 row `telefun / voice_live`. Buka modal `Usage` dan cek module `telefun` bertambah.

## Debug Cepat

- `NEXT_PUBLIC_TELEFUN_WS_URL tidak terkonfigurasi`: set env frontend dan redeploy Next.js.
- Close code `4001`: token Supabase hilang/tidak valid; login ulang dan cek env Supabase proxy.
- Close code `4003`: origin Vercel belum masuk `ALLOWED_ORIGINS`.
- Close code `1006`: server proxy tidak reachable atau koneksi WebSocket putus mendadak.
- Close code `1011`: proxy gagal menghubungi Gemini atau Gemini mengembalikan error payload.
