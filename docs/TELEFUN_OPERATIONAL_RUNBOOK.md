# Telefun Operational Runbook

Dokumen ini adalah sumber operasional untuk Telefun pada snapshot sekarang. Gunakan bersama `docs/modules.md` untuk gambaran fitur dan `docs/TELEFUN_KNOWN_ISSUE_RAILWAY_STALE_DIST.md` untuk regresi Railway stale build.

## Ringkasan Runtime

Telefun terdiri dari dua runtime:

- Next.js route `/telefun` di `app/(main)/telefun`.
- Node WebSocket proxy di `apps/telefun-server` untuk koneksi Gemini Live.

Flow live call:

1. User melewati maintenance/warning gate Telefun.
2. `PhoneInterface` meminta izin mikrofon dan membuat `LiveSession`.
3. `LiveSession` membaca Supabase session browser dan membuka `NEXT_PUBLIC_TELEFUN_WS_URL?token=<access_token>`.
4. Proxy memvalidasi origin, path `/` atau `/ws`, dan access token Supabase.
5. Proxy membuka WebSocket Gemini Live API dan meneruskan setup/audio dua arah.
6. UI baru masuk status `Tersambung` setelah Gemini mengirim `setupComplete`.

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

Frontend Next.js:

```env
NEXT_PUBLIC_TELEFUN_WS_URL=wss://<telefun-server-domain>/ws
```

Telefun server:

```env
PORT=3001
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<anon-key>
GEMINI_API_KEY=<gemini-api-key>
ALLOWED_ORIGINS=http://localhost:3000,https://<vercel-domain>
```

`ALLOWED_ORIGINS=*` valid untuk development, tetapi production sebaiknya dibatasi ke origin aplikasi.

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

- `voice_tts`
- `chat_response`
- `first_message`
- `score_generation`

Catatan penting: stream Gemini Live via WebSocket proxy tidak otomatis mencatat token usage dari browser audio real-time. Row `ai_usage_logs` Telefun berasal dari call yang melewati wrapper server-side `generateGeminiContent()` dan mengirim `usageContext`.

## Smoke Test

Checklist manual setelah deploy:

1. Buka `/telefun` sebagai trainer/admin, lanjutkan dari warning modal.
2. Pastikan browser meminta izin mikrofon.
3. Mulai panggilan dan cek UI berpindah dari `Memanggil...` ke `Menghubungkan...` lalu `Tersambung`.
4. Di Railway, pastikan log healthy call berurutan sampai `Gemini setupComplete received`.
5. Uji mute dan hold, lalu resume panggilan.
6. Akhiri panggilan dan pastikan riwayat muncul di modal `Riwayat`.
7. Untuk user login, cek `telefun_history` terisi dan monitoring histori menampilkan sesi Telefun.
8. Jika flow memicu call non-live, buka modal `Usage` dan cek module `telefun` bertambah.

## Debug Cepat

- `NEXT_PUBLIC_TELEFUN_WS_URL tidak terkonfigurasi`: set env frontend dan redeploy Next.js.
- Close code `4001`: token Supabase hilang/tidak valid; login ulang dan cek env Supabase proxy.
- Close code `4003`: origin Vercel belum masuk `ALLOWED_ORIGINS`.
- Close code `1006`: server proxy tidak reachable atau koneksi WebSocket putus mendadak.
- Close code `1011`: proxy gagal menghubungi Gemini atau Gemini mengembalikan error payload.
