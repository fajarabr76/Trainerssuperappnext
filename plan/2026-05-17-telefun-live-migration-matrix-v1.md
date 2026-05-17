# Telefun Live Migration Matrix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the known issue in `docs/TELEFUN_REPLAY_RETRY_TRANSCRIPTION_FIXES_CHANGELOG_2026-05-16.md` by adding a repeatable live Postgres migration matrix for Telefun replay support migrations.

**Architecture:** Keep the production migrations unchanged unless the matrix exposes a real failure. Add a local-only harness that resets Supabase, simulates legacy partial-apply states caused by the old duplicate `20260516000000` migrations, reapplies the repair/follow-up SQL with `psql`, and validates the final schema/RLS/RPC contract against a real Postgres engine.

**Tech Stack:** Supabase CLI, local Docker/Postgres, `psql`, Node.js `child_process`, Postgres PL/pgSQL assertions, Vitest static contract tests.

---

## Current Evidence

- The changelog known issue says: **Live migration matrix** has not been run because it needs Docker/Postgres and is only covered by static contract string tests.
- Current static coverage lives in `tests/supabase/telefun-replay-migrations-contracts.test.ts`.
- The replay migration chain now includes:
  - `supabase/migrations/20260516000000_create_telefun_replay_support.sql`
  - `supabase/migrations/20260516000001_telefun_replay_rls_repair.sql`
  - `supabase/migrations/20260517000000_enforce_telefun_coaching_summary_shape.sql`
  - `supabase/migrations/20260517000001_add_telefun_replay_completion_metadata.sql`
  - `supabase/migrations/20260517000002_restrict_telefun_replay_annotation_delete.sql`
- The risky state is not the happy-path app code. It is whether a real database that partially received the old duplicate timestamp migrations can safely converge after the repair and follow-up migrations.

## Matrix Coverage

| Scenario | Setup | Must prove |
|---|---|---|
| `fresh-full-chain` | `supabase db reset --debug` only | Full tracked migration chain applies cleanly from an empty local database. |
| `missing-all-replay-support` | Remove Telefun replay tables/functions/columns after reset | Repair migration can recreate the entire replay support surface. |
| `coaching-summary-only` | Leave only legacy `telefun_coaching_summary` and old 2-arg RPC | Repair/follow-ups add annotations, history columns, strict validation, metadata, and final RPC signature. |
| `annotations-only-with-delete` | Leave only legacy `telefun_replay_annotations` with client DELETE grant/policy | Repair/follow-ups preserve read/manual insert, then remove direct authenticated DELETE. |
| `realistic-columns-only` | Leave only the old realistic-mode columns on `telefun_history` | Repair/follow-ups create missing replay tables and add `session_duration_ms` without failing on existing columns. |
| `post-repair-pre-followups` | Apply `20260516000001` first, then replay it with all follow-ups | Later migrations are idempotent and converge from a database that already received the repair. |

## Non-Goals

- Do not change Telefun replay UI behavior in this plan.
- Do not add new npm dependencies.
- Do not connect to the remote Supabase project from the harness by default.
- Do not mutate production data. The matrix is local-only unless a future operator explicitly sets a separate database URL.
- Do not mark the changelog known issue fixed until the live matrix command has actually passed on a machine with Docker/Postgres.

## File Map

- Create: `scripts/verify-telefun-replay-migration-matrix.mjs`
  - Orchestrates Supabase reset, scenario setup, migration replay, and SQL assertions.
- Create: `supabase/tests/telefun_replay_live_matrix/reset_replay_support.sql`
  - Common cleanup that removes replay support objects after a local reset.
- Create: `supabase/tests/telefun_replay_live_matrix/assert_final_contract.sql`
  - Live Postgres assertions for tables, columns, RLS, grants, policies, and RPC signatures.
- Create: `supabase/tests/telefun_replay_live_matrix/scenario_coaching_summary_only.sql`
  - Legacy partial state where only coaching summary support exists.
