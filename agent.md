# AGENT.md — TrainersSuperAppNext

## Tujuan
Dokumen ini adalah instruksi kerja untuk AI Agent yang akan membantu pengembangan repo `trainerssuperappnext`.  
Ikuti konteks proyek yang sudah ada. Jangan membuat pola arsitektur baru jika tidak benar-benar diperlukan.

---

## Ringkasan Proyek
TrainersSuperApp adalah aplikasi internal untuk kebutuhan pelatihan, simulasi, profiler peserta, dashboard, dan QA Analyzer/SIDAK.  
Aplikasi ini dibangun dengan:
- Next.js 15 (App Router)
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase (Auth, PostgreSQL, RLS, Storage)
- Motion
- Recharts
- Lucide React

Repo ini juga memakai fitur ekspor dan pengolahan file seperti ExcelJS, xlsx, jsPDF, html2canvas, dan PPTXGenJS.

---

## Prinsip Umum
- **WAJIB**: Selalu refer ke MCP `context7` sebelum mengerjakan task apa pun untuk mendapatkan konteks terbaru atau instruksi tambahan yang mungkin relevan.
- Utamakan konsistensi dengan codebase yang sudah ada.
- Jangan refactor besar tanpa diminta.
- Jangan mengganti struktur route, auth flow, atau pola Supabase tanpa alasan kuat.
- Jangan membuat dependency baru bila library yang ada sudah cukup.
- Semua perubahan harus minimal, terarah, dan kompatibel dengan implementasi sekarang.

---

## Stack dan Konvensi Teknis

### Framework
- Gunakan Next.js App Router.
- Gunakan pola file `page.tsx`, `layout.tsx`, dan route group yang sudah ada.
- Pertahankan pemisahan area utama di `app/(main)`.

### Bahasa
- Gunakan TypeScript.
- Hindari `any` kecuali benar-benar darurat; jika terpaksa, beri alasan singkat di komentar.
- Utamakan type/interface yang eksplisit untuk props, response, dan shape data.

### Styling
- Gunakan Tailwind CSS 4.
- Ikuti style yang sudah ada: card rounded, dark mode aware, utility-first.
- Jangan hardcode style inline jika bisa dinyatakan dengan utility Tailwind.
- Pertahankan konsistensi visual existing, termasuk dark/light mode.

### Animasi
- Gunakan package `motion`.
- Jangan kembali ke import lama berbasis `framer-motion` jika codebase aktif sudah memakai pola baru.

### Chart
- Gunakan Recharts bila pekerjaan terkait grafik/dashboard.
- Jangan mengganti ke chart library lain.

### Icons
- Gunakan `lucide-react`.

---

## Struktur Folder yang Harus Dihormati
Ikuti struktur yang sudah ada di repo:

- `app/(main)` → area aplikasi utama
- `app/(main)/dashboard`
- `app/(main)/ketik`
- `app/(main)/pdkt`
- `app/(main)/telefun`
- `app/(main)/profiler`
- `app/(main)/qa-analyzer`
- `app/actions` → server-side actions
- `app/components` → shared UI components
- `app/lib` → utilitas, hooks, services, supabase helpers
- `app/lib/hooks` → hooks seperti auth
- `app/lib/services` → service/data access layer
- `app/lib/supabase` → integrasi client/server/middleware Supabase

Jika menambah file baru, tempatkan sesuai domain modul, bukan asal taruh di root.

---

## Auth dan RBAC
Role yang valid di sistem saat ini hanyalah:
- `Trainer`
- `Leader`
- `Agent`

Aturan penting:
- Jangan membuat asumsi adanya role lain seperti `QA` atau `SPV` kecuali user secara eksplisit meminta perubahan schema dan RBAC.
- Validasi akses harus mengikuti role di tabel `profiles`.
- Hook auth yang ada menggunakan pemeriksaan role secara case-insensitive.
- User dengan status `pending` diarahkan ke halaman pending.
- User yang ditandai deleted akan di-sign-out.

Implikasi praktis:
- `Trainer` dan `Leader` punya akses luas ke data operasional.
- `Agent` harus dibatasi untuk area tertentu.
- Jangan membuka akses route sensitif ke `Agent` tanpa instruksi eksplisit.

---

## Database dan Supabase
- Gunakan Supabase sebagai source of truth.
- Hormati RLS yang sudah ada.
- Jangan menulis query yang berpotensi menabrak policy tanpa memahami schema terlebih dahulu.
- Jika butuh data agregasi atau analytics, utamakan service/helper yang rapi daripada query langsung tersebar di komponen.
- Jika perlu menambah query baru, letakkan di layer service/helper yang relevan.

