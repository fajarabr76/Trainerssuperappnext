# QA Versioned Rules Revision — Safe Parameter Editing After Publish

**Date:** 2026-05-05
**Status:** Approved for implementation
**Module:** QA-Analyzer (SIDAK)
**Approach:** B — DB-Enforced with RPC

---

## 1. Problem Statement

The QA/SIDAK module already has a versioning foundation via `qa_service_rule_versions` and `qa_service_rule_indicators`. `qa_temuan` already stores `rule_version_id` and `rule_indicator_id`. However, after a parameter set is published, users cannot safely fix mistakes (wrong parameter name, wrong weight, or sudden changes) without risking historical data integrity.

**Current gaps:**
- No explicit revision flow: published versions are immutable but cannot be branched.
- No `superseded` state: old published versions remain in limbo when a new one is published.
- No `change_reason` tracking.
- No validation that indicator weights per category sum to 100%.
- Dashboard could incorrectly recalculate historical data using the latest parameters.

---

## 2. Goals

1. Enable safe editing of parameters after publish via a **Create Revision** flow.
2. Preserve historical data integrity: old findings must keep using the parameters that were active when they were entered.
3. Prevent invalid parameter sets from being published.
4. Provide clear UI states and actions per version status.
5. Keep changes minimal and safe; do not refactor outside this scope.

---

## 3. Non-Goals

- Mass-updating old `qa_temuan` rows to new parameters.
- Adding an `archived` status (out of scope; `superseded` is sufficient for now).
- Changing the scoring algorithm itself.
- Replacing `qa_indicators` entirely; it remains as a legacy fallback.

---

## 4. Database Schema Changes

### 4.1. `qa_service_rule_versions`

**New columns:**

| Column | Type | Description |
|--------|------|-------------|
| `version_number` | `integer NOT NULL DEFAULT 1` | Sequential per `service_type + effective_period_id`. Example: Email–May 2026 v1, Email–May 2026 v2, Email–June 2026 v1. |
| `change_reason` | `text` | Required when publishing a revision. Optional when creating a draft or first publish. |
| `updated_by` | `uuid REFERENCES auth.users(id)` | Who last updated the draft. |
| `superseded_at` | `timestamptz` | When this version was superseded. |
| `superseded_by` | `uuid REFERENCES auth.users(id)` | Who triggered the supersede action. |
| `superseded_by_version_id` | `uuid REFERENCES qa_service_rule_versions(id)` | Links to the version that replaced this one. |
| `created_from_version_id` | `uuid REFERENCES qa_service_rule_versions(id)` | For drafts created via revision; links to the source published version. |

**Constraint changes:**

```sql
-- Drop old status check, add superseded
ALTER TABLE qa_service_rule_versions
  DROP CONSTRAINT IF EXISTS qa_service_rule_versions_status_check;

ALTER TABLE qa_service_rule_versions
  ADD CONSTRAINT qa_service_rule_versions_status_check
  CHECK (status IN ('draft', 'published', 'superseded'));
```

**Indexes:**

```sql
-- Unique version number per service + period
CREATE UNIQUE INDEX IF NOT EXISTS uq_qa_rule_version_number
ON qa_service_rule_versions (service_type, effective_period_id, version_number);

-- Only one published version per service + period
CREATE UNIQUE INDEX IF NOT EXISTS uq_qa_rule_one_published_per_service_period
ON qa_service_rule_versions (service_type, effective_period_id)
WHERE status = 'published';

-- Optional: only one draft per service + period (recommended for operational simplicity)
CREATE UNIQUE INDEX IF NOT EXISTS uq_qa_rule_one_draft_per_service_period
ON qa_service_rule_versions (service_type, effective_period_id)
WHERE status = 'draft';
```

### 4.2. `qa_service_rule_indicators`

```sql
ALTER TABLE qa_service_rule_indicators
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id);
```

### 4.3. `qa_temuan` (no schema change)

Already has `rule_version_id` and `rule_indicator_id`. No migration needed.

### 4.4. Migration Strategy for Existing Data

**Risk:** Adding `version_number integer NOT NULL DEFAULT 1` with a unique index on `(service_type, effective_period_id, version_number)` will fail if existing rows already contain duplicates for that composite key.

**Recommended migration order:**

