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

### 3. Database Security (RLS)
Keamanan data sesungguhnya berada di tingkat database menggunakan Supabase Row Level Security (RLS). Contoh kebijakan:
- `profiles`: User hanya bisa melihat profil sendiri, tapi Trainer/Admin bisa melihat semua profil.
- `results`: Peserta hanya bisa melihat hasil simulasinya sendiri.
- `profiler_peserta`: Hanya role 'Trainer', 'Leader', dan 'Admin' yang bisa melakukan operasi CRUD.

## Menu & Komponen Berbasis Role

Aplikasi secara dinamis menyembunyikan atau menampilkan elemen UI berdasarkan role:
- **Management Panel**: Menu Monitoring, Kelola Pengguna, dan Activity Logs tersedia untuk Admin dan Trainer.
- **Dashboard Shortcuts**: Admin dan Trainer mendapatkan pintasan produktivitas yang sama (Input, Analisis, Ranking) untuk efisiensi operasional.
- **Action Buttons**: Aksi destruktif seperti "Hapus Pengguna" dibatasi khusus untuk role `admin`, sementara penghapusan "Activity Logs" dapat dilakukan oleh Admin dan Trainer.
