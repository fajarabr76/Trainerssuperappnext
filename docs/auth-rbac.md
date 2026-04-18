# Authentication & Role-Based Access Control (RBAC)

Dokumen ini menjelaskan bagaimana sistem keamanan, pendaftaran, dan hak akses dikelola di Trainers SuperApp.

## Struktur Role

Aplikasi memiliki 4 role utama dengan hierarki akses sebagai berikut:

| Role | Deskripsi | Hak Akses Utama |
|---|---|---|
| **Admin** | Pengelola Sistem | Akses penuh seluruh modul, manajemen user (approve/reject/delete), audit logs, & konfigurasi sistem. |
| **Trainer** | Operasional Utama | Manajemen data Profiler, input & setting QA (SIDAK), monitoring, & audit logs terbatas. |
| **Leader** | Pengawas Tim | Melihat dashboard tim, monitoring aktivitas tim, melihat data Profiler. |
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

### 2. Guard Logic
Setiap halaman atau aksi sensitif dilindungi dengan pengecekan role:

```tsx
// Contoh Server Component Guard Terstandar
const { role } = await requirePageAccess({
  allowedRoles: ['admin', 'trainer']
});
```

### 3. Strict Profile Requirement (No-Profile-No-Entry)
Untuk mencegah degradasi role secara diam-diam (fallback ke role kosong/"User"), sistem menerapkan kebijakan ketat:
- **PROFILE_FIELDS**: Gunakan konstanta `PROFILE_FIELDS` dari `app/lib/authz.ts` untuk canonical auth profile read di guard, middleware, dan alur lain yang membutuhkan kontrak profil penuh. Untuk kueri feature-specific, pilih kolom minimum yang dibutuhkan, tetapi **DILARANG** menambahkan kolom baru ke dalam kueri `select` tanpa memverifikasi keberadaannya di skema database asli.
- **Explicit Recovery**: Jika user terautentikasi tetapi profilnya tidak terbaca (karena drift skema atau data korup), sistem akan langsung melakukan `signOut()` dan me-redirect user ke landing page dengan pesan `profile-unavailable`. Hal ini mencegah user terjebak dalam sesi "setengah login" yang tidak memiliki hak akses.

### 4. Role Normalization
Aplikasi menormalkan role (misalnya dari `trainers` menjadi `trainer`) menggunakan fungsi `normalizeRole()` di `authz.ts`. Seluruh perbandingan role di tingkat aplikasi harus melalui fungsi ini untuk memastikan konsistensi.

### 5. Checklist Refactor Auth
Setiap refactor yang menyentuh auth flow atau tabel `profiles` wajib memeriksa poin berikut:
- Sinkronkan `PROFILE_FIELDS` dengan skema `profiles` yang aktual.
- Sinkronkan interface `Profile` di `app/types/auth.ts` dengan field yang benar-benar ada.
- Perbarui `docs/database.md` dan dokumen RBAC ini jika kontrak auth berubah.
- Jalankan `npm run lint` dan `npm run type-check`.
- Lakukan smoke test login untuk akun `approved`, `pending`, `rejected`, dan skenario `profile-unavailable`.