```sql
-- 1. Add columns as nullable (no default)
ALTER TABLE qa_service_rule_versions
  ADD COLUMN IF NOT EXISTS version_number integer,
  ADD COLUMN IF NOT EXISTS change_reason text,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS superseded_at timestamptz,
  ADD COLUMN IF NOT EXISTS superseded_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS superseded_by_version_id uuid REFERENCES qa_service_rule_versions(id),
  ADD COLUMN IF NOT EXISTS created_from_version_id uuid REFERENCES qa_service_rule_versions(id);

ALTER TABLE qa_service_rule_indicators
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id);

-- 2. Backfill existing rows safely
--    If only one row exists per (service_type, effective_period_id), set to 1.
--    If multiple exist, assign sequential numbers.
WITH numbered AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY service_type, effective_period_id
           ORDER BY created_at, id
         ) as rn
  FROM qa_service_rule_versions
)
UPDATE qa_service_rule_versions
SET version_number = numbered.rn
FROM numbered
WHERE qa_service_rule_versions.id = numbered.id;

-- 3. Set NOT NULL after backfill
ALTER TABLE qa_service_rule_versions
  ALTER COLUMN version_number SET NOT NULL;

-- 4. Now safe to create unique index
CREATE UNIQUE INDEX IF NOT EXISTS uq_qa_rule_version_number
ON qa_service_rule_versions (service_type, effective_period_id, version_number);
```

**Rollback strategy:**

- **Safe (non-destructive) rollback:**
  ```sql
  DROP FUNCTION IF EXISTS public.publish_rule_version(uuid, text);
  DROP INDEX IF EXISTS uq_qa_rule_version_number;
  DROP INDEX IF EXISTS uq_qa_rule_one_published_per_service_period;
  DROP INDEX IF EXISTS uq_qa_rule_one_draft_per_service_period;
  ALTER TABLE qa_service_rule_versions
    DROP CONSTRAINT IF EXISTS qa_service_rule_versions_status_check;
  ALTER TABLE qa_service_rule_versions
    ADD CONSTRAINT qa_service_rule_versions_status_check
    CHECK (status IN ('draft', 'published'));
  -- Do NOT drop audit columns if production data has been written.
  ```

- **Destructive rollback (dev/staging only):**
  ```sql
  ALTER TABLE qa_service_rule_versions
    DROP COLUMN IF EXISTS version_number,
    DROP COLUMN IF EXISTS change_reason,
    DROP COLUMN IF EXISTS updated_by,
    DROP COLUMN IF EXISTS superseded_at,
    DROP COLUMN IF EXISTS superseded_by,
    DROP COLUMN IF EXISTS superseded_by_version_id,
    DROP COLUMN IF EXISTS created_from_version_id;
  ALTER TABLE qa_service_rule_indicators
    DROP COLUMN IF EXISTS updated_by;
  ```

---

## 5. State Machine

```
[draft] --(publish)--> [published]

[published] --(create revision)-->
  [published] (old, unchanged)
  + [draft] (new, copied from old, version_number = MAX + 1)

[published] --(publish revision)-->
  [superseded] (old)
  + [published] (new)
```

**Rules:**
- A `draft` can be edited, previewed, or deleted.
- A `published` version cannot be edited directly. It can only be revised.
- A `superseded` version is read-only.

---

## 6. Server Actions / RPC Functions

### 6.1. `createRuleDraft(serviceType, createdBy, sourceVersionId?)`

**Flow:**
1. If `sourceVersionId` is provided (revision from published):
   - Validate source status = `published`.
   - Copy all indicators from source to new draft.
   - `version_number = MAX(version_number) + 1` for `service_type + effective_period_id`.
   - Set `created_from_version_id = sourceVersionId`.
2. If no `sourceVersionId` (first draft):
   - Validate that no `published` version already exists for `service_type + effective_period_id`. If one exists, the user must use **Create Revision** instead.
   - Validate that no existing `draft` already exists for `service_type + effective_period_id` (enforced by `uq_qa_rule_one_draft_per_service_period`).
   - Copy from legacy `qa_indicators` + `qa_service_weights`.
   - `version_number = 1`.
3. Insert into `qa_service_rule_versions` with `status = 'draft'`.

### 6.2. `updateDraftRuleVersion(versionId, payload)`

- Validate `status == 'draft'`.
- Update `critical_weight`, `non_critical_weight`, `scoring_mode`, `updated_by`, `updated_at`.
- `change_reason` can be updated optionally.

### 6.3. `addDraftIndicator` / `updateDraftIndicator` / `deleteDraftIndicator`

