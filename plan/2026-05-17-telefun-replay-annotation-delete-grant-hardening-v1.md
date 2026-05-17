# Telefun Replay Annotation DELETE Grant Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the known issue where authenticated clients can directly delete Telefun AI-generated replay annotations through the Supabase Data API.

**Architecture:** Keep `telefun_replay_annotations` readable by the session owner and writable only for manual annotation inserts, but remove direct client-side DELETE capability. AI annotation cleanup must remain server-owned through `createAdminClient()` in `generateReplayAnnotations()`, so stale generated rows can still be replaced without exposing delete rights to browser clients.

**Tech Stack:** Supabase Postgres RLS/grants, Next.js Server Actions, Vitest static SQL contract tests, Markdown docs.

---

## Current Evidence

- `docs/TELEFUN_REPLAY_RETRY_TRANSCRIPTION_FIXES_CHANGELOG_2026-05-16.md` lists the unresolved issue: `DELETE grant ke authenticated`.
- `supabase/migrations/20260516000000_create_telefun_replay_support.sql` grants `SELECT, INSERT, DELETE` on `telefun_replay_annotations` to `authenticated`.
- `supabase/migrations/20260516000001_telefun_replay_rls_repair.sql` repeats the same grant for partial-apply recovery.
- Both replay support migrations create a DELETE policy using only `auth.uid() = user_id`, so any authenticated owner can delete both manual and AI-generated rows for their own session.
- `app/actions/replayAnnotation.ts` deletes stale AI annotations through `createAdminClient()`, not the browser Supabase client. Removing the authenticated table DELETE grant should not break AI regeneration.
- The app currently has `addManualAnnotation()` but no user-facing delete manual annotation server action. Do not invent that feature in this fix.

## Non-Goals

- Do not change replay timestamp ordering. That remains a separate known issue.
- Do not add manual annotation delete UX/API.
- Do not edit historical applied migrations as the live fix. Add a forward migration so already-deployed databases are hardened.
- Do not grant broader permissions to compensate for this change.
- Do not add dependencies.

## File Map

- Modify: `tests/supabase/telefun-replay-migrations-contracts.test.ts`
  - Add final-state contract coverage proving a follow-up migration revokes authenticated DELETE and drops the authenticated DELETE policy.
- Create: `supabase/migrations/20260517000002_restrict_telefun_replay_annotation_delete.sql`
  - Revoke direct DELETE from `authenticated`.
  - Drop the old authenticated DELETE policy.
  - Assert the final privilege is absent.
- Create: `supabase/rollback/20260517000002_restrict_telefun_replay_annotation_delete.down.sql`
  - Restore the previous owner-only DELETE behavior only for deployment rollback.
- Modify: `docs/TELEFUN_REPLAY_RETRY_TRANSCRIPTION_FIXES_CHANGELOG_2026-05-16.md`
  - Move the known issue into a resolved follow-up section.
- Modify: `docs/TELEFUN_OPERATIONAL_RUNBOOK.md`
  - Add an operational note that AI replay annotation deletion is server-only.

---

### Task 1: Add Failing Migration Contract Tests

**Files:**
- Modify: `tests/supabase/telefun-replay-migrations-contracts.test.ts`

- [ ] **Step 1: Add migration path constants**

Patch the constants near the top of `tests/supabase/telefun-replay-migrations-contracts.test.ts`:

```ts
const DELETE_HARDENING_MIGRATION_PATH =
  'supabase/migrations/20260517000002_restrict_telefun_replay_annotation_delete.sql';
const DELETE_HARDENING_ROLLBACK_PATH =
  'supabase/rollback/20260517000002_restrict_telefun_replay_annotation_delete.down.sql';
```

- [ ] **Step 2: Add contract assertions**

Add these tests inside `describe('Telefun replay migration contracts', () => { ... })`:

```ts
it('delete hardening migration removes direct authenticated replay annotation deletes', () => {
  const sql = readFileSync(DELETE_HARDENING_MIGRATION_PATH, 'utf8');

  expect(sql).toContain('DROP POLICY IF EXISTS "Users can delete their own replay annotations"');
  expect(sql).toContain('REVOKE DELETE ON public.telefun_replay_annotations FROM authenticated;');
  expect(sql).toContain(
    "has_table_privilege('authenticated', 'public.telefun_replay_annotations', 'DELETE')"
  );
  expect(sql).toContain('authenticated must not have direct DELETE on telefun_replay_annotations');
  expect(sql).not.toContain('CREATE POLICY "Users can delete their own replay annotations"');
  expect(sql).not.toContain('GRANT SELECT, INSERT, DELETE ON public.telefun_replay_annotations TO authenticated;');
});

it('delete hardening rollback explicitly restores the previous owner-only delete contract', () => {
  const sql = readFileSync(DELETE_HARDENING_ROLLBACK_PATH, 'utf8');

  expect(sql).toContain('GRANT DELETE ON public.telefun_replay_annotations TO authenticated;');
  expect(sql).toContain('CREATE POLICY "Users can delete their own replay annotations"');
  expect(sql).toContain('FOR DELETE');
  expect(sql).toContain('USING (auth.uid() = user_id);');
});
```

