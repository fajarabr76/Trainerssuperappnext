# Telefun Known Issue - Railway Stale dist/server.js

## Status

- Status: `open`
- Prioritas: `high`
- Dampak: Telefun WebSocket proxy dapat terlihat berhasil connect ke Gemini, tetapi sesi tidak pernah masuk `setupComplete` karena Railway menjalankan build lama.

## Gejala

1. Railway log menampilkan `[Telefun] User connected: ...`.
2. Railway log menampilkan `[Telefun] Connected to Gemini Live API`.
3. Tidak ada log `[Telefun] Client setup message received, model: ...`.
4. Tidak ada log `[Telefun] Gemini setupComplete received`.
5. Beberapa detik kemudian muncul `[Telefun] Client connection closed` dan `[Telefun] Gemini WS Closed: 1000`.

## Akar Masalah yang Dicurigai

Telefun server dijalankan dengan `node dist/server.js`. Jika Railway tidak menjalankan `npm run build` sebelum `npm run start`, perubahan pada `src/server.ts` tidak masuk ke runtime container. Akibatnya log baru dan fix proxy tidak terlihat walaupun commit sudah masuk ke GitHub.

## Konfigurasi Railway yang Diharapkan

- Root Directory: `apps/telefun-server`
- Build Command: `npm install && npm run build`
- Start Command: `npm run start`

## Log Sehat yang Diharapkan

```text
[Telefun] User connected: ...
[Telefun] Connected to Gemini Live API
[Telefun] Client setup message received, model: models/gemini-3.1-flash-live-preview
[Telefun] Gemini setupComplete received
```

## Catatan Diagnostik

- `npm warn config production Use --omit=dev instead` bukan akar masalah koneksi; itu warning npm dari environment Railway.
- Jika `Client setup message received` sudah muncul tetapi `Gemini setupComplete received` belum muncul, fokus diagnosis pindah ke payload/model Gemini Live, bukan stale build.