- Create: `supabase/tests/telefun_replay_live_matrix/scenario_annotations_only_with_delete.sql`
  - Legacy partial state where replay annotations exist with owner DELETE.
- Create: `supabase/tests/telefun_replay_live_matrix/scenario_realistic_columns_only.sql`
  - Legacy partial state where only realistic-mode columns exist.
- Modify: `package.json`
  - Add `test:telefun:migration-matrix`.
- Modify: `tests/supabase/telefun-replay-migrations-contracts.test.ts`
  - Add a light static guard that the live matrix harness and assertion files exist.
- Modify after command passes: `docs/TELEFUN_REPLAY_RETRY_TRANSCRIPTION_FIXES_CHANGELOG_2026-05-16.md`
  - Move the known issue into a resolved verification note.
- Modify after command passes: `docs/SUPABASE_LOCAL_MIGRATION_RESET_RUNBOOK.md`
  - Add the Telefun replay matrix command and what it proves.
- Modify after command passes: `docs/README.md`
  - Mention the matrix under verification docs only if a new runbook section is added.

---

### Task 1: Add The Live Matrix Runner

**Files:**
- Modify: `package.json`
- Create: `scripts/verify-telefun-replay-migration-matrix.mjs`

- [x] **Step 1: Read current files before editing**

Run:

```bash
sed -n '1,220p' package.json
test -f scripts/verify-telefun-replay-migration-matrix.mjs && sed -n '1,260p' scripts/verify-telefun-replay-migration-matrix.mjs || true
```

Expected: `package.json` is readable. The script file should not exist yet unless another agent already started this plan.

- [x] **Step 2: Add npm script**

Patch `package.json` inside `"scripts"`:

```json
"test:telefun:migration-matrix": "node scripts/verify-telefun-replay-migration-matrix.mjs"
```

Place it near the other Telefun commands.

- [x] **Step 3: Create the runner script**

Create `scripts/verify-telefun-replay-migration-matrix.mjs`:

```js
#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const dbUrl =
  process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

const resetSql = 'supabase/tests/telefun_replay_live_matrix/reset_replay_support.sql';
const assertSql = 'supabase/tests/telefun_replay_live_matrix/assert_final_contract.sql';

const repairAndFollowupMigrations = [
  'supabase/migrations/20260516000001_telefun_replay_rls_repair.sql',
  'supabase/migrations/20260517000000_enforce_telefun_coaching_summary_shape.sql',
  'supabase/migrations/20260517000001_add_telefun_replay_completion_metadata.sql',
  'supabase/migrations/20260517000002_restrict_telefun_replay_annotation_delete.sql',
];

const scenarios = [
  { name: 'fresh-full-chain' },
  {
    name: 'missing-all-replay-support',
    resetReplaySupport: true,
  },
  {
    name: 'coaching-summary-only',
    resetReplaySupport: true,
    fixture: 'supabase/tests/telefun_replay_live_matrix/scenario_coaching_summary_only.sql',
  },
  {
    name: 'annotations-only-with-delete',
    resetReplaySupport: true,
    fixture: 'supabase/tests/telefun_replay_live_matrix/scenario_annotations_only_with_delete.sql',
  },
  {
    name: 'realistic-columns-only',
    resetReplaySupport: true,
    fixture: 'supabase/tests/telefun_replay_live_matrix/scenario_realistic_columns_only.sql',
  },
  {
    name: 'post-repair-pre-followups',
    resetReplaySupport: true,
    preMigrations: ['supabase/migrations/20260516000001_telefun_replay_rls_repair.sql'],
  },
];

function run(command, args) {
  console.log(`\n$ ${command} ${args.join(' ')}`);
  execFileSync(command, args, { stdio: 'inherit' });
}

function requireFile(path) {
  if (!existsSync(path)) {
    throw new Error(`Required matrix file is missing: ${path}`);
  }
}

function psqlFile(path) {
  requireFile(path);
  run('psql', [dbUrl, '-v', 'ON_ERROR_STOP=1', '-f', path]);
}

function resetLocalDatabase() {
  run('supabase', ['db', 'reset', '--debug']);
}

function applyRepairAndFollowups() {
  for (const migration of repairAndFollowupMigrations) {
    psqlFile(migration);
  }
}

for (const scenario of scenarios) {
  console.log(`\n=== Telefun replay live migration matrix: ${scenario.name} ===`);
  resetLocalDatabase();

  if (scenario.resetReplaySupport) {
    psqlFile(resetSql);
  }

  if (scenario.fixture) {
    psqlFile(scenario.fixture);
  }

  if (scenario.preMigrations) {
    for (const migration of scenario.preMigrations) {
      psqlFile(migration);
    }
  }

  if (scenario.resetReplaySupport || scenario.fixture || scenario.preMigrations) {
    applyRepairAndFollowups();
  }

  psqlFile(assertSql);
}

console.log('\nTelefun replay live migration matrix passed.');
```

