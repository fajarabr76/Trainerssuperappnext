# TrainersSuperAppNext — Design System Guide

> **Versi:** 1.0 · **Tanggal:** April 2026  
> Dokumen ini adalah sumber kebenaran tunggal (*single source of truth*) untuk semua keputusan visual dan UI di TrainersSuperAppNext. Setiap developer yang menulis komponen baru atau memodifikasi modul yang ada **wajib** merujuk ke dokumen ini.

---

## 1. Prinsip Desain

TrainersSuperAppNext menggunakan estetika **Dark Luxury × Minimalist Clarity** — antarmuka yang terasa premium, efisien, dan tidak berisik. Tiga kata kunci yang harus selalu diingat:

- **Presisi** — Setiap elemen ada tujuannya. Tidak ada dekorasi tanpa fungsi.
- **Konsistensi** — Komponen yang sama di modul berbeda harus tampil dan berperilaku identik.
- **Kontrol** — User selalu tahu di mana mereka berada dan apa yang bisa dilakukan.

---

## 2. Color Palette (Design Token)

Semua warna didefinisikan di `app/globals.css`. **Jangan pernah hardcode hex color langsung di komponen.**

### 2.1 Semantic Tokens (Pakai Token Ini)

| Token | Light Mode | Dark Mode | Kegunaan |
|---|---|---|---|
| `background` | `#FAFAF9` (Stone-50) | `#09090B` (Zinc-950) | Background halaman utama |
| `foreground` | `#1C1917` (Stone-900) | `#FAFAFA` (Zinc-50) | Teks utama |
| `card` | `#FFFFFF` | `#18181B` (Zinc-900) | Surface card & panel |
| `card-foreground` | `#1C1917` | `#FAFAFA` | Teks di atas card |
| `primary` | `#1E293B` (Navy/Slate-800) | `#F59E0B` (Amber-500) | Aksen utama, CTA primer |
| `primary-foreground` | `#F8FAFC` | `#09090B` | Teks di atas primary |
| `muted-foreground` | `#78716C` (Stone-500) | `#A1A1AA` (Zinc-400) | Teks sekunder & label |
| `accent` | `#F1F5F9` (Slate-100) | `#27272A` (Zinc-800) | Surface hover, chip, tag |
| `border` | `#E7E5E4` (Stone-200) | `#27272A` (Zinc-800) | Garis pembatas |
| `destructive` | `#DC2626` (Red-600) | `#DC2626` | Aksi hapus, error state |
| `ring` | `#1E293B` | `#F59E0B` | Focus ring outline |

### 2.2 Module Accent Colors (Hardcoded yang Diizinkan)

Warna di bawah ini adalah satu-satunya pengecualian boleh hardcode, karena digunakan sebagai identitas visual modul dan belum ada token Tailwind yang semantik untuk ini. Setiap modul memiliki satu warna identitas.

| Modul | Class Tailwind | Hex | Kegunaan |
|---|---|---|---|
| **Profiler / KTP** | `violet-600` / `violet-500` | `#7C3AED` / `#8B5CF6` | Tombol CTA utama Profiler |
| **Database / Analisis** | `blue-500` | `#3B82F6` | Section accent bar "Analisis" |
| **Statistik** | `emerald-500` | `#10B981` | Icon & badge Statistik/Impor |
| **Slides / Filter** | `purple-500` | `#A855F7` | Icon Slides & visualisasi |
| **Ekspor** | `orange-500` | `#F97316` | Icon Ekspor |
| **Ulang Tahun / Perayaan** | `pink-500` to `rose-500` (gradient) | — | Header modal Birthday |
| **Delete/Danger** | `red-500` | `#EF4444` | Ikon & konfirmasi hapus |

> **Aturan:** Warna aksen modul **hanya boleh** dipakai untuk icon background (`bg-{color}/10`), teks icon (`text-{color}`), dan section accent bar (`bg-{color}`). Tombol CTA utama di luar Profiler tetap menggunakan `bg-primary`.

### 2.3 Warna yang DILARANG di UI