Tabel penting yang sudah tampak di repo mencakup:
- `profiles`
- `results`
- `profiler_years`
- `profiler_folders`
- `profiler_peserta`
- `profiler_tim_list`

Area QA/SIDAK juga memakai tabel dan SQL terpisah yang sudah disiapkan lewat file SQL di root repo.  
Sebelum mengubah query atau schema QA, cek file SQL terkait terlebih dahulu.

---

## Pedoman Implementasi Komponen
Saat membuat atau mengubah komponen:
- Gunakan functional component.
- Jaga komponen tetap kecil dan fokus.
- Pisahkan logika data dari UI bila mulai membesar.
- Untuk komponen client, tambahkan `'use client'` hanya bila memang perlu.
- Jangan menjadikan seluruh tree sebagai client component bila cukup satu leaf saja.
- Pastikan loading state, empty state, dan error state dipikirkan.

---

## Pedoman Pengambilan Data
- Gunakan pola yang sudah ada di repo.
- Jika data dipakai lintas komponen/modul, letakkan di service/helper.
- Hindari duplikasi query Supabase.
- Jangan menghitung ulang agregasi berat di client jika bisa disiapkan lebih rapi dari query/service.
- Untuk filter dashboard dan analytics, jaga agar perubahan state tidak memicu render/query berlebihan.

---

## Pedoman QA Analyzer / SIDAK
Jika mengerjakan area `qa-analyzer`:
- Pertahankan filosofi dashboard yang sudah ada: fokus pada analisis temuan, tren, dan root cause.
- Gunakan Recharts untuk visualisasi.
- Gunakan istilah dan metrik yang konsisten dengan dokumen proyek dan implementasi yang ada.
- Jangan mengasumsikan role QA/SPV sudah tersedia di auth; mapping operasionalnya saat ini tetap mengikuti role aplikasi yang nyata.

---

## Pedoman Profiler
Jika mengerjakan area `profiler`:
- Pertahankan struktur hierarki data tahun → folder → sub-folder/peserta bila relevan.
- Hormati alur import/export yang sudah ada.
- Jangan merusak kompatibilitas fitur Excel, gambar, slide, atau export.

---

## Pedoman Dashboard dan UI
- Pertahankan dark mode support.
- Gunakan pola card, border, spacing, dan iconografi yang konsisten.
- Jangan membuat desain yang bertolak belakang dengan UI existing.
- Optimalkan keterbacaan data, terutama pada dashboard, tabel, dan chart.

---

## Hal yang Jangan Dilakukan
- Jangan ganti arsitektur App Router ke pola lain.
- Jangan menambah role baru tanpa mengubah schema, policy, dan auth flow.
- Jangan menghapus atau bypass RLS.
- Jangan memindahkan logika penting tanpa kebutuhan jelas.
- Jangan mengganti library inti (Supabase, Recharts, Motion, Tailwind) tanpa instruksi eksplisit.
- Jangan mengubah naming domain besar seperti KETIK, PDKT, TELEFUN, PROFILER, atau QA Analyzer/SIDAK secara sepihak.
- Jangan membuat refactor masif hanya demi preferensi gaya.

---

## Checklist Sebelum Menyelesaikan Tugas
Sebelum menganggap pekerjaan selesai, pastikan:
- Build tidak rusak secara logika.
- Type aman dan konsisten.
- Role access tetap benar (`Trainer`, `Leader`, `Agent`).
- UI tetap mendukung dark mode.
- Tidak ada import usang atau inkonsisten.
- Tidak ada perubahan yang menyalahi struktur folder/domain modul.
- Perubahan sesederhana mungkin namun tetap lengkap.

---

## Format Jawaban yang Diharapkan dari AI Agent
Saat mengerjakan task, AI Agent harus:
1. Menjelaskan file mana yang akan diubah.
2. Menjelaskan alasan perubahan secara singkat.
3. Memberikan patch/kode final yang siap ditempel.
4. Menyebut potensi risiko atau asumsi bila ada.
5. Tidak mengklaim sesuatu "sudah ada" jika belum diverifikasi dari repo.

---

## Prioritas Pengambilan Keputusan
Jika ada konflik, gunakan urutan prioritas ini:
1. Kode aktual di repo
2. Schema/RBAC aktual di SQL
3. Struktur folder aktual
4. README / handover
5. PRD / dokumen rencana

Artinya: implementasi nyata selalu lebih dipercaya daripada dokumen rencana yang belum sepenuhnya diwujudkan.

---

## Catatan Penting
Repo ini mengandung campuran dokumen perencanaan, handover, dan implementasi nyata.  
Jika ada perbedaan antara PRD dan kode aktual, ikuti kode aktual terlebih dahulu, lalu tandai gap tersebut secara eksplisit di jawaban.