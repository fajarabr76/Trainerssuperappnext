# Telefun AI Annotation Completeness Heuristic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the Telefun replay cache path so persisted AI annotations are only treated as complete when they match durable completion metadata, not merely when at least one AI annotation row exists.

**Architecture:** Keep manual annotations intact, but make AI-generated annotation sets replaceable. Store a deterministic count and checksum on `telefun_coaching_summary`; the server action may short-circuit only when the summary metadata matches the current non-manual annotation rows. Missing or mismatched metadata triggers regeneration from the recording, deletes stale AI rows via service-role access, inserts the fresh AI rows, and upserts the summary with the new completion metadata.

**Tech Stack:** Next.js Server Actions, Supabase Postgres/RLS/RPC, Vitest, TypeScript, Node `crypto` for deterministic checksum.

---

## Current Evidence

- `docs/TELEFUN_REPLAY_RETRY_TRANSCRIPTION_FIXES_CHANGELOG_2026-05-16.md` lists the issue: `aiAnnotations.length > 0` is treated as complete, so partial repaired rows can block regeneration.
- `app/actions/replayAnnotation.ts` currently maps persisted annotations, splits `aiAnnotations`, and sets `hasPersistedAIAnnotations = aiAnnotations.length > 0`.
- The short-circuit returns cached data when `hasPersistedAIAnnotations && hasPersistedSummary`.
- `app/actions/replayAnnotationHelpers.ts` already owns validation and truncation logic, so the completeness check should live there instead of being embedded in the action.
- `supabase/migrations/20260517000000_enforce_telefun_coaching_summary_shape.sql` is the latest RPC definition for `upsert_telefun_coaching_summary`; add a new migration after it instead of editing older applied migrations.
- Existing unit coverage for this action lives in `tests/telefun/replay-annotation-persistence.test.ts`.
- Existing migration contract coverage lives in `tests/supabase/telefun-replay-migrations-contracts.test.ts`.

## Non-Goals

- Do not fix the separate `DELETE grant ke authenticated` known issue in this patch.
- Do not change `ReplayAnnotator.tsx` timeline sorting; ordering is a separate API-contract issue.
- Do not add new dependencies.
- Do not change Gemini prompt behavior unless a test proves the completeness metadata requires it.

## File Map

- Modify: `app/actions/replayAnnotationHelpers.ts`
  - Add deterministic checksum and completeness helpers for persisted AI annotation sets.
- Modify: `app/actions/replayAnnotation.ts`
  - Replace `aiAnnotations.length > 0` completeness with helper result.
  - Delete stale non-manual AI rows before persisting regenerated AI rows.
  - Upsert coaching summary with count/checksum metadata.
- Create: `supabase/migrations/20260517000001_add_telefun_replay_completion_metadata.sql`
  - Add metadata columns to `telefun_coaching_summary`.
  - Replace the RPC with a 4-argument signature that accepts metadata.
- Create: `supabase/rollback/20260517000001_add_telefun_replay_completion_metadata.down.sql`
  - Restore the previous 2-argument RPC and drop metadata columns.
- Modify: `tests/telefun/replay-annotation-persistence.test.ts`
  - Add action-level tests for stale partial AI rows and metadata-matched short-circuit.
- Create: `tests/telefun/replay-annotation-completeness.test.ts`
  - Add pure helper tests for count/checksum matching, mismatch, missing metadata, and zero-annotation completion.
- Modify: `tests/supabase/telefun-replay-migrations-contracts.test.ts`
  - Add static contract assertions for the new metadata migration and rollback.
- Modify: `docs/TELEFUN_REPLAY_RETRY_TRANSCRIPTION_FIXES_CHANGELOG_2026-05-16.md`
  - Move the known issue into a resolved follow-up note or mark it as fixed by the new plan implementation.
- Modify: `docs/TELEFUN_OPERATIONAL_RUNBOOK.md`
  - Add a short Replay cache-integrity note for operators.

---

### Task 1: Add Pure Completeness Helper Tests

**Files:**
- Create: `tests/telefun/replay-annotation-completeness.test.ts`
- Modify: `app/actions/replayAnnotationHelpers.ts`

- [ ] **Step 1: Create failing helper tests**

Create `tests/telefun/replay-annotation-completeness.test.ts` with these cases:

