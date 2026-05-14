# 📚 Indeks Dokumentasi Trainers SuperApp

Selamat datang di pusat panduan Trainers SuperApp! Dokumen ini dirancang sebagai peta navigasi utama untuk membantu seluruh anggota tim—baik manajemen, perancang antarmuka, hingga pengembang teknis—memahami cara kerja dan aturan sistem kami.

---

## 🌟 Panduan Cepat untuk Pengguna Umum (Human-Readable Reader)
Jika Anda baru mengenal proyek ini atau ingin memahami gambaran besar tanpa pusing dengan kode, silakan mulai dari sini:
- **[README.md](../README.md):** Pengenalan produk, fungsi utama aplikasi, dan cara menjalankan aplikasi di komputer Anda.
- **[docs/modules.md](modules.md):** Penjelasan fungsional dari masing-masing modul pelatihan (Ketik, PDKT, Telefun, Profiler, dan SIDAK) beserta manfaat nyata bagi pelatih dan peserta.

---

## 🛠️ Panduan Teknis untuk Pengembang (Developer & Agent Reader)
Gunakan dokumen spesifik di bawah ini saat memodifikasi modul untuk memastikan kepatuhan terhadap aturan sistem (*guardrails*) dan prosedur pengujian:

### Mulai Dari Sini
- `README.md`: Ringkasan produk, setup lokal, env, dan command operasional.
- `docs/architecture.md`: Arsitektur Next.js/Supabase/AI, struktur folder, pola data flow, dan workflow verifikasi.
- `docs/modules.md`: Status fitur per modul: Dashboard, KETIK, PDKT, TELEFUN, Profiler/KTP, dan SIDAK.
- `docs/auth-rbac.md`: Role, approval akun, route guard, dan kontrak `profiles`.
- `docs/database.md`: Tabel utama, RLS, hak akses eksplisit (Explicit Grants), storage bucket, usage billing, dan catatan backup data.
- `docs/design-guidelines.md`: Prinsip visual dan UI yang harus dipakai untuk perubahan frontend.

## Operasional

- `docs/SUPABASE_DATA_API_GRANTS_CHANGELOG_2026-05-14.md`: Catatan perubahan hardening keamanan database ke model hak akses data eksplisit (Deny-by-Default).
- `docs/MONITORING_TOKEN_USAGE_BILLING.md`: Kontrak usage AI bulanan, billing Rupiah, pricing/kurs, quick-view modul, dan smoke test.
- `docs/TELEFUN_OPERATIONAL_RUNBOOK.md`: Kontrak runtime Telefun, WebSocket proxy Railway, env, storage rekaman, usage, dan smoke test.
- `docs/SUPABASE_LOCAL_BACKUP.md`: Backup lokal Supabase database dan Storage.
- `docs/VERCEL_RES_OPTIMIZATION.md`: Catatan optimasi Vercel RES, hasil Tahap 0-3, guardrail performa, dan gate persetujuan sebelum auth/cache/dependency cleanup.
- `docs/QA_DASHBOARD_SUMMARY_ROLLUP_STAGING.md`: Scope commit, catatan file Supabase CLI, dan checklist testing staging untuk summary rollup dashboard SIDAK.
- `docs/SIDAK_LOGIC_AND_SCORING.md`: Penjelasan logika bisnis SIDAK, rumus skor, clean-session, dan cara perhitungan.
- `docs/QA_SMOKE_TEST_VERSIONED_RULES.md`: Checklist smoke test SIDAK untuk scoring, ranking, dan clean-session.
- `docs/SIDAK_SCORING_GUARDRAILS.md`: Guardrail wajib sebelum mengubah scoring atau agregasi SIDAK.
- `docs/SIDAK_KNOWN_ISSUE_HISTORICAL_AGENT_INPUT.md`: Toggle data keseluruhan untuk input agent historis/excluded, normalisasi `Tim BKO`, dan link `INPUT AUDIT`.
- `docs/PDKT_CONSUMER_NAME_MENTION_PATTERN_CHANGELOG_2026-05-05.md`: Ringkasan perubahan user-facing untuk setting pola penyebutan nama konsumen di PDKT.
- `docs/TELEFUN_MUTE_VAD_RESPONSE_HANDOFF_CHANGELOG_2026-05-07.md`: Ringkasan perubahan user-facing untuk semantik mute, VAD, dan handoff respons di Telefun Live.
- `docs/TELEFUN_VOICE_ASSESSMENT_CHANGELOG_2026-05-07.md`: Ringkasan perubahan user-facing untuk validasi hasil analisis suara dan konsistensi skor Telefun.
- `docs/OPENCODE_MCP_CONFIG_FIX_CHANGELOG_2026-05-12.md`: Catatan perbaikan argumen eksekusi dan penonaktifan MCP server IDE pada `opencode.json`.
- `docs/PDKT_COMPANY_NAME_LICENSED_CHANGELOG_2026-05-12.md`: Catatan kepatuhan regulasi LJK OJK, pengetatan prompt entitas ilegal, dan implementasi Toggle UI Manual untuk status berizin.
- `docs/superpowers/specs/2026-05-05-pdkt-consumer-name-mention-pattern-design.md`: Spec desain setting PDKT untuk pola penyebutan nama konsumen.
- `docs/superpowers/plans/2026-05-05-pdkt-consumer-name-mention-pattern.md`: Rencana implementasi task-by-task untuk setting pola penyebutan nama konsumen di PDKT.
- `docs/master-backlog.md`: Master Backlog untuk SIDAK Regression Audit dan panduan verifikasi.
- `docs/qa_report_guidelines.md`: Panduan standar untuk pelaporan AI QA Analyzer (Path to Zero).

