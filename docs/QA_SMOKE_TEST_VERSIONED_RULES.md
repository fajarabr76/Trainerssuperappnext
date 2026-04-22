# TODO Smoke Test - Versioned QA Rules

Checklist ini dipakai setelah migration:
- `20260421000000_versioned_qa_rules.sql`
- `20260421000001_add_service_type_to_rule_indicators.sql`
- `20260421090000_fix_qa_scoring_and_dashboard.sql`
- `20260421103000_fix_qa_score_agent_uuid_session_grouping.sql`
- `20260421105000_fix_qa_dashboard_range_category_alias.sql`
- `20260422103000_fix_sidak_clean_session_audit_presence.sql`

## A. Pre-check Database
- [ ] Pastikan tabel baru ada: `qa_service_rule_versions`, `qa_service_rule_indicators`.
- [ ] Pastikan kolom baru ada di `qa_temuan`: `rule_version_id`, `rule_indicator_id`.
- [ ] Pastikan `qa_service_rule_indicators.service_type` sudah terisi (tidak null).
- [ ] Pastikan data temuan lama sudah ter-backfill ke `rule_version_id` dan `rule_indicator_id`.

## B. Smoke Test Settings (Draft/Publish)
- [ ] Buka halaman `/qa-analyzer/settings`.
- [ ] Buat draft baru untuk 1 service (contoh: `call`).
- [ ] Ubah minimal 1 parameter (nama/bobot/kategori).
- [ ] Publish draft ke periode target (contoh: Mei 2026).
- [ ] Verifikasi tidak bisa update/hapus indicator dari version yang status `published`.
- [ ] Verifikasi tidak bisa publish 2 version `published` untuk service+periode yang sama.

## C. Smoke Test Input Periode
- [ ] Pilih agent + periode lama (contoh: April 2026), cek indikator yang muncul sesuai version lama.
- [ ] Pilih agent + periode baru (contoh: Mei 2026), cek indikator yang muncul sesuai version baru.
- [ ] Tanpa pilih periode dulu, ganti service, pastikan indikator tetap muncul (latest published).
- [ ] Simpan temuan baru, lalu cek record `qa_temuan` terisi `rule_version_id` dan `rule_indicator_id`.

## D. Historis Tidak Berubah
- [ ] Catat skor 1 agent di periode lama sebelum publish.
- [ ] Publish perubahan rule ke periode baru.
- [ ] Buka ulang periode lama, pastikan skor lama tidak berubah.
- [ ] Tambah input susulan di periode lama, pastikan tetap pakai rule version periode lama.

## E. Dashboard/Ranking/Export Konsisten
- [ ] Cek `/qa-analyzer/dashboard` untuk periode lama vs baru, pastikan tren masuk akal.
- [ ] Cek `/qa-analyzer/ranking`, pastikan peringkat mengikuti rule tiap periode.
- [ ] Jalankan export data agent, pastikan skor export per periode sesuai snapshot rules periode tersebut.
- [ ] Verifikasi split `NC/CR` di export konsisten dengan kategori snapshot.

## F. Regression Ringan
- [ ] Jalankan `npm run test:sidak` untuk lock clean-session semantics, ranking, dashboard fallback, trend fallback, dan SQL contract migration aktif.
- [ ] Pastikan semua orang paham bahwa `npm run test:sidak` tidak menjalankan migration dan tidak mengubah data historis; ini hanya harness verifikasi kontrak.
- [ ] Jalankan `npm run lint` (expected: 0 error, warning existing boleh jika unrelated).
- [ ] Jalankan `npm run type-check` (expected: build sukses).
- [ ] Smoke check cepat halaman: `settings`, `input`, `dashboard`, `reports/data`.

## G. Sign-off
- [ ] Tulis hasil uji: PASS/FAIL per poin.
- [ ] Catat bug yang ditemukan + langkah reproduksi.
- [ ] Approve untuk deploy jika seluruh poin kritikal PASS.

## H. Anti-regression (Skor/Kepatuhan 100%)
- [ ] Verifikasi fetch indikator SIDAK memanggil cache dengan argumen `service_type` + `period_id` (hindari pola key global statis tanpa argumen).
- [ ] Verifikasi `qa_score_agent` masih memetakan indikator dengan `COALESCE(rule_indicator_id, indicator_id)` agar kompatibel untuk data versioned + legacy.
- [ ] Verifikasi kalkulasi SIDAK memakai 3 bucket data: `auditPresenceRows`, `scoreRows`, dan `findingRows`.
- [ ] Verifikasi phantom-only clean session tetap dihitung sebagai audit valid untuk skor dan audited population.
- [ ] Verifikasi phantom tidak pernah menambah total temuan, pareto, donut, critical count, atau defect ranking.
- [ ] Verifikasi `get_qa_dashboard_range_data` dan `get_qa_dashboard_range_trend_data` masih sinkron ke `qa_service_rule_indicators` (dengan fallback legacy saat diperlukan).
- [ ] Jalankan smoke query cepat di SQL Editor: ambil 1 service + 1 rentang periode dan pastikan metrik tidak terkunci di 100% saat data temuan nyata (`nilai < 3`) tersedia.

## I. Clean-session Regression Check
- [ ] Buka `/qa-analyzer/agents/7f7cb2d1-de1e-482c-b8b7-2cc793965075?year=2026&tstart=1&tend=4&service=email`.
- [ ] Pastikan bulan phantom-only tetap muncul di rail dengan skor `100` dan `findingsCount = 0`.
- [ ] Pastikan bulan yang punya row real tetap menampilkan skor non-100 dan tidak collapse ke `100`.
- [ ] Buka `/qa-analyzer/ranking?service=email&year=2026`, lalu pastikan agent phantom-only muncul dengan `defects = 0` dan `score = 100`.
- [ ] Buka `/qa-analyzer/dashboard`, lalu pastikan clean session menambah audited population tetapi tidak menambah total defect/pareto/donut.

## J. Detail Agent Consistency
- [ ] Buka `/qa-analyzer/agents/[id]` untuk minimal 1 agent yang punya temuan real dan pastikan panel skor detail tidak mentok di `100%`.
- [ ] Bandingkan skor detail agent dengan directory `/qa-analyzer/agents` untuk agent/service yang sama.
- [ ] Jika mismatch muncul lagi, blok release dan rujuk `docs/SIDAK_KNOWN_ISSUE_AGENT_DETAIL_SCORE.md`.