Warna berikut tidak boleh muncul di elemen UI biasa (hanya boleh di chart/data viz):

- `yellow-*`, `amber-*` (kecuali sebagai `primary` di dark mode via token)
- `teal-*`, `cyan-*`, `sky-*`
- `green-*` (gunakan `emerald-*` jika perlu)
- Gradient warna-warni di background card atau tombol biasa

---

## 3. Tipografi

### 3.1 Font Family

```
Font Utama: var(--font-sans) — Inter atau system-ui (didefinisikan di layout.tsx)
```

Tidak ada font display terpisah. Semua heading menggunakan font yang sama dengan variasi `font-weight` dan `tracking`.

### 3.2 Typography Scale (Gunakan Persis Ini)

| Nama | Class Tailwind | Kegunaan |
|---|---|---|
| **Page Title** | `text-4xl font-bold tracking-tight` | Judul halaman utama (h1) |
| **Section Title** | `text-3xl font-bold tracking-tight` | Sub-judul section besar (h2) |
| **Card Title** | `text-base font-bold tracking-tight` | Judul card/item |
| **Label Mono** | `text-[10px] font-bold uppercase tracking-widest text-muted-foreground` | Label section, badge teks |
| **Body** | `text-sm font-light text-muted-foreground` | Deskripsi & body teks |
| **Body Bold** | `text-sm font-bold` | Teks penting, nama, status |
| **Stat Value** | `text-3xl font-black tracking-tighter` | Angka statistik besar |
| **Stat Label** | `text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground` | Label di atas angka stat |
| **Button Text** | `text-sm font-bold` | Semua label tombol |
| **Tiny Meta** | `text-xs font-light text-muted-foreground` | Tanggal, metadata kecil |

### 3.3 Aturan Tipografi

1. **Jangan campur** `font-black` dan `font-light` dalam satu elemen teks.
2. `tracking-tighter` hanya untuk angka besar (`text-3xl` ke atas).
3. `tracking-widest` hanya untuk `text-[10px]` uppercase label.
4. Semua heading menggunakan `text-wrap: balance` (sudah di base CSS).
5. Body teks maksimal `max-w-prose` atau `max-w-[65ch]`.

---

## 4. Border Radius

Radius menggunakan sistem token yang sudah didefinisikan. **Jangan gunakan `rounded-[2rem]` atau nilai arbitrary lainnya.**

| Token Class | Nilai Aktual | Kegunaan |
|---|---|---|
| `rounded-sm` | `calc(0.75rem - 4px) = 8px` | Input kecil, badge |
| `rounded-md` | `calc(0.75rem - 2px) = 10px` | Input form, tag |
| `rounded-lg` / `rounded` | `0.75rem = 12px` | Card, panel umum |
| `rounded-xl` | `calc(0.75rem + 4px) = 16px` | Card utama, header icon |
| `rounded-2xl` | `1rem = 16px` (Tailwind default) | Card section, container |
| `rounded-3xl` | `1.5rem = 24px` | Card hero/statistik |
| `rounded-full` | `9999px` | Avatar, badge pill, dot |

### Hierarki Radius dalam Nested Elements

Saat ada elemen di dalam elemen yang rounded, gunakan radius yang lebih kecil:

```
Modal container   → rounded-[2rem] ✗   →  rounded-3xl ✓ (24px)
  Button di dalam → rounded-2xl        (16px — 8px lebih kecil)
  Input di dalam  → rounded-2xl        (16px)

Card container    → rounded-2xl (16px)
  Icon di dalam   → rounded-xl  (12px — harus lebih kecil)
  Badge di dalam  → rounded-full (pill — pengecualian untuk badge)
```

---

## 5. Border & Divider

- **Border kartu/panel:** `border border-border/40` — semi-transparan 40%
- **Border input/form:** `border border-border/40`
- **Border hover/interaktif:** `border-border` — penuh, untuk state aktif
- **Divider line:** `<hr className="border-border/40" />`
- **Jangan pakai** `border-gray-*` atau `border-slate-*` langsung.

---

## 6. Spacing & Layout

### 6.1 Prinsip Spacing

