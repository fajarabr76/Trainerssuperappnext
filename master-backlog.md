# Master Backlog - SIDAK Regression Audit

> Status: In Progress (Stage 8 Baseline Complete, Authenticated Smoke Pending)
> Fokus: audit regresi menyeluruh untuk modul SIDAK setelah rangkaian refactor besar pada dashboard, agent detail, reports, phantom padding, auth guard, dan versioned QA rules.
> Outcome: setiap alur utama SIDAK punya checklist verifikasi, bug bucket, dan acceptance criteria yang jelas sebelum dianggap stabil.

## 1. Scoring & Rules Compatibility [P0] - DONE
- Audit kompatibilitas `versioned QA rules` dengan data legacy pada `qa_indicators`, `qa_service_weights`, dan `qa_temuan`.
- Verifikasi fallback indikator dan bobot untuk period lama saat `resolveRuleVersion()` tidak menemukan versi published.
- Verifikasi semua kalkulasi yang memakai `calculateQAScoreFromTemuan()` tidak diam-diam menghasilkan `100` karena indikator kosong.
- Audit parity antara path cache, fallback service, dan path RPC untuk:
- `getAgentPeriodSummaries`
- `getAgentDirectorySummary`
- dashboard aggregate helpers
- ranking/report summaries
- Acceptance:
- skor bulanan agent, skor direktori, ranking, dan dashboard konsisten untuk dataset yang sama
- tidak ada period valid yang tampil `100` hanya karena missing rule version
- period tanpa indikator menghasilkan warning/empty state yang jelas, bukan skor palsu

## 2. Agent Detail & Canonical State [P0] - DONE
- Audit route `/qa-analyzer/agents/[id]` untuk sinkronisasi state server-client:
- `year`
- `service`
- `tstart`
- `tend`
- month rail / active summary
- Verifikasi `monthlySummaries`, `topTickets`, `trend range`, `team switcher`, dan `export` tetap selaras setelah refactor UI dan canonical redirect.
- Uji perilaku untuk:
- agent dengan data multi-service
- agent dengan data tahun lama
- agent tanpa audit di tahun terpilih
- agent role vs trainer/leader/admin
- Acceptance:
- Analisis Performa Bulanan menampilkan skor riil per bulan
- pergantian year/service/range tidak menyisakan chart atau summary stale
- empty state dan fallback render benar untuk agent tanpa data
- Fix applied:
- rekonsiliasi `selectedMonth` setelah ganti year/service agar panel bulanan dan top tickets tidak stale
- server actions detail agent sekarang memverifikasi ownership untuk role `agent`

## 3. Dashboard, Ranking, and Aggregate Integrity [P0] - DONE
- Verifikasi semua aggregate SIDAK memakai definisi data yang konsisten terhadap:
- phantom padding exclusion
- service filter
- folder filter
- month range
- year filter
- Bandingkan hasil dashboard, ranking, dan top agents terhadap service-layer source yang sama untuk mendeteksi drift antara RPC dan fallback TypeScript.
- Audit area yang baru/refactor berat:
- dashboard workspace + filter trust logic
- ranking route
- top findings / pareto / severity composition
- admin parity changes
- Acceptance:
- perubahan filter tidak menghasilkan mismatch antara UI scope dan angka yang ditampilkan
- phantom rows tidak bocor ke KPI, ranking, maupun findings aggregate
- hasil fallback dan RPC tidak berbeda secara fungsional untuk scope yang sama
- Fix applied:
- ranking/top agents sekarang mengecualikan phantom rows secara konsisten untuk scoring, defects, dan critical flags
- aggregate dashboard menyamakan populasi agent dengan filter `isAgentExcluded` agar KPI dan daftar agent menggunakan basis data yang sama

## 4. Input Audit & Phantom Session Safety [P0] - DONE
- Audit flow `/qa-analyzer/input` untuk input manual, input clean session, dan reuse parameter setelah versioned rules.
- Verifikasi mapping `indicator_id`, `rule_version_id`, dan `rule_indicator_id` saat:
- rule version tersedia
- rule version tidak tersedia
- service type BKO/SLIK/no_category
- Uji migration-dependent behavior:
- phantom support column/index
- duplicate phantom prevention
- period/service resolution
- Acceptance:
- input audit baru selalu menyimpan referensi yang konsisten
- clean session/phantom session tidak menggandakan data atau merusak scoring
- error untuk skema lama bersifat user-friendly dan traceable
- Fix applied:
- mapping `rule_indicator_id` pada input manual/import sekarang match by `indicator.id` maupun `legacy_indicator_id` agar aman untuk indikator versi baru maupun legacy
- `createTemuanBatchAction` sekarang memberi error schema lama yang eksplisit ketika kolom `rule_version_id` / `rule_indicator_id` belum tersedia
- live score dan label parameter di input page sekarang memprioritaskan `rule_indicator_id` dengan fallback ke `indicator_id` agar preview tetap akurat lintas versi rule

