# SIDAK Known Issue: Historical Agent Input And Excluded Data Toggle

Status: `resolved`

## Ringkasan

SIDAK default menampilkan agent aktif/non-excluded. Untuk kebutuhan input audit periode lama sebelum agent promosi atau pindah jabatan, halaman directory dan input sekarang menyediakan toggle `Tampilkan Data Keseluruhan`.

## Gejala

1. `/qa-analyzer/agents` hanya menampilkan agent yang tidak terkena filter exclude.
2. `/qa-analyzer/input` sebelumnya hanya menampilkan folder/agent non-excluded.
3. Tombol `INPUT AUDIT` dari `/qa-analyzer/agents/[id]` pernah mengarah ke route lama `/qa-analyzer/entry`, sehingga membuka halaman `404`.
4. Opsi `BKO` dan `Tim BKO` pernah muncul sebagai dua pilihan terpisah, padahal tujuan operasionalnya sama.

## Kontrak Perbaikan

- Default tetap filtered agar tampilan operasional harian tidak berubah.
- Toggle `Tampilkan Data Keseluruhan` harus default `off`.
- Saat toggle aktif:
  - `/qa-analyzer/agents` lazy-load seluruh directory agent lewat action khusus.
  - `/qa-analyzer/input` memanggil `getAgentsByFolder(..., includeExcluded=true)`.
  - Agent yang excluded karena `tim`, `batch_name`, atau `jabatan` boleh dipilih untuk input periode historis.
- Tombol `INPUT AUDIT` dari detail agent wajib menuju `/qa-analyzer/input`, bukan route lama `/qa-analyzer/entry`.
- Link dari detail agent wajib membawa query:
  - `folder=<agent.batch_name atau agent.tim>`
  - `agentId=<agent id>`
  - `showAll=1` jika agent terkena `isAgentExcluded(...)`
- `showAll=1` hanya mengaktifkan mode tampilan/prefetch all-data; hak akses route tetap mengikuti guard `/qa-analyzer/input`.
- `BKO` dan `Tim BKO` dinormalisasi sebagai satu pilihan UI: `Tim BKO`.
- `Tim BKO` harus tetap resolve ke service `bko`.
- Selection special team `Tim BKO`, `BKO`, dan `SLIK` wajib merge `batch_name` exact match + `tim ILIKE`, lalu de-dupe berdasarkan `id`.

## File Penting

- `app/(main)/qa-analyzer/lib/qa-types.ts`
  - `isAgentExcluded(...)`
  - `resolveServiceTypeFromTeam(...)`
  - mapping `Tim BKO -> bko`
- `app/(main)/qa-analyzer/services/qaService.server.ts`
  - `getAgentDirectorySummary(year, includeExcluded?)`
  - `getAgentListWithScores(year, includeExcluded?)`
  - `getAgentsByFolder(batch, includeExcluded?)`
- `app/(main)/qa-analyzer/actions.ts`
  - `getAllAgentDirectoryAction(year?)`
  - `getAgentsByFolderAction(batch, includeExcluded?)`
- `app/(main)/qa-analyzer/input/page.tsx`
  - query `showAll=1`
  - prefetch agent dengan `includeExcluded`
- `app/(main)/qa-analyzer/input/QaInputClient.tsx`
  - initial toggle `initialShowAll`
- `app/(main)/qa-analyzer/agents/[id]/hooks/useAgentDetail.ts`
  - `handleTambahTemuan`

## Smoke Test Manual

1. Buka `/qa-analyzer/agents`.
2. Pastikan default hanya menampilkan data filtered.
3. Aktifkan `Tampilkan Data Keseluruhan`, pastikan agent excluded muncul.
4. Buka detail salah satu agent excluded, klik `INPUT AUDIT`.
5. Pastikan URL masuk ke `/qa-analyzer/input?...&showAll=1`, bukan `/qa-analyzer/entry`.
6. Pastikan toggle all-data di input aktif dan agent sudah terpilih.
7. Pilih periode lama, pastikan indikator dan temuan mengikuti service aktif dari `computeEffectiveService(...)`.
8. Di `/qa-analyzer/input`, pastikan pilihan yang muncul adalah `Tim BKO`, bukan dua opsi `BKO` dan `Tim BKO`.
9. Pilih `Tim BKO`, pastikan daftar agent menggabungkan batch `Tim BKO` dan tim yang mengandung `BKO` tanpa duplikasi agent.

## Verifikasi Wajib

- `git diff --check`
- `npm run test:sidak`
- `npm run lint`
- `npm run type-check`