- [x] **Step 4: Run the script before fixtures exist and confirm the failure is clear**

Run:

```bash
npm run test:telefun:migration-matrix
```

Expected: fail on a missing `supabase/tests/telefun_replay_live_matrix/*.sql` file, not with a Node syntax error.

---

### Task 2: Add Common Cleanup And Final Assertions

**Files:**
- Create: `supabase/tests/telefun_replay_live_matrix/reset_replay_support.sql`
- Create: `supabase/tests/telefun_replay_live_matrix/assert_final_contract.sql`

- [x] **Step 1: Create the cleanup SQL**

Create `supabase/tests/telefun_replay_live_matrix/reset_replay_support.sql`:

```sql
\set ON_ERROR_STOP on

DROP FUNCTION IF EXISTS public.upsert_telefun_coaching_summary(UUID, JSONB, INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.upsert_telefun_coaching_summary(UUID, JSONB);

DROP TABLE IF EXISTS public.telefun_replay_annotations CASCADE;
DROP TABLE IF EXISTS public.telefun_coaching_summary CASCADE;

ALTER TABLE public.telefun_history
  DROP COLUMN IF EXISTS session_duration_ms,
  DROP COLUMN IF EXISTS voice_dashboard_metrics,
  DROP COLUMN IF EXISTS disruption_config,
  DROP COLUMN IF EXISTS disruption_results,
  DROP COLUMN IF EXISTS persona_config,
  DROP COLUMN IF EXISTS realistic_mode_enabled;
```

- [x] **Step 2: Create the final assertion SQL**

Create `supabase/tests/telefun_replay_live_matrix/assert_final_contract.sql`:

