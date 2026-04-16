# Master Backlog Trainers SuperApp

Last update: 16 April 2026
Owner default: Product + Engineering

## Cara Pakai
- Gunakan checklist untuk update progres.
- Ubah status hanya di satu tempat ini agar tracking tetap konsisten.
- Prioritas: `P0` (kritis), `P1` (tinggi), `P2` (menengah), `P3` (nice to have).

## A. Selesai

### A1. User Management + Access
- [x] Aksi `approve user` kembali muncul dan berfungsi.
- [x] Aksi `delete user` kembali muncul dan berfungsi.
- [x] Aksi `reset password`, `ubah role`, dan `suspend/pending user` direstore di flow baru.
- [x] Visibilitas management untuk `trainer/admin/superadmin` dibenahi.
- [x] Akses `admin/superadmin` ke menu management dan monitoring dipulihkan.

### A2. Auth Flow Konsisten
- [x] Redirect ke `/?auth=login` disamakan di area yang masih pakai route lama.
- [x] Flow `waiting-approval` disamakan.
- [x] Route legacy `/pending` diarahkan ke flow approval baru.

### A3. Tooling
- [x] Script `lint:fix` ditambahkan.
- [x] Script `type-check` ditambahkan.

### A4. Profiler (Visual + Slides Baseline)
- [x] Unifikasi visual `Profiler`: `add`, `import`, `analytics`, `export`, `teams`.
- [x] Preview eksplorasi `Profiler Slides` (konservatif + polished) tersedia di route lokal.
- [x] Opsi alternatif export portrait A4 berbasis preview polished sudah diterapkan.
- [x] Hub Profiler (pilih tahun/tim/batch sebelum masuk folder) sudah ditambahkan.
- [x] Copywriting utama Profiler sudah mulai dirapikan ke gaya profesional.

### A5. SIDAK Unifikasi State (Batch 1)
- [x] Komponen state terpadu dibuat: `app/(main)/qa-analyzer/components/QaStatePanel.tsx`.
- [x] State `empty/loading/error/success/warning` mulai disamakan di halaman:
  - [x] `periods`
  - [x] `settings`
  - [x] `ranking`
  - [x] `dashboard` (chart/table utama)
  - [x] `input`
  - [x] `reports`
  - [x] `agents`
  - [x] `agents/[id]` (sebagian)

## B. Sedang Jalan

### B1. Dashboard & IA
- [ ] Review penuh prioritas dashboard per role (`agent/leader/trainer/admin/superadmin`).
- [ ] Validasi ulang quick actions agar benar-benar role-driven.

### B2. Profiler Visual Consistency
- [x] Final pass konsistensi style lintas seluruh submodule Profiler.
- [x] Audit spacing/card density desktop vs mobile di halaman padat.

### B3. SIDAK Visual Consistency
- [x] Rapikan hierarchy card/panel agar tidak ada sisa nuansa old app.
- [x] Samakan tone copywriting semua empty/loading/error state.

## C. Belum Selesai - Prioritas Tinggi

### C1. Profiler Table (P0)
- [x] Ratakan ke visual system terbaru.
- [x] Rapikan toolbar, filter, bulk action, modal edit.
- [x] Rapikan empty/loading/error state.
- [x] Final check responsive density desktop/mobile.

### C2. Profiler Slides Export Mode (P0)
- [x] Finalisasi pilihan export:
  - [x] `Original`
  - [x] `Opsi 2 (Portrait A4)` berbasis konsep polished
- [x] Pastikan preview aktif merepresentasikan hasil export.
- [x] Pastikan output download benar-benar sesuai mode aktif.

### C3. Crop/Zoom Foto Peserta (P0)
- [x] Crop/zoom in/zoom out saat upload/edit dari table.
- [x] Persist metadata framing.
- [x] Framing dipakai konsisten untuk table + slide + export.
- [x] Uji fallback data lama tanpa metadata crop secara menyeluruh.

## D. SIDAK / QA Analyzer

### D1. Unifikasi Subpage ke Visual System Baru (P1)
- [x] `agents`
- [x] `agents/[id]` (mayoritas state utama)
- [x] `input`
- [x] `periods`
- [x] `ranking`
- [x] `reports`
- [x] `settings`
- [x] Final pass komponen minor yang belum tersentuh di masing-masing halaman.

