# Vercel RES Optimization v1

## Status

- Belum dikerjakan
- Plan dibuat untuk eksekusi bertahap
- Tahap hati-hati wajib meminta persetujuan user sebelum implementasi

## Ringkasan

Plan ini bertujuan menaikkan Real Experience Score (RES) Vercel tanpa mengurangi keamanan, RBAC, atau logika bisnis. Fokus awal adalah perubahan risiko rendah seperti image optimization, deferred loading, dan pengurangan hydration di first viewport. Optimasi yang menyentuh middleware, auth, caching protected route, dan dependency removal dipisahkan sebagai tahap hati-hati.

RES Vercel perlu dibaca dari Speed Insights per route, device, environment, dan metric. Perbaikan tidak boleh diasumsikan berhasil hanya dari build lokal; build lokal dipakai untuk baseline First Load JS dan validasi integrasi, sedangkan dampak RES perlu dilihat setelah deployment mengumpulkan data real user.

## Guardrail Umum

- Jangan mengubah schema database.
- Jangan mengubah rumus SIDAK, total temuan, ranking, clean-session semantics, phantom rows, atau scoring.
- Jangan mengubah flow bisnis KETIK, PDKT, Telefun, Profiler, atau QA Analyzer kecuali memang bagian dari tahap yang disetujui.
- Jangan menghapus auth gate, RBAC, `requirePageAccess()`, middleware protected route, atau status handling user.
- Semua file edit wajib membaca file terbaru terlebih dahulu, lalu memakai patch unified diff dengan perubahan minimal.
- Setiap tahap harus diverifikasi sebelum lanjut ke tahap berikutnya.
- Tahap yang ditandai "Hati-hati" wajib berhenti dan meminta persetujuan eksplisit user sebelum mulai implementasi.

## Tahap 0 - Baseline dan Diagnosis

Tujuan: memastikan optimasi diarahkan ke route dan metric yang benar.

Perubahan:

- Buat baseline lokal dengan `npm run build`.
- Catat First Load JS untuk route utama:
  - `/`
  - `/dashboard`
  - `/qa-analyzer/dashboard`
  - route lain yang muncul buruk di Vercel Speed Insights.
- Audit manual Vercel Speed Insights:
  - environment production
  - mobile dan desktop
  - RES, FCP, LCP, INP, CLS
  - route, country, dan element yang paling buruk jika tersedia.
- Update file plan ini dengan hasil baseline jika tahap dikerjakan nanti.

Verifikasi:

- `npm run build`
- Tidak ada perubahan logika bisnis.
- Tidak ada perubahan auth/RBAC.

Risiko:

- Rendah. Tahap ini hanya observasi dan dokumentasi.

## Tahap 1 - Relatif Aman: Image Optimization dan Asset Loading

Tujuan: memperbaiki LCP/FCP tanpa menyentuh auth, data, atau business logic.

Perubahan:

- Hapus `images.unoptimized: true` dari `next.config.ts` jika semua domain image sudah didukung.
- Lengkapi `images.remotePatterns` secara spesifik untuk sumber image yang dipakai:
  - Supabase Storage project domain
  - `api.dicebear.com`
  - `picsum.photos` jika masih dipakai runtime
- Review semua penggunaan `Image` dengan prop `unoptimized`.
- Pertahankan `unoptimized` hanya untuk kasus yang memang perlu, misalnya SVG/avatar external yang tidak cocok dengan optimizer atau preview lokal yang riskan.
- Pastikan image above-the-fold punya ukuran stabil, `sizes`, dan `priority` hanya jika benar-benar menjadi LCP element.
- Jangan mengubah template raw `<img>` untuk export HTML/PDF jika template itu bukan route runtime yang mempengaruhi RES.

Verifikasi:

- `npm run lint`
- `npm run build`
- Smoke test landing, dashboard, profiler preview, avatar, dan image dari Supabase/DiceBear.
- Pastikan tidak ada broken image.

