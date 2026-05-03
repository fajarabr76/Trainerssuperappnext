# Leader Approval-Based Data Access

## Overview

Role `leader` sekarang menggunakan approval-based access untuk modul KTP (`/profiler`) dan SIDAK (`/qa-analyzer`). Admin dan trainer tetap memiliki akses penuh. Leader wajib mendapatkan approval per module sebelum dapat melihat data, dan semua query difilter berdasarkan access group yang disetujui.

Prinsip: **fail closed** — scope kosong, status tidak jelas, atau filter gagal menghasilkan data kosong/blocked, bukan fallback semua data.

## Architecture

### Database Tables

| Table | Purpose |
|---|---|
| `access_groups` | Definisi access group (nama, deskripsi, scope_type, is_active) |
| `access_group_items` | Item scope individual dalam access group (field_name: `peserta_id`, `batch_name`, `tim`, `service_type`) |
| `leader_access_requests` | Request approval per leader per module |
| `leader_access_request_groups` | Join table: satu approved request bisa memiliki >1 access group |

### Scope Semantics (V1)

Access group items adalah **union rules** — peserta masuk scope jika memenuhi minimal satu item field:
- `peserta_id`: match by UUID
- `batch_name`: match by batch/folder name
- `tim`: match by team name
- `service_type`: match by service type (HANYA untuk SIDAK; KTP mengabaikan field ini)

### Access Group Builder UI

Halaman `/dashboard/access-groups` memakai guided scope builder agar Admin/Trainer tidak perlu mengetik `field_name` dan `field_value` manual.

Builder menyediakan 3 jalur:

| Mode | UI Flow | Stored Item |
|---|---|---|
| By Team | Pilih team dari data `profiler_peserta.tim` yang tersedia | `field_name = tim`, `field_value = selected team` |
| By Service | Pilih service dari daftar SIDAK valid | `field_name = service_type`, `field_value = selected service` |
| By Name | Pilih Team dulu, lalu pilih Name/agent dari team tersebut | `field_name = peserta_id`, `field_value = selected peserta id` |

Catatan:
- Dropdown Name selalu disabled sampai Team dipilih.
- Opsi Team dan Name diambil dari `profiler_peserta` saat halaman dibuka.
- Opsi Service diambil dari `VALID_SERVICE_TYPES` dan `SERVICE_LABELS`.
- Struktur database tidak berubah; builder hanya memetakan pilihan user ke `access_group_items`.

### Modules

| Module ID | Label | KTP-Relevant Fields | SIDAK-Relevant Fields |
|---|---|---|---|
| `ktp` | KTP / Profiler | peserta_id, batch_name, tim | — |
| `sidak` | SIDAK / QA Analyzer | peserta_id, batch_name, tim | + service_type |
| `all` | Semua Modul | Same as module-specific (resolved per-module) | Same as module-specific |

### Key Files

| File | Role |
|---|---|
| `app/lib/access-control/leaderScope.ts` | Pure functions: `resolveLeaderScope()`, `isPrivilegedRole()`, types |
| `app/lib/access-control/leaderAccess.server.ts` | Server-only: `getLeaderAccessStatus()`, `getAllowedParticipantIdsForLeader()`, `requestLeaderModuleAccess()`, `assertPrivilegedAccess()` |
| `app/actions/leader-access.ts` | Server Actions: `getPendingLeaderAccessRequests()`, `approveLeaderAccessRequest()`, etc. |
| `app/components/access/LeaderAccessStatus.tsx` | Status UI component untuk leader (none/pending/approved/rejected/revoked) |
| `app/(main)/dashboard/access-approval/` | Admin/Trainer approval management page |
| `app/(main)/dashboard/access-groups/` | Admin/Trainer access group CRUD page dengan guided scope builder |
| `app/(main)/profiler/services/profilerService.server.ts` | Scoped variants: `getFolderCounts(scope)`, `getByBatch(batch, scope)` + participant-ID variants |
| `app/(main)/qa-analyzer/lib/leaderAccessGuard.ts` | Helper: `checkSidakLeaderAccess()`, `checkKtpLeaderAccess()` — returns `participantIds` for leader |
| `app/(main)/qa-analyzer/lib/leaderScopeFilters.ts` | Filter helpers: `filterAgentDirectoryByLeaderScope()`, `filterAgentDirectoryByParticipantIds()`, `filterRankingByParticipantIds()` |
| `app/(main)/qa-analyzer/services/qaService.server.ts` | `computeDominantService()`, participant-ID scoped dashboard queries |
| `supabase/migrations/20260502133224_leader_access_approval.sql` | Database migration |

### Access Status Flow