```sql
\set ON_ERROR_STOP on

CREATE OR REPLACE FUNCTION pg_temp.assert_true(condition boolean, message text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT condition THEN
    RAISE EXCEPTION '%', message;
  END IF;
END;
$$;

SELECT pg_temp.assert_true(
  to_regclass('public.telefun_coaching_summary') IS NOT NULL,
  'telefun_coaching_summary must exist'
);

SELECT pg_temp.assert_true(
  to_regclass('public.telefun_replay_annotations') IS NOT NULL,
  'telefun_replay_annotations must exist'
);

SELECT pg_temp.assert_true(
  (
    SELECT count(*)
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'telefun_history'
      AND column_name IN (
        'session_duration_ms',
        'voice_dashboard_metrics',
        'disruption_config',
        'disruption_results',
        'persona_config',
        'realistic_mode_enabled'
      )
  ) = 6,
  'telefun_history must have all replay/realistic columns'
);

SELECT pg_temp.assert_true(
  (
    SELECT relrowsecurity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'telefun_replay_annotations'
  ),
  'telefun_replay_annotations must have RLS enabled'
);

SELECT pg_temp.assert_true(
  has_table_privilege('authenticated', 'public.telefun_replay_annotations', 'SELECT'),
  'authenticated must be able to SELECT owned replay annotations through RLS'
);

SELECT pg_temp.assert_true(
  has_table_privilege('authenticated', 'public.telefun_replay_annotations', 'INSERT'),
  'authenticated must be able to INSERT manual replay annotations through RLS'
);

SELECT pg_temp.assert_true(
  NOT has_table_privilege('authenticated', 'public.telefun_replay_annotations', 'DELETE'),
  'authenticated must not have direct DELETE on replay annotations'
);

SELECT pg_temp.assert_true(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'telefun_replay_annotations'
      AND policyname = 'Users can insert their own replay annotations'
      AND cmd = 'INSERT'
      AND with_check ILIKE '%is_manual = true%'
      AND with_check ILIKE '%telefun_history%'
  ),
  'replay annotation INSERT policy must require manual rows and session ownership'
);

SELECT pg_temp.assert_true(
  (
    SELECT count(*)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'upsert_telefun_coaching_summary'
      AND oidvectortypes(p.proargtypes) = 'uuid, jsonb, integer, text'
  ) = 1,
  'final upsert_telefun_coaching_summary(uuid,jsonb,integer,text) signature must exist exactly once'
);

SELECT pg_temp.assert_true(
  (
    SELECT count(*)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'upsert_telefun_coaching_summary'
      AND oidvectortypes(p.proargtypes) = 'uuid, jsonb'
  ) = 0,
  'legacy upsert_telefun_coaching_summary(uuid,jsonb) signature must be removed'
);

SELECT pg_temp.assert_true(
  has_function_privilege(
    'authenticated',
    'public.upsert_telefun_coaching_summary(uuid,jsonb,integer,text)',
    'EXECUTE'
  ),
  'authenticated must have EXECUTE on final coaching summary RPC'
);

SELECT pg_temp.assert_true(
  has_function_privilege(
    'service_role',
    'public.upsert_telefun_coaching_summary(uuid,jsonb,integer,text)',
    'EXECUTE'
  ),
  'service_role must have EXECUTE on final coaching summary RPC'
);

DO $$
BEGIN
  PERFORM public.upsert_telefun_coaching_summary(
    '00000000-0000-0000-0000-000000000001'::uuid,
    '[]'::jsonb,
    0,
    repeat('0', 64)
  );
  RAISE EXCEPTION 'RPC should reject a missing caller or session owner';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'Cannot resolve user_id%'
      AND SQLERRM NOT LIKE 'Session not found:%' THEN
      RAISE;
    END IF;
END;
$$;
```

- [x] **Step 3: Run the fresh-chain assertion only**

Run:

```bash
supabase db reset --debug
psql "${SUPABASE_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}" -v ON_ERROR_STOP=1 -f supabase/tests/telefun_replay_live_matrix/assert_final_contract.sql
```

Expected: pass on the current tracked full migration chain.

---

### Task 3: Add Legacy Partial-State Fixtures

**Files:**
- Create: `supabase/tests/telefun_replay_live_matrix/scenario_coaching_summary_only.sql`
- Create: `supabase/tests/telefun_replay_live_matrix/scenario_annotations_only_with_delete.sql`
- Create: `supabase/tests/telefun_replay_live_matrix/scenario_realistic_columns_only.sql`

- [x] **Step 1: Create coaching-summary-only fixture**

Create `supabase/tests/telefun_replay_live_matrix/scenario_coaching_summary_only.sql`:

```sql
\set ON_ERROR_STOP on

CREATE TABLE IF NOT EXISTS public.telefun_coaching_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL UNIQUE REFERENCES public.telefun_history(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recommendations JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.telefun_coaching_summary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own coaching summaries"
  ON public.telefun_coaching_summary;

CREATE POLICY "Users can view their own coaching summaries"
  ON public.telefun_coaching_summary
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

REVOKE ALL ON public.telefun_coaching_summary FROM anon, public;
GRANT SELECT ON public.telefun_coaching_summary TO authenticated;

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
  v_summary_id UUID;
BEGIN
  INSERT INTO public.telefun_coaching_summary (session_id, user_id, recommendations, generated_at)
  VALUES (p_session_id, auth.uid(), p_recommendations, now())
  ON CONFLICT (session_id)
  DO UPDATE SET
    recommendations = EXCLUDED.recommendations,
    generated_at = EXCLUDED.generated_at
  RETURNING id INTO v_summary_id;

  RETURN v_summary_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_telefun_coaching_summary(UUID, JSONB)
  TO authenticated, service_role;
```

