# SIDAK Recent Git Changes — 2026-04-22

Rangkuman commit SIDAK terbaru yang relevan untuk surface QA/Scoring/Agent Detail.
Commit repo lain yang tidak relevan (monitoring, ketik, auth) tidak dimasukkan.

## Commit Log

| Commit | Message | Tujuan | Area Terdampak | Risiko/Regresi |
|--------|---------|--------|----------------|----------------|
| `c09d3a8` | `feat: refresh dashboard shell and harden sidak input` | Perbaikan dashboard shell dan pengerasan input SIDAK | `/qa-analyzer/dashboard`, `/qa-analyzer/input` | UI regression pada input flow atau dashboard layout |
| `1bc41c0` | `fix(sidak): harden error normalization and resolve dashboard build blocker` | Normalisasi error yang lebih defensif dan perbaikan build blocker dashboard | `qaService.server.ts`, dashboard page | Error handling berubah; pastikan error AppRouter masih tertangkap |
| `4daa99a` | `fix(sidak): refactor all server actions to prevent generic Next.js masking` | Refactor server actions agar error spesifik tidak ditutupi wrapper Next.js | `app/actions/*`, `qaService.server.ts` | Error boundary dan client-side error handler harus handle wrapped error |
| `987727a` | `fix(sidak): resolve FK violation on indicator_id and add missing tahun field` | Perbaikan FK violation pada `indicator_id` dan tambah field `tahun` yang hilang di temuan creation | `createTemuanBatchAction`, `qa_temuan` inserts | Data tanpa `tahun` atau `indicator_id` yang salah akan gagal; pastikan migration dan seed data sudah sesuai |

## In-Flight Issue: CSO → Call Service Default

**Status**: `resolved in worktree, pending commit` (manual smoke verification masih pending)

| Aspek | Detail |
|-------|--------|
| Isu | Agent dengan tim `Mix`/`CSO` memilih layanan `CSO` di UI tetapi parameter atau query prefetched jatuh ke `Call` |
| Akar masalah | Inferensi service dari `tim` tidak konsisten di beberapa file; prefetch temuan tidak filter `service_type` |
| Fix yang diterapkan | 1) Helper `resolveServiceTypeFromTeam()` di `qa-types.ts` sebagai satu-satunya sumber inferensi. 2) Semua chain `includes()` ad hoc dan exact-match `TIM_TO_DEFAULT_SERVICE[...]` diganti dengan helper. 3) `getTemuanByAgentPeriod(...)` sekarang menerima argumen opsional `serviceType` untuk prefetch yang service-scoped. |
| File terdampak | `qa-types.ts`, `agents/[id]/page.tsx`, `input/page.tsx`, `input/QaInputClient.tsx`, `services/qaService.server.ts` |
| Verifikasi otomatis | `npm run lint` (pass), `npm run type-check` (pass) |

## Verification Status

| Check | Status |
|-------|--------|
| `npm run lint` | Pass |
| `npm run type-check` | Pass |
| Smoke manual `/qa-analyzer/input` (Mix/CSO) | Pending |
| Smoke manual `/qa-analyzer/agents/[id]` canonical redirect | Pending |
| Smoke manual agent Telepon kontrol | Pending |

## Referensi Silang

- Guardrails: `docs/SIDAK_SCORING_GUARDRAILS.md` (bagian 4)
- Smoke test: `docs/QA_SMOKE_TEST_VERSIONED_RULES.md` (bagian K)
- Incident note: `docs/SIDAK_KNOWN_ISSUE_SERVICE_DEFAULT_CSO_CALL.md`
- Incident note lama (beda isu): `docs/SIDAK_KNOWN_ISSUE_AGENT_DETAIL_SCORE.md`