```
Leader opens KTP/SIDAK page
  |
  +-- No request exists --> status: "none" --> show LeaderAccessStatus with "Ajukan Akses" button
  |
  +-- Request pending --> status: "pending" --> show LeaderAccessStatus "Menunggu Approval"
  |
  +-- Request rejected --> status: "rejected" --> show LeaderAccessStatus "Ditolak"
  |
  +-- Request revoked --> status: "revoked" --> show LeaderAccessStatus "Dicabut"
  |
  +-- Request approved --> resolve scope filter --> query data with scope
       |
       +-- Scope empty (no active items) --> data kosong
       +-- Scope has items --> filter data by union of all items
```

### Admin/Trainer Approval Flow

1. Admin/trainer navigates to `/dashboard/access-approval`
2. See pending requests tab: leader name, module, date, select access groups, approve/reject
3. See approved tab: leader name, module, access groups, date, revoke button
4. Approve requires selecting minimal 1 active access group
5. Manage access groups at `/dashboard/access-groups` using By Team, By Service, or By Name
6. Server action rejects self-approval and validates that every selected group is still active before approving

### RLS Policies

- `leader_access_requests`: Leader only sees and inserts own pending requests; insert also checks the caller role is `leader`/`leaders`; Admin/trainer can manage all
- `leader_access_request_groups`: Leader sees own approved groups; Admin/trainer can manage all
- `access_groups` / `access_group_items`: Admin/trainer only (leader cannot see these pages or data)

### Security: Fail-Closed

- Leader dengan scope kosong → data kosong (tidak fallback ke semua data)
- Leader dengan status tidak approved → blocked (tidak bisa fetch data modul)
- Access group nonaktif → tidak dihitung dalam scope
- Access group items nonaktif → tidak dihitung
- Module "unknown" → scope kosong
- Role tidak dikenal → default deny

### Manual QA Checklist

Use this checklist after applying the migration and before release:

1. Leader with no request opens KTP and SIDAK → sees access request status page, no data.
2. Leader submits request → duplicate pending request is not created.
3. Pending Leader opens KTP/SIDAK → sees "Menunggu Approval", no data.
4. Admin/trainer approves with one active access group → Leader sees only participants/agents in that group.
5. Admin/trainer attempts to approve with inactive/invalid group → request is rejected by server action.
6. Admin/trainer attempts to approve own request → request is rejected by server action.
7. Leader opens out-of-scope KTP/SIDAK detail → data is not returned.
8. Admin/trainer revokes access → Leader returns to blocked status.
9. Admin/trainer opens KTP/SIDAK → full data remains visible.
10. Leader approved for only one module → the other module remains blocked.
11. Admin/trainer adds access group item By Name → Name dropdown remains locked until Team is selected.
12. Admin/trainer adds access group item By Name → saved item uses peserta id, not display name.

### Regression Commands

```bash
npm run test:sidak
npm run lint
npm run type-check
git diff --check
```

### Migration

```bash
# Apply migration to Supabase
npx supabase migration up

# Rollback
npx supabase migration down 20260502133224_leader_access_approval.sql
```

### Changelog

#### 2026-05-03 — Fix: Leader Approved Access for Profiler and SIDAK (Participant-ID Scoped)

**Symptom:**
- Leader approved dengan scope `peserta_id` atau `tim` melihat dashboard SIDAK kosong (blank) karena `hasUnsupportedDashboardScope` memaksa data kosong untuk scope yang tidak bisa direpresentasikan sebagai folder filter.
- Leader approved dengan scope kosong (approved tapi tanpa item) juga melihat dashboard kosong.
- Profiler menampilkan folder/batch global yang difilter mentah, bukan folder yang benar-benar berisi peserta allowed.
- Leader approved di SIDAK bisa mengganti service type dropdown ke service lain di luar scope-nya.

**Root Cause:**
1. Dashboard SIDAK hanya mendukung filter berbasis `batch_names` dan `service_types`. Scope `peserta_id` dan `tim` dianggap "unsupported" dan memicu fail-closed blanket.
2. Tidak ada mekanisme `dominantService` — Leader tidak di-lock ke service type utama dari data peserta yang diizinkan.
3. Profiler membangun folder dari data global lalu memfilter, bukan dari daftar peserta allowed langsung.
4. Service dropdown di SIDAK tidak di-disable untuk Leader.

**Fix:**
- Ditambahkan `getAllowedParticipantIdsForLeader(userId, module, role)` di `leaderAccess.server.ts` yang resolve semua scope (`peserta_id`, `batch_name`, `tim`) menjadi konkret `profiler_peserta.id` list.
- `LeaderAccessResult` sekarang mengembalikan `participantIds: string[] | null` — `null` untuk admin/trainer (full access), array kosong untuk approved tanpa peserta valid.
- Dashboard SIDAK:
  - Dihapus `hasUnsupportedDashboardScope` — semua scope Leader didukung melalui participant-ID filtering.
  - Untuk Leader dengan `participantIds`: hitung `dominantService` dari data peserta allowed pada periode aktif, lock service dropdown, filter data dashboard oleh `peserta_id IN allowedParticipantIds` dan `service_type = dominantService`.
  - `serviceData` hanya menampilkan dominant service untuk Leader.
  - `topAgents` di-filter oleh `participantIds`.
