# SIDAK Known Issue — Service Default CSO/Call Mismatch

## Status

- Status: `pending verification`
- Prioritas: `medium-high`
- Dampak: agent dengan tim `Mix`/`CSO` memilih layanan `CSO` di UI tetapi parameter atau query prefetched jatuh ke `Call`.

## Route Terdampak

- `/qa-analyzer/input`
- `/qa-analyzer/agents/[id]`
- Service-layer fallback di `qaService.server.ts`

## Gejala

1. Di `/qa-analyzer/input`, pilih agent dengan tim `Mix` atau `CSO`; layanan dropdown menunjukkan `CSO` tetapi parameter/temuan yang diload berasal dari `Call`.
2. Di `/qa-analyzer/agents/[id]`, buka tanpa query `service`; canonical redirect memilih `service=call` padahal default service seharusnya `cso`.
3. Di agent directory/ranking, fallback scoring untuk agent tanpa `service_type` di temuan menggunakan `TIM_TO_DEFAULT_SERVICE[agent.tim] ?? 'call'` yang gagal mencocokkan variasi casing tim.

## Akar Masalah Final

1. **Inferensi service dari `tim` tidak konsisten** — sebagian path memakai normalisasi `normalizedTim.includes('mix') → 'cso'`, sebagian lain memakai exact-match `TIM_TO_DEFAULT_SERVICE[agent.tim] ?? 'call'`. Nilai tim seperti `Mix`, `Tim Mix`, atau variasi casing mudah jatuh ke fallback `call` karena exact-match hanya cocok untuk `Mix` (exact case).
2. **Prefetch temuan di input page tidak service-scoped** — `getTemuanByAgentPeriod(peserta_id, period_id)` mengambil semua service untuk satu agent+period, sehingga konteks `CSO` bisa tercampur dengan data `Call`.

## Fix Yang Diterapkan

### 1. Helper Tunggal `resolveServiceTypeFromTeam(team?)`

Ditambahkan di `app/(main)/qa-analyzer/lib/qa-types.ts`:

- Trim + lowercase input.
- Passthrough jika input sudah berupa service code (`call`, `chat`, `email`, `cso`, `bko`, `slik`, `pencatatan`).
- Alias map: `mix`/`cso` → `cso`, `telepon`/`call` → `call`, `chat` → `chat`, `email` → `email`, `bko` → `bko`, `slik` → `slik`, `pencatatan` → `pencatatan`.
- Fallback ke `TIM_TO_DEFAULT_SERVICE` untuk exact key match.
- Fallback terakhir ke `call`.

### 2. Penggantian Inferensi Ad Hoc

Semua inferensi ad hoc diganti dengan helper:

| File | Sebelum | Sesudah |
|------|---------|---------|
| `agents/[id]/page.tsx` | `TIM_TO_DEFAULT_SERVICE[agent.tim] ?? 'call'` | `resolveServiceTypeFromTeam(agent.tim)` |
| `input/page.tsx` | Chain `includes()` inline | `resolveServiceTypeFromTeam(initialAgent.tim)` |
| `input/QaInputClient.tsx` | Chain `includes()` inline di `handleSelectAgent` | `resolveServiceTypeFromTeam(agent.tim)` |
| `qaService.server.ts` (2x) | `TIM_TO_DEFAULT_SERVICE[agentObj.tim] \|\| 'call'` | `resolveServiceTypeFromTeam(agentObj.tim)` |

### 3. Service-Scoped Prefetch

`getTemuanByAgentPeriod(...)` sekarang menerima argumen opsional `serviceType?: ServiceType`. Jika diberikan, query menambahkan `.eq('service_type', serviceType)`.

Di `input/page.tsx`, prefetch `initialTemuan` sekarang membawa `defaultService` sebagai argumen ketiga sehingga hanya temuan untuk service yang benar yang diload.

## Interface yang Berubah

- `getTemuanByAgentPeriod(peserta_id: string, period_id: string, serviceType?: ServiceType): Promise<QATemuan[]>`
- Tidak ada perubahan schema DB.
- Tidak ada perubahan API publik eksternal.

## Regression Guard

- [ ] Agent tim `Mix`/`CSO` default ke layanan `CSO` di page input.
- [ ] Agent tim `Telepon` default ke layanan `Call`.
- [ ] Prefetch temuan di input page ter-filter sesuai service yang dipilih.
- [ ] Canonical redirect di detail agent memilih `service=cso` untuk tim `CSO`.
- [ ] `resolveServiceTypeFromTeam` konsisten digunakan di semua 4 file terdampak.
- [ ] Tidak ada chain `includes()` atau exact-match `TIM_TO_DEFAULT_SERVICE[...] ?? 'call'` yang tersisa di luar helper.

## Smoke Steps Singkat

1. Buka SIDAK Input untuk agent dengan tim `Mix`/`CSO`; pastikan default layanan adalah `CSO`.
2. Pilih periode yang punya data multi-service; pastikan parameter/temuan yang tampil hanya milik `cso`.
3. Buka detail agent tanpa query `service`; pastikan redirect ke `service=cso`, bukan `service=call`.
4. Ulangi pada agent `Telepon`; default harus `call`.

## Checklist Penutupan

- [ ] `npm run lint` pass.
- [ ] `npm run type-check` pass.
- [ ] Smoke manual poin 1–4 di atas PASS.
- [ ] Tidak ada sisa inferensi ad hoc di codebase (verifikasi grep).

## Referensi Silang

- Guardrails: `docs/SIDAK_SCORING_GUARDRAILS.md` (bagian 4)
- Smoke test: `docs/QA_SMOKE_TEST_VERSIONED_RULES.md` (bagian K)
- Recent git: `docs/SIDAK_RECENT_GIT_2026-04-22.md`
- Incident note lama (beda isu): `docs/SIDAK_KNOWN_ISSUE_AGENT_DETAIL_SCORE.md`
