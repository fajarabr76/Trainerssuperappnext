# SIDAK Incident Note - Agent Detail Score 100%

Dokumen ini menyimpan ringkasan incident yang sempat terjadi pada halaman detail agent SIDAK dan sekarang sudah ditutup.

## Status

- Status: `resolved`
- Prioritas saat incident: `high`
- Dampak saat incident: skor pada halaman detail agent dapat tampil `100%` walaupun data audit nyata tidak sempurna.

## Route Terdampak

- ` /qa-analyzer/agents/[id]`

Contoh route yang dipakai sebagai repro utama:
- `/qa-analyzer/agents/7f7cb2d1-de1e-482c-b8b7-2cc793965075?year=2026&tstart=1&tend=4&service=email`

## Ringkasan Gejala Saat Incident

- Dashboard SIDAK sudah tidak selalu `100%`.
- Directory/list agent di `/qa-analyzer/agents` sudah menampilkan skor non-100 untuk agent tertentu.
- Tetapi ringkasan bulanan dan panel skor utama di `/qa-analyzer/agents/[id]` masih bisa tampil `100%` karena row phantom clean session terfilter terlalu awal dari jalur detail.

## Fakta Data Yang Sudah Diverifikasi

Agent contoh: `7f7cb2d1-de1e-482c-b8b7-2cc793965075` (`Email`, `Tim Email`)

Temuan audit nyata `email` tahun `2026`:
- Jan 2026: `2` row real, `2` defect
- Feb 2026: `0` row real, `40` row phantom
- Mar 2026: `7` row real, `3` defect
- Apr 2026: `2` row real, `2` defect

Perhitungan skor dari data mentah yang sudah diverifikasi:
- Jan 2026: `96.75`
- Mar 2026: `96.75`
- Apr 2026: `96.58`

Directory summary untuk agent yang sama juga sudah menunjukkan skor non-100:
- `avgScore: 98.43`

Kesimpulan: issue ini **bukan** karena data audit agent memang sempurna, tetapi karena jalur scoring di halaman detail agent masih belum konsisten dengan source of truth.

## Akar Masalah Final

- Row phantom clean session diperlakukan sebagai kasus yang harus selalu dibuang, padahal untuk SIDAK ia tetap harus dihitung sebagai audit valid.
- Karena filter itu terjadi terlalu awal, jalur detail agent, ranking, dan fallback dashboard kehilangan audited presence pada periode phantom-only.
- Metrik defect dan metrik audited population belum dipisah secara eksplisit.

## Fix Yang Diterapkan

- Introduce invariant 3 bucket di service layer:
  - `auditPresenceRows`
  - `scoreRows`
  - `findingRows`
- `getAgentPeriodSummaries()`, ranking, top agents, dashboard fallback, dan trend fallback sekarang memakai bucket yang sesuai.
- Tambah migration `20260422103000_fix_sidak_clean_session_audit_presence.sql` agar RPC dashboard/range/trend mengikuti semantik yang sama.
- Dokumentasi smoke test dan guardrails diperbarui agar future change tidak lagi memakai filter phantom global untuk semua jalur.

## Dampak Bisnis Saat Incident

- Trainer/leader dapat salah menyimpulkan performa agent pada halaman detail individual.
- Pada saat incident, halaman detail agent tidak bisa dijadikan source of truth.

## Status Setelah Fix

- Smoke test manual terbaru dinyatakan `ok`.
- Halaman detail agent, ranking, dan dashboard sudah konsisten dengan semantik clean-session yang baru.
- Dokumen ini dipertahankan sebagai incident note dan referensi regresi, bukan lagi issue terbuka.

## Regression Guard

- Jangan filter `is_phantom_padding = false` sebelum data dipartisi ke `auditPresenceRows`, `scoreRows`, dan `findingRows`.
- Gunakan `docs/SIDAK_SCORING_GUARDRAILS.md` sebagai checklist code review.
- Gunakan `docs/QA_SMOKE_TEST_VERSIONED_RULES.md` bagian clean-session regression check sebelum deploy.

## Checklist Penutupan

- [ ] `getAgentPeriodSummaries()` menghasilkan skor non-100 untuk agent contoh di atas.
- [ ] Halaman `/qa-analyzer/agents/[id]` menampilkan nilai yang sama dengan hasil hitung server.
- [ ] Nilai di detail agent konsisten dengan directory list untuk period/service yang sama.
- [ ] Nilai phantom-only period muncul sebagai audited session valid dengan skor `100` dan `findingsCount = 0`.
- [ ] Smoke test ulang untuk minimal 3 agent lintas service (`call`, `chat`, `email`).
