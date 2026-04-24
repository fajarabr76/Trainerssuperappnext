# Authentication & Role-Based Access Control (RBAC)

Dokumen ini menjelaskan bagaimana sistem keamanan, pendaftaran, dan hak akses dikelola di Trainers SuperApp.

## Struktur Role

Aplikasi memiliki 4 role utama dengan hierarki akses sebagai berikut:

| Role | Deskripsi | Hak Akses Utama |
|---|---|---|
| **Admin** | Pengelola Sistem | Akses penuh seluruh modul, manajemen user (approve/reject/delete), audit logs, & konfigurasi sistem. |
| **Trainer** | Operasional Utama | Manajemen data Profiler, input & setting QA (SIDAK), monitoring, editor pricing/kurs usage billing, & audit logs terbatas. |
| **Leader** | Pengawas Tim | Melihat dashboard tim, monitoring aktivitas tim, monitoring usage billing lintas akun tanpa akses editor pricing/kurs, melihat data Profiler. |
| **Agent** | Pengguna Simulasi | Akses ke modul simulasi (Ketik, PDKT, Telefun), melihat dashboard pribadi. |

## Alur Pendaftaran & Approval

Untuk menjaga keamanan internal, pendaftaran user baru melalui proses approval:

1. **Registrasi**: User baru mendaftar melalui modal Auth di landing page.
2. **Pending State**: Akun baru secara default memiliki status `pending`.
3. **Approval Page**: User `pending` akan otomatis di-redirect ke halaman "Waiting for Approval" saat mencoba masuk.
4. **Approval**: Admin atau Trainer menyetujui akun melalui menu "Kelola Pengguna" di Dashboard.
5. **Approved Access**: Setelah disetujui (`status: 'approved'`), user baru dapat mengakses dashboard dan modul sesuai role yang ditetapkan.

## Implementasi Teknis

### 1. Unified Auth Guard
Sistem menggunakan helper server-side terpadu untuk menjaga akses route:
- `app/lib/authz.ts`: Berisi fungsi `requirePageAccess` yang menjadi kontrak tunggal untuk guard halaman server. Helper ini menangani redirect otomatis untuk tamu, user pending, akun ditolak/dihapus, dan ketidakcocokan role.
- `middleware.ts`: Melakukan pengecekan sesi aktif di tingkat edge/network sebelum request mencapai server/page.
- `app/components/AuthModal.tsx`: Menunggu sesi Supabase benar-benar aktif setelah login, lalu menentukan rute lanjutan berdasarkan status profil.

### 2. Guard Logic
Setiap halaman atau aksi sensitif dilindungi dengan pengecekan role:

```tsx
// Contoh Server Component Guard Terstandar
const { role } = await requirePageAccess({
  allowedRoles: ['admin', 'trainer']
});
```

### 3. Profile Read Contract & Recovery
Sistem sekarang membedakan dengan tegas antara state terminal akun dan kegagalan pembacaan profil yang bersifat transient.

- **PROFILE_FIELDS**: Gunakan konstanta `PROFILE_FIELDS` dari `app/lib/authz.ts` untuk canonical auth profile read di guard, middleware, dan alur lain yang membutuhkan kontrak profil penuh. Untuk kueri feature-specific, pilih kolom minimum yang dibutuhkan, tetapi jangan menambahkan kolom ke `select` tanpa memverifikasi field tersebut benar-benar ada di skema database.
- **Terminal states tetap hard-fail**: Jika profil berhasil terbaca dan status menunjukkan `rejected` atau `is_deleted = true`, sesi harus dianggap tidak valid untuk akses aplikasi dan user di-redirect kembali ke landing page dengan pesan yang sesuai.
- **Pending tetap diarahkan ke waiting approval**: Jika profil berhasil terbaca dan status `pending`, user harus diarahkan ke `/waiting-approval`.
- **Transient profile read failure tidak lagi menghancurkan sesi**: Jika pembacaan `profiles` gagal sementara karena network error, row belum tersedia, atau mismatch kontrak yang belum final, middleware dan alur login client tidak lagi langsung memanggil `signOut()`. Sistem mempertahankan sesi aktif, mencatat warning, lalu membiarkan recovery lanjut di route normal.
- **Default post-login path**: Setelah sesi login aktif, `AuthModal` memetakan `pending -> /waiting-approval`, `rejected -> signOut() + error`, dan untuk kondisi selain itu tetap mengarah ke `/dashboard`. Ini termasuk kasus pembacaan profil yang gagal sementara.

