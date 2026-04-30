# SIDAK Scoring Guardrails

Dokumen ini dibuat untuk mencegah regresi SIDAK pada scoring, audited population, dan clean-session handling.

Status issue detail agent: `resolved`. Ringkasan penutupan ada di `docs/SIDAK_KNOWN_ISSUE_AGENT_DETAIL_SCORE.md`.
Status issue ranking completeness + parameter order: `resolved`. Ringkasan penutupan ada di `docs/SIDAK_KNOWN_ISSUE_RANKING_COMPLETENESS_PARAMETER_ORDER.md`.
Status issue historical/excluded agent input: `resolved`. Ringkasan penutupan ada di `docs/SIDAK_KNOWN_ISSUE_HISTORICAL_AGENT_INPUT.md`.

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

Catatan khusus report data:
- `/qa-analyzer/reports/data` adalah view tabel/export temuan real, bukan sumber scoring atau audit-presence.
- Jalur ini boleh mengecualikan `is_phantom_padding = true` di query presentation layer, selama jalur dashboard, ranking, detail agent, dan scoring tetap memakai bucket audit-presence di atas.
- Tabel/export report data hanya boleh menampilkan row yang memiliki isi `ketidaksesuaian` dan `sebaiknya`.

### 4) Service Inference Harus Lewat Helper Tunggal

- Inferensi default service dari `tim` wajib menggunakan `resolveServiceTypeFromTeam(team?)` di `qa-types.ts`.
- Service aktif di `/qa-analyzer/input` wajib dihitung lewat `computeEffectiveService(serviceOverride, agentTim, fallbackService)` agar override manual, inferensi tim, dan fallback tidak saling menimpa secara stale.
- Dilarang menulis chain `includes()` terpisah atau exact-match `TIM_TO_DEFAULT_SERVICE[agent.tim] ?? 'call'` di luar helper.
- Helper menangani: trim + lowercase, passthrough service code langsung (`call`, `cso`, dll), alias tim (`mix`/`cso` → `cso`, `telepon`/`call` → `call`), dan fallback akhir ke `call`.
- Jika UI sudah mengetahui service aktif, query prefetch temuan per `agent + period` wajib ikut filter `service_type` (via `getTemuanByAgentPeriod` argumen ketiga).
- Saat agent berubah di input page, override service lama dan form state wajib di-reset sebelum fetch berikutnya.
- Tim agent di UI input bersifat display-only; jangan jadikan dropdown tim sebagai sumber perubahan fetch.

Rute terdampak:
- `/qa-analyzer/input` — prefetch `initialIndicators` dan `initialTemuan` harus scoped ke service yang sama.
- `/qa-analyzer/agents/[id]` — canonical redirect `service=` harus memakai `resolveServiceTypeFromTeam`.
- Service-layer fallback di `qaService.server.ts` — `getAgentListWithScores` dan sejenisnya harus memakai helper, bukan lookup `TIM_TO_DEFAULT_SERVICE` langsung.

Checklist review:
- [ ] Tidak ada `includes('mix')`, `includes('chat')`, atau chain serupa di luar `resolveServiceTypeFromTeam`.
- [ ] Tidak ada `TIM_TO_DEFAULT_SERVICE[...] ?? 'call'` di luar helper.
- [ ] Prefetch temuan di input page membawa argumen `serviceType` ke `getTemuanByAgentPeriod`.
- [ ] `handleSelectAgent` dan `handleSelectPeriod` tidak memakai service state lama saat agent berganti.
- [ ] Tim agent di UI input tidak mengubah hasil fetch service.
- [ ] Agent detail page memakai `resolveServiceTypeFromTeam` untuk menentukan `defaultSvc`.

### 5) Ranking Harus Fetch Lengkap Dan Dipartisi Per Agent

- Jalur ranking yang membaca `qa_temuan` langsung tidak boleh bergantung pada satu page default PostgREST.
- Jika ranking memakai row-level fetch dari `qa_temuan`, pembacaan wajib di-paginate sampai habis.
- Grouping untuk audited population ranking minimal harus memisahkan `agent + period`; jangan pakai `period_id` saja.
- Untuk clean session, audited presence agent harus tetap masuk ranking walaupun `findingRows` kosong.

Checklist review:
- [ ] `getAllAgentsRanking()` atau jalur setara tidak rawan truncation 1000 row.
- [ ] Key partisi ranking tidak menggabungkan beberapa agent dalam satu period bucket.
- [ ] Agent phantom-only tetap bisa muncul di ranking dengan `defects = 0` dan `score = 100`.

