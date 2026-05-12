# Telefun Expanded Voices Customization

**Date:** 2026-05-12

## Ringkasan Perubahan

Mengembangkan kapabilitas modul Telefun dari yang sebelumnya memiliki pilihan suara statis (`Fenrir` untuk laki-laki dan `Kore` untuk perempuan) menjadi sistem yang mendukung **10 pilihan suara dinamis dari Gemini Live** yang dikelompokkan secara konsisten berdasarkan gender. Hal ini memberikan kebebasan kustomisasi simulasi yang lebih kaya dan mendalam bagi para trainer, dengan tetap mempertahankan integritas penentuan gender konsumen.

## Detail Implementasi

1. **Tipe Data (`app/types.ts`)**:
   - Memperluas interface `Identity` dan `ConsumerIdentitySettings` dengan menambahkan properti opsional `voiceName?: string`.
2. **Konstanta & Logika Cross-Gender Fallback (`app/(main)/telefun/constants.ts`)**:
   - Menambahkan daftar suara resmi: 5 Laki-laki (`Fenrir`, `Charon`, `Dipper`, `Puck`, `Ursa`) dan 5 Perempuan (`Kore`, `Aoede`, `Capella`, `Lyra`, `Vega`).
   - Menerapkan fungsi helper `resolveVoiceForGender()` yang cerdas: memastikan bahwa suara yang dipilih oleh user kustom valid untuk gender aktif. Jika terjadi ketidaksesuaian (misalnya akibat *fallback* atau perubahan dari mode acak), sistem secara otomatis melakukan *fallback* dengan memilih suara acak yang valid dari kelompok gender yang tepat.
   - Memperbarui `DEFAULT_IDENTITY_POOL` dengan memberikan pemetaan suara default spesifik untuk setiap profil guna menjamin variasi saat pemilihan acak.
   - Menjamin kompatibilitas mundur pada `parseTelefunSettings` bagi pengaturan tersimpan yang belum memiliki field `voiceName`.
3. **Layanan & Engine Integrasi (`app/(main)/telefun/services/geminiService.ts`)**:
   - Menghapus pemetaan statis usang `_STABLE_VOICE_MAP`.
   - Mengubah alur inisialisasi koneksi live (`connect`) dan *Text-to-Speech* cadangan (`generateConsumerVoice`) agar memanfaatkan fungsi `resolveVoiceForGender()`.
4. **Antarmuka Pengguna (`app/(main)/telefun/components/SettingsModal.tsx`)**:
   - Menambahkan *dropdown* Pilihan Suara pada *grid* pengaturan Identitas.
   - Mengimplementasikan logika *reset* otomatis pada `handleIdentityChange`: jika *trainer* mengubah opsi Jenis Kelamin, field `voiceName` akan otomatis dikosongkan agar pengguna diarahkan memilih suara dari kelompok yang sesuai, atau membiarkan sistem mengundinya secara otomatis.

Perubahan ini sepenuhnya bersifat *runtime/client-side* dan terintegrasi pada skema penyimpanan JSON *settings* di Supabase serta `localStorage` tanpa memerlukan *database migration*.
