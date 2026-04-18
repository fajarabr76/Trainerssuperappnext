# Master Backlog - Trainers SuperApp

## A. Design System & Refactoring

### A1. Tailwind 4 & Framer Motion Pass (P1)
- [x] Migrasi ke Tailwind 4 (utility-first approach).
- [x] Update Framer Motion ke `motion/react`.
- [x] Unifikasi skema warna per modul (accent-colors).

### A2. Shared Components Pass (P2)
- [x] `ModuleWorkspaceIntro` (Intro seragam tiap modul).
- [x] `PageHeroHeader` (Header seragam tiap modul).
- [x] `ThemeToggle` (Terintegrasi ke Sidebar).
- [x] `Sidebar` (Unified navigation & theme controller).
- [x] `IdleWarningModal` (Global idle session management).
- [x] `AccessDeniedModal` (Global guard interceptor).

## B. Dashboard & Core Layout

### B1. Layout Utama (P1)
- [x] Sidebar baru dengan responsive hamburger.
- [x] Integrasi `next-themes` (Dark/Light mode).
- [x] Session Timeout auto-signout (8 jam max).

### B2. Analitik Dashboard (P1)
- [x] Hero section ("Halo, [User]").
- [x] Pintasan modul cerdas berbasis role.
- [x] Workspace grid navigation.
- [x] Recharts dashboard summary (Service trend).
- [x] Activity logs feed panel.

## C. Profiler (KTP Database)

### C1. Hierarki & Folder Baru (P1)
- [x] Sidebar `profiler_years` (Navigasi tahun).
- [x] Subfolder list `profiler_folders` (Navigasi batch/group).
- [x] CRUD Folder (Add/Edit/Delete).
- [x] Pengecekan duplikasi batch name yang ketat.

### C2. Photo & Metadata Crop (P1)
- [x] Integrasi metadata crop (`x`, `y`, `zoom`) ke database.
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
- [x] Audit responsive halaman kompleks:
  - [x] `/qa-analyzer/input`
  - [x] `/qa-analyzer/reports`
- [x] Audit dark mode halaman SIDAK yang belum disentuh detail.

## E. Regression & Functional QA

### E1. Navigation & Telefun Regression (P1)
- [x] Perbaiki logic back navigation agar deterministik. (Ganti `router.back()` dengan explicit redirect di Profiler Download)
- [x] Sinkronkan modal Telefun Maintenance agar terpusat di `MainLayoutClient`.
- [x] Hapus ownership ganda modal maintenance di `TelefunPage`.

### E2. Auth & Approval Flow (P1)
- [x] Implementasi helper `requirePageAccess` di `app/lib/authz.ts`.
- [x] Sinkronkan landing page untuk membaca query `message=rejected|deleted`.
- [x] Hubungkan `AuthModal` dengan `initialNotice` dari landing page.
- [x] Perbaiki `/waiting-approval` agar menangani status `rejected`/`deleted` terminal.
- [x] Jadikan `/pending` alias redirect ke `/waiting-approval`.

### E3. Security Access Guard (P1)
- [x] Audit route sensitif + role guard terpusat di Server Components. (100% migrasi ke `requirePageAccess`)
- [x] Validasi ketat bahwa `agent` tidak melihat route/aksi terlarang.
- [x] Sinkronisasi status terminal (`rejected`, `deleted`) langsung ke UI login.
- [x] Laporan verifikasi QA tersedia di `docs/QA_VERIFICATION_E_F.md`.

## F. Technical Debt

### F1. Lint & Type Hygiene (P1)
- [x] Turunkan warning lint global. (Semua warning tersisa bersih 100% - verified with npm run lint)
- [x] Bersihkan `unused imports`.
- [x] Bersihkan `unused vars`.
- [x] Bersihkan `missing exhaustive-deps`.
- [x] Bersihkan `unused expressions`.

### F2. Type Safety (P1)
- [x] Kurangi `any` di area prioritas:
  - [x] auth/layout & SessionTimeoutContext (User type Supabase)
  - [x] dashboard/monitoring/users/settings (MonitoringClient, SettingsClient, API pdkt/evaluate)
  - [x] shared services (gemini.ts - bersih dari any)
  - [x] module config/shared UI (QaSettingsClient, QaDashboardClient, Sidebar, TelefunPage, KetikClient, PdktClient)
- [x] Normalkan role ke singular form (`agent`, `leader`, `trainer`, `admin`).

### F3. Code Health (P2)
- [x] Audit hook/effect rapuh. (Hapus `useAuth` lama, migrasi ke server-side `requirePageAccess` di 100% route (main))
- [x] Rapikan dynamic import/interoperability di export/reporting. (Ditambahkan dynamic import untuk ProfilerExportClient, ReportMakerClient, QaInputClient, ProfilerImportClient)
- [x] Audit dead code/shared abstraction yang belum terpakai. (Hapus `useAuth.ts`)

## G. Performance & Asset

### G1. SIDAK Performance (P1)
- [x] Audit `<img>` ke `next/image` di SIDAK agent pages. (Verified next/image usage in Directory/Detail)
- [x] Review asset/background glow agar mobile tidak berat. (Reduced blur intensity and shadows on small screens)
- [x] Review page berat (Sudah menggunakan dynamic import):
  - [x] `/qa-analyzer/input` (Lazy load XLSX/ExcelJS)
  - [x] `/qa-analyzer/reports` (Lazy load Chart Capture)
  - [x] `/profiler/import` (Lazy load XLSX)
  - [x] `/profiler/export` (Lazy load XLSX)
- [x] Tambahkan split/lazy load pada komponen berat yang relevan. (QA Detail tabs & modal now dynamic)

## H. Responsive & Visual QA

### H1. Final Cross-Module Pass (P1)
- [x] Cek ulang responsive:
  - [x] SIDAK input (Breadcrumb & header fixes)
  - [x] SIDAK reports (General layout pass)
  - [x] Profiler table (Search & filter optimization)
  - [x] Profiler import/export (Consistent mobile layouts)
- [x] Uji mobile sidebar + overlay pasca redesign. (Auto-close on navigation, body scroll prevention)
- [x] Review hero/header baru di viewport kecil. (Spacing & glow optimization)
- [x] Audit dark mode menyeluruh. (Verified contrast across key modules)

## I. Integrasi AI PDKT

### I1. Skoring Jawaban dengan Gemini 3.1 Flash Lite (P0)
- [x] Investigasi error saat cek skor jawaban di aplikasi PDKT. (Fixed: unified AI model source of truth)
- [x] Samakan konfigurasi model ke versi terbaru yang sudah ada di GitHub. (Using normalized model IDs from ai-models.ts)
- [x] Uji fallback/error handling jika provider timeout/rate-limit. (Implemented retry with exponential backoff)
- [x] Verifikasi output skor konsisten dengan rubrik existing. (Updated evaluateAgentResponse to use provider-agnostic helper)
- [x] Laporan verifikasi QA tersedia di `docs/QA_VERIFICATION_G_H_I.md`.