Semua spacing mengikuti kelipatan 4px (sistem Tailwind standard). Tidak ada spacing arbitrary.

| Konteks | Padding |
|---|---|
| Card content padding | `p-4` (16px) atau `p-5` (20px) |
| Section padding dalam page | `p-6` (24px) |
| Page outer padding | `px-8 py-4` |
| Gap antar card dalam grid | `gap-4` (16px) |
| Gap antar elemen inline | `gap-3` (12px) kecil, `gap-4` standar |

### 6.2 Grid Layout

```tsx
// 3 kolom standar
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">

// 2+1 (card besar + kecil)
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
  <Card className="md:col-span-2" />
  <Card />
</div>

// 4 kolom untuk action grid kecil
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
```

### 6.3 Lebar Konten

- **Page max-width:** `max-w-7xl mx-auto w-full`
- **Modal/dialog max-width:** `max-w-sm` (standar) atau `max-w-md` (lebar)
- **Prose text:** `max-w-prose` atau `max-w-[65ch]`

---

## 7. Komponen UI Standar

### 7.1 Page Header (Sticky Top Bar)

Semua modul menggunakan struktur header yang **identik**. Gunakan tiga zona: kiri (back button), tengah (identitas modul), kanan (theme toggle atau aksi sekunder).

```tsx
<div className="flex items-center justify-between px-8 py-4 bg-card/30 backdrop-blur-2xl border-b border-border/40 sticky top-0 z-50">
  {/* Kiri: Back button */}
  <div className="flex-1">
    <button
      onClick={() => router.push('/dashboard')}
      className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.2em] text-foreground/70 hover:text-primary transition-all group"
    >
      <div className="w-8 h-8 rounded-xl bg-accent/50 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-all">
        <ChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
      </div>
      <span className="hidden md:block">Dashboard</span>
    </button>
  </div>

  {/* Tengah: Identitas modul */}
  <div className="flex items-center gap-4">
    <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center shadow-xl shadow-primary/20">
      <ModuleIcon className="w-5 h-5 text-primary-foreground" />
    </div>
    <div className="flex flex-col">
      <span className="text-sm font-black tracking-tighter uppercase leading-none">KODE</span>
      <span className="text-[10px] font-mono uppercase tracking-[0.2em] opacity-70">Nama Lengkap Modul</span>
    </div>
  </div>

  {/* Kanan: Theme toggle */}
  <div className="flex-1 flex justify-end">
    <ThemeToggleButton />
  </div>
</div>
```

> **Aturan penting:** Setiap modul **wajib** memiliki back button ke `/dashboard`. ThemeToggle **wajib** ada di setiap modul.

### 7.2 Section Accent Bar

Digunakan sebelum setiap grup konten sebagai label navigasi visual.

```tsx
<div className="flex items-center gap-3 mb-4 px-1">
  <div className="w-1 h-3 bg-primary rounded-full" />
  {/* Gunakan bg-primary untuk section umum */}
  {/* Gunakan warna aksen modul (bg-blue-500, dst) hanya jika ada makna semantik */}
  <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">
    Nama Section
  </p>
</div>
```

### 7.3 Action Card (Tombol Navigasi dengan Ikon)

```tsx
<button
  onClick={onClick}
  className="group flex flex-col gap-3 p-5 bg-card/40 backdrop-blur-sm border border-border/40 rounded-xl text-left transition-all hover:bg-card hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-0.5 active:translate-y-0"
>
  <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center transition-transform group-hover:scale-110 duration-500`}>
    <span className={iconColor}>{icon}</span>
  </div>
  <div>
    <p className="text-base font-bold mb-1 tracking-tight group-hover:text-primary transition-colors">{title}</p>
    <p className="text-xs text-muted-foreground leading-relaxed font-light">{desc}</p>
  </div>