## Catatan Regresi Penting

- `docs/AUTH_KNOWN_ISSUE_TRANSIENT_PROFILE_READS.md`: Perlakuan transient profile read agar sesi tidak dihancurkan.
- `docs/AUTH_KNOWN_ISSUE_PROFILES_SELECT_RLS_AFTER_EXPLICIT_GRANTS.md`: Profil SELECT RLS blocking setelah explicit grants migration — login regression dan fix.
- `docs/KETIK_KNOWN_ISSUE_TIMEOUT_CONTEXT_HISTORY.md`: Timeout, konteks chat, dan history KETIK.
- `docs/KETIK_PDKT_SETTINGS_DRAFT_AUTOCOMMIT.md`: Draft settings modal KETIK/PDKT/TELEFUN yang harus ikut tersimpan saat `Simpan Perubahan`.
- `docs/PDKT_MAILBOX.md`: Panduan teknis sistem persistent mailbox PDKT, manual scenario selection, dan async evaluation auto-recovery.
- `docs/PDKT_EMAIL_COMPOSER_REFRESH_V1.md`: Refresh UI composer PDKT.
- `docs/TELEFUN_KNOWN_ISSUE_RAILWAY_STALE_DIST.md`: Diagnostik Telefun saat Railway menjalankan `dist/server.js` lama.
- `docs/SIDAK_KNOWN_ISSUE_AGENT_DETAIL_SCORE.md`: Penutupan mismatch skor detail agent.
- `docs/SIDAK_KNOWN_ISSUE_SERVICE_DEFAULT_CSO_CALL.md`: Service default CSO-vs-Call di input SIDAK.
- `docs/SIDAK_KNOWN_ISSUE_RANKING_COMPLETENESS_PARAMETER_ORDER.md`: Ranking completeness dan urutan parameter dashboard.
- `docs/SIDAK_KNOWN_ISSUE_HISTORICAL_AGENT_INPUT.md`: Input temuan untuk agent historis/excluded dan pencegahan route 404 dari detail agent.

## Verifikasi Umum

- Jalankan `npm run lint` untuk validasi lint cepat.
- Jalankan `npm run type-check` saat perubahan menyentuh kontrak lintas modul atau build integration.
- Jalankan `npm run test:sidak` untuk perubahan SIDAK yang menyentuh service resolution, scoring, atau regresi fixture.
- Jalankan `npx vitest run tests/audit` untuk verifikasi keamanan dan keandalan pasca audit SIDAK/Telefun. Suite ini mengimpor langsung dari `.worktrees/` untuk validasi isolasi branch.
- Jalankan `git diff --check` sebelum commit untuk memastikan tidak ada whitespace error.
