# SIDAK Scoring Guardrails

Dokumen ini dibuat untuk mencegah regresi SIDAK pada scoring, audited population, dan clean-session handling.

Status issue detail agent: `resolved`. Ringkasan penutupan ada di `docs/SIDAK_KNOWN_ISSUE_AGENT_DETAIL_SCORE.md`.

## Ringkasan Akar Masalah

1. Cache server untuk indikator memakai pola key global sehingga hasil indikator bisa tertukar antar konteks periode/service.
2. Fungsi scoring/agregasi SQL belum sepenuhnya siap untuk data Versioned QA Rules (`rule_indicator_id`).
3. Row phantom/clean session pernah difilter terlalu awal, sehingga period clean hilang dari audited population dan jalur detail agent.

## Guardrails Wajib Saat Ubah SIDAK

### 1) Cache Key Harus Kontekstual

- Untuk `unstable_cache`, jangan gunakan fetcher indikator tanpa argumen untuk kebutuhan lintas periode/service.
- Pastikan pemanggilan cache indikator selalu membawa konteks `service_type` dan `period_id` saat konteks periode aktif.
- Referensi perilaku Next.js: argumen fungsi adalah bagian dari cache key, `keyParts` hanya tambahan identitas.

Checklist review:
- [ ] Tidak ada pola cache indikator global statis yang dipakai lintas periode.
- [ ] Endpoint/dashboard/ranking yang butuh versioned indicators mengirim `service_type` + `period_id`.

### 2) Scoring SQL Harus Kompatibel Versioned + Legacy

- Di fungsi `qa_score_agent`, pemetaan indikator wajib kompatibel:
  - gunakan `COALESCE(rule_indicator_id, indicator_id)` untuk membaca data temuan campuran.
- Saat `rule_version_id` tersedia, metadata indikator dan bobot harus diambil dari `qa_service_rule_indicators`.
- Jika `rule_version_id` tidak ada, fallback aman ke `qa_indicators` tetap dipertahankan untuk data legacy.

Checklist review:
- [ ] `qa_score_agent` masih mendukung `rule_indicator_id` + fallback `indicator_id`.
- [ ] Join/lookup indikator tidak hard-code ke tabel legacy saja.

### 3) Clean Session Harus Pakai 3 Bucket Data

Jangan pakai satu filter global `is_phantom_padding = false` untuk semua jalur SIDAK. Gunakan tiga bucket berikut:

- `auditPresenceRows`: semua row agent-period-service, termasuk phantom-only clean session.
- `scoreRows`: pakai row real jika ada; jika satu agent-period-service hanya punya phantom, pakai phantom agar skor periode tetap `100`.
- `findingRows`: hanya row real yang countable (`nilai < 3` atau ada catatan).

Aturan turunannya:

- Phantom-only clean session adalah audit valid untuk `totalAgents`, `zeroErrorRate`, `complianceRate`, `avgAgentScore`, rail period detail, dan ranking audited agents.
- Phantom tidak boleh menambah `totalDefects`, `findingsCount`, pareto, donut, `hasCritical`, atau defect sorting.
- Jika satu agent-period-service punya row real + phantom sekaligus, scoring dan defect aggregation wajib identik dengan memakai row real saja.

Checklist review:
- [ ] Tidak ada filter phantom global yang dijalankan sebelum data dipartisi ke `auditPresenceRows/scoreRows/findingRows`.
- [ ] `totalAgents`, `zeroErrorRate`, `complianceRate`, dan `avgAgentScore` memakai populasi audit presence.
- [ ] `totalDefects`, `findingsCount`, pareto, donut, dan ranking defect hanya memakai `findingRows`.
- [ ] Mixed real + phantom tetap menghasilkan skor/defect yang sama dengan row real saja.

## Deployment Checklist

1. Apply migration terbaru SIDAK (termasuk fix scoring/dashboard):
   - `20260421000000_versioned_qa_rules.sql`
   - `20260421000001_add_service_type_to_rule_indicators.sql`
   - `20260421090000_fix_qa_scoring_and_dashboard.sql`
   - `20260421103000_fix_qa_score_agent_uuid_session_grouping.sql`
   - `20260421105000_fix_qa_dashboard_range_category_alias.sql`
   - `20260422103000_fix_sidak_clean_session_audit_presence.sql`
2. Jalankan smoke test di `docs/QA_SMOKE_TEST_VERSIONED_RULES.md`.
3. Verifikasi manual dashboard untuk 2 periode berbeda (lama vs baru) agar skor/tren tidak collapse ke `100%` tanpa alasan data.
4. Verifikasi minimal 1 agent dengan bulan phantom-only agar rail/detail/ranking tetap menampilkan audited session `100` tanpa menaikkan defect count.

## Minimal Verification Setelah Perubahan

- `npm run lint`
- `npm run type-check`
- Smoke UI: `/qa-analyzer/settings`, `/qa-analyzer/input`, `/qa-analyzer/dashboard`, `/qa-analyzer/ranking`