```ts
import { describe, expect, it } from 'vitest';
import {
  createReplayAnnotationChecksum,
  hasCompleteAiAnnotationSet,
} from '@/app/actions/replayAnnotationHelpers';
import type { ReplayAnnotation } from '@/app/(main)/telefun/services/realisticMode/types';

const aiAnnotation: ReplayAnnotation = {
  id: 'ai-1',
  timestampMs: 1200,
  category: 'critical_moment',
  moment: 'interruption',
  text: 'Agen memotong penjelasan konsumen.',
  isManual: false,
};

const manualAnnotation: ReplayAnnotation = {
  id: 'manual-1',
  timestampMs: 700,
  category: 'strength',
  moment: 'good_de_escalation',
  text: 'Catatan manual trainer.',
  isManual: true,
};

describe('replay annotation completion metadata', () => {
  it('accepts a persisted AI set only when count and checksum match', () => {
    const annotations = [manualAnnotation, aiAnnotation];
    const checksum = createReplayAnnotationChecksum([aiAnnotation]);

    expect(
      hasCompleteAiAnnotationSet(annotations, {
        aiAnnotationCount: 1,
        aiAnnotationChecksum: checksum,
      })
    ).toBe(true);
  });

  it('rejects a persisted AI set when metadata is missing', () => {
    expect(
      hasCompleteAiAnnotationSet([aiAnnotation], {
        aiAnnotationCount: null,
        aiAnnotationChecksum: null,
      })
    ).toBe(false);
  });

  it('rejects a persisted AI set when count does not match current rows', () => {
    const checksum = createReplayAnnotationChecksum([aiAnnotation]);

    expect(
      hasCompleteAiAnnotationSet([aiAnnotation], {
        aiAnnotationCount: 2,
        aiAnnotationChecksum: checksum,
      })
    ).toBe(false);
  });

  it('rejects a persisted AI set when checksum does not match current rows', () => {
    expect(
      hasCompleteAiAnnotationSet([aiAnnotation], {
        aiAnnotationCount: 1,
        aiAnnotationChecksum: '0'.repeat(64),
      })
    ).toBe(false);
  });

  it('allows a completed zero-annotation AI result when metadata explicitly records zero rows', () => {
    const checksum = createReplayAnnotationChecksum([]);

    expect(
      hasCompleteAiAnnotationSet([manualAnnotation], {
        aiAnnotationCount: 0,
        aiAnnotationChecksum: checksum,
      })
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run helper tests and confirm they fail**

Run:

```bash
npx vitest run tests/telefun/replay-annotation-completeness.test.ts
```

Expected result: fail because `createReplayAnnotationChecksum` and `hasCompleteAiAnnotationSet` are not exported yet.

- [ ] **Step 3: Implement helper functions**

Patch `app/actions/replayAnnotationHelpers.ts` by adding `node:crypto` and these exports:

```ts
import { createHash } from 'node:crypto';
```

```ts
export interface ReplayAnnotationCompletionMetadata {
  aiAnnotationCount: number | null | undefined;
  aiAnnotationChecksum: string | null | undefined;
}

type ChecksumAnnotation = Pick<
  ReplayAnnotation,
  'timestampMs' | 'category' | 'moment' | 'text' | 'isManual'
>;

