# Telefun Random Gender Mode

**Date:** 2026-05-12

## Ringkasan Perubahan

Menambahkan mode **Acak (Random)** pada pengaturan Jenis Kelamin di bagian Identitas modul Telefun. Hal ini mencegah simulasi menjadi statis jika pengguna tidak menentukan secara eksplisit apakah profil harus Laki-laki atau Perempuan.

## Detail Implementasi

1. **Tipe Data (`app/types.ts`)**:
   - `ConsumerIdentitySettings.gender` diperluas dari `'male' | 'female'` menjadi `'male' | 'female' | 'random'`.
2. **Parser Settings (`app/(main)/telefun/constants.ts`)**:
   - Nilai fallback untuk gender pada profil custom yang tidak diset (atau belum tersimpan) kini diset ke `'random'` sebagai default behavior yang baru.
   - `resolveFinalIdentity` diberikan fungsi helper pembantu `resolveGender` yang akan mengevaluasi opsi `'random'` pada saat runtime sesi dimulai. Jika `'random'`, sistem akan mengundi `Math.random() > 0.5` untuk menentukan apakah sesi menggunakan gender `'male'` atau `'female'`, memastikan bahwa pada akhirnya profil konsumen memiliki jenis kelamin yang eksplisit ketika diserahkan kepada Voice Engine.
3. **UI Pengaturan (`app/(main)/telefun/components/SettingsModal.tsx`)**:
   - Tab Identitas sekarang menyediakan opsi `<option value="random">Acak</option>` di dropdown Jenis Kelamin. 

Perubahan ini tidak memerlukan migrasi basis data karena pengaturan Telefun disimpan di `localStorage` dan field JSON payload `settings`.
