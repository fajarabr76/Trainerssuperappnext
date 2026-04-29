# KETIK / PDKT / TELEFUN Settings Draft Auto-Commit

## Status

- Status: `resolved in worktree, pending commit`
- Prioritas: `medium`
- Dampak: user bisa kehilangan draft skenario atau karakter saat menekan `Simpan Perubahan` tanpa lebih dulu menekan tombol dedicated seperti `Simpan Skenario`, `Perbarui Skenario`, atau save karakter.

## Area Terdampak

- `app/(main)/ketik/components/SettingsModal.tsx`
- `app/(main)/pdkt/components/SettingsModal.tsx`
- `app/(main)/telefun/components/SettingsModal.tsx`

## Gejala

1. User membuka form tambah atau edit skenario, mengubah isi form, lalu langsung menekan `Simpan Perubahan`.
2. User membuka form tambah atau edit karakter, mengubah isi form, lalu langsung menekan `Simpan Perubahan`.
3. Perubahan pada form draft tidak ikut tersimpan karena daftar final di settings belum diperbarui oleh tombol dedicated form.
4. User di Telefun membuka form skenario atau karakter, lalu menutup modal lewat `X`, backdrop, atau `Batal` saat draft masih aktif.

## Akar Masalah Final

1. Draft form skenario dan karakter hidup di state lokal terpisah dari `localSettings`.
2. Tombol dedicated form memang meng-commit draft ke `localSettings`, tetapi tombol global `Simpan Perubahan` sebelumnya langsung menyimpan snapshot settings yang belum mematerialisasi draft terbuka.
3. Upaya awal yang hanya memanggil `setLocalSettings(...)` saat save global masih rawan membaca state lama karena update React bersifat async.
4. Di Telefun, perubahan inline pada form baru/edit juga harus diperlakukan sebagai draft aktif supaya close path tidak membuang perubahan diam-diam.

## Fix Yang Diterapkan

### 1. Dirty draft diperlakukan berdasarkan form aktif

- KETIK:
  - draft skenario dianggap aktif saat `isScenarioFormOpen`
  - draft karakter dianggap aktif saat `isConsumerFormOpen`
- PDKT:
  - draft skenario dianggap aktif saat mode add/edit terbuka
  - draft karakter dianggap aktif saat mode add/edit terbuka
- TELEFUN:
  - draft skenario dianggap aktif saat `isScenarioFormOpen`
  - draft karakter dianggap aktif saat `isConsumerFormOpen`

Dengan aturan ini, perubahan pada field apa pun di form yang masih terbuka tetap dianggap draft yang harus diproses oleh `Simpan Perubahan`.

### 2. Save global sekarang mematerialisasi draft secara sinkron

- Kedua modal memakai helper pure:
  - `applyScenarioDraft(base)`
  - `applyConsumerDraft(base)`
- `handleSave()` sekarang:
  1. mendeteksi draft yang masih aktif
  2. memvalidasi draft aktif
  3. memblok save bila draft belum lengkap
  4. membangun `finalSettings` secara sinkron dari `localSettings`
  5. baru memanggil `onSave(finalSettings)`

Ini menghilangkan bug stale-state saat save global membaca snapshot settings yang belum menerima hasil commit draft.

### 3. Draft invalid memblok save, bukan dibuang diam-diam

- Jika draft skenario belum lengkap, tab diarahkan ke `scenarios`, form di-scroll ke area edit, lalu warning ditampilkan.
- Jika draft karakter belum lengkap, tab diarahkan ke `consumers`, form di-scroll ke area edit, lalu warning ditampilkan.
- Modal tetap terbuka sampai draft diperbaiki atau dibatalkan oleh user.
- Di Telefun, close path juga menampilkan konfirmasi saat draft aktif masih belum disimpan, termasuk dari backdrop click.

## Perilaku Baru

- `Simpan Perubahan` sekarang dianggap final save untuk draft skenario dan karakter yang masih terbuka.
- User tidak wajib lagi menekan tombol dedicated form lebih dulu agar perubahan ikut tersimpan.
- Draft yang belum lengkap tidak ikut disimpan dan akan menghentikan save total dengan peringatan yang jelas.
- Draft kosong yang tidak sedang aktif tidak memblok proses save.
- Di Telefun, perubahan difficulty pada karakter baru juga dihitung sebagai draft aktif supaya tidak hilang saat modal ditutup.
- Di Telefun, perubahan toggle `Ikuti Skrip` atau `Sangat Kreatif` pada edit skenario juga dihitung sebagai draft aktif walaupun teks skrip tidak berubah.

## Regression Guard

- [ ] Tambah skenario, isi lengkap, lalu langsung klik `Simpan Perubahan` tanpa klik tombol dedicated; skenario baru harus ikut tersimpan.
- [ ] Edit skenario, ubah isi, lalu klik `Simpan Perubahan`; perubahan harus ikut tersimpan.
- [ ] Tambah atau edit karakter, lalu klik `Simpan Perubahan`; perubahan harus ikut tersimpan.
- [ ] Form aktif dengan field wajib kosong harus memblok save dan menampilkan warning.
- [ ] `onSave(...)` harus menerima `finalSettings` yang sudah mematerialisasi draft, bukan snapshot state lama.
- [ ] PDKT tetap mempertahankan preflight localStorage size check setelah `finalSettings` terbentuk.
- [ ] Di Telefun, ubah difficulty karakter baru lalu tekan `X` atau backdrop; warning konfirmasi harus muncul.
- [ ] Di Telefun, edit skenario yang sudah punya skrip lalu matikan `Ikuti Skrip` dan klik `Simpan Perubahan`; `scenario.script` harus ikut kosong setelah modal dibuka ulang.

## Smoke Steps Singkat

1. Di KETIK, buka form skenario, ubah data, jangan klik tombol save dedicated, lalu klik `Simpan Perubahan`.
2. Di KETIK, buka form karakter, ubah data, jangan klik tombol save dedicated, lalu klik `Simpan Perubahan`.
3. Di PDKT, ulangi langkah yang sama untuk skenario dan karakter.
4. Buka form aktif dengan field wajib kosong, lalu klik `Simpan Perubahan`; pastikan modal tidak tertutup dan warning muncul.
5. Verifikasi hasil simpan tetap muncul setelah modal dibuka ulang.

## Referensi Silang

- `docs/PDKT_EMAIL_COMPOSER_REFRESH_V1.md`
- `docs/modules.md`