- [x] **Step 2: Create annotations-only-with-delete fixture**

Create `supabase/tests/telefun_replay_live_matrix/scenario_annotations_only_with_delete.sql`:

```sql
\set ON_ERROR_STOP on

CREATE TABLE IF NOT EXISTS public.telefun_replay_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.telefun_history(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  timestamp_ms INTEGER NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('strength', 'improvement_area', 'critical_moment', 'technique_used')),
  moment TEXT NOT NULL,
  text TEXT NOT NULL CHECK (char_length(text) <= 500),
  is_manual BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.telefun_replay_annotations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own replay annotations"
  ON public.telefun_replay_annotations;
DROP POLICY IF EXISTS "Users can insert their own replay annotations"
  ON public.telefun_replay_annotations;
DROP POLICY IF EXISTS "Users can delete their own replay annotations"
  ON public.telefun_replay_annotations;

CREATE POLICY "Users can view their own replay annotations"
  ON public.telefun_replay_annotations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own replay annotations"
  ON public.telefun_replay_annotations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own replay annotations"
  ON public.telefun_replay_annotations
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

REVOKE ALL ON public.telefun_replay_annotations FROM anon, public;
GRANT SELECT, INSERT, DELETE ON public.telefun_replay_annotations TO authenticated;
```

- [x] **Step 3: Create realistic-columns-only fixture**

Create `supabase/tests/telefun_replay_live_matrix/scenario_realistic_columns_only.sql`:

```sql
\set ON_ERROR_STOP on

ALTER TABLE public.telefun_history
  ADD COLUMN IF NOT EXISTS voice_dashboard_metrics JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS disruption_config JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS disruption_results JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS persona_config JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS realistic_mode_enabled BOOLEAN NOT NULL DEFAULT FALSE;
```

- [x] **Step 4: Run the matrix**

Run:

```bash
npm run test:telefun:migration-matrix
```

Expected: all six scenarios pass and print `Telefun replay live migration matrix passed.`

---

### Task 4: Add Static Guardrails For The Harness

**Files:**
- Modify: `tests/supabase/telefun-replay-migrations-contracts.test.ts`

- [x] **Step 1: Add static file-existence assertions**

Patch the test file with a new test:

```ts
it('live migration matrix harness is tracked for Telefun replay repair states', () => {
  const files = [
    'scripts/verify-telefun-replay-migration-matrix.mjs',
    'supabase/tests/telefun_replay_live_matrix/reset_replay_support.sql',
    'supabase/tests/telefun_replay_live_matrix/assert_final_contract.sql',
    'supabase/tests/telefun_replay_live_matrix/scenario_coaching_summary_only.sql',
    'supabase/tests/telefun_replay_live_matrix/scenario_annotations_only_with_delete.sql',
    'supabase/tests/telefun_replay_live_matrix/scenario_realistic_columns_only.sql',
  ];

  for (const file of files) {
    expect(readFileSync(file, 'utf8').trim().length).toBeGreaterThan(0);
  }
});
```

- [x] **Step 2: Run focused static contract tests**

Run:

```bash
npx vitest run tests/supabase/telefun-replay-migrations-contracts.test.ts
```

Expected: pass.

---

### Task 5: Resolve Or Keep The Known Issue Based On Live Evidence

**Files:**
- Modify: `docs/TELEFUN_REPLAY_RETRY_TRANSCRIPTION_FIXES_CHANGELOG_2026-05-16.md`
- Modify: `docs/SUPABASE_LOCAL_MIGRATION_RESET_RUNBOOK.md`
- Optional modify: `docs/README.md`

