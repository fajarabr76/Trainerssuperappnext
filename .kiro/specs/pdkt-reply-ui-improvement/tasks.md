# Implementation Plan: PDKT Reply UI Improvement

## Overview

Implementasi peningkatan UI form reply di modul PDKT dengan mengekstrak komponen shared `ReplyComposer.tsx`, meningkatkan styling visual, dan memastikan konsistensi antara `EmailInterface.tsx` dan `EmailComposer.tsx`.

Bahasa implementasi: TypeScript/React (Next.js App Router)

## Tasks

- [x] 1. Buat komponen shared ReplyComposer
  - [x] 1.1 Buat file `app/(main)/pdkt/components/ReplyComposer.tsx` dengan interface props
    - Definisikan `ReplyComposerProps` interface: `recipient`, `subject`, `onSend`, `onClose`, `isLoading`
    - Implementasi state internal `replyText`
    - Implementasi `handleSend` dengan validasi whitespace
    - _Requirements: 5.1, 5.2_
  - [x] 1.2 Implementasi Composer Container dengan styling baru
    - Gunakan `bg-foreground/[0.02]` untuk background subtle
    - Tambah `border border-border/60 rounded-xl shadow-sm` untuk elevation
    - Tambah spacing margin dari parent (`mx-3 mb-3` atau sesuai konteks)
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [x] 1.3 Implementasi Header Section yang informatif
    - Tambah `Reply` icon dari lucide-react (16px) di samping label
    - Ubah label "Balas" ke `text-xs font-semibold` (12px, semi-bold)
    - Tambah aksen warna `text-module-pdkt` pada icon sebagai indikator tema
    - Perbesar close button ke `w-8 h-8` (32x32px) untuk aksesibilitas
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - [x] 1.4 Implementasi Field Section dengan layout terstruktur
    - Label field: `text-xs text-muted-foreground/70` (12px, kontras cukup)
    - Value field: `text-[13px] text-foreground` (13px)
    - Spacing antar baris: `space-y-2` (8px)
    - Padding section: `py-2.5`
    - Empty state: `text-muted-foreground/40` untuk placeholder
    - Border-bottom sebagai pemisah ke textarea
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  - [x] 1.5 Implementasi Textarea Section dengan batas visual jelas
    - Background subtle: `bg-foreground/[0.01]`
    - Height responsive: `h-32 md:h-48` (128px mobile, 192px desktop)
    - Padding: `p-4 md:p-5` (16px minimum)
    - Placeholder: "Tulis balasan Anda..." dengan `placeholder:text-muted-foreground/40`
    - Focus state: `focus:ring-1 focus:ring-module-pdkt/20` atau `focus:border-module-pdkt/30`
    - autoFocus attribute
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 6.2, 6.3, 7.3_
  - [x] 1.6 Implementasi Footer Section dengan tombol kirim
    - Warna: `bg-module-pdkt hover:bg-module-pdkt/90 text-white`
    - Padding: `px-5 py-2.5` (20px horizontal, 10px vertikal)
    - Border-radius: `rounded-lg`
    - Disabled state: `disabled:opacity-50 disabled:cursor-not-allowed` saat text kosong
    - Loading state: Loader2 spinner + text "Mengirim..."
    - Normal state: Send icon + text "Kirim"
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 2. Integrasikan ReplyComposer ke EmailInterface.tsx
  - [x] 2.1 Ganti inline reply composer di EmailInterface.tsx dengan ReplyComposer
    - Hapus kode inline composer (sekitar lines 460-530)
    - Import `ReplyComposer` dari `./ReplyComposer`
    - Bungkus dengan `AnimatePresence` dan `motion.div` yang sudah ada
    - Pass props: `recipient={firstInboundEmail?.from || '-'}`, `subject={firstInboundEmail?.subject || ''}`, `onSend={handleSend}`, `onClose={() => setIsDrafting(false)}`, `isLoading={isLoading}`
    - Pastikan animasi spring (damping: 25, stiffness: 200) tetap di motion.div wrapper
    - _Requirements: 5.1, 5.2, 5.3, 7.1, 7.2_

- [x] 3. Refactor EmailComposer.tsx untuk menggunakan ReplyComposer
  - [x] 3.1 Refactor EmailComposer.tsx menjadi thin wrapper
    - Hapus internal `replyText` state dan `handleSend` logic
    - Import `ReplyComposer` dari `./ReplyComposer`
    - Pertahankan `AnimatePresence` dan `motion.div` wrapper dengan parameter animasi yang sama
    - Pass props dari EmailComposerProps ke ReplyComposer
    - Pastikan positioning (`absolute bottom-0 left-0 right-0`) tetap di wrapper
    - _Requirements: 5.1, 5.2, 5.3, 7.1, 7.2_

- [x] 4. Checkpoint - Verifikasi konsistensi dan responsivitas
  - Jalankan `npm run lint` untuk memastikan tidak ada error
  - Jalankan `npm run type-check` untuk validasi TypeScript
  - Verifikasi bahwa kedua parent component (EmailInterface dan EmailComposer) menggunakan ReplyComposer yang sama
  - Pastikan tidak ada kode reply composer yang tersisa di EmailInterface.tsx
  - Ensure all tests pass, ask the user if questions arise.

- [ ]* 5. Tulis unit tests untuk ReplyComposer
  - [ ]* 5.1 Test rendering dengan props lengkap
    - Verifikasi semua elemen tampil: Reply icon, label "Balas", fields, textarea, button
    - _Requirements: 2.1, 2.2, 3.1, 3.3_
  - [ ]* 5.2 Test disabled state dan loading state
    - Verifikasi button disabled saat text kosong/whitespace
    - Verifikasi spinner dan text "Mengirim..." saat isLoading=true
    - _Requirements: 8.3, 8.4, 8.5_
  - [ ]* 5.3 Test callbacks
    - Verifikasi `onSend` dipanggil dengan text yang benar
    - Verifikasi `onClose` dipanggil saat klik close button
    - _Requirements: 8.1_
  - [ ]* 5.4 Test empty/placeholder states
    - Verifikasi "Tanpa Subjek" ditampilkan saat subject kosong
    - Verifikasi placeholder styling berbeda dari nilai aktual
    - _Requirements: 3.5_

- [x] 6. Final checkpoint - Pastikan semua berjalan dengan baik
  - Ensure all tests pass, ask the user if questions arise.
  - Verifikasi visual di browser (manual): mobile dan desktop viewport
  - Pastikan animasi slide-up/slide-down smooth

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Komponen ReplyComposer mengelola state `replyText` secara internal — parent hanya perlu menyediakan callbacks
- Animasi (`AnimatePresence` + `motion.div`) tetap di parent karena konteks mounting berbeda
- Tidak ada dependency baru yang perlu diinstall — semua library sudah tersedia (motion/react, lucide-react, Tailwind)
- Responsive breakpoint menggunakan prefix `md:` (768px) sesuai konvensi Tailwind yang sudah ada di project
