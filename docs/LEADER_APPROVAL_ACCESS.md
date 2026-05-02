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
| `app/(main)/dashboard/access-groups/` | Admin/Trainer access group CRUD page |
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
5. Manage access groups at `/dashboard/access-groups`
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