## 5. Reports & Export Regression [P1] - DONE
- Audit menu `/qa-analyzer/reports`, report data workspace, dan AI gate setelah pemisahan `reports/data` dan `reports/ai`.
- Verifikasi data report table:
- sorting
- filter period
- chronological month rendering
- export/download path
- Verifikasi agent export dan report builder tetap cocok dengan model data terbaru, terutama setelah versioned rules dan clean-session handling.
- Acceptance:
- report data dan export agent menampilkan angka yang sama dengan halaman sumber
- filter/sort tidak mengubah makna data
- AI/report gate tidak memblokir flow normal dan tidak bocor state antar sesi
- Fix applied:
- data report sekarang versioned-rule aware: tidak lagi bergantung pada join legacy `qa_indicators!inner`, parameter diselesaikan via metadata resolver snapshot/legacy
- filter parameter di data report sekarang cocok lintas `indicator_id`, `rule_indicator_id`, dan fallback nama indikator legacy agar hasil filter tidak hilang pada data versioned
- export agent menambahkan fallback indikator per period/service saat snapshot tidak tersedia agar skor export tidak jatuh ke nilai default palsu
- report individu AI menormalkan nama parameter dengan fallback catalog indikator per service/period sehingga peta zero/regresi tetap akurat pada data legacy maupun versioned

## 6. Auth, Access, and Route Guard Regression [P1] - DONE
- Audit seluruh page SIDAK yang memakai `requirePageAccess()` setelah centralization auth guard.
- Verifikasi proteksi berlapis for:
- middleware
- server page guard
- role-gated actions
- own-agent restriction
- Uji role matrix:
- `agent`
- `leader`
- `trainer`
- `admin`
- Acceptance:
- role hanya melihat route dan data yang seharusnya
- redirect/login terminal state tetap benar
- perubahan role naming (`admin`, `trainer`, `leader`, `agent`) tidak meninggalkan cabang legacy yang salah
- Fix applied:
- middleware sekarang memisahkan guard `/qa-analyzer/agents` (list) dan `/qa-analyzer/agents/[id]` (detail) agar role `agent` tidak salah diblokir saat membuka detail
- server actions SIDAK untuk versioned-rules dan helper read sensitif sekarang memiliki RBAC internal konsisten (trainer/admin, serta trainer/leader/admin untuk ranking)
- akses detail agent tetap berlapis: middleware mengizinkan role yang tepat, lalu action-level own-agent restriction tetap memverifikasi kepemilikan data untuk role `agent`

## 7. Performance, Loading, and UX Stability [P2] - DONE
- Audit lazy loading dan loading skeleton pada area yang baru dipecah atau didesain ulang:
- agent detail tabs
- report chart capture
- heavy export/import libraries
- dashboard charts
- Verifikasi state loading/empty/error di desktop dan mobile untuk route utama SIDAK.
- Fokuskan juga pada regressi non-fungsional:
- no-scroll issues
- hydration mismatch
- dark mode contrast
- responsive overflow
- Acceptance:
- route utama SIDAK usable pada mobile/tablet/desktop
- komponen berat tidak memblok render awal tanpa alasan
- tidak ada overflow atau stuck loading pada path umum
- Fix applied:
- default bulan pada `reports/data` dan `reports/ai` sekarang diinjeksi dari server (`currentMonth`) untuk mengurangi potensi hydration mismatch lintas timezone
- loading fallback untuk route `input` dan `reports/ai` diubah dari `h-screen` ke tinggi adaptif (`min-h-[45vh]`) agar tidak memicu no-scroll/viewport lock pada layout bertingkat mobile

## 8. Verification Runbook [P0] - IN PROGRESS
- Jalankan baseline teknis:
- `npm run lint` - DONE
- `npm run type-check` - DONE
- Jalankan smoke test manual minimal untuk route:
- `/qa-analyzer/dashboard`
- `/qa-analyzer/agents`
- `/qa-analyzer/agents/[id]`
- `/qa-analyzer/input`
- `/qa-analyzer/ranking`
- `/qa-analyzer/reports`
- `/qa-analyzer/settings`
- Untuk tiap temuan regresi:
- catat severity (`P0`, `P1`, `P2`)
- catat source area (`rules`, `aggregate`, `ui-state`, `auth`, `report`, `performance`)
- tautkan ke commit/refactor pemicu bila bisa diisolasi
- Exit criteria:
- semua bug `P0` selesai
- `P1` minimal punya fix plan yang jelas
- lint dan build hijau pada baseline final
- tidak ada mismatch angka lintas halaman untuk dataset yang sama

### Current Status
- Baseline teknis sudah lolos pada `2026-04-21`: `npm run lint` dan `npm run type-check`.
- Smoke check route SIDAK (unauthenticated) sudah diverifikasi pada `2026-04-21`; semua route mengarah `307` ke `/?auth=login`, sesuai guard:
- `/qa-analyzer/dashboard`
- `/qa-analyzer/agents`
- `/qa-analyzer/agents/[id]`
- `/qa-analyzer/input`
- `/qa-analyzer/ranking`
- `/qa-analyzer/reports`
- `/qa-analyzer/settings`
- Sisa pekerjaan tahap 8:
- smoke test manual terautentikasi (role `agent`, `leader`, `trainer`, `admin`) pada route utama SIDAK
- validasi akhir mismatch angka lintas halaman untuk dataset yang sama dalam sesi login nyata

## Notes
- `master-backlog.md` harus diganti penuh dengan backlog ini; backlog redesign lama dihapus seluruhnya.
- Tidak ada script test otomatis khusus di `package.json`, jadi regresi SIDAK harus ditopang oleh `lint`, `type-check`, dan smoke test manual terstruktur.
- Ada perubahan lokal yang belum committed di `app/(main)/qa-analyzer/services/qaService.server.ts`; backlog audit ini harus memperlakukan file itu sebagai in-flight risk area dan memverifikasi hasilnya sebelum menyimpulkan modul stabil.
- `context7` MCP tidak tersedia di sesi ini, jadi backlog ini disusun dari inspeksi repo lokal, histori git 10 hari terakhir, dan dokumen verifikasi yang ada.