- [ ] **Step 3: Run the focused test and confirm failure**

Run:

```bash
npx vitest run tests/supabase/telefun-replay-migrations-contracts.test.ts
```

Expected: fail because the new migration and rollback files do not exist yet.

---

### Task 2: Create Forward Hardening Migration

**Files:**
- Create: `supabase/migrations/20260517000002_restrict_telefun_replay_annotation_delete.sql`

- [ ] **Step 1: Create the hardening migration**

Create `supabase/migrations/20260517000002_restrict_telefun_replay_annotation_delete.sql`:

```sql
-- Security hardening: remove direct client DELETE access from Telefun replay annotations.
--
-- AI-generated replay annotations are maintained by server actions through
-- createAdminClient(). Browser clients may read their own rows and insert manual
-- annotations, but they must not delete generated rows through the Data API.

DROP POLICY IF EXISTS "Users can delete their own replay annotations"
  ON public.telefun_replay_annotations;

REVOKE DELETE ON public.telefun_replay_annotations FROM authenticated;

DO $$
BEGIN
  IF has_table_privilege('authenticated', 'public.telefun_replay_annotations', 'DELETE') THEN
    RAISE EXCEPTION 'authenticated must not have direct DELETE on telefun_replay_annotations';
  END IF;
END;
$$;

COMMENT ON TABLE public.telefun_replay_annotations IS
  'AI-generated and manual annotations for Telefun session replay. Browser clients may read owned rows and insert manual annotations; generated annotation cleanup is server-only.';
```

- [ ] **Step 2: Confirm SQL scope**

Run:

```bash
rg -n "telefun_replay_annotations|REVOKE DELETE|DROP POLICY IF EXISTS" supabase/migrations/20260517000002_restrict_telefun_replay_annotation_delete.sql
```

Expected: the file only touches `telefun_replay_annotations` delete policy/grant and its table comment.

---

### Task 3: Create Rollback SQL

**Files:**
- Create: `supabase/rollback/20260517000002_restrict_telefun_replay_annotation_delete.down.sql`

- [ ] **Step 1: Create the rollback**

Create `supabase/rollback/20260517000002_restrict_telefun_replay_annotation_delete.down.sql`:

```sql
-- Rollback: restore the previous owner-only direct DELETE contract for Telefun
-- replay annotations. Use only when rolling back migration
-- 20260517000002_restrict_telefun_replay_annotation_delete.sql.

GRANT DELETE ON public.telefun_replay_annotations TO authenticated;

DROP POLICY IF EXISTS "Users can delete their own replay annotations"
  ON public.telefun_replay_annotations;

CREATE POLICY "Users can delete their own replay annotations"
  ON public.telefun_replay_annotations
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.telefun_replay_annotations IS
  'AI-generated and manual annotations for Telefun session replay. Each annotation marks a specific moment in the recording with category, description, and timestamp.';
```

- [ ] **Step 2: Re-run migration contract tests**

Run:

```bash
npx vitest run tests/supabase/telefun-replay-migrations-contracts.test.ts
```

Expected: pass.

---

### Task 4: Update Replay Docs

**Files:**
- Modify: `docs/TELEFUN_REPLAY_RETRY_TRANSCRIPTION_FIXES_CHANGELOG_2026-05-16.md`
- Modify: `docs/TELEFUN_OPERATIONAL_RUNBOOK.md`

- [ ] **Step 1: Add a resolved follow-up section to the changelog**

In `docs/TELEFUN_REPLAY_RETRY_TRANSCRIPTION_FIXES_CHANGELOG_2026-05-16.md`, add this section before `## Known Issues (Sengaja Tidak Disentuh)`:

```md
## Follow-up Fixes (DELETE Grant Hardening)

### 10. Replay annotations - direct client DELETE dinonaktifkan
- **Bug:** `authenticated` sebelumnya mendapat `DELETE` grant pada `telefun_replay_annotations`, dan policy DELETE hanya memeriksa `user_id`. Pemilik sesi bisa menghapus row AI-generated langsung via Data API.
- **Fix:** Migration `20260517000002_restrict_telefun_replay_annotation_delete.sql` mencabut `DELETE` dari `authenticated` dan menghapus policy DELETE owner-only. Cleanup row AI sekarang tetap dilakukan server-side melalui `generateReplayAnnotations()` memakai `createAdminClient()`.
- **Test:** `tests/supabase/telefun-replay-migrations-contracts.test.ts` memastikan migration hardening mencabut privilege dan rollback mendokumentasikan kontrak lama secara eksplisit.
```