- Validate parent `status == 'draft'`.
- Track `updated_by` on the indicator row.

### 6.4. `publishRuleVersion(p_version_id, p_change_reason)` — RPC

**Atomic DB function:**

```sql
CREATE OR REPLACE FUNCTION public.publish_rule_version(
  p_version_id uuid,
  p_change_reason text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record qa_service_rule_versions%ROWTYPE;
  v_service_type text;
  v_period_id uuid;
  v_old_published qa_service_rule_versions%ROWTYPE;
  v_actor uuid;
BEGIN
  v_actor := auth.uid();

  -- 0. Permission check
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = v_actor
      AND role IN ('admin', 'trainer', 'trainers')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- 1. Lock & fetch draft
  SELECT * INTO v_record FROM qa_service_rule_versions
  WHERE id = p_version_id AND status = 'draft'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Draft not found');
  END IF;

  v_service_type := v_record.service_type;
  v_period_id := v_record.effective_period_id;

  -- 2. Validate no duplicate indicator names within the same category
  IF EXISTS (
    SELECT 1 FROM qa_service_rule_indicators
    WHERE rule_version_id = p_version_id
    GROUP BY lower(trim(name)), category
    HAVING COUNT(*) > 1
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ada parameter duplikat dalam kategori yang sama');
  END IF;

  -- 3. Scoring-mode-aware validation
  IF v_record.scoring_mode = 'weighted' THEN
    -- Validate indicators exist for categories with weight > 0
    IF v_record.critical_weight > 0 AND NOT EXISTS (
      SELECT 1 FROM qa_service_rule_indicators
      WHERE rule_version_id = p_version_id AND category = 'critical'
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Parameter critical wajib ada');
    END IF;

    IF v_record.non_critical_weight > 0 AND NOT EXISTS (
      SELECT 1 FROM qa_service_rule_indicators
      WHERE rule_version_id = p_version_id AND category = 'non_critical'
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Parameter non-critical wajib ada');
    END IF;

    -- Validate indicator weights per category = 100%
    IF EXISTS (
      SELECT 1 FROM (
        SELECT category, SUM(bobot) as total
        FROM qa_service_rule_indicators
        WHERE rule_version_id = p_version_id AND category IN ('critical', 'non_critical')
        GROUP BY category
        HAVING ABS(SUM(bobot) - 1.0) > 0.001
      ) x
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Bobot per kategori tidak 100%');
    END IF;
  ELSIF v_record.scoring_mode = 'flat' THEN
    -- Flat mode: no per-category weight enforcement
    -- Optionally ensure total weight across all indicators is reasonable
    NULL;
  ELSIF v_record.scoring_mode = 'no_category' THEN
    -- No category mode: category can be 'none', no critical/non_critical required
    NULL;
  END IF;

  -- 4. Find existing published version for this service + period
  SELECT * INTO v_old_published FROM qa_service_rule_versions
  WHERE service_type = v_service_type
    AND effective_period_id = v_period_id
    AND status = 'published'
    AND id != p_version_id
  FOR UPDATE;

  -- 5. If replacing an old published version, change_reason is required
  IF v_old_published.id IS NOT NULL AND (p_change_reason IS NULL OR trim(p_change_reason) = '') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Alasan revisi wajib diisi');
  END IF;

  -- 6. Supersede old published version
  IF v_old_published.id IS NOT NULL THEN
    UPDATE qa_service_rule_versions
    SET status = 'superseded',
        superseded_at = now(),
        superseded_by = v_actor,
        superseded_by_version_id = p_version_id,
        updated_at = now()
    WHERE id = v_old_published.id;
  END IF;

  -- 7. Publish the draft
  UPDATE qa_service_rule_versions
  SET status = 'published',
      published_by = v_actor,
      published_at = now(),
      change_reason = p_change_reason,
      updated_at = now()
  WHERE id = p_version_id;

  RETURN jsonb_build_object('success', true, 'superseded_version_id', v_old_published.id);
END;
$$;
```

**Why RPC:**
- Atomic: no half-updates. If anything fails, the DB rolls back.
- `auth.uid()` is used instead of trusting a client-supplied user ID.
- DB-level validation prevents app-layer bypass.

### 6.5. `resolveRuleVersion(periodId, serviceType)`

**Updated logic:**

```sql
SELECT * FROM qa_service_rule_versions
WHERE status = 'published'
  AND service_type = serviceType
  AND effective_period_id = periodId
ORDER BY version_number DESC, published_at DESC
LIMIT 1;
```