### 6) Urutan Parameter Dashboard Harus Eksplisit

- Panel `Tren Kualitas & Parameter` tidak boleh mengandalkan urutan payload mentah.
- Dataset parameter non-total wajib diurutkan berdasarkan total temuan terbesar ke terkecil sebelum dipakai untuk toggle dan chart.
- `Total Temuan` tetap menjadi seri pertama jika ditampilkan.
- Jika total temuan sama, gunakan tie-break stabil berbasis label agar urutan UI tidak berubah-ubah antar render.

Checklist review:
- [ ] Toggle parameter dashboard memakai dataset yang sudah di-sort, bukan payload mentah.
- [ ] Chart parameter dashboard memakai urutan yang sama dengan toggle.
- [ ] Tie-break urutan parameter stabil saat total temuan sama.

### 7) Historical Agent Input Harus Lewat Toggle All-Data

- Default `/qa-analyzer/agents` dan `/qa-analyzer/input` tetap filtered memakai `isAgentExcluded(...)`.
- Kebutuhan input periode lama untuk agent yang sudah promosi/pindah jabatan wajib memakai toggle `Tampilkan Data Keseluruhan`, bukan menghapus filter default.
- `includeExcluded` hanya boleh aktif saat toggle all-data atau query `showAll=1` aktif.
- Tombol `INPUT AUDIT` dari `/qa-analyzer/agents/[id]` wajib menuju `/qa-analyzer/input`, bukan route lama/nonexistent.
- Jika agent terkena `isAgentExcluded(...)`, link `INPUT AUDIT` wajib membawa `showAll=1` agar input page langsung memuat agent historis.
- Opsi BKO di UI input harus menjadi satu pilihan `Tim BKO`; jangan tampilkan `BKO` dan `Tim BKO` sebagai dua folder terpisah.
- Special team `Tim BKO`, `BKO`, dan `SLIK` di `getAgentsByFolder(...)` wajib merge `batch_name` exact match + `tim ILIKE`, lalu de-dupe berdasarkan `id`.

Checklist review:
- [ ] Tidak ada route `/qa-analyzer/entry` yang dipakai dari detail agent.
- [ ] `handleTambahTemuan` membangun URL `/qa-analyzer/input` dengan `folder` dan `agentId`.
- [ ] Agent excluded membawa `showAll=1` dari detail agent ke input page.
- [ ] `input/page.tsx` meneruskan `includeExcluded` saat prefetch jika `showAll=1`.
- [ ] Toggle all-data di input mereset folder, agent, period, temuan, dan form state.
- [ ] `Tim BKO` resolve ke service `bko` dan tidak menimbulkan opsi `BKO` duplikat.

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
5. Verifikasi panel `Tren Kualitas & Parameter` mengurutkan parameter dari total temuan terbesar ke terkecil.

## Minimal Verification Setelah Perubahan

- `npm run test:sidak`
- `npm run lint`
- `npm run type-check`
- Smoke UI: `/qa-analyzer/settings`, `/qa-analyzer/input`, `/qa-analyzer/dashboard`, `/qa-analyzer/ranking`, `/qa-analyzer/reports/data`
- Fokus smoke tambahan:
  - ranking tetap lengkap saat dataset besar
  - toggle parameter dashboard mengikuti urutan total temuan
  - toggle `Tampilkan Data Keseluruhan` di `/qa-analyzer/agents` dan `/qa-analyzer/input`
  - tombol `INPUT AUDIT` dari detail agent menuju `/qa-analyzer/input`, bukan 404
  - report data memakai filter bar atas dan tidak menampilkan phantom padding di tabel/export

Gunakan `npm run test:sidak` sebagai verifikasi wajib setiap ada perubahan clean-session semantics, ranking/top agents, fallback dashboard/trend, atau migration RPC SIDAK terkait audited population.

## Catatan Harness

- Harness `npm run test:sidak` adalah contract test berbasis fixture dan SQL-string guard, bukan eksekusi database lokal.
- Menjalankan harness ini tidak mengubah data historis, tidak menjalankan migration, dan tidak menulis apa pun ke tabel Supabase.
- Refactor TypeScript yang menyertai harness hanya memindahkan kalkulasi fallback internal agar kontraknya bisa diuji; snapshot data periode lama tetap bergantung pada migration dan data yang sudah ada di database.
