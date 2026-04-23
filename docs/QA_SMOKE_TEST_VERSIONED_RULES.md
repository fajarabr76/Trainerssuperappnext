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
- [ ] Pastikan `/qa-analyzer/ranking` tetap lengkap walaupun dataset `qa_temuan` untuk filter aktif besar (tidak terpotong di sekitar batas 1000 row fetch).
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

## L. Ranking Completeness & Parameter Order Check
- [ ] Pilih 1 filter ranking dengan data besar; pastikan semua agent yang punya audit presence tampil, bukan hanya sebagian awal hasil fetch.
- [ ] Jika service punya clean session, pastikan agent phantom-only tetap ada di ranking walaupun tidak punya finding row real.
- [ ] Buka `/qa-analyzer/dashboard` dengan filter yang sama, lalu cek panel `Tren Kualitas & Parameter`.
- [ ] Pastikan toggle parameter diurutkan dari total temuan terbesar ke tersedikit.
- [ ] Pastikan urutan parameter chart sama dengan urutan toggle.
- [ ] Jika dua parameter punya total temuan sama, pastikan urutan label stabil dan tidak berubah-ubah saat reload.

## J. Detail Agent Consistency
- [ ] Buka `/qa-analyzer/agents/[id]` untuk minimal 1 agent yang punya temuan real dan pastikan panel skor detail tidak mentok di `100%`.
- [ ] Bandingkan skor detail agent dengan directory `/qa-analyzer/agents` untuk agent/service yang sama.
- [ ] Jika mismatch muncul lagi, blok release dan rujuk `docs/SIDAK_KNOWN_ISSUE_AGENT_DETAIL_SCORE.md`.

## K. Service Default CSO/Call Regression Check
- [ ] Pilih agent dengan tim `Mix` atau `CSO` di `/qa-analyzer/input`; pastikan layanan default yang terpilih adalah `CSO`, bukan `Call`.
- [ ] Pilih periode yang sudah punya data temuan multi-service; pastikan parameter dan daftar temuan yang muncul hanya milik `cso`, tidak bocor dari `call`.
- [ ] Ubah layanan manual ke `Call`, lalu pindah ke agent lain; pastikan service reset mengikuti tim agent baru dan tidak membawa override lama.
- [ ] Pastikan field tim agent di halaman input hanya display-only dan tidak mengubah hasil fetch.
- [ ] Buka `/qa-analyzer/agents/[id]` untuk agent yang sama tanpa query `service` di URL; pastikan canonical redirect memilih `service=cso` (bukan `service=call`).
- [ ] Ulangi poin di atas pada agent dengan tim `Telepon` sebagai kontrol; default harus tetap `call`.
- [ ] Verifikasi bahwa semua jalur code memakai `resolveServiceTypeFromTeam()` dari `qa-types.ts`, bukan chain `includes()` atau `TIM_TO_DEFAULT_SERVICE[...] ?? 'call'` inline.
- [ ] Verifikasi bahwa `getTemuanByAgentPeriod(...)` dipanggil dengan argumen `serviceType` ketika service sudah diketahui, sehingga prefetch tidak mengambil semua service sekaligus.
