# PDKT Email Composer Refresh v1

## Status

- Status: `committed`
- Fokus: refresh UI workspace email PDKT tanpa mengubah flow, schema, atau business logic inti.
- **v2 (Reply UI Improvement)**: Refactoring reply composer menjadi shared component, penambahan ScenarioImage component, dan deteksi MIME type otomatis.

## Ringkasan

Refresh ini mengubah tampilan email PDKT agar lebih dekat ke email client modern. Email masuk utama tampil sebagai detail view, balasan memakai composer-style panel, riwayat dibuat lebih ringkas, dan surface evaluasi tetap dipertahankan.

Addon yang menyertai refresh ini adalah hardening realism untuk subject email awal. Subject tidak boleh membocorkan inti masalah terlalu cepat; empty subject dianggap valid bila cocok dengan karakter konsumen.

## Perubahan Utama

- Struktur induk PDKT tetap dipertahankan:
  - view `home` dan `email` tidak berubah
  - overlay `fixed inset-0` tetap dipakai
  - container `max-w-5xl` dan `md:max-h-[92vh]` tetap dipertahankan
- `app/(main)/pdkt/components/EmailInterface.tsx` menjadi titik utama reskin UI:
  - top bar ringkas dengan judul halaman, status aktif, timer, dan tombol tutup
  - inbound email ditampilkan sebagai detail view dengan subject, metadata, body, attachment, dan action reply
  - composer balasan memakai field read-only `Kepada`, `Cc`, dan `Subjek`
  - history sesi lebih ringkas dan bisa di-collapse
  - state evaluasi `processing`, `failed`, dan `completed` tetap muncul
- `app/(main)/pdkt/services/geminiService.ts` menangani contract subject yang lebih realistis:
  - subject boleh kosong
  - subject boleh sangat umum
  - subject boleh samar, tetapi tidak boleh membocorkan inti masalah
  - subject yang terlalu deskriptif dinormalisasi menjadi kosong
- `app/(main)/pdkt/PdktClient.tsx` menjaga reply flow tetap aman:
  - jika inbound subject kosong, reply subject juga kosong
  - tidak ada fallback `Re: Ticket` yang memaksa clue baru

### v2: Reply UI Improvement & Component Extraction

- **Shared ReplyComposer** (`ReplyComposer.tsx`):
  - Reply form di-extract dari `EmailInterface.tsx` dan `EmailComposer.tsx` menjadi satu komponen shared
  - Konsistensi visual terjamin: header dengan ikon Reply + label "Balas", border-left accent `module-pdkt`, field section (Kepada/Cc/Subjek), textarea, dan tombol kirim
  - Responsive: padding dan tinggi textarea menyesuaikan viewport (mobile vs desktop)
  - Aksesibilitas: tombol close 32x32px, aria-label, disabled state pada tombol kirim
- **ScenarioImage** (`ScenarioImage.tsx`):
  - Komponen shared untuk rendering gambar skenario (base64) secara konsisten
  - Mendukung 3 variant: `grid`, `thumbnail`, `fullscreen`
  - Menggunakan `next/image` dengan `unoptimized` untuk base64
  - Keyboard accessible (Enter/Space) pada variant yang clickable
- **detectMimeType utility** (`utils/detectMimeType.ts`):
  - Deteksi MIME type otomatis dari magic bytes (JPEG, PNG, WebP, GIF)
  - Menggantikan hardcoded `data:image/png;base64,` yang sebelumnya salah untuk non-PNG
  - Fallback ke `image/png` jika tidak terdeteksi
- **UI Polish pada komponen existing**:
  - `EmailDetailPane.tsx`: menggunakan ScenarioImage, layout lebih compact
  - `MailboxSidebar.tsx`: penyesuaian spacing dan visual
  - `SettingsModal.tsx`: menggunakan ScenarioImage untuk preview template
  - `CreateEmailModal.tsx`: penyesuaian minor
  - `EmailInterface.tsx`: body email di-split per paragraf, subject font-size lebih compact, attachment menggunakan ScenarioImage

## Subject Realism

- Baseline yang dipakai adalah `adaptive mix`:
  - bingung atau awam: subject boleh kosong atau sangat umum
  - biasa: subject singkat dan samar
  - terstruktur atau ekspresif: subject boleh ada, tetapi hanya clue tipis
- Subject tidak boleh:
  - membocorkan inti masalah secara eksplisit
  - menyebut nama LJK plus problem utama secara terang-terangan
  - menjadi ringkasan kronologi
  - lebih informatif daripada body email
- Subject kosong adalah state valid di data dan UI.

## Dampak Ke UI

- Detail view tetap aman saat subject kosong, dengan placeholder netral `Tanpa Subjek`.
- Composer balasan tetap read-only untuk field metadata dan tidak mengubah payload submit.
- History dan ringkasan sesi tetap render aman saat subject kosong.
- Body email tetap menjadi sumber konteks utama untuk agen.

## Pengujian

- `npm run lint`
- `npm run build` atau `npm run type-check`

- Smoke test manual:
  - mulai sesi baru dan cek subject bisa kosong, umum, atau samar
  - pastikan detail view tidak rusak saat subject kosong
  - pastikan composer balasan tidak memaksa subject baru
  - pastikan history sesi tetap stabil saat subject kosong
  - pastikan evaluasi tetap muncul setelah reply

## Referensi File

- `app/(main)/pdkt/components/EmailInterface.tsx`
- `app/(main)/pdkt/components/EmailComposer.tsx`
- `app/(main)/pdkt/components/ReplyComposer.tsx` — shared reply composer component
- `app/(main)/pdkt/components/ScenarioImage.tsx` — shared scenario image renderer
- `app/(main)/pdkt/components/EmailDetailPane.tsx`
- `app/(main)/pdkt/components/MailboxInterface.tsx`
- `app/(main)/pdkt/components/MailboxSidebar.tsx`
- `app/(main)/pdkt/components/CreateEmailModal.tsx`
- `app/(main)/pdkt/components/SettingsModal.tsx`
- `app/(main)/pdkt/utils/detectMimeType.ts` — MIME type detection dari magic bytes
- `app/(main)/pdkt/services/geminiService.ts`
- `app/(main)/pdkt/PdktClient.tsx`
