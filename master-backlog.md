# Master Backlog - SIDAK Regression Audit

> Status: In Progress (Stages 1-7 Audit Completed)
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

## 3. Dashboard, Ranking, and Aggregate Integrity [P0] - IN REVIEW
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
- Baseline teknis sudah lolos: `npm run lint` dan `npm run type-check`.
- Sisa pekerjaan tahap 8 adalah smoke test manual pada route utama SIDAK dan validasi akhir lintas halaman untuk dataset yang sama.

## Notes
- `master-backlog.md` harus diganti penuh dengan backlog ini; backlog redesign lama dihapus seluruhnya.
- Tidak ada script test otomatis khusus di `package.json`, jadi regresi SIDAK harus ditopang oleh `lint`, `type-check`, dan smoke test manual terstruktur.
- Ada perubahan lokal yang belum committed di `app/(main)/qa-analyzer/services/qaService.server.ts`; backlog audit ini harus memperlakukan file itu sebagai in-flight risk area dan memverifikasi hasilnya sebelum menyimpulkan modul stabil.
- `context7` MCP tidak tersedia di sesi ini, jadi backlog ini disusun dari inspeksi repo lokal, histori git 10 hari terakhir, dan dokumen verifikasi yang ada.