- [x] **Step 1: If the matrix passes, update the changelog**

Replace the known issue bullet:

```md
- **Live migration matrix:** Belum dijalankan karena butuh akses Docker/Postgres. Hanya terverifikasi melalui static contract test string.
```

with:

```md
- **Live migration matrix:** Selesai diverifikasi via `npm run test:telefun:migration-matrix` pada local Supabase/Postgres. Matrix mencakup fresh full-chain reset, missing all replay support, coaching-summary-only, annotations-only-with-delete, realistic-columns-only, dan post-repair-pre-followups.
```

- [ ] **Step 2: If the matrix fails, keep the known issue and record the failing scenario**

If any scenario fails, do not mark it resolved. Update the known issue with the first failing scenario name from the matrix (`fresh-full-chain`, `missing-all-replay-support`, `coaching-summary-only`, `annotations-only-with-delete`, `realistic-columns-only`, or `post-repair-pre-followups`) and the first exact `psql`/Supabase error line.

- [x] **Step 3: Add the command to the Supabase reset runbook**

Add a short section to `docs/SUPABASE_LOCAL_MIGRATION_RESET_RUNBOOK.md`:

````md
## Telefun Replay Live Migration Matrix

Untuk perubahan migration Telefun replay, jalankan:

```bash
npm run test:telefun:migration-matrix
```

Command ini membutuhkan Docker, Supabase CLI, dan `psql`. Matrix memverifikasi bahwa migration repair Telefun replay dapat converge dari fresh database dan beberapa state partial-apply legacy.
````

- [x] **Step 4: Update docs index only if the runbook section is added**

If `docs/SUPABASE_LOCAL_MIGRATION_RESET_RUNBOOK.md` is updated, keep `docs/README.md` wording concise:

```md
- `docs/SUPABASE_LOCAL_MIGRATION_RESET_RUNBOOK.md`: Panduan reset migration Supabase lokal, kontrak baseline schema, dan Telefun replay live migration matrix.
```

---

### Task 6: Final Verification And Commit

**Files:**
- All files touched above.

- [x] **Step 1: Run focused verification**

Run:

```bash
npm run test:telefun:migration-matrix
npx vitest run tests/supabase/telefun-replay-migrations-contracts.test.ts
git diff --check
```

Expected:

- Matrix passes all six live scenarios.
- Static contract test passes.
- `git diff --check` has no whitespace errors.

- [ ] **Step 2: Run broader verification if SQL changed after a failure**

If any migration SQL is changed to fix a matrix failure, also run:

```bash
npx vitest run tests/supabase
npm run lint
```

Expected: pass, except pre-existing lint warnings may remain if already present.

- [x] **Step 3: Commit**

Use the repo default git identity if needed:

```bash
git config user.name "Fajar Abdurrahman"
git config user.email "fajarabr76@gmail.com"
```

Commit:

```bash
git add package.json scripts/verify-telefun-replay-migration-matrix.mjs supabase/tests/telefun_replay_live_matrix tests/supabase/telefun-replay-migrations-contracts.test.ts docs/TELEFUN_REPLAY_RETRY_TRANSCRIPTION_FIXES_CHANGELOG_2026-05-16.md docs/SUPABASE_LOCAL_MIGRATION_RESET_RUNBOOK.md docs/README.md
git commit -m "test(supabase): add Telefun replay live migration matrix"
```

If `docs/README.md` is not changed, remove it from `git add`.

## Self-Review

- Spec coverage: The plan directly addresses the changelog known issue by replacing static-only migration confidence with a live Postgres matrix.
- Placeholder scan: No step relies on `TODO`, `TBD`, or unspecified validation.
- Type/signature consistency: The final expected RPC signature is `upsert_telefun_coaching_summary(uuid,jsonb,integer,text)`, matching `20260517000001_add_telefun_replay_completion_metadata.sql`.
- Scope control: The plan only adds verification harness/docs unless a live matrix failure proves that migration SQL itself must be changed.
