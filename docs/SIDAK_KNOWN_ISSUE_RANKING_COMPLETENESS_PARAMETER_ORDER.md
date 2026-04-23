# SIDAK Incident Note - Ranking Completeness & Parameter Order

Dokumen ini menyimpan ringkasan incident pada halaman ranking SIDAK dan panel tren parameter dashboard. Status issue ini sekarang ditutup, tetapi guardrail-nya harus tetap dipakai agar regresi yang sama tidak muncul lagi.

## Status

- Status: `resolved`
- Prioritas saat incident: `high`
- Dampak saat incident:
  - halaman `/qa-analyzer/ranking` tidak menampilkan seluruh agent yang punya audit presence untuk filter aktif
  - urutan parameter pada panel `Tren Kualitas & Parameter` tidak konsisten dengan jumlah temuan terbanyak

## Route Terdampak

- `/qa-analyzer/ranking`
- `/qa-analyzer/dashboard`

## Ringkasan Gejala Saat Incident

- Ranking agent terlihat "kurang lengkap" walaupun data audit untuk periode/service yang dipilih sebenarnya ada.
- Agent yang hanya punya phantom padding / clean session dapat hilang dari ranking, padahal secara bisnis harus tetap tampil dengan `defects = 0` dan `score = 100`.
- Toggle parameter di dashboard tidak diurutkan berdasarkan total temuan, sehingga fokus analisis bisa bergeser ke parameter yang bukan paling dominan.

## Akar Masalah Final

1. Jalur `getAllAgentsRanking()` membaca `qa_temuan` tanpa pagination, sehingga hasil query rawan terpotong pada limit default PostgREST (`1000` row).
2. Partisi ranking dibentuk hanya dengan `period_id`, sehingga semua agent dalam periode yang sama bisa tergabung ke satu bucket dan audited presence agent lain hilang.
3. Dataset parameter di dashboard dirender memakai urutan asal payload, bukan urutan hasil agregasi temuan total.

## Fix Yang Diterapkan

- `getAllAgentsRanking()` sekarang:
  - memakai service-role client bila tersedia agar pembacaan ranking tidak tertahan RLS browser path
  - mengambil seluruh row `qa_temuan` dengan pagination
  - membawa `peserta_id` ke objek normalisasi
  - mempartisi data per `agent-period` (`${peserta_id}:${period_id}`), bukan per periode global
- `QaDashboardClient` sekarang membentuk `sortedParamTrend` yang:
  - menjaga `Total Temuan` tetap di urutan pertama
  - mengurutkan semua dataset parameter non-total berdasarkan jumlah temuan terbesar ke terkecil
  - memakai tie-break stabil `label ASC`

## Dampak Bisnis Saat Incident

- Trainer/leader dapat mengira ranking agent sudah lengkap padahal audited population belum seluruhnya masuk.
- Dashboard dapat mengarahkan perhatian ke parameter yang bukan penyumbang temuan terbesar.

## Regression Guard

- Jangan baca ranking SIDAK dari satu fetch raw tanpa pagination jika sumbernya `qa_temuan`.
- Jangan pakai key partisi yang lebih kasar dari `agent-period-service` saat logic butuh audited presence per agent.
- Jangan mengasumsikan urutan dataset backend sudah cocok untuk UI dashboard; sort eksplisit di boundary UI atau service sebelum render.
- Gunakan `docs/SIDAK_SCORING_GUARDRAILS.md` dan `docs/QA_SMOKE_TEST_VERSIONED_RULES.md` sebagai checklist wajib sebelum merge/deploy.

## Checklist Penutupan

- [ ] `/qa-analyzer/ranking` menampilkan seluruh agent yang punya audit presence untuk filter aktif.
- [ ] Agent phantom-only tetap muncul dengan `defects = 0` dan `score = 100`.
- [ ] Ranking tidak berubah hanya karena total row `qa_temuan` melewati 1000 baris.
- [ ] Panel `Tren Kualitas & Parameter` mengurutkan parameter dari temuan terbanyak ke tersedikit.
- [ ] `npm run lint`, `npm run type-check`, dan `npm run test:sidak` lulus pada snapshot yang sama.