export function createReplayAnnotationChecksum(annotations: ChecksumAnnotation[]): string {
  const payload = annotations
    .filter((annotation) => !annotation.isManual)
    .map((annotation) => ({
      timestampMs: annotation.timestampMs,
      category: annotation.category,
      moment: annotation.moment,
      text: annotation.text,
    }))
    .sort((a, b) => {
      if (a.timestampMs !== b.timestampMs) return a.timestampMs - b.timestampMs;
      return `${a.category}:${a.moment}:${a.text}`.localeCompare(`${b.category}:${b.moment}:${b.text}`);
    });

  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export function hasCompleteAiAnnotationSet(
  annotations: ReplayAnnotation[],
  metadata: ReplayAnnotationCompletionMetadata
): boolean {
  if (metadata.aiAnnotationCount === null || metadata.aiAnnotationCount === undefined) return false;
  if (!metadata.aiAnnotationChecksum) return false;

  const aiAnnotations = annotations.filter((annotation) => !annotation.isManual);
  if (metadata.aiAnnotationCount !== aiAnnotations.length) return false;
  if (!aiAnnotations.every(isValidAnnotation)) return false;

  return createReplayAnnotationChecksum(aiAnnotations) === metadata.aiAnnotationChecksum;
}
```

- [ ] **Step 4: Run helper tests and existing property tests**

Run:

```bash
npx vitest run tests/telefun/replay-annotation-completeness.test.ts tests/telefun-realistic/replayAnnotator.property.test.ts
```

Expected result: pass. This also confirms the new `node:crypto` import does not break the existing helper imports in Vitest.

- [ ] **Step 5: Commit helper tests and helper implementation**

```bash
git add app/actions/replayAnnotationHelpers.ts tests/telefun/replay-annotation-completeness.test.ts
git commit -m "test: cover Telefun replay annotation completeness metadata"
```

---

### Task 2: Add Completion Metadata Migration

**Files:**
- Create: `supabase/migrations/20260517000001_add_telefun_replay_completion_metadata.sql`
- Create: `supabase/rollback/20260517000001_add_telefun_replay_completion_metadata.down.sql`
- Modify: `tests/supabase/telefun-replay-migrations-contracts.test.ts`

- [ ] **Step 1: Add failing migration contract tests**

Patch `tests/supabase/telefun-replay-migrations-contracts.test.ts`:

```ts
const COMPLETION_METADATA_MIGRATION_PATH =
  'supabase/migrations/20260517000001_add_telefun_replay_completion_metadata.sql';
const COMPLETION_METADATA_ROLLBACK_PATH =
  'supabase/rollback/20260517000001_add_telefun_replay_completion_metadata.down.sql';
```

Add:

```ts
it('completion metadata migration adds replay annotation metadata columns', () => {
  const sql = readFileSync(COMPLETION_METADATA_MIGRATION_PATH, 'utf8');

  expect(sql).toContain('ADD COLUMN IF NOT EXISTS ai_annotation_count');
  expect(sql).toContain('ADD COLUMN IF NOT EXISTS ai_annotation_checksum');
  expect(sql).toContain('ADD COLUMN IF NOT EXISTS ai_annotation_completed_at');
  expect(sql).toContain('DROP FUNCTION IF EXISTS public.upsert_telefun_coaching_summary(UUID, JSONB);');
  expect(sql).toContain('p_ai_annotation_count INTEGER DEFAULT NULL');
  expect(sql).toContain('p_ai_annotation_checksum TEXT DEFAULT NULL');
  expect(sql).toContain('ai_annotation_count = EXCLUDED.ai_annotation_count');
  expect(sql).toContain(
    'GRANT EXECUTE ON FUNCTION public.upsert_telefun_coaching_summary(UUID, JSONB, INTEGER, TEXT) TO authenticated, service_role;'
  );
});

it('completion metadata rollback restores the previous RPC signature', () => {
  const sql = readFileSync(COMPLETION_METADATA_ROLLBACK_PATH, 'utf8');

  expect(sql).toContain('DROP FUNCTION IF EXISTS public.upsert_telefun_coaching_summary(UUID, JSONB, INTEGER, TEXT);');
  expect(sql).toContain('CREATE OR REPLACE FUNCTION public.upsert_telefun_coaching_summary(');
  expect(sql).toContain('p_recommendations JSONB');
  expect(sql).toContain('DROP COLUMN IF EXISTS ai_annotation_count');
  expect(sql).toContain(
    'GRANT EXECUTE ON FUNCTION public.upsert_telefun_coaching_summary(UUID, JSONB) TO authenticated, service_role;'
  );
});
```

- [ ] **Step 2: Run migration contract tests and confirm they fail**

Run:

```bash
npx vitest run tests/supabase/telefun-replay-migrations-contracts.test.ts
```

Expected result: fail because the new migration and rollback files do not exist yet.

- [ ] **Step 3: Create the forward migration**

Create `supabase/migrations/20260517000001_add_telefun_replay_completion_metadata.sql`:

```sql
-- Add durable completion metadata for Telefun replay AI annotations.
-- Existing rows remain NULL so legacy or repaired partial sets must regenerate
-- before they are treated as a complete AI cache.

ALTER TABLE telefun_coaching_summary
  ADD COLUMN IF NOT EXISTS ai_annotation_count INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ai_annotation_checksum TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ai_annotation_completed_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE telefun_coaching_summary
  DROP CONSTRAINT IF EXISTS telefun_coaching_summary_ai_annotation_count_check,
  DROP CONSTRAINT IF EXISTS telefun_coaching_summary_ai_annotation_checksum_check;

ALTER TABLE telefun_coaching_summary
  ADD CONSTRAINT telefun_coaching_summary_ai_annotation_count_check
    CHECK (ai_annotation_count IS NULL OR ai_annotation_count >= 0),
  ADD CONSTRAINT telefun_coaching_summary_ai_annotation_checksum_check
    CHECK (ai_annotation_checksum IS NULL OR ai_annotation_checksum ~ '^[a-f0-9]{64}$');

DROP FUNCTION IF EXISTS public.upsert_telefun_coaching_summary(UUID, JSONB);

CREATE OR REPLACE FUNCTION public.upsert_telefun_coaching_summary(
  p_session_id UUID,
  p_recommendations JSONB,
  p_ai_annotation_count INTEGER DEFAULT NULL,
  p_ai_annotation_checksum TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_session_owner UUID;
  v_summary_id UUID;
  v_rec JSONB;
  v_priority NUMERIC;
BEGIN
  IF auth.role() = 'anon' THEN
    RAISE EXCEPTION 'Access denied: Anonymous users cannot upsert coaching summaries.';
  END IF;

  IF auth.role() = 'service_role' THEN
    SELECT user_id INTO v_user_id FROM telefun_history WHERE id = p_session_id;
  ELSE
    v_user_id := auth.uid();
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Cannot resolve user_id for this session.';
  END IF;

  SELECT user_id INTO v_session_owner
  FROM telefun_history
  WHERE id = p_session_id;

  IF v_session_owner IS NULL THEN
    RAISE EXCEPTION 'Session not found: %', p_session_id;
  END IF;

  IF auth.role() <> 'service_role' THEN
    IF v_session_owner <> v_user_id THEN
      RAISE EXCEPTION 'Access denied: You do not own this session.';
    END IF;
  END IF;

  IF p_recommendations IS NULL OR jsonb_typeof(p_recommendations) <> 'array' THEN
    RAISE EXCEPTION 'Invalid input: recommendations must be a non-null JSON array.';
  END IF;

  IF jsonb_array_length(p_recommendations) > 5 THEN
    RAISE EXCEPTION 'Invalid input: recommendations must contain at most 5 items.';
  END IF;

  FOR v_rec IN SELECT value FROM jsonb_array_elements(p_recommendations) LOOP
    IF jsonb_typeof(v_rec) <> 'object' THEN
      RAISE EXCEPTION 'Invalid recommendation: each item must be a JSON object.';
    END IF;

    IF (SELECT count(*) FROM jsonb_object_keys(v_rec) k WHERE k NOT IN ('text', 'priority')) > 0 THEN
      RAISE EXCEPTION 'Invalid recommendation: object keys must only be "text" and "priority".';
    END IF;

    IF NOT (v_rec ? 'text') OR jsonb_typeof(v_rec->'text') <> 'string' THEN
      RAISE EXCEPTION 'Invalid recommendation: "text" field is required and must be a string.';
    END IF;

    IF btrim(v_rec->>'text') = '' THEN
      RAISE EXCEPTION 'Invalid recommendation: "text" field cannot be empty or whitespace only.';
    END IF;

    IF length(v_rec->>'text') > 200 THEN
      RAISE EXCEPTION 'Invalid recommendation: "text" field must not exceed 200 characters.';
    END IF;

    IF NOT (v_rec ? 'priority') OR jsonb_typeof(v_rec->'priority') <> 'number' THEN
      RAISE EXCEPTION 'Invalid recommendation: "priority" field is required and must be a number.';
    END IF;

    v_priority := (v_rec->>'priority')::numeric;
    IF v_priority <> floor(v_priority) THEN
      RAISE EXCEPTION 'Invalid recommendation: "priority" must be an integer.';
    END IF;

    IF v_priority < 1 OR v_priority > 5 THEN
      RAISE EXCEPTION 'Invalid recommendation: "priority" must be between 1 and 5.';
    END IF;
  END LOOP;

  IF (p_ai_annotation_count IS NULL) <> (p_ai_annotation_checksum IS NULL) THEN
    RAISE EXCEPTION 'Invalid input: annotation count and checksum must be provided together.';
  END IF;

  IF p_ai_annotation_count IS NOT NULL AND p_ai_annotation_count < 0 THEN
    RAISE EXCEPTION 'Invalid input: annotation count must not be negative.';
  END IF;

  IF p_ai_annotation_checksum IS NOT NULL AND p_ai_annotation_checksum !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid input: annotation checksum must be a lowercase SHA-256 hex digest.';
  END IF;

  INSERT INTO telefun_coaching_summary (
    session_id,
    user_id,
    recommendations,
    generated_at,
    ai_annotation_count,
    ai_annotation_checksum,
    ai_annotation_completed_at
  )
  VALUES (
    p_session_id,
    v_user_id,
    p_recommendations,
    now(),
    p_ai_annotation_count,
    p_ai_annotation_checksum,
    CASE WHEN p_ai_annotation_count IS NULL THEN NULL ELSE now() END
  )
  ON CONFLICT (session_id)
  DO UPDATE SET
    recommendations = EXCLUDED.recommendations,
    generated_at = EXCLUDED.generated_at,
    ai_annotation_count = EXCLUDED.ai_annotation_count,
    ai_annotation_checksum = EXCLUDED.ai_annotation_checksum,
    ai_annotation_completed_at = EXCLUDED.ai_annotation_completed_at
  RETURNING id INTO v_summary_id;

  RETURN v_summary_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_telefun_coaching_summary(UUID, JSONB, INTEGER, TEXT) TO authenticated, service_role;

COMMENT ON COLUMN telefun_coaching_summary.ai_annotation_count IS 'Number of non-manual Telefun replay annotations persisted for the completed AI generation batch.';
COMMENT ON COLUMN telefun_coaching_summary.ai_annotation_checksum IS 'SHA-256 checksum of sorted non-manual Telefun replay annotation content for cache completeness checks.';
COMMENT ON COLUMN telefun_coaching_summary.ai_annotation_completed_at IS 'Timestamp when the AI replay annotation set was durably paired with this coaching summary.';
```

- [ ] **Step 4: Create the rollback migration**

Create `supabase/rollback/20260517000001_add_telefun_replay_completion_metadata.down.sql`:

```sql
-- Rollback: remove Telefun replay annotation completion metadata and restore the previous RPC signature.

DROP FUNCTION IF EXISTS public.upsert_telefun_coaching_summary(UUID, JSONB, INTEGER, TEXT);

CREATE OR REPLACE FUNCTION public.upsert_telefun_coaching_summary(
  p_session_id UUID,
  p_recommendations JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_session_owner UUID;
  v_summary_id UUID;
  v_rec JSONB;
  v_priority NUMERIC;
BEGIN
  IF auth.role() = 'anon' THEN
    RAISE EXCEPTION 'Access denied: Anonymous users cannot upsert coaching summaries.';
  END IF;

  IF auth.role() = 'service_role' THEN
    SELECT user_id INTO v_user_id FROM telefun_history WHERE id = p_session_id;
  ELSE
    v_user_id := auth.uid();
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Cannot resolve user_id for this session.';
  END IF;

  SELECT user_id INTO v_session_owner
  FROM telefun_history
  WHERE id = p_session_id;

  IF v_session_owner IS NULL THEN
    RAISE EXCEPTION 'Session not found: %', p_session_id;
  END IF;

  IF auth.role() <> 'service_role' THEN
    IF v_session_owner <> v_user_id THEN
      RAISE EXCEPTION 'Access denied: You do not own this session.';
    END IF;
  END IF;

  IF p_recommendations IS NULL OR jsonb_typeof(p_recommendations) <> 'array' THEN
    RAISE EXCEPTION 'Invalid input: recommendations must be a non-null JSON array.';
  END IF;

  IF jsonb_array_length(p_recommendations) > 5 THEN
    RAISE EXCEPTION 'Invalid input: recommendations must contain at most 5 items.';
  END IF;

  FOR v_rec IN SELECT value FROM jsonb_array_elements(p_recommendations) LOOP
    IF jsonb_typeof(v_rec) <> 'object' THEN
      RAISE EXCEPTION 'Invalid recommendation: each item must be a JSON object.';
    END IF;

    IF (SELECT count(*) FROM jsonb_object_keys(v_rec) k WHERE k NOT IN ('text', 'priority')) > 0 THEN
      RAISE EXCEPTION 'Invalid recommendation: object keys must only be "text" and "priority".';
    END IF;

    IF NOT (v_rec ? 'text') OR jsonb_typeof(v_rec->'text') <> 'string' THEN
      RAISE EXCEPTION 'Invalid recommendation: "text" field is required and must be a string.';
    END IF;

    IF btrim(v_rec->>'text') = '' THEN
      RAISE EXCEPTION 'Invalid recommendation: "text" field cannot be empty or whitespace only.';
    END IF;

    IF length(v_rec->>'text') > 200 THEN
      RAISE EXCEPTION 'Invalid recommendation: "text" field must not exceed 200 characters.';
    END IF;

    IF NOT (v_rec ? 'priority') OR jsonb_typeof(v_rec->'priority') <> 'number' THEN
      RAISE EXCEPTION 'Invalid recommendation: "priority" field is required and must be a number.';
    END IF;

    v_priority := (v_rec->>'priority')::numeric;
    IF v_priority <> floor(v_priority) THEN
      RAISE EXCEPTION 'Invalid recommendation: "priority" must be an integer.';
    END IF;

    IF v_priority < 1 OR v_priority > 5 THEN
      RAISE EXCEPTION 'Invalid recommendation: "priority" must be between 1 and 5.';
    END IF;
  END LOOP;

  INSERT INTO telefun_coaching_summary (session_id, user_id, recommendations, generated_at)
  VALUES (p_session_id, v_user_id, p_recommendations, now())
  ON CONFLICT (session_id)
  DO UPDATE SET
    recommendations = EXCLUDED.recommendations,
    generated_at = EXCLUDED.generated_at
  RETURNING id INTO v_summary_id;

  RETURN v_summary_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_telefun_coaching_summary(UUID, JSONB) TO authenticated, service_role;

ALTER TABLE telefun_coaching_summary
  DROP CONSTRAINT IF EXISTS telefun_coaching_summary_ai_annotation_count_check,
  DROP CONSTRAINT IF EXISTS telefun_coaching_summary_ai_annotation_checksum_check,
  DROP COLUMN IF EXISTS ai_annotation_count,
  DROP COLUMN IF EXISTS ai_annotation_checksum,
  DROP COLUMN IF EXISTS ai_annotation_completed_at;
```

- [ ] **Step 5: Run migration contract tests**

Run:

```bash
npx vitest run tests/supabase/telefun-replay-migrations-contracts.test.ts
```

Expected result: pass.

- [ ] **Step 6: Commit migration and migration tests**

```bash
git add supabase/migrations/20260517000001_add_telefun_replay_completion_metadata.sql supabase/rollback/20260517000001_add_telefun_replay_completion_metadata.down.sql tests/supabase/telefun-replay-migrations-contracts.test.ts
git commit -m "fix: add Telefun replay completion metadata migration"
```

---

### Task 3: Update Server Action Cache Completeness Logic

**Files:**
- Modify: `app/actions/replayAnnotation.ts`
- Modify: `tests/telefun/replay-annotation-persistence.test.ts`

- [ ] **Step 1: Add failing action tests**

Extend the fake Supabase client in `tests/telefun/replay-annotation-persistence.test.ts`:

```ts
function createAdminClient(options: {
  sessionRow: Record<string, unknown>;
  existingAnnotations: Array<Record<string, unknown>>;
  existingSummary:
    | {
        id: string;
        recommendations: Array<{ text: string; priority: number }>;
        ai_annotation_count?: number | null;
        ai_annotation_checksum?: string | null;
      }
    | null;
  annotationsSelectError?: unknown;
  summarySelectError?: unknown;
  downloadResult?: QueryResult;
  insertResult?: QueryResult;
  deleteResult?: QueryResult;
  rpcResult?: QueryResult;
}) {
  const insert = vi.fn().mockResolvedValue(options.insertResult ?? { data: null, error: null });
  const deleteRows = vi.fn(() => ({
    eq() {
      return {
        eq() {
          return {
            eq() {
              return Promise.resolve(options.deleteResult ?? { data: null, error: null });
            },
          };
        },
      };
    },
  }));

  // Keep existing rpc, download, and from setup; add delete: deleteRows
}
```

Add imports:

```ts
import { createReplayAnnotationChecksum } from '@/app/actions/replayAnnotationHelpers';
```

Add these tests:

```ts
it('short-circuits only when persisted AI annotation metadata matches current rows', async () => {
  const existingAnnotations = [
    {
      id: 'ann-1',
      timestamp_ms: 500,
      category: 'strength',
      moment: 'good_de_escalation',
      text: 'Persisted AI annotation',
      is_manual: false,
    },
  ];
  const checksum = createReplayAnnotationChecksum([
    {
      id: 'ann-1',
      timestampMs: 500,
      category: 'strength',
      moment: 'good_de_escalation',
      text: 'Persisted AI annotation',
      isManual: false,
    },
  ]);
  const { admin, spies } = createAdminClient({
    sessionRow: {
      id: 'session-1',
      user_id: 'user-1',
      scenario_title: 'Test scenario',
      recording_path: 'telefun-recordings/user-1/session-1/full_call.webm',
      session_metrics: null,
    },
    existingAnnotations,
    existingSummary: {
      id: 'summary-1',
      recommendations: [{ text: 'Persisted recommendation', priority: 1 }],
      ai_annotation_count: 1,
      ai_annotation_checksum: checksum,
    },
  });
  createAdminClientMock.mockReturnValue(admin);

  const result = await generateReplayAnnotations('session-1');

  expect(result.success).toBe(true);
  expect(result.result?.annotations).toHaveLength(1);
  expect(spies.download).not.toHaveBeenCalled();
  expect(spies.insert).not.toHaveBeenCalled();
  expect(spies.deleteRows).not.toHaveBeenCalled();
  expect(spies.rpc).not.toHaveBeenCalled();
});

it('regenerates and replaces stale persisted AI rows when completion metadata is missing', async () => {
  const existingAnnotations = [
    {
      id: 'manual-1',
      timestamp_ms: 300,
      category: 'strength',
      moment: 'good_de_escalation',
      text: 'Manual trainer note',
      is_manual: true,
    },
    {
      id: 'stale-ai-1',
      timestamp_ms: 500,
      category: 'strength',
      moment: 'good_de_escalation',
      text: 'Partial stale AI annotation',
      is_manual: false,
    },
  ];
  const { admin, spies } = createAdminClient({
    sessionRow: {
      id: 'session-1',
      user_id: 'user-1',
      scenario_title: 'Test scenario',
      recording_path: 'telefun-recordings/user-1/session-1/full_call.webm',
      session_metrics: null,
    },
    existingAnnotations,
    existingSummary: {
      id: 'summary-1',
      recommendations: [{ text: 'Old recommendation', priority: 2 }],
      ai_annotation_count: null,
      ai_annotation_checksum: null,
    },
  });
  createAdminClientMock.mockReturnValue(admin);
  generateGeminiContentMock.mockResolvedValue({
    success: true,
    text: JSON.stringify({
      annotations: [
        {
          timestampMs: 1200,
          category: 'critical_moment',
          moment: 'interruption',
          text: 'Fresh regenerated AI annotation',
        },
      ],
      recommendations: [{ text: 'Fresh recommendation', priority: 1 }],
    }),
  });

  const result = await generateReplayAnnotations('session-1');

  expect(result.success).toBe(true);
  expect(result.result?.annotations).toEqual([
    {
      id: 'manual-1',
      timestampMs: 300,
      category: 'strength',
      moment: 'good_de_escalation',
      text: 'Manual trainer note',
      isManual: true,
    },
    {
      id: expect.any(String),
      timestampMs: 1200,
      category: 'critical_moment',
      moment: 'interruption',
      text: 'Fresh regenerated AI annotation',
      isManual: false,
    },
  ]);
  expect(spies.download).toHaveBeenCalledTimes(1);
  expect(spies.deleteRows).toHaveBeenCalledTimes(1);
  expect(spies.insert).toHaveBeenCalledTimes(1);
  expect(spies.rpc).toHaveBeenCalledWith('upsert_telefun_coaching_summary', {
    p_session_id: 'session-1',
    p_recommendations: [{ text: 'Fresh recommendation', priority: 1 }],
    p_ai_annotation_count: 1,
    p_ai_annotation_checksum: expect.stringMatching(/^[a-f0-9]{64}$/),
  });
});

it('returns partial failure without marking metadata complete when stale AI delete fails', async () => {
  const { admin, spies } = createAdminClient({
    sessionRow: {
      id: 'session-1',
      user_id: 'user-1',
      scenario_title: 'Test scenario',
      recording_path: 'telefun-recordings/user-1/session-1/full_call.webm',
      session_metrics: null,
    },
    existingAnnotations: [
      {
        id: 'stale-ai-1',
        timestamp_ms: 500,
        category: 'strength',
        moment: 'good_de_escalation',
        text: 'Partial stale AI annotation',
        is_manual: false,
      },
    ],
    existingSummary: {
      id: 'summary-1',
      recommendations: [{ text: 'Old recommendation', priority: 2 }],
      ai_annotation_count: null,
      ai_annotation_checksum: null,
    },
    deleteResult: { data: null, error: new Error('Delete failed') },
  });
  createAdminClientMock.mockReturnValue(admin);
  generateGeminiContentMock.mockResolvedValue({
    success: true,
    text: JSON.stringify({
      annotations: [
        {
          timestampMs: 1200,
          category: 'critical_moment',
          moment: 'interruption',
          text: 'Fresh regenerated AI annotation',
        },
      ],
      recommendations: [{ text: 'Fresh recommendation', priority: 1 }],
    }),
  });

  const result = await generateReplayAnnotations('session-1');

  expect(result.success).toBe(false);
  expect(result.error).toBe('Sebagian hasil analisis gagal disimpan. Silakan coba lagi.');
  expect(spies.insert).not.toHaveBeenCalled();
  expect(spies.rpc).toHaveBeenCalledWith('upsert_telefun_coaching_summary', {
    p_session_id: 'session-1',
    p_recommendations: [{ text: 'Fresh recommendation', priority: 1 }],
    p_ai_annotation_count: null,
    p_ai_annotation_checksum: null,
  });
});
```

- [ ] **Step 2: Run action tests and confirm they fail**

Run:

```bash
npx vitest run tests/telefun/replay-annotation-persistence.test.ts
```

Expected result: fail because the action still short-circuits on `aiAnnotations.length > 0` and the mock does not yet support delete.

- [ ] **Step 3: Patch `generateReplayAnnotations` persisted summary mapping**

In `app/actions/replayAnnotation.ts`, extend the summary select:

```ts
.select('id, recommendations, ai_annotation_count, ai_annotation_checksum')
```

Then derive:

```ts
const replayCompletionMetadata = {
  aiAnnotationCount:
    typeof existingSummary?.ai_annotation_count === 'number' ? existingSummary.ai_annotation_count : null,
  aiAnnotationChecksum:
    typeof existingSummary?.ai_annotation_checksum === 'string' ? existingSummary.ai_annotation_checksum : null,
};
const hasCompletePersistedAIAnnotations =
  hasPersistedSummary && hasCompleteAiAnnotationSet(allPersistedAnnotations, replayCompletionMetadata);
const hasAnyPersistedData = allPersistedAnnotations.length > 0 || hasPersistedSummary;
```

Replace the old short-circuit:

```ts
if (hasCompletePersistedAIAnnotations) {
  return { success: true, result: { annotations: allPersistedAnnotations, summary: persistedSummary } };
}
```

- [ ] **Step 4: Patch regeneration persistence**

Import the new helpers:

```ts
  createReplayAnnotationChecksum,
  hasCompleteAiAnnotationSet,
```

Replace this logic:

```ts
const finalAnnotations = hasPersistedAIAnnotations
  ? [...manualAnnotations, ...aiAnnotations]
  : [...manualAnnotations, ...truncatedAnnotations];
const finalSummary = hasPersistedSummary ? persistedSummary : constrainedRecommendations;
```

With:

```ts
const finalAnnotations = [...manualAnnotations, ...truncatedAnnotations];
const finalSummary = constrainedRecommendations;
const aiCompletionChecksum = createReplayAnnotationChecksum(truncatedAnnotations);
let aiPersistenceComplete = false;
let persistenceFailed = false;
```

Before inserting regenerated rows, delete stale non-manual rows when they exist:

```ts
if (aiAnnotations.length > 0) {
  const { error: deleteError } = await admin
    .from('telefun_replay_annotations')
    .delete()
    .eq('session_id', sessionId)
    .eq('user_id', user.id)
    .eq('is_manual', false);

  if (deleteError) {
    console.warn('[ReplayAnnotator] Failed to delete stale AI annotations:', deleteError);
    persistenceFailed = true;
  }
}
```

Only insert the new generated rows if stale delete did not fail:

```ts
if (!persistenceFailed && truncatedAnnotations.length > 0) {
  const annotationRows = truncatedAnnotations.map((ann) => ({
    session_id: sessionId,
    user_id: user.id,
    timestamp_ms: ann.timestampMs,
    category: ann.category,
    moment: ann.moment,
    text: ann.text,
    is_manual: false,
  }));

  const { error: insertError } = await admin
    .from('telefun_replay_annotations')
    .insert(annotationRows);

  if (insertError) {
    console.warn('[ReplayAnnotator] Failed to persist annotations:', insertError);
    persistenceFailed = true;
  } else {
    aiPersistenceComplete = true;
  }
} else if (!persistenceFailed && truncatedAnnotations.length === 0) {
  aiPersistenceComplete = true;
}
```

Call the RPC on every regeneration path and pass metadata only when the AI row set is durable:

```ts
const { error: rpcError } = await admin.rpc('upsert_telefun_coaching_summary', {
  p_session_id: sessionId,
  p_recommendations: constrainedRecommendations,
  p_ai_annotation_count: aiPersistenceComplete ? truncatedAnnotations.length : null,
  p_ai_annotation_checksum: aiPersistenceComplete ? aiCompletionChecksum : null,
});
```

- [ ] **Step 5: Run action tests**

Run:

```bash
npx vitest run tests/telefun/replay-annotation-persistence.test.ts tests/telefun/replay-annotation-completeness.test.ts
```

Expected result: pass.

- [ ] **Step 6: Commit action changes**

```bash
git add app/actions/replayAnnotation.ts app/actions/replayAnnotationHelpers.ts tests/telefun/replay-annotation-persistence.test.ts tests/telefun/replay-annotation-completeness.test.ts
git commit -m "fix: require Telefun replay completion metadata"
```

---

### Task 4: Update Documentation

**Files:**
- Modify: `docs/TELEFUN_REPLAY_RETRY_TRANSCRIPTION_FIXES_CHANGELOG_2026-05-16.md`
- Modify: `docs/TELEFUN_OPERATIONAL_RUNBOOK.md`

- [ ] **Step 1: Update changelog known issue**

In `docs/TELEFUN_REPLAY_RETRY_TRANSCRIPTION_FIXES_CHANGELOG_2026-05-16.md`, move this known issue out of the unresolved list:

```md
- **AI annotation completeness heuristic:** `aiAnnotations.length > 0` = dianggap lengkap. Risk: partial corruption, forged row (sekarang sudah dicegah oleh fix RLS di atas), atau repaired DB bisa membuat set parsial tidak pernah diregenerasi.
```

Add a new section before `Known Issues`:

```md
## Follow-up Fixes (AI Annotation Completeness)

### 9. Replay annotations - cache AI tidak lagi dianggap lengkap hanya karena ada 1 row
- **Bug:** `generateReplayAnnotations()` sebelumnya menganggap cache AI lengkap ketika ada minimal satu row non-manual. Jika database pernah partial-apply, row AI terhapus sebagian, atau repair meninggalkan set parsial, replay tidak akan regenerasi walau datanya tidak lengkap.
- **Fix:** `telefun_coaching_summary` sekarang menyimpan metadata `ai_annotation_count`, `ai_annotation_checksum`, dan `ai_annotation_completed_at`. Action hanya short-circuit ketika metadata itu cocok dengan row AI non-manual saat ini. Jika tidak cocok, action regenerasi dari rekaman, mempertahankan anotasi manual, mengganti row AI lama, lalu menyimpan metadata baru.
- **Test:** `tests/telefun/replay-annotation-completeness.test.ts`, `tests/telefun/replay-annotation-persistence.test.ts`, dan `tests/supabase/telefun-replay-migrations-contracts.test.ts`.
```

- [ ] **Step 2: Update unresolved known issues list**

Keep the remaining unresolved items:

```md
- **Live migration matrix:** Belum dijalankan karena butuh akses Docker/Postgres. Hanya terverifikasi melalui static contract test string.
- **DELETE grant ke authenticated:** Client bisa hapus AI-generated annotations langsung via API tanpa guard - hanya pemeriksaan `user_id`.
- **Ordering replay result:** Action return annotations dalam urutan insertion, bukan timestamp. UI timeline sudah sort sendiri, jadi tidak ada bug visual, tapi API contract tidak eksplisit.
- **Tidak ada integrasi test untuk `ReviewModal` + `VoiceEvaluationDashboard`:** Test hanya unit-level untuk fungsi helper dan render static markup. Transient notice -> error retry belum diuji di level komponen penuh dengan mock server.
```

- [ ] **Step 3: Add operational runbook note**

In `docs/TELEFUN_OPERATIONAL_RUNBOOK.md`, after the `Review Modal` paragraph, add:

```md
### Replay Annotation Cache Integrity

Replay AI cache tidak hanya dilihat dari jumlah row anotasi. `telefun_coaching_summary` menyimpan metadata `ai_annotation_count`, `ai_annotation_checksum`, dan `ai_annotation_completed_at`. Saat tab Replay dibuka, action hanya memakai cache jika metadata tersebut cocok dengan row `telefun_replay_annotations` non-manual untuk sesi yang sama.

Jika metadata kosong atau tidak cocok, sistem akan mencoba regenerasi dari `full_call.webm`, mempertahankan anotasi manual trainer, mengganti row AI lama, dan menyimpan checksum baru. Jika rekaman tidak tersedia atau proses AI gagal, UI tetap boleh menampilkan data parsial dengan status error agar trainer bisa retry.
```

- [ ] **Step 4: Commit docs**

```bash
git add docs/TELEFUN_REPLAY_RETRY_TRANSCRIPTION_FIXES_CHANGELOG_2026-05-16.md docs/TELEFUN_OPERATIONAL_RUNBOOK.md
git commit -m "docs: record Telefun replay cache integrity fix"
```

---

### Task 5: Full Verification

**Files:**
- Read-only verification across touched files.

- [ ] **Step 1: Run targeted Telefun replay tests**

```bash
npx vitest run tests/telefun/replay-annotation-completeness.test.ts tests/telefun/replay-annotation-persistence.test.ts
```

Expected result: pass.

- [ ] **Step 2: Run migration contract tests**

```bash
npx vitest run tests/supabase/telefun-replay-migrations-contracts.test.ts
```

Expected result: pass.

- [ ] **Step 3: Run broader Telefun/Supabase suites used by the changelog**

```bash
npx vitest run tests/telefun tests/telefun-realistic tests/supabase
```

Expected result: pass.

- [ ] **Step 4: Run lint and build-level type check**

```bash
npm run lint
npm run type-check
```

Expected result: lint has 0 errors and type-check build succeeds. Existing warnings may remain if they are unrelated.

- [ ] **Step 5: Check patch hygiene**

```bash
git diff --check
git status --short
```

Expected result: no whitespace errors. `git status --short` should show only intentional files until they are committed.

---

## Acceptance Criteria

- Cached AI replay data short-circuits only when:
  - coaching summary exists,
  - `ai_annotation_count` is non-null,
  - `ai_annotation_checksum` is a valid checksum,
  - current non-manual annotation count equals the stored count,
  - checksum of current non-manual annotation content equals stored checksum.
- Missing metadata, count mismatch, checksum mismatch, or stale legacy rows trigger regeneration when recording is available.
- Manual annotations are preserved during regeneration.
- Stale AI annotations are deleted before regenerated AI annotations are inserted.
- If stale AI deletion or regenerated AI insertion fails, the action returns `success: false` with partial generated data and does not mark metadata complete.
- A valid zero-annotation AI result can be marked complete through count `0` and checksum of an empty non-manual set.
- Existing separate known issues remain visibly unresolved unless fixed in a separate patch.

## Final Commit Shape

Use separate commits if executing task-by-task:

```text
test: cover Telefun replay annotation completeness metadata
fix: add Telefun replay completion metadata migration
fix: require Telefun replay completion metadata
docs: record Telefun replay cache integrity fix
```

Use one squash commit if the user asks for a single commit:

```text
fix: harden Telefun replay annotation cache completeness
```
