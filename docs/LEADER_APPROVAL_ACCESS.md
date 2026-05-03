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
| `app/lib/access-control/leaderAccess.server.ts` | Server-only: `getLeaderAccessStatus()`, `requestLeaderModuleAccess()`, `assertPrivilegedAccess()` |
| `app/actions/leader-access.ts` | Server Actions: `getPendingLeaderAccessRequests()`, `approveLeaderAccessRequest()`, etc. |
| `app/components/access/LeaderAccessStatus.tsx` | Status UI component untuk leader (none/pending/approved/rejected/revoked) |
| `app/(main)/dashboard/access-approval/` | Admin/Trainer approval management page |
| `app/(main)/dashboard/access-groups/` | Admin/Trainer access group CRUD page dengan guided scope builder |
| `app/(main)/profiler/services/profilerService.server.ts` | Scoped variants: `getFolderCounts(scope)`, `getByBatch(batch, scope)` |
| `app/(main)/qa-analyzer/lib/leaderAccessGuard.ts` | Helper: `checkSidakLeaderAccess()`, `checkKtpLeaderAccess()` |
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