</button>
```

### 7.4 Tombol (Button Variants)

| Variant | Class | Kegunaan |
|---|---|---|
| **Primary** | `bg-primary text-primary-foreground hover:opacity-90 rounded-2xl font-bold text-sm` | Aksi utama (Simpan, Konfirmasi) |
| **Accent/Ghost** | `bg-accent text-foreground border border-border/40 hover:bg-accent/80 rounded-2xl font-bold text-sm` | Aksi sekunder (Batal, Kembali) |
| **Module CTA** | `bg-violet-600 text-white shadow-lg shadow-violet-600/20 hover:scale-105 active:scale-95 rounded-xl font-bold text-sm` | CTA utama spesifik modul Profiler |
| **Destructive** | `bg-red-500 hover:bg-red-600 text-white rounded-2xl font-bold text-sm` | Hapus permanen |

Semua tombol yang memiliki aksi wajib menggunakan focus ring:
```
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background
```

### 7.5 Modal / Dialog

```tsx
{/* Overlay */}
<div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-md">
  {/* Container */}
  <div className="bg-card w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-border/40">
    <h3 className="text-lg font-bold mb-4">Judul Modal</h3>
    {/* Content */}
    <div className="flex gap-3 mt-6">
      <button className="flex-1 py-3 ... rounded-2xl">Batal</button>
      <button className="flex-1 py-3 ... rounded-2xl">Konfirmasi</button>
    </div>
  </div>
</div>
```

### 7.6 Form Input

```tsx
<input
  className="w-full px-4 py-3 rounded-2xl border border-border/40 bg-background transition-all focus:outline-none focus:ring-2 focus:ring-primary/20"
/>
```

### 7.7 Badge / Chip

```tsx
{/* Neutral badge */}
<span className="px-3 py-1 bg-foreground/5 text-foreground/60 text-[10px] font-bold uppercase tracking-widest rounded-full border border-border">
  Teks Badge
</span>

{/* Primary badge */}
<span className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest rounded-full">
  Teks Badge
</span>
```

### 7.8 Stat Card

```tsx
<div className="bg-card/40 backdrop-blur-sm border border-border/40 rounded-xl p-4 flex flex-col justify-between shadow-sm hover:shadow-lg hover:shadow-primary/5 transition-all">
  <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-black">Label</p>
  <p className="text-3xl font-black tracking-tighter text-foreground">Nilai</p>
</div>
```

---

## 8. Background Effects

Setiap page utama menggunakan efek ambient background untuk memberikan kedalaman. Efek ini **opsional dan dekoratif** — harus menggunakan `pointer-events-none` dan `z-0`.

```tsx
{/* Ambient background blobs — HANYA di main content area, BUKAN di seluruh halaman */}
<div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none overflow-hidden z-0 rounded-2xl">
  <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px] animate-pulse" />
  <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-violet-500/5 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
</div>
```

**Aturan:**
- Warna blob: `bg-primary/5` (selalu) + satu warna aksen modul pada `/5` opacity.
- Blur minimum `blur-[80px]`, standar `blur-[120px]`.
- Tidak boleh ada lebih dari 2 blob per view.
- Konten di atas blob harus menggunakan `relative z-10`.

---

## 9. Scrollbar Custom

Sudah didefinisikan di `globals.css`. **Jangan override.**

```css
/* Standar — scrollbar tipis & bersih */
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }

/* Untuk area dengan overflow scroll yang tidak ingin tampilkan scrollbar */
className="custom-scrollbar"   /* visible scrollbar */
className="scrollbar-hide"     /* hidden scrollbar */
```

---

## 10. Motion & Animasi

Gunakan animasi yang sederhana dan fungsional. Semua animasi harus memiliki durasi di bawah 300ms kecuali untuk animasi ambient (blob pulse).

| Situasi | Kelas / Style |
|---|---|
| Hover naik (lift) | `hover:-translate-y-0.5 active:translate-y-0 transition-all` |
| Hover scale (icon) | `group-hover:scale-110 transition-transform duration-500` |
| Hover overlay shimmer | `translate-y-full group-hover:translate-y-0 transition-transform duration-300` |
| Fade in/out | `transition-all duration-500` dengan opacity |
| Loading spinner | `<Loader2 className="animate-spin" />` dari lucide-react |
| Ambient background | `animate-pulse` dengan `animationDelay` berbeda |

**Dilarang:**
- `animate-bounce` di UI fungsional (hanya untuk empty state yang sangat spesial)
- Transisi lebih dari `duration-500` kecuali ambient blob
- Keyframe custom tanpa dokumentasi

---

## 11. Icon System

Seluruh ikon menggunakan **Lucide React**. Tidak boleh menggunakan library ikon lain.

```tsx
import { Users, Plus, ChevronLeft, ... } from 'lucide-react';

