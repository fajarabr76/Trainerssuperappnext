# Authentication & Role-Based Access Control (RBAC)

Dokumen ini menjelaskan bagaimana sistem keamanan, pendaftaran, dan hak akses dikelola di Trainers SuperApp.

## Struktur Role

Aplikasi memiliki 4 role utama dengan hierarki akses sebagai berikut:

| Role | Deskripsi | Hak Akses Utama |
|---|---|---|
| **Admin** | Pengelola Sistem | Akses penuh seluruh modul, manajemen user (approve/reject/delete), ubah role. |
| **Trainer** | Operasional Utama | Manajemen data Profiler, input & setting QA (SIDAK), monitoring aktivitas. |
| **Leader** | Pengawas Tim | Melihat dashboard tim, monitoring aktivitas tim, melihat data Profiler. |
| **Agent** | Pengguna Simulasi | Akses ke modul simulasi (Ketik, PDKT, Telefun), melihat dashboard pribadi. |

## Alur Pendaftaran & Approval

Untuk menjaga keamanan internal, pendaftaran user baru melalui proses approval:

1. **Registrasi**: User baru mendaftar melalui modal Auth di landing page.
2. **Pending State**: Akun baru secara default memiliki status `pending`.
3. **Approval Page**: User `pending` akan otomatis di-redirect ke halaman "Waiting for Approval" saat mencoba masuk.
4. **Approval**: Admin atau Trainer level tinggi menyetujui akun melalui menu "Kelola Pengguna" di Dashboard.
5. **Active Access**: Setelah disetujui (`status: 'active'`), user baru dapat mengakses dashboard dan modul sesuai role yang ditetapkan.

## Implementasi Teknis

### 1. Unified Auth Hook
Sistem menggunakan hook kustom atau helper server-side untuk mengecek identitas:
- `app/lib/authz.ts`: Berisi fungsi `getCurrentUserContext` dan `normalizeRole` untuk memastikan role selalu konsisten.
- `middleware.ts`: Melakukan pengecekan sesi aktif di tingkat edge/network sebelum request mencapai server/page.

### 2. Guard Logic
Setiap halaman atau aksi sensitif dilindungi dengan pengecekan role:

```tsx
// Contoh Server Component Guard
const { role } = await getCurrentUserContext();
if (!['admin', 'trainer'].includes(role)) {
  redirect('/dashboard');
}
```

### 3. Database Security (RLS)
Keamanan data sesungguhnya berada di tingkat database menggunakan Supabase Row Level Security (RLS). Contoh kebijakan:
- `profiles`: User hanya bisa melihat profil sendiri, tapi Trainer bisa melihat semua profil.
- `results`: Peserta hanya bisa melihat hasil simulasinya sendiri.
- `profiler_peserta`: Hanya role 'Trainer' dan 'Leader' yang bisa melakukan operasi CRUD.

## Menu & Komponen Berbasis Role

Aplikasi secara dinamis menyembunyikan atau menampilkan elemen UI berdasarkan role:
- **Sidebar**: Link ke "Kelola Pengguna" hanya muncul jika role adalah `admin`.
- **Dashboard Shortcuts**: Admin mendapatkan pintasan "Kelola Pengguna", sementara Agent hanya mendapatkan pintasan modul simulasi.
- **Action Buttons**: Tombol "Hapus" atau "Ubah Role" di user management hanya aktif untuk role `admin`.
