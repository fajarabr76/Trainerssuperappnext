# Implementation Plan: Perbaikan UI Modul PDKT

## Overview

Implementasi dilakukan secara incremental per komponen. Dimulai dari pembuatan utility dan shared component, lalu refactor setiap komponen satu per satu. Bahasa implementasi: TypeScript (Next.js + React).

## Tasks

- [x] 1. Buat utility `detectMimeType` dan shared component `ScenarioImage`
  - [x] 1.1 Buat file `app/(main)/pdkt/utils/detectMimeType.ts`
    - Implementasi fungsi `getImageDataUri(base64: string): string`
    - Implementasi fungsi internal `detectMimeFromBytes(base64: string): string`
    - Deteksi magic bytes untuk PNG (89 50 4E 47), JPEG (FF D8 FF), WebP (52 49 46 46), GIF (47 49 46 38)
    - Fallback ke `image/png` jika tidak terdeteksi
    - Handle case: string sudah memiliki data URI prefix (return as-is)
    - _Requirements: 1.2, 1.5_
  - [ ]* 1.2 Tulis property test untuk `getImageDataUri`
    - **Property 1: MIME Type Detection Round-Trip**
    - **Property 2: Idempotence of Data URI Generation**
    - **Validates: Requirements 1.2, 1.5**
    - Gunakan `fast-check` library, minimum 100 iterasi
    - Buat file test di `app/(main)/pdkt/utils/__tests__/detectMimeType.test.ts`
  - [x] 1.3 Buat file `app/(main)/pdkt/components/ScenarioImage.tsx`
    - Props: `base64`, `alt`, `variant` ('grid' | 'thumbnail' | 'fullscreen'), `onClick`, `className`
    - Variant `grid`: aspect-[4/3], object-contain, bg-muted/50, rounded-lg, border
    - Variant `thumbnail`: min-w-20 min-h-20, object-contain, bg-muted/30, rounded-lg
    - Variant `fullscreen`: object-contain, max-w-full max-h-full, rounded-xl
    - Gunakan `getImageDataUri` untuk src
    - Gunakan `next/image` dengan `unoptimized` prop
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 1.1_

- [x] 2. Refactor `MailboxSidebar.tsx` — Typography dan layout
  - [x] 2.1 Perbaiki typography hierarchy di MailboxSidebar
    - Header "Mailbox": ganti `font-black uppercase tracking-widest` → `font-semibold`
    - Filter tabs: ganti `font-black uppercase tracking-wider` → `font-medium uppercase tracking-wide`
    - Empty state text: ganti `font-bold uppercase tracking-widest` → `font-medium`
    - "Buat Email Pertama" link: ganti `font-black uppercase tracking-widest` → `font-medium`
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 2.2 Perbaiki status badge di sidebar items
    - Ganti badge dengan colored background (`bg-module-pdkt/10 px-1.5 py-0.5 rounded-full`) → dot indicator + teks ringan
    - Pattern baru: `<span className="w-1.5 h-1.5 rounded-full bg-module-pdkt" />` + teks `font-medium text-[9px]`
    - Hapus `font-black uppercase tracking-wider` dari badge text
    - _Requirements: 3.2, 5.1_
  - [x] 2.3 Kurangi visual noise di sidebar
    - Hapus `shadow-lg shadow-module-pdkt/20` dari tombol "+" (new email button)
    - Ganti `rounded-full` button → `rounded-lg` untuk konsistensi
    - _Requirements: 5.1, 5.3_

- [x] 3. Refactor `EmailDetailPane.tsx` — Gambar, typography, spacing
  - [x] 3.1 Ganti rendering gambar dengan `ScenarioImage` component
    - Import `ScenarioImage` dari `./ScenarioImage`
    - Ganti blok `<Image>` di section lampiran dengan `<ScenarioImage variant="grid" />`
    - Ganti `aspect-square` → `aspect-[4/3]` (via ScenarioImage)
    - Ganti `object-cover` → `object-contain` (via ScenarioImage)
    - Hapus `whileHover={{ scale: 1.02 }}` dari image container
    - Update zoom modal untuk menggunakan `getImageDataUri` pada src
    - _Requirements: 1.1, 1.2, 6.1, 6.3_
  - [x] 3.2 Perbaiki typography di EmailDetailPane
    - Pane header label: ganti `font-black uppercase tracking-widest` → `font-medium uppercase tracking-wide`
    - Status "Telah Dibalas": ganti `font-bold uppercase tracking-wide` → `font-medium text-xs`
    - Subject heading: ganti `font-black` → `font-semibold`
    - Sender name: ganti `font-black` → `font-semibold`
    - Sender initials: ganti `font-black` → `font-semibold`
    - Evaluation header: ganti `font-black uppercase tracking-widest` → `font-semibold`
    - Evaluation sub-headers: ganti `font-black uppercase tracking-widest` → `font-medium uppercase tracking-wide`
    - Thread history button: ganti `font-black uppercase tracking-widest` → `font-medium uppercase tracking-wide`
    - _Requirements: 2.1, 2.2, 2.4_
  - [x] 3.3 Perbaiki spacing dan readability di EmailDetailPane
    - Email body: pastikan `leading-relaxed` (line-height ~1.625) dan tambahkan `max-w-prose`
    - Kurangi rounded corners: `rounded-2xl` → `rounded-xl` pada evaluation cards
    - Reply button: ganti `rounded-2xl shadow-xl shadow-module-pdkt/20 tracking-[0.2em] font-black uppercase` → `rounded-xl shadow-sm font-semibold`
    - _Requirements: 4.1, 4.3, 5.1, 5.3_