// Ukuran standar
<Icon size={16} />    // Kecil — dalam tombol kecil, nav
<Icon size={18} />    // Standar — tombol utama, header
<Icon className="w-5 h-5" />   // Dalam action card
<Icon className="w-10 h-10" /> // Empty state illustrasi
```

Ikon dalam tombol **wajib** punya `aria-label` jika tidak ada teks label yang terlihat.

---

## 12. State Patterns

### Empty State

```tsx
<div className="h-full flex items-center justify-center text-center p-6">
  <div className="max-w-xs">
    <div className="w-20 h-20 rounded-3xl bg-foreground/5 flex items-center justify-center mx-auto mb-6">
      <FolderOpen className="w-10 h-10 text-foreground/20" />
    </div>
    <h3 className="text-xl font-bold mb-2">Judul yang Informatif</h3>
    <p className="text-sm text-foreground/40 font-light">
      Deskripsi singkat apa yang harus dilakukan user.
    </p>
  </div>
</div>
```

### Loading State

```tsx
<Loader2 size={10} className="animate-spin text-muted-foreground" />
```

### Disabled/Locked State

```tsx
className="opacity-30 grayscale pointer-events-none"
```

---

## 13. Responsivitas

Semua modul harus berfungsi minimal di breakpoint berikut:

| Breakpoint | Perilaku |
|---|---|
| `< md (768px)` | Single column, sidebar collapse, font size tetap |
| `md (768px)` | Grid 2-3 kolom aktif, sidebar visible |
| `lg (1024px)` | Full layout, spacing lebih generous |

Kelas yang wajib ada di grid:
```
grid-cols-1 md:grid-cols-3
```
Teks yang hanya muncul di desktop:
```
hidden md:block
```

---

## 14. Dark Mode

Dark mode diatur via `next-themes`. **Jangan pernah** menggunakan kondisi JavaScript untuk mengganti kelas warna secara manual. Semua adaptasi warna harus via CSS token di `globals.css`.

```tsx
// BENAR — pakai token
<div className="bg-card text-foreground">

// SALAH — hardcode per mode
<div className={isDark ? 'bg-zinc-900 text-white' : 'bg-white text-black'}>
```

Untuk warna yang memang perlu berbeda di dark mode dan tidak ada tokennya, gunakan Tailwind dark variant:
```
dark:bg-pink-500/10  dark:text-pink-400
```

---

## 15. Checklist Sebelum Commit

Setiap developer wajib mencentang ini sebelum push perubahan UI:

- [ ] Semua warna dari token (`bg-background`, `text-foreground`, `border-border`) — bukan hardcode hex
- [ ] Pengecualian warna aksen modul sesuai tabel di Seksi 2.2
- [ ] Radius menggunakan kelas standar — tidak ada `rounded-[...]` arbitrary
- [ ] Page header menggunakan struktur standar (back button + logo modul + theme toggle)
- [ ] Section accent bar menggunakan `bg-primary` kecuali ada alasan semantik
- [ ] Semua tombol memiliki focus ring (`focus-visible:ring-2 focus-visible:ring-ring`)
- [ ] Tidak ada warna teks di bawah `text-foreground/40` opacity untuk teks yang informatif
- [ ] Empty state didesain — bukan hanya teks kosong
- [ ] Ikon dari Lucide React — bukan library lain
- [ ] Dark mode tidak di-hardcode via JavaScript

---

*Dokumen ini diperbarui setiap kali ada komponen atau pola baru yang disepakati tim. Jika menemukan inkonsistensi antara dokumen ini dan kode aktual, kode aktual yang lebih baru adalah referensi — lalu update dokumen ini.*