### D2. Responsive + Dark Mode QA (P1)
- [ ] Audit responsive halaman kompleks:
  - [x] `/qa-analyzer/input`
  - [x] `/qa-analyzer/reports`
- [x] Audit dark mode halaman SIDAK yang belum disentuh detail.

## E. Regression & Functional QA

### E1. Regression Utama (P0)
- [ ] Audit management lain pasca redesign.
- [ ] Verifikasi penuh `Telefun` maintenance tidak memblokir area lain.
- [ ] Pastikan back navigation/dashboard links menjaga flow lama.

### E2. Auth Regression (P0)
- [ ] Login
- [ ] Register
- [ ] Forgot password
- [ ] Reset password
- [ ] Pending
- [ ] Waiting approval

### E3. Security Access Guard (P0)
- [ ] Review ulang seluruh flow approval user.
- [ ] Audit route sensitif + role guard.
- [ ] Validasi ketat bahwa `agent` tidak melihat route/aksi terlarang.

## F. Technical Debt

### F1. Lint & Type Hygiene (P1)
- [ ] Turunkan warning lint global.
- [ ] Bersihkan `unused imports`.
- [ ] Bersihkan `unused vars`.
- [ ] Bersihkan `missing exhaustive-deps`.
- [ ] Bersihkan `unused expressions`.

### F2. Type Safety (P1)
- [ ] Kurangi `any` di area prioritas:
  - [ ] auth/layout
  - [ ] dashboard/monitoring/users/settings
  - [ ] shared services
  - [ ] module config/shared UI

### F3. Code Health (P2)
- [ ] Audit hook/effect rapuh.
- [ ] Rapikan dynamic import/interoperability di export/reporting.
- [ ] Audit dead code/shared abstraction yang belum terpakai.

## G. Performance & Asset

### G1. SIDAK Performance (P1)
- [ ] Audit `<img>` ke `next/image` di SIDAK agent pages.
- [ ] Review asset/background glow agar mobile tidak berat.
- [ ] Review page berat:
  - [ ] `/qa-analyzer/input`
  - [ ] `/qa-analyzer/reports`
  - [ ] `/profiler/import`
  - [ ] area export/profiler lain bila perlu
- [ ] Tambahkan split/lazy load pada komponen berat yang relevan.

## H. Responsive & Visual QA

### H1. Final Cross-Module Pass (P1)
- [ ] Cek ulang responsive:
  - [ ] SIDAK input
  - [ ] SIDAK reports
  - [ ] Profiler table
  - [ ] Profiler import/export
- [ ] Uji mobile sidebar + overlay pasca redesign.
- [ ] Review hero/header baru di viewport kecil.
- [ ] Audit dark mode menyeluruh.

## I. Integrasi AI PDKT

### I1. Skoring Jawaban dengan Gemini 3.1 Flash Lite (P0)
- [ ] Investigasi error saat cek skor jawaban di aplikasi PDKT.
- [ ] Samakan konfigurasi model ke versi terbaru yang sudah ada di GitHub.
- [ ] Uji fallback/error handling jika provider timeout/rate-limit.
- [ ] Verifikasi output skor konsisten dengan rubrik existing.

## J. Urutan Eksekusi Rekomendasi

1. Profiler Table final pass.
2. Finalisasi mode export Profiler (`Original` + `Opsi 2 Portrait A4`).
3. QA fallback data lama untuk metadata crop foto.
4. SIDAK responsive + dark mode full pass.
5. Regression/auth/access QA menyeluruh.
6. PDKT Gemini 3.1 Flash Lite fix + verifikasi.
7. Warning cleanup dan technical debt besar.

## K. Catatan UX Writing / Content Design

- Hindari copy yang terdengar seperti catatan internal percakapan.
- Gunakan gaya profesional, ringkas, dan berorientasi aksi.
- Hindari frasa ambigu seperti “sekarang memudahkan trainer untuk ...”.
- Gunakan pola kalimat:
  - Konteks singkat
  - Aksi utama
  - Dampak/hasil yang jelas