Risiko:

- Rendah. Risiko utama adalah image gagal render karena domain belum masuk `remotePatterns`.

## Tahap 2 - Relatif Aman: Defer Komponen Berat

Tujuan: mengurangi initial JS dan hydration cost tanpa mengubah hasil bisnis.

Perubahan:

- Dynamic import chart yang tidak wajib untuk first paint.
- Dynamic import modal besar yang hanya muncul setelah interaksi user.
- Dynamic import library export/import berat hanya saat aksi dijalankan:
  - `xlsx`
  - `exceljs`
  - `docx`
  - `pptxgenjs`
  - `jspdf`
  - `html2canvas`
- Pastikan fallback/skeleton punya tinggi atau aspect ratio stabil agar tidak menambah CLS.
- Jangan mengubah hasil export/import, hanya waktu loading dependency.

Verifikasi:

- `npm run lint`
- `npm run build`
- Smoke test dashboard chart.
- Smoke test export/import utama.
- Bandingkan First Load JS sebelum dan sesudah.

Risiko:

- Rendah sampai sedang. Risiko utama adalah loading state, chart, modal, atau export action terlambat muncul.

## Tahap 3 - Relatif Aman: Kurangi Hydration Above-the-Fold

Tujuan: memperbaiki FCP/INP dengan membatasi client work pada landing, dashboard, dan shell.

Perubahan:

- Audit `app/page.tsx`, dashboard first viewport, dan authenticated shell.
- Pecah komponen besar menjadi Server wrapper plus Client island hanya untuk bagian interaktif.
- Prioritaskan route `/`, `/dashboard`, dan shell `(main)`.
- Optimasi sidebar hanya pada render/hydration; jangan ubah daftar menu, role visibility, atau akses route.
- Kurangi animation-on-mount yang muncul di first viewport jika tidak penting.
- Hindari perubahan SIDAK data flow pada tahap ini.

Verifikasi:

- `npm run lint`
- `npm run build`
- Smoke test:
  - landing auth modal
  - login/logout dasar
  - dashboard render
  - sidebar navigation
  - theme toggle
  - route protected tetap sesuai role

Risiko:

- Rendah sampai sedang. Risiko utama adalah regression UI/interaksi, bukan keamanan, selama permission logic tidak disentuh.

## Tahap 4 - Hati-hati: Auth, Middleware, dan RBAC Performance

NOTE WAJIB: sebelum masuk tahap ini, minta persetujuan eksplisit user. Jangan implementasi otomatis.

Tujuan: menurunkan TTFB protected routes tanpa melemahkan keamanan.

Batas keras:

- Jangan menghapus `requirePageAccess()`.
- Jangan menghapus middleware gate untuk protected routes.
- Jangan menghapus handling `is_deleted`, `rejected`, `pending`, atau role normalization.
- Jangan mengubah kontrak tolerant transient profile read.
- Jangan menyimpan role/status sensitif di cookie biasa tanpa proteksi dan strategi invalidasi.

Perubahan yang boleh dipertimbangkan setelah audit:

- Kurangi profile read berulang hanya jika ada mekanisme freshness yang jelas.
- Gunakan cache pendek yang scoped per-user jika benar-benar aman.
- Pindahkan data non-security keluar dari middleware bila tidak diperlukan untuk keputusan akses.
- Pertahankan security gate server-side.

Verifikasi wajib:

- `npm run lint`
- `npm run build`
- Smoke test login/logout.
- Smoke test guest redirect ke login.
- Smoke test user `pending`, `rejected`, dan `is_deleted`.
- Smoke test route access untuk role trainer, leader, agent, dan admin.

Risiko:

- Tinggi. Kesalahan bisa membuka akses route, menutup akses user valid, atau membuat session dihancurkan secara salah.

## Tahap 5 - Hati-hati: Route Dynamic, Server Caching, dan Data Cache

