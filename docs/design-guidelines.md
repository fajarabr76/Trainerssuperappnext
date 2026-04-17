# Design Guidelines & System

Dokumen ini adalah ringkasan standar desain visual dan UI yang diterapkan di Trainers SuperApp. Aplikasi ini mengusung estetika **Dark Luxury × Minimalist Clarity**.

## Prinsip Desain
1. **Presisi**: Setiap elemen UI harus memiliki tujuan fungsional.
2. **Konsistensi**: Komponen yang sama harus tampil dan berperilaku identik di seluruh modul.
3. **Kontrol**: Pengguna harus selalu memahami posisi mereka dalam aplikasi (Breadcrumbs, Indicators).

## Design Tokens (Tailwind CSS 4)

Semua komponen wajib menggunakan sistem token yang didefinisikan di `app/globals.css`.

### Warna Semantik
- `background`: Warna dasar halaman.
- `foreground`: Warna teks utama.
- `primary`: Warna aksen (Default: Navy/Slate di Light mode; Amber di Dark mode).
- `card`: Surface untuk panel, modal, dan kartu informasi.
- `accent`: Warna untuk state hover, chip, dan tag.
- `destructive`: Warna untuk aksi berbahaya atau pesan kesalahan.

### Warna Identitas Modul
Setiap modul memiliki warna identitas untuk membantu navigasi visual:
- **Profiler / KTP**: `violet-500`
- **SIDAK / Analisis**: `blue-500`
- **Statistik/Status**: `emerald-500`
- **Ekspor/Unduh**: `orange-500`

## Tipografi

Menggunakan font sans-serif modern (Inter/System) dengan skala sebagai berikut:
- **Page Title**: `text-4xl font-bold tracking-tight`
- **Section Title**: `text-3xl font-bold tracking-tight`
- **Body Text**: `text-sm font-light text-muted-foreground`
- **Label Mono**: `text-[10px] font-bold uppercase tracking-widest`

## Komponen Navigasi

### 1. Module Header
Setiap modul wajib memiliki header yang konsisten dengan:
- Tombol kembali (Back to Dashboard).
- Ikon dan nama modul yang jelas.
- Toggle switch untuk mode Gelap/Terang.

### 2. Sidebar
- Sidebar utama di dashboard menggunakan sistem Accordion untuk mengelompokkan modul.
- Desain sidebar harus responsif (Auto-collapse pada mobile).

## Animasi & Micro-interactions

Aplikasi menggunakan `framer-motion` untuk meningkatkan pengalaman pengguna:
- **Hover Lift**: Komponen kartu sedikit terangkat saat di-hover.
- **Fade-Scale**: Transisi halus saat membuka modal atau berpindah tab.
- **Ambient Glow**: Efek cahaya latar (Ambient background blobs) pada area header untuk kesan premium.

## Aturan Penulisan Kode UI
- Gunakan variabel CSS (`var(--primary)`) daripada nilai hex langsung.
- Gunakan komponen `motion.div` untuk elemen yang membutuhkan transisi.
- Pastikan semua input memiliki state `focus-visible:ring-2` untuk aksesibilitas.
- Gunakan properti `rounded-xl` hingga `rounded-3xl` untuk komponen kartu/modal agar terlihat modern.