- [ ] **Step 2: Remove the resolved item from unresolved known issues**

Remove this bullet from the unresolved known-issues list:

```md
- **DELETE grant ke authenticated:** Client bisa hapus AI-generated annotations langsung via API tanpa guard — hanya pemeriksaan `user_id`.
```

- [ ] **Step 3: Add an operational note to the runbook**

In `docs/TELEFUN_OPERATIONAL_RUNBOOK.md`, near the Telefun replay/cache integrity section, add:

```md
### Replay Annotation Delete Contract

Client Supabase access tidak memiliki direct `DELETE` pada `telefun_replay_annotations`. User-facing flow hanya boleh membaca anotasi milik sesi sendiri dan menambah anotasi manual. Penghapusan row AI-generated untuk regenerasi replay dilakukan oleh server action `generateReplayAnnotations()` melalui `createAdminClient()`, sehingga cleanup tetap berjalan tanpa membuka delete API ke browser.
```

---

### Task 5: Verify No App Regression

**Files:**
- Read-only verification across `app/actions/replayAnnotation.ts`, migration files, and docs.

- [ ] **Step 1: Confirm the server cleanup path still uses admin access**

Run:

```bash
rg -n "createAdminClient|from\\('telefun_replay_annotations'\\)|\\.delete\\(\\)|eq\\('is_manual', false\\)" app/actions/replayAnnotation.ts
```

Expected:
- `createAdminClient()` is used before replay annotation persistence.
- The stale AI delete path remains in `generateReplayAnnotations()`.
- The delete filter includes `session_id`, `user_id`, and `is_manual = false`.

- [ ] **Step 2: Confirm there is no user-facing manual delete flow to preserve**

Run:

```bash
rg -n "delete.*manual|manual.*delete|remove.*annotation|deleteAnnotation|telefun_replay_annotations.*delete" app tests
```

Expected:
- No browser/client manual delete feature is present.
- The only expected delete path is server-side stale AI cleanup in `app/actions/replayAnnotation.ts`.

- [ ] **Step 3: Run focused tests**

Run:

```bash
npx vitest run tests/supabase/telefun-replay-migrations-contracts.test.ts tests/telefun/replay-annotation-persistence.test.ts tests/telefun/replay-annotation-completeness.test.ts
```

Expected: pass.

- [ ] **Step 4: Run lint**

Run:

```bash
npm run lint
```

Expected: 0 errors. Existing warnings are acceptable if unchanged.

- [ ] **Step 5: Run type/build check only if code changed beyond SQL/docs/tests**

Run if `app/actions/**`, React components, shared TS helpers, or Supabase generated types are touched:

```bash
npm run type-check
```

Expected: build succeeds.

---

### Task 6: Commit

**Files:**
- Stage only the files changed for this hardening patch.

- [ ] **Step 1: Review diff**

Run:

```bash
git diff -- tests/supabase/telefun-replay-migrations-contracts.test.ts supabase/migrations/20260517000002_restrict_telefun_replay_annotation_delete.sql supabase/rollback/20260517000002_restrict_telefun_replay_annotation_delete.down.sql docs/TELEFUN_REPLAY_RETRY_TRANSCRIPTION_FIXES_CHANGELOG_2026-05-16.md docs/TELEFUN_OPERATIONAL_RUNBOOK.md
git diff --check
```

Expected:
- No unrelated files.
- No whitespace errors.
- Docs mark the DELETE grant issue as resolved, not both resolved and unresolved.

- [ ] **Step 2: Commit**

```bash
git add tests/supabase/telefun-replay-migrations-contracts.test.ts \
  supabase/migrations/20260517000002_restrict_telefun_replay_annotation_delete.sql \
  supabase/rollback/20260517000002_restrict_telefun_replay_annotation_delete.down.sql \
  docs/TELEFUN_REPLAY_RETRY_TRANSCRIPTION_FIXES_CHANGELOG_2026-05-16.md \
  docs/TELEFUN_OPERATIONAL_RUNBOOK.md
git commit -m "fix: restrict Telefun replay annotation deletes"
```

---

## Acceptance Criteria

- `authenticated` no longer has direct `DELETE` privilege on `public.telefun_replay_annotations` after the latest migration.
- The old authenticated DELETE policy is dropped by the latest migration.
- AI annotation regeneration still works because stale AI cleanup stays server-side through `createAdminClient()`.
- The unresolved known-issues section no longer lists `DELETE grant ke authenticated`.
- The runbook states the direct delete contract clearly for future agents.
- Focused Vitest migration/replay tests pass.