NOTE WAJIB: sebelum masuk tahap ini, minta persetujuan eksplisit user. Jangan implementasi otomatis.

Tujuan: memperbaiki TTFB dan FCP/LCP server-rendered routes tanpa merusak data freshness atau business logic.

Batas keras:

- Jangan hapus `force-dynamic` massal.
- Jangan cache data user-specific secara global.
- Jangan cache hasil yang bergantung role/session tanpa cache key yang benar.
- Jangan ubah rumus SIDAK, ranking, clean-session semantics, phantom rows, atau total temuan.

Perubahan yang boleh dipertimbangkan setelah audit:

- Klasifikasikan route menjadi public, protected shared, protected user-specific, dan SIDAK.
- Untuk public landing, evaluasi apakah dynamic masih diperlukan.
- Untuk dashboard protected, cache hanya data agregat yang aman dan punya TTL/invalidation jelas.
- Untuk SIDAK, pertahankan aggregation semantics dan gunakan caching hanya jika parity terbukti.
- Dokumentasikan cache key, TTL, invalidation, dan alasan data aman dicache.

Verifikasi wajib:

- `npm run lint`
- `npm run type-check`
- `npm run test:sidak`
- Smoke test dashboard.
- Smoke test SIDAK dashboard, ranking, input, dan agent detail.
- Bandingkan angka total temuan, score, ranking, dan clean-session behavior sebelum/sesudah.

Risiko:

- Tinggi. Kesalahan caching bisa menampilkan data stale, salah, lintas-user, atau merusak metrik SIDAK.

## Tahap 6 - Hati-hati: Dependency Cleanup

NOTE WAJIB: sebelum masuk tahap ini, minta persetujuan eksplisit user jika sampai menghapus dependency dari `package.json`.

Tujuan: mengurangi bundle dan dependency surface.

Perubahan:

- Audit penggunaan `framer-motion` vs `motion`.
- Standarkan ke satu package hanya jika seluruh import path aman dimigrasikan.
- Jangan hapus library export/import sebelum semua call site terbukti dynamic import atau tidak dipakai.
- Jika ada dependency removal, update `package-lock.json` lewat `npm install`.

Verifikasi wajib:

- `npm run lint`
- `npm run build`
- Smoke test modul yang memakai modal, animation, chart, export, dan import.
- Review diff `package.json` dan `package-lock.json`.

Risiko:

- Sedang sampai tinggi. Bisa merusak import path atau fitur yang jarang dipakai.

## Acceptance Criteria

- Build dan lint lulus untuk tahap yang dikerjakan.
- Tidak ada perubahan schema/database.
- Tidak ada perubahan business logic SIDAK/KETIK/PDKT/Profiler.
- Login, logout, RBAC, dan protected routes tetap berjalan.
- First Load JS atau metrik Speed Insights route target membaik setelah deployment dan data terkumpul.
- Tahap hati-hati hanya dilakukan setelah user menyetujui tahap tersebut secara eksplisit.

## Urutan Eksekusi Default

1. Tahap 0 - baseline dan diagnosis.
2. Tahap 1 - image optimization.
3. Tahap 2 - defer komponen berat.
4. Tahap 3 - hydration above-the-fold.
5. Stop dan minta persetujuan user sebelum Tahap 4.
6. Stop dan minta persetujuan user sebelum Tahap 5.
7. Stop dan minta persetujuan user sebelum Tahap 6 jika ada dependency removal.

## Catatan untuk Implementer

- Jangan menjalankan tahap 4, 5, atau 6 hanya karena tahap 1-3 selesai.
- Jika user meminta "lanjut", konfirmasi tahap mana yang dimaksud bila instruksi tidak eksplisit.
- Untuk setiap tahap, update bagian `Status` atau tambahkan catatan hasil verifikasi di file ini setelah implementasi.
- Jika Vercel Speed Insights menunjukkan route spesifik yang buruk, prioritaskan route itu daripada melakukan refactor luas.