**Fallback:**
- If no published version is found, fall back to legacy `qa_indicators` + `qa_service_weights`.
- **Do not** use `effective_period_id <= periodId` with UUID comparison.

---

## 7. Flow Input QA

**Goal:** Every new `qa_temuan` row must store the exact version and indicator that were active at the time of input.

**Flow:**
1. Call `resolveRuleVersion(periodId, serviceType)` → get `{ version, indicators }`.
2. UI renders the list of indicators from `qa_service_rule_indicators`.
3. When the user selects a parameter, the UI sends `rule_indicator_id` directly (not a name/category lookup).
4. `saveQaTemuan` stores:
   - `rule_version_id = version.id`
   - `rule_indicator_id = indicator.id`
   - `indicator_id = indicator.legacy_indicator_id` (for backward compatibility)

**Backward compatibility:**
- If `resolveRuleVersion` returns nothing (legacy data), fall back to `qa_indicators`.
- Old rows without `rule_version_id`/`rule_indicator_id` continue to use `qa_indicators` for dashboard display.

---

## 8. Dashboard

**Core principle:** Do **not** recalculate historical data using the latest parameters.

**Rules:**
1. For rows with `rule_version_id` and `rule_indicator_id`:
   - Read name, category, and weight directly from `qa_service_rule_indicators`.
2. For rows without `rule_version_id`:
   - Fall back to `qa_indicators`.
3. Scoring per period:
   - Use the `rule_version_id` stored on each `qa_temuan` row.
   - Only use `resolveRuleVersion` for:
     - New QA input
     - Fallback when data lacks `rule_version_id`
     - Previewing the currently active settings
4. If multiple versions exist in the same month:
   - Each `qa_temuan` row displays using its own `rule_version_id`.
   - The dashboard does not "merge" or "upgrade" old rows.

### 8.1. Dashboard Summary / Cache Tables

If the project uses materialized views, cache tables, or summary tables for dashboard QA (e.g., `qa_dashboard_summary_tables`), the refresh/rebuild logic must:

1. Use `qa_temuan.rule_indicator_id` to look up `name`, `category`, and `bobot` from `qa_service_rule_indicators`.
2. Never pull `category` or `bobot` from `qa_indicators` for rows that already have `rule_indicator_id`.
3. Ensure the summary refresh does not silently "upgrade" historical data to the latest parameter set.

**Recommended audit:** Search the codebase for any `qa_indicators` joins in dashboard/SIDAK summary queries and verify they respect `rule_indicator_id`.

---

## 9. UI Changes

### 9.1. Action Matrix (`QaVersionedSettings.tsx`)

| Status | Actions |
|--------|---------|
| `draft` | Edit, Delete Draft, Preview, Publish |
| `published` | View, Create Revision, View History |
| `superseded` | View Only, Compare with Current |

**Rules:**
- `published` and `superseded` must **not** show an Edit button.
- `Create Revision` duplicates the published version into a new draft.

### 9.2. Preview Before Publish

A preview modal/section must display:
- Service type
- Effective period
- Total parameters (count of indicators)
- Total weight: critical vs non-critical
- List of changes vs the previous version (if a revision)
- Confirmation checkbox before Publish is enabled

### 9.3. Publish Revision Flow

1. User clicks Publish on a draft revision.
2. Preview modal opens.
3. User must enter `change_reason` (required for revisions).
4. Backend calls `publishRuleVersion` RPC.
5. On success:
   - Old version becomes `superseded`.
   - New draft becomes `published`.
   - UI refreshes to show the new published version.

---

## 10. Guardrails

1. **Single published version per service + period:**
   - Enforced by partial unique index `uq_qa_rule_one_published_per_service_period`.
2. **Atomic publish:**
   - `publishRuleVersion` RPC handles supersede + publish in one transaction.
3. **No mass data migration:**
   - Old `qa_temuan` rows are never updated to new parameters.
4. **Category weight validation:**
   - RPC validates that indicator weights per category sum to 100%.
   - RPC validates that indicators exist for categories with weight > 0.
5. **User identity:**
   - `published_by` and `superseded_by` are derived from `auth.uid()`, not client input.

---

## 11. Testing / Manual Checklist

