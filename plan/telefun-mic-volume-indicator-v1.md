# Plan: Telefun Mic Volume Indicator Accuracy (v1)

## Tujuan
- Memperbaiki akurasi indikator suara Telefun agar bergerak proporsional terhadap volume asli mic user secara realtime.
- Menjaga scope tetap kecil dan aman, tanpa refactor besar di luar indikator suara.

## Ringkasan Masalah Saat Ini
- Sumber data indikator sudah berasal dari mic lokal, tetapi akurasi visual belum konsisten.
- Kalibrasi volume belum cukup halus (noise floor/smoothing), sehingga indikator bisa terasa tidak natural.
- Loop analisis volume perlu cleanup eksplisit agar tidak berisiko berjalan setelah sesi selesai.

## Scope Implementasi
1. `app/(main)/telefun/services/geminiService.ts`
- Pertahankan sumber audio dari local microphone stream (`this.stream`).
- Perkuat perhitungan volume realtime berbasis Web Audio API:
  - `AnalyserNode.getByteTimeDomainData`
  - RMS amplitude
  - normalisasi level `0..100`
- Tambahkan noise gate kecil agar noise ruangan tidak selalu menggerakkan indikator.
- Tambahkan smoothing (EMA) agar pergerakan tidak patah-patah tetapi tetap responsif.
- Simpan `requestAnimationFrame` id untuk bisa di-cancel saat cleanup.
- Pastikan cleanup saat `disconnect()`:
  - cancel animation frame
  - disconnect analyser/source
  - close audio context
  - reset state volume/smoothing

2. `app/(main)/telefun/components/PhoneInterface.tsx`
- Tetap pakai `session.onVolumeChange(level)` sebagai sumber indikator.
- Kalibrasi mapping status/width indikator agar low volume tidak terlihat seperti high activity.
- Jangan ubah desain besar komponen; hanya perbaikan perilaku indikator.

## Batasan Perubahan
- Tidak mengubah alur besar sesi Telefun (connect, hold, dead-air, usage logging, history).
- Tidak menambah dependency baru.
- `autoGainControl` tetap `true` untuk meminimalkan risiko regresi voice flow.

## Acceptance Criteria
1. Saat user diam, indikator mendekati 0/sangat kecil.
2. Saat user bicara pelan, indikator naik rendah.
3. Saat user bicara keras, indikator naik lebih tinggi secara proporsional.
4. Indikator tidak menjadi fake/random animation.
5. Setelah sesi selesai/unmount, tidak ada RAF loop yang tetap jalan.
6. Mic dan audio processing berhenti bersih setelah end call.

## Verifikasi
- `npm run lint`
- `npm run telefun:build`
- `npm run type-check`
- Manual smoke test:
  - diam / bicara pelan / bicara keras
  - mute on/off
  - end call dan unmount cleanup

## Output Tracking
- Catat file yang berubah.
- Catat akar bug teknis yang ditemukan.
- Catat hasil verifikasi command + manual smoke.