- [x] 4. Refactor `EmailInterface.tsx` — Gambar dan typography
  - [x] 4.1 Ganti rendering gambar dengan `ScenarioImage` component
    - Import `ScenarioImage` dari `./ScenarioImage`
    - Ganti blok `<Image>` di section attachments dengan `<ScenarioImage variant="grid" />`
    - Hapus `whileHover={{ scale: 1.02 }}` dari image container
    - Update zoom modal src dengan `getImageDataUri`
    - _Requirements: 1.1, 1.2, 6.1, 6.3_
  - [x] 4.2 Perbaiki typography minor di EmailInterface
    - Pastikan tidak ada `font-black uppercase tracking-widest` pada label non-header
    - Evaluation section headers: ganti `font-medium uppercase tracking-wide` (sudah cukup baik, verifikasi saja)
    - _Requirements: 2.1, 2.2_

- [x] 5. Refactor `MailboxInterface.tsx` — Header styling
  - [x] 5.1 Perbaiki header workspace
    - Title "Workspace PDKT": ganti `font-black uppercase tracking-widest` → `font-semibold text-sm`
    - Subtitle: ganti `font-bold uppercase` → `font-medium text-xs text-muted-foreground`
    - Button "Buat Email": ganti `font-black uppercase tracking-widest` → `font-semibold text-xs`
    - _Requirements: 2.1, 2.2, 5.3_
  - [x] 5.2 Perbaiki empty state di MailboxInterface
    - "Pilih Email" heading: ganti `font-black uppercase tracking-widest` → `font-semibold`
    - _Requirements: 2.2_

- [x] 6. Refactor `CreateEmailModal.tsx` — Typography dan spacing
  - [x] 6.1 Perbaiki typography di CreateEmailModal
    - Section label "Pilih Skenario": ganti `font-black uppercase tracking-[0.1em]` → `font-medium uppercase tracking-wide`
    - Scenario title: ganti `font-black uppercase tracking-wide` → `font-semibold`
    - Badge labels ("Always use", "Template tersedia", "AI generated"): ganti `font-black uppercase tracking-widest` → `font-medium uppercase tracking-wide`
    - Cancel button: ganti `font-black uppercase tracking-widest` → `font-medium`
    - _Requirements: 2.1, 2.2, 5.1_
  - [x] 6.2 Kurangi visual noise di CreateEmailModal
    - Hapus `whileHover={{ scale: 1.01, x: 2 }}` dan `whileTap={{ scale: 0.99 }}` dari scenario buttons (non-fungsional)
    - Ganti `rounded-3xl` pada modal shell → `rounded-xl`
    - Ganti `rounded-2xl` pada scenario items → `rounded-lg`
    - _Requirements: 5.1, 5.4_

- [x] 7. Refactor `SettingsModal.tsx` — Image thumbnails dan typography
  - [x] 7.1 Ganti rendering image thumbnails dengan `ScenarioImage`
    - Import `ScenarioImage` dari `./ScenarioImage`
    - Ganti semua `<Image>` untuk scenario attachment previews dengan `<ScenarioImage variant="thumbnail" />`
    - _Requirements: 1.3, 6.1, 6.2_
  - [x] 7.2 Perbaiki typography di SettingsModal
    - Modal title: pertahankan `font-bold` (sudah sesuai sebagai header utama), hapus `font-black`
    - Module label: ganti `font-black uppercase tracking-[0.3em]` → `font-medium uppercase tracking-wide`
    - Tab labels: ganti `font-black uppercase tracking-[0.2em]` → `font-medium uppercase tracking-wide`
    - Section headers: ganti `font-black` → `font-semibold`
    - Sub-labels: ganti `font-black uppercase tracking-[0.2em]` → `font-medium uppercase tracking-wide`
    - Button "Simpan Perubahan": ganti `font-black uppercase tracking-widest` → `font-semibold`
    - _Requirements: 2.1, 2.2_
  - [x] 7.3 Kurangi visual noise di SettingsModal
    - Hapus gradient overlay di modal header (`bg-gradient-to-r from-module-pdkt/10 to-transparent`)
    - Ganti `rounded-[2rem]` pada modal shell → `rounded-xl`
    - Ganti `rounded-3xl` pada scenario cards → `rounded-xl`
    - Ganti `shadow-2xl shadow-black/10` pada modal → `shadow-xl`
    - Ganti `shadow-xl shadow-primary/20` pada save button → `shadow-sm`
    - _Requirements: 5.1, 5.2, 5.4_

- [x] 8. Checkpoint — Verifikasi semua perubahan
  - Jalankan `npm run lint` untuk memastikan tidak ada error
  - Jalankan `npm run type-check` untuk memastikan type safety
  - Pastikan semua import `ScenarioImage` dan `getImageDataUri` ter-resolve dengan benar
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Setiap task mereferensikan requirements spesifik untuk traceability
- Tidak ada perubahan pada logic bisnis, state management, atau API calls
- Perubahan hanya pada layer presentasi (CSS classes, component structure)
- Property tests hanya untuk utility `detectMimeType` karena ini satu-satunya pure function baru
- Semua perubahan styling lainnya diverifikasi via lint + type-check + visual review