- SIDAK service dropdown di-lock (disabled) untuk Leader dengan badge "Service aktif: {label}".
- Profiler:
  - Folder dan counts dibangun dari peserta allowed (`participantIds`), bukan dari raw scope filter.
  - `getByBatch`, `getGlobalPesertaPool` menerima `participantIds` langsung untuk filtering di query level.
  - `getTimList` juga scoped ke `participantIds`.
  - Approved Leader tanpa peserta valid melihat empty state message.
- SIDAK actions (agent directory, ranking, agent detail) menggunakan `participantIds` alih-alih raw `scopeFilter`.

**Files changed:**
- `app/lib/access-control/leaderAccess.server.ts` — Added `getAllowedParticipantIdsForLeader()`
- `app/(main)/qa-analyzer/lib/leaderAccessGuard.ts` — Updated `LeaderAccessResult` to include `participantIds`
- `app/(main)/qa-analyzer/lib/leaderScopeFilters.ts` — Added `filterAgentDirectoryByParticipantIds()`, `filterRankingByParticipantIds()`
- `app/(main)/qa-analyzer/services/qaService.server.ts` — Added `computeDominantService()`, `allowedParticipantIds` parameter to consolidated data methods
- `app/(main)/qa-analyzer/dashboard/page.tsx` — Removed `hasUnsupportedDashboardScope`, added participant-ID-scoped dashboard path
- `app/(main)/qa-analyzer/dashboard/QaDashboardClient.tsx` — Added `leaderLockedService` prop for locked service dropdown
- `app/(main)/qa-analyzer/dashboard/components/DashboardFilters.tsx` — Added `leaderLockedService` prop
- `app/(main)/qa-analyzer/actions.ts` — Updated agent directory, ranking, and agent detail to use `participantIds`
- `app/(main)/profiler/page.tsx` — Use `getAllowedParticipantIdsForLeader()` with `participantIds`
- `app/(main)/profiler/services/profilerService.server.ts` — Added `participantIds` parameter to service methods
- `app/(main)/profiler/actions.ts` — Updated leader scope checks to use `participantIds`
- `tests/access-control/leader-sidak-contracts.test.ts` — Updated contract tests for participant-ID-based filtering

---

#### 2026-05-03 — Fix: SIDAK Landing Navigation Exact Match

**Symptom:** Saat halaman `/qa-analyzer` menjadi landing hub, sidebar berisiko menandai parent/root SIDAK bersamaan dengan sub-route karena matching prefix terlalu umum.

**Fix:**
- Child navigation SIDAK sekarang mendukung flag `exactMatch` di `APP_MODULES`.
- Item `Beranda SIDAK` memakai `exactMatch: true`, sehingga aktif hanya di `/qa-analyzer`.
- Filter ranking berbasis leader scope dipindahkan ke helper shared agar server action, initial ranking page, dan test memakai kontrak yang sama.

**Files changed:**
- `app/lib/app-config.ts`
- `app/components/Sidebar.tsx`
- `app/(main)/qa-analyzer/lib/leaderScopeFilters.ts`
- `app/(main)/qa-analyzer/actions.ts`
- `app/(main)/qa-analyzer/ranking/page.tsx`
- `tests/access-control/ranking-filter-logic.test.ts`

#### 2026-05-03 — Fix: Dropdown "Pilih Group" Overlap Antar Row

**Symptom:** Dropdown multi-select "Pilih group" pada tabel Pending di halaman `/dashboard/access-approval` muncul di belakang row berikutnya atau ter-clip, karena `AnimatePresence` dirender di dalam `<td>` yang berada di dalam container `overflow-hidden`.

**Root Cause:** Meskipun `motion.div` menggunakan `position: fixed`, properti CSS seperti `backdrop-filter` dan `transform` pada ancestor dapat membentuk **stacking context baru** yang menjebak dropdown (stacking context trap). Dengan demikian `z-index: 50` tidak efektif melawan konten di luar stacking context tersebut.

**Fix (`AccessApprovalClient.tsx`):**
- Dropdown dirender via `ReactDOM.createPortal` langsung ke `document.body`, sehingga benar-benar keluar dari DOM tree tabel.
- Backdrop `z-[9998]` dan dropdown `z-[9999]` dijamin selalu berada paling atas, tidak terpengaruh ancestor apapun.
- Wrapper `<div className="relative z-50">` di dalam `<td>` dihapus (tidak diperlukan lagi).
- Backdrop `fixed inset-0 z-40` yang sebelumnya berada di dalam container tabel dipindahkan ke dalam portal.

**Files changed:**
- `app/(main)/dashboard/access-approval/AccessApprovalClient.tsx`