- [ ] Create a draft parameter set for May.
- [ ] Edit parameter names and weights before publish.
- [ ] Publish the draft.
- [ ] Verify the published version cannot be edited directly.
- [ ] Create a revision from the published version.
- [ ] Edit the revision.
- [ ] Publish the revision (must enter change_reason).
- [ ] Verify the old version is now `superseded`.
- [ ] Enter new QA findings; they must use the latest published version.
- [ ] Verify old QA findings still use the old version.
- [ ] Verify the dashboard displays historical data correctly, even if May had multiple versions.

**Negative tests:**
- [ ] Try to publish two drafts for the same `service_type + effective_period_id` → must fail.
- [ ] Try to create a revision and publish without `change_reason` → must fail.
- [ ] Try to publish with invalid weights (e.g., critical total != 100%) → must fail.
- [ ] Verify that if publish revision fails mid-transaction (e.g., due to invalid weights), the old version remains `published` (atomic rollback).

---

## 12. Files to Modify

| File | Reason |
|------|--------|
| `supabase/migrations/20260505000000_enhance_qa_versioning.sql` | Add columns, constraints, indexes, and RPC. |
| `supabase/rollback/20260505000000_enhance_qa_versioning.down.sql` | Rollback script. |
| `app/(main)/qa-analyzer/services/qaService.server.ts` | Update `createRuleDraft`, `updateRuleDraft`, `publishRuleVersion` wrapper, `resolveRuleVersion`. |
| `app/(main)/qa-analyzer/actions.ts` | Update server action wrappers and validation. |
| `app/(main)/qa-analyzer/settings/QaVersionedSettings.tsx` | Update action buttons, add preview modal, revision flow. |
| `app/(main)/qa-analyzer/input/QaInputClient.tsx` | Ensure UI sends `rule_indicator_id` directly. |
| `app/(main)/qa-analyzer/lib/qa-types.ts` | Update TypeScript types for new fields and statuses. |
| Dashboard components | Update to read from `qa_service_rule_indicators` with fallback. |

---

## 13. Changelog Entry

**Added:**
- Safe parameter revision flow after publish.
- `superseded` status for old published versions.
- `version_number`, `change_reason`, `updated_by`, `superseded_at`, `superseded_by`, `superseded_by_version_id` fields.
- Atomic `publish_rule_version` RPC with DB-level weight validation.
- Preview modal before publishing.

**Fixed:**
- Dashboard no longer recalculates historical data using latest parameters.
- Input QA now stores `rule_version_id` and `rule_indicator_id` correctly.

---

## 14. Acceptance Criteria

Implementation is considered complete when **all** of the following are true:

1. **Published versions are immutable:** A version with `status = 'published'` cannot be edited directly via UI or API. The only allowed action is **Create Revision**.
2. **Revision creates a new draft:** Creating a revision from a published version produces a new `draft` with `version_number = MAX(version_number) + 1` for that `service_type + effective_period_id`, and `created_from_version_id` points to the source published version.
3. **Publish is atomic:** Publishing a revision (via `publish_rule_version` RPC) either succeeds entirely (old version becomes `superseded`, new draft becomes `published`) or fails with no side effects (old version stays `published`).
4. **`change_reason` is required for revisions:** Publishing a revision that replaces an existing published version rejects the request if `change_reason` is empty.
5. **QA input stores versioned IDs:** New `qa_temuan` rows must populate `rule_version_id` and `rule_indicator_id` from the active published version at the time of input.
6. **Dashboard uses stored versioned IDs:** Dashboard rendering and scoring for historical rows use `qa_temuan.rule_version_id` and `rule_indicator_id`. Legacy rows without these fields fall back to `qa_indicators`.
7. **Dashboard summary/cache respects versioning:** Any summary tables, materialized views, or cache rebuilds for QA dashboards must join through `qa_service_rule_indicators` when `rule_indicator_id` is present, never silently pulling from `qa_indicators`.
8. **Validations enforce data integrity:**
   - Only one `published` version per `service_type + effective_period_id`.
   - Only one `draft` per `service_type + effective_period_id` (if `uq_qa_rule_one_draft_per_service_period` is enabled).
   - Indicator weights per category sum to 100% for `scoring_mode = weighted`.
   - Duplicate indicator names within the same category are rejected at publish time.
9. **Permission checks are in place:** The `publish_rule_version` RPC verifies the caller has an authorized role (`admin`, `trainer`, or `trainers`).
10. **Legacy fallback works:** If no published version exists for a given period and service, the system falls back to legacy `qa_indicators` + `qa_service_weights` without errors.

---

*Design approved. Ready for implementation planning.*
