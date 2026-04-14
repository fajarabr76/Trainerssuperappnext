# AGENT.md - Trainers SuperApp

## Tujuan
Dokumen ini adalah panduan kerja untuk agent yang membantu pengembangan repo ini. Ikuti struktur dan pola yang sudah ada di codebase. Jangan mengubah arah produk tanpa alasan yang jelas.

## Ringkasan Produk
Trainers SuperApp adalah aplikasi internal untuk operasional contact center training, simulasi, database peserta, monitoring, dan quality assurance.

Modul yang saat ini aktif di aplikasi:
- `Dashboard` untuk ringkasan performa dan aktivitas
- `KETIK` untuk simulasi chat
- `PDKT` untuk simulasi email
- `TELEFUN` untuk simulasi telepon
- `KTP / Profiler` untuk database peserta dan agent
- `SIDAK / QA Analyzer` untuk analisis temuan QA
- `Monitoring` untuk ringkasan aktivitas dan operasional

## Stack
- Next.js 15 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase untuk auth, database, storage, dan RLS
- Motion untuk animasi
- Recharts untuk visualisasi data
- Lucide React untuk icon

## Prinsip Kerja
- Ikuti struktur route, komponen, dan service yang sudah ada.
- Jangan refactor besar tanpa diminta.
- Jangan menambah dependency baru kalau library existing sudah cukup.
- Pertahankan dark mode dan visual language yang sudah dipakai.
- Prioritaskan perubahan yang kecil, jelas, dan aman untuk production.

## Area yang Perlu Dijaga
### Auth dan akses
- Login diarahkan lewat landing page `/?auth=login`.
- User dengan status `pending` masuk ke halaman approval.
- Role yang dipakai saat ini adalah `Trainer`, `Leader`, dan `Agent`, dengan beberapa area admin internal yang sudah ada di codebase.
- Jangan membuka route sensitif tanpa cek akses yang sesuai.

### Dashboard
- Dashboard utama mengambil data dari service QA dan activity log.
- Perubahan pada ringkasan performa harus tetap kompatibel dengan data existing.

### Profiler
- Struktur data utama tetap hierarki tahun -> folder -> peserta.
- Area ini punya banyak fitur export/import, jadi perubahan UI jangan memecah alur existing.

### QA Analyzer / SIDAK
- Halaman index mengarah ke dashboard SIDAK.
- Fokus area ini adalah analisis temuan, ranking, tren, dan detail agent.

## Cara Kerja Yang Disarankan
1. Baca file yang terlibat dulu.
2. Pahami hubungan antara page, client component, action, dan service.
3. Cek apakah perubahan berdampak ke route lain, auth, atau layout shared.
4. Implementasikan perubahan sekecil mungkin.
5. Verifikasi dengan lint atau type check jika ada perubahan kode.

## Aturan Praktis
- Gunakan TypeScript yang eksplisit.
- Gunakan `motion` untuk animasi, bukan pola lama yang sudah ditinggalkan.
- Untuk data domain, utamakan service/helper daripada query tersebar di komponen.
- Jangan menulis asumsi baru soal role, schema, atau policy kalau belum ada di repo.
- Jika file atau pola yang dibutuhkan belum ada, ikuti konvensi folder yang sudah dipakai.

## Struktur Folder Inti
- `app/(main)` untuk area aplikasi utama
- `app/components` untuk shared UI
- `app/lib` untuk helper, hooks, service, dan Supabase
- `app/(main)/dashboard` untuk dashboard dan monitoring
- `app/(main)/profiler` untuk database peserta dan export/import
- `app/(main)/qa-analyzer` untuk SIDAK
- `app/(main)/ketik`, `pdkt`, `telefun` untuk simulasi

## Yang Sebaiknya Tidak Dilakukan
- Jangan mengubah arsitektur App Router.
- Jangan mengganti stack inti tanpa instruksi.
- Jangan menambah role baru tanpa update auth dan akses.
- Jangan menghapus RLS atau bypass security model.
- Jangan membuat refactor masif hanya demi preferensi visual.

## Checklist Sebelum Selesai
- Type aman.
- UI tetap konsisten dengan tema existing.
- Auth flow tetap jalan.
- Akses role tetap benar.
- Tidak ada file yang berubah di luar scope.