### 4. Access Matrix Ringkas

| Kondisi | Middleware / Guard | Hasil |
|---|---|---|
| Tidak ada sesi | Hard redirect | `/?auth=login` |
| `pending` | Redirect | `/waiting-approval` |
| `rejected` | Sign-out + redirect | `/?auth=login&message=rejected` |
| `is_deleted = true` | Sign-out + redirect | `/?auth=login&message=deleted` |
| Role tidak diizinkan | Redirect | `/dashboard` |
| Profil gagal dibaca sementara | Toleran, log warning | sesi dipertahankan |

### 5. Role Normalization
Aplikasi menormalkan role (misalnya dari `trainers` menjadi `trainer`) menggunakan fungsi `normalizeRole()` di `authz.ts`. Seluruh perbandingan role di tingkat aplikasi harus melalui fungsi ini untuk memastikan konsistensi.

### 6. Checklist Refactor Auth
Setiap refactor yang menyentuh auth flow atau tabel `profiles` wajib memeriksa poin berikut:
- Sinkronkan `PROFILE_FIELDS` dengan skema `profiles` yang aktual.
- Sinkronkan interface `Profile` di `app/types/auth.ts` dengan field yang benar-benar ada.
- Perbarui `docs/database.md` dan dokumen RBAC ini jika kontrak auth berubah.
- Jalankan `npm run lint` dan `npm run type-check`.
- Lakukan smoke test login minimal untuk akun `approved`, `pending`, `rejected`, dan skenario pembacaan profil transient.

### 7. Smoke Test Wajib Setelah Auth/Profile Refactor

- Login akun `approved` role `agent` harus berhasil dan mendarat di `/dashboard`.
- Login akun `pending` harus selalu berakhir di `/waiting-approval`.
- Login akun `rejected` harus memutus sesi dan menampilkan pesan penolakan.
- Simulasikan pembacaan `profiles` yang gagal sementara; sesi tidak boleh langsung dihancurkan hanya karena profil belum terbaca jelas.
- Setelah login `agent`, akses route terbatas seperti `/profiler` atau route SIDAK manajerial harus tetap ditolak sesuai matrix akses, tanpa dianggap sebagai kegagalan login.

## Monitoring Usage & Billing Access

Route `/dashboard/monitoring` memakai guard:

```tsx
const { role } = await requirePageAccess({
  allowedRoles: ['trainer', 'leader', 'admin']
});
```

Kontrak akses untuk fitur monitoring usage billing:

| Permukaan | Admin | Trainer | Leader | Agent |
|---|---|---|---|---|
| Histori simulasi lintas akun | Ya | Ya | Ya | Tidak |
| Tab `Penggunaan Token` lintas akun | Ya | Ya | Ya | Tidak |
| Tab `Harga & Kurs` | Ya | Ya | Tidak | Tidak |
| Simpan harga input/output model | Ya | Ya | Tidak | Tidak |
| Simpan kurs USD/IDR | Ya | Ya | Tidak | Tidak |
| Quick-view `Usage Bulan Ini` di modul pribadi | Ya, jika memakai modul | Ya, jika memakai modul | Ya, jika memakai modul | Ya |

Catatan:
- `leader` tetap dapat melihat agregasi usage lintas akun, tetapi tidak menerima editor pricing/kurs dari server.
- `agent` tidak memiliki akses ke monitoring lintas akun, tetapi tetap dapat melihat quick-view usage miliknya sendiri di KETIK dan PDKT.
- Detail perilaku fitur dan smoke test operasional ada di `docs/MONITORING_TOKEN_USAGE_BILLING.md`.

## Referensi Guardrail

- `app/components/AuthModal.tsx`
- `app/lib/supabase/middleware.ts`
- `app/lib/authz.ts`
- `docs/AUTH_KNOWN_ISSUE_TRANSIENT_PROFILE_READS.md`
