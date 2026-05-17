# Supabase Local Missing Base Schema Migration Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a fresh Supabase local database apply the tracked migration chain successfully after Docker/Supabase CLI startup by restoring the missing base schema that current migrations assume already exists.

**Architecture:** Add one idempotent baseline migration with a timestamp earlier than `20260407190000_add_service_weights.sql`, then let the existing forward migrations continue to evolve the schema. The baseline creates only foundational tables/functions that later migrations already reference; it does not seed production data or rewrite SIDAK scoring behavior.

**Tech Stack:** Supabase Postgres migrations, Postgres RLS/grants, Vitest static SQL contract tests, Markdown docs.

---

## Current Evidence

- Local Supabase reset/start reaches `20260407190000_add_service_weights.sql`, then fails because that migration executes `ALTER TABLE qa_indicators` and `INSERT INTO qa_indicators`.
- `rg` found no tracked migration that creates `qa_indicators`, `qa_periods`, or `qa_temuan` before `20260407190000`.
- The same first migration also creates an RLS policy that reads from `profiles`, so after `qa_indicators` is fixed a fresh DB can still fail if `profiles` is absent.
- Later migrations assume additional base tables already exist:
  - `20260411120000_reports_and_storage.sql` references `profiler_peserta`.
  - `20260412103000_pdkt_async_eval_and_profiler_bulk_reorder.sql` explicitly raises if `pdkt_history` does not exist.
  - `20260508000000_ketik_ai_reviews.sql` alters `ketik_history`.
  - `20260508110000_ketik_review_jobs.sql` expects `update_updated_at_column()`.
- Existing setup scripts (`supabase/scripts/supabase_rbac_setup.sql`, `supabase/scripts/supabase-profiler-schema.sql`) contain parts of the missing baseline, but setup scripts are not applied by `supabase db reset` as migrations.

## Root Cause

The repository migration chain is not self-contained. Some foundational app tables were likely created manually or through setup scripts before migrations were formalized. A fresh local Supabase database only applies `supabase/migrations/*.sql`, so the first SIDAK migration sees missing base tables.

## Fix Strategy

Create a prequel baseline migration:

```text
supabase/migrations/20260401000000_create_initial_app_base_schema.sql
```

This timestamp sorts before `20260407190000_add_service_weights.sql`, so fresh local resets get the required tables before the dependent SIDAK migration runs. All DDL must use `IF NOT EXISTS`, `DROP ... IF EXISTS`, and guarded `DO $$` checks so existing remote databases can no-op safely if the same objects were created manually in the past.

## Non-Goals

- Do not change `20260407190000_add_service_weights.sql` unless the prequel migration approach is blocked by Supabase CLI migration history.
- Do not import production data, local backups, or PII.
- Do not seed full SIDAK parameter sets beyond seed data already present in tracked migrations.
- Do not change SIDAK score formulas, versioned rule behavior, RLS role policy semantics, or app UI.
- Do not add new npm dependencies.

## File Map

- Create: `tests/supabase/base-schema-migration-contracts.test.ts`
  - Static contract proving the baseline migration exists, sorts before `20260407190000`, and creates the base objects later migrations require.
- Create: `supabase/migrations/20260401000000_create_initial_app_base_schema.sql`
  - Idempotent base schema for profiles, activity logs, settings, Profiler, KETIK/PDKT history, and SIDAK base tables.
- Create: `supabase/rollback/20260401000000_create_initial_app_base_schema.down.sql`
  - Guarded rollback documentation for local/dev only. It should refuse to drop non-empty base tables.
- Create: `docs/SUPABASE_LOCAL_MIGRATION_RESET_RUNBOOK.md`
  - Human-readable local reset runbook and troubleshooting note for missing baseline migrations.
- Modify: `docs/README.md`
  - Add the new runbook to the docs index.
- Modify: `docs/database.md`
  - Note that the initial app base schema is now tracked by migration, not only setup scripts.

---

### Task 1: Add Failing Static Contract Test

**Files:**
- Create: `tests/supabase/base-schema-migration-contracts.test.ts`

- [ ] **Step 1: Create the test file**

Create `tests/supabase/base-schema-migration-contracts.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { describe, expect, it } from 'vitest';

const BASELINE_MIGRATION_PATH =
  'supabase/migrations/20260401000000_create_initial_app_base_schema.sql';
const FIRST_SIDAK_MIGRATION_PATH =
  'supabase/migrations/20260407190000_add_service_weights.sql';
const BASELINE_ROLLBACK_PATH =
  'supabase/rollback/20260401000000_create_initial_app_base_schema.down.sql';

function migrationVersion(path: string) {
  return Number(basename(path).split('_')[0]);
}

describe('initial app base schema migration contract', () => {
  it('baseline migration sorts before the first SIDAK migration that depends on qa_indicators', () => {
    expect(migrationVersion(BASELINE_MIGRATION_PATH)).toBeLessThan(
      migrationVersion(FIRST_SIDAK_MIGRATION_PATH)
    );
  });

  it('creates foundational tables referenced by later migrations', () => {
    const sql = readFileSync(BASELINE_MIGRATION_PATH, 'utf8');
    const requiredTables = [
      'profiles',
      'activity_logs',
      'user_settings',
      'profiler_years',
      'profiler_folders',
      'profiler_peserta',
      'profiler_tim_list',
      'ketik_history',
      'pdkt_history',
      'qa_periods',
      'qa_indicators',
      'qa_temuan',
    ];

    for (const table of requiredTables) {
      expect(sql).toMatch(
        new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}\\b`, 'i')
      );
    }
  });

  it('creates helper functions needed before later trigger/policy migrations', () => {
    const sql = readFileSync(BASELINE_MIGRATION_PATH, 'utf8');

    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.get_auth_role()');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.update_updated_at_column()');
    expect(sql).toContain('SET search_path = public, pg_temp');
  });

  it('keeps baseline grants least-privilege and avoids broad public access', () => {
    const sql = readFileSync(BASELINE_MIGRATION_PATH, 'utf8');

    expect(sql).toContain('REVOKE ALL ON public.profiles FROM anon, public;');
    expect(sql).toContain('GRANT UPDATE (full_name) ON public.profiles TO authenticated;');
    expect(sql).not.toMatch(/GRANT\s+ALL\s+ON\s+public\.profiles\s+TO\s+authenticated/i);
    expect(sql).not.toMatch(/GRANT\s+.*ON\s+public\.[a-z_]+\s+TO\s+anon/i);
  });

  it('rollback refuses destructive drops unless tables are empty', () => {
    const sql = readFileSync(BASELINE_ROLLBACK_PATH, 'utf8');

    expect(sql).toContain('Rollback is local/dev only');
    expect(sql).toContain('Refusing to drop non-empty base table');
    expect(sql).toContain('SELECT COUNT(*)');
  });
});
```

- [ ] **Step 2: Run the new test and confirm failure**

Run:

```bash
npx vitest run tests/supabase/base-schema-migration-contracts.test.ts
```

Expected: fail because the baseline migration and rollback files do not exist yet.

---

### Task 2: Create Idempotent Baseline Migration

**Files:**
- Create: `supabase/migrations/20260401000000_create_initial_app_base_schema.sql`

- [ ] **Step 1: Create extension and generic trigger helper first**

Start the migration with:

```sql
-- Initial app base schema.
--
-- Fresh Supabase local databases apply only tracked migrations. Older setup
-- scripts/manual SQL created these foundational objects, but later migrations
-- already depend on them. Keep this migration idempotent so existing databases
-- can safely no-op when the objects already exist.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
```

- [ ] **Step 2: Create auth/profile and shared utility tables**

Add:

```sql
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text,
  role text NOT NULL DEFAULT 'agent'
    CONSTRAINT profiles_role_check
    CHECK (lower(role) IN ('admin', 'trainer', 'trainers', 'leader', 'agent', 'agents')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT lower(coalesce(role, '')) FROM public.profiles WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_auth_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_auth_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_role() TO service_role;

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name text,
  action text NOT NULL,
  module text,
  type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS update_user_settings_updated_at ON public.user_settings;
CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
```

- [ ] **Step 3: Create Profiler base tables**

Add:

```sql
CREATE TABLE IF NOT EXISTS public.profiler_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL UNIQUE CHECK (year BETWEEN 2000 AND 2100),
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profiler_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  trainer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  year_id uuid REFERENCES public.profiler_years(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.profiler_folders(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profiler_peserta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  batch_name text NOT NULL REFERENCES public.profiler_folders(name) ON DELETE CASCADE ON UPDATE CASCADE,
  nomor_urut integer NOT NULL DEFAULT 0,
  nama text NOT NULL,
  tim text NOT NULL,
  jabatan text NOT NULL,
  foto_url text,
  photo_frame jsonb,
  nik_ojk text,
  bergabung_date date,
  email_ojk text,
  no_telepon text,
  no_telepon_darurat text,
  nama_kontak_darurat text,
  hubungan_kontak_darurat text,
  jenis_kelamin text,
  agama text,
  tgl_lahir date,
  status_perkawinan text,
  pendidikan text,
  no_ktp text,
  no_npwp text,
  nomor_rekening text,
  nama_bank text,
  alamat_tinggal text,
  status_tempat_tinggal text,
  nama_lembaga text,
  jurusan text,
  previous_company text,
  pengalaman_cc text,
  catatan_tambahan text,
  keterangan text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profiler_tim_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama text NOT NULL UNIQUE,
  trainer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiler_peserta_batch_name ON public.profiler_peserta(batch_name);
CREATE INDEX IF NOT EXISTS idx_profiler_peserta_tim ON public.profiler_peserta(tim);

DROP TRIGGER IF EXISTS update_profiler_peserta_updated_at ON public.profiler_peserta;
CREATE TRIGGER update_profiler_peserta_updated_at
  BEFORE UPDATE ON public.profiler_peserta
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
```

- [ ] **Step 4: Create KETIK and PDKT history base tables**

Add:

```sql
CREATE TABLE IF NOT EXISTS public.ketik_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date timestamptz NOT NULL DEFAULT now(),
  scenario_title text NOT NULL,
  consumer_name text NOT NULL,
  consumer_phone text,
  consumer_city text,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ketik_history_user_date
  ON public.ketik_history(user_id, date DESC);

CREATE TABLE IF NOT EXISTS public.pdkt_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  timestamp timestamptz NOT NULL DEFAULT now(),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  emails jsonb NOT NULL DEFAULT '[]'::jsonb,
  evaluation jsonb,
  time_taken integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pdkt_history_user_timestamp
  ON public.pdkt_history(user_id, timestamp DESC);
```

- [ ] **Step 5: Create SIDAK base tables before `20260407190000` depends on them**

Add:

```sql
CREATE TABLE IF NOT EXISTS public.qa_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  year integer NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (month, year)
);

CREATE TABLE IF NOT EXISTS public.qa_indicators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type text NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'non_critical'
    CONSTRAINT qa_indicators_category_check
    CHECK (category IN ('critical', 'non_critical')),
  bobot numeric NOT NULL DEFAULT 0,
  has_na boolean NOT NULL DEFAULT false,
  threshold numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (service_type, name)
);

CREATE TABLE IF NOT EXISTS public.qa_temuan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  peserta_id uuid NOT NULL REFERENCES public.profiler_peserta(id) ON DELETE CASCADE,
  period_id uuid NOT NULL REFERENCES public.qa_periods(id) ON DELETE CASCADE,
  indicator_id uuid NOT NULL REFERENCES public.qa_indicators(id) ON DELETE RESTRICT,
  service_type text NOT NULL,
  no_tiket text,
  nilai integer NOT NULL CHECK (nilai BETWEEN 0 AND 3),
  ketidaksesuaian text,
  sebaiknya text,
  tahun integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qa_indicators_service_type ON public.qa_indicators(service_type);
CREATE INDEX IF NOT EXISTS idx_qa_temuan_period_service ON public.qa_temuan(period_id, service_type);
CREATE INDEX IF NOT EXISTS idx_qa_temuan_peserta_period ON public.qa_temuan(peserta_id, period_id);
CREATE INDEX IF NOT EXISTS idx_qa_temuan_indicator_id ON public.qa_temuan(indicator_id);

DROP TRIGGER IF EXISTS update_qa_indicators_updated_at ON public.qa_indicators;
CREATE TRIGGER update_qa_indicators_updated_at
  BEFORE UPDATE ON public.qa_indicators
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_qa_temuan_updated_at ON public.qa_temuan;
CREATE TRIGGER update_qa_temuan_updated_at
  BEFORE UPDATE ON public.qa_temuan
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
```

- [ ] **Step 6: Add conservative initial RLS/grants**

Add:

```sql
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiler_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiler_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiler_peserta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiler_tim_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ketik_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pdkt_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_temuan ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.profiles FROM anon, public;
REVOKE ALL ON public.activity_logs FROM anon, public;
REVOKE ALL ON public.user_settings FROM anon, public;
REVOKE ALL ON public.profiler_years FROM anon, public;
REVOKE ALL ON public.profiler_folders FROM anon, public;
REVOKE ALL ON public.profiler_peserta FROM anon, public;
REVOKE ALL ON public.profiler_tim_list FROM anon, public;
REVOKE ALL ON public.ketik_history FROM anon, public;
REVOKE ALL ON public.pdkt_history FROM anon, public;
REVOKE ALL ON public.qa_periods FROM anon, public;
REVOKE ALL ON public.qa_indicators FROM anon, public;
REVOKE ALL ON public.qa_temuan FROM anon, public;

GRANT SELECT, INSERT ON public.profiles TO authenticated;
GRANT UPDATE (full_name) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiler_years TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiler_folders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiler_peserta TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiler_tim_list TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ketik_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdkt_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_periods TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_indicators TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_temuan TO authenticated;

GRANT ALL ON public.activity_logs TO service_role;
GRANT ALL ON public.user_settings TO service_role;
GRANT ALL ON public.profiler_years TO service_role;
GRANT ALL ON public.profiler_folders TO service_role;
GRANT ALL ON public.profiler_peserta TO service_role;
GRANT ALL ON public.profiler_tim_list TO service_role;
GRANT ALL ON public.ketik_history TO service_role;
GRANT ALL ON public.pdkt_history TO service_role;
GRANT ALL ON public.qa_periods TO service_role;
GRANT ALL ON public.qa_indicators TO service_role;
GRANT ALL ON public.qa_temuan TO service_role;
```

Keep detailed final RLS semantics in the existing hardening migrations. This baseline only prevents early migration failures.

- [ ] **Step 7: Add final baseline assertions**

Add:

```sql
DO $$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(required_table, ', ')
  INTO v_missing
  FROM (
    VALUES
      ('public.profiles'),
      ('public.activity_logs'),
      ('public.user_settings'),
      ('public.profiler_years'),
      ('public.profiler_folders'),
      ('public.profiler_peserta'),
      ('public.profiler_tim_list'),
      ('public.ketik_history'),
      ('public.pdkt_history'),
      ('public.qa_periods'),
      ('public.qa_indicators'),
      ('public.qa_temuan')
  ) AS t(required_table)
  WHERE to_regclass(required_table) IS NULL;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Initial app base schema incomplete. Missing: %', v_missing;
  END IF;
END $$;
```

---

### Task 3: Create Guarded Rollback

**Files:**
- Create: `supabase/rollback/20260401000000_create_initial_app_base_schema.down.sql`

- [ ] **Step 1: Create rollback that refuses to drop non-empty tables**

Create `supabase/rollback/20260401000000_create_initial_app_base_schema.down.sql`:

```sql
-- Rollback is local/dev only for 20260401000000_create_initial_app_base_schema.sql.
-- It refuses to drop non-empty base tables because these tables can contain
-- user profiles, participant PII, simulation history, and SIDAK audit data.

DO $$
DECLARE
  v_table text;
  v_count bigint;
  v_tables text[] := ARRAY[
    'qa_temuan',
    'qa_indicators',
    'qa_periods',
    'pdkt_history',
    'ketik_history',
    'profiler_peserta',
    'profiler_tim_list',
    'profiler_folders',
    'profiler_years',
    'user_settings',
    'activity_logs',
    'profiles'
  ];
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    IF to_regclass('public.' || v_table) IS NOT NULL THEN
      EXECUTE format('SELECT COUNT(*) FROM public.%I', v_table) INTO v_count;
      IF v_count > 0 THEN
        RAISE EXCEPTION 'Refusing to drop non-empty base table public.% with % rows', v_table, v_count;
      END IF;
    END IF;
  END LOOP;
END $$;

DROP TABLE IF EXISTS public.qa_temuan;
DROP TABLE IF EXISTS public.qa_indicators;
DROP TABLE IF EXISTS public.qa_periods;
DROP TABLE IF EXISTS public.pdkt_history;
DROP TABLE IF EXISTS public.ketik_history;
DROP TABLE IF EXISTS public.profiler_peserta;
DROP TABLE IF EXISTS public.profiler_tim_list;
DROP TABLE IF EXISTS public.profiler_folders;
DROP TABLE IF EXISTS public.profiler_years;
DROP TABLE IF EXISTS public.user_settings;
DROP TABLE IF EXISTS public.activity_logs;
DROP TABLE IF EXISTS public.profiles;

DROP FUNCTION IF EXISTS public.get_auth_role();
DROP FUNCTION IF EXISTS public.update_updated_at_column();
```

- [ ] **Step 2: Re-run the static contract test**

Run:

```bash
npx vitest run tests/supabase/base-schema-migration-contracts.test.ts
```

Expected: pass.

---

### Task 4: Verify Full Local Migration Chain

**Files:**
- No file edits.

- [ ] **Step 1: Run a fresh reset**

Run:

```bash
supabase db reset --debug
```

Expected:
- `20260401000000_create_initial_app_base_schema.sql` appears before `20260407190000_add_service_weights.sql`.
- `20260407190000_add_service_weights.sql` no longer fails on `qa_indicators`.
- The reset completes all migrations.

- [ ] **Step 2: If reset fails on another missing base object, update the baseline once**

If a later migration reports another missing table/function that is part of the original app baseline, add that object to `20260401000000_create_initial_app_base_schema.sql`, then add it to `requiredTables` in `tests/supabase/base-schema-migration-contracts.test.ts`.

Do not add feature-specific tables here if they already have their own tracked `CREATE TABLE IF NOT EXISTS` migration.

- [ ] **Step 3: Run focused repo checks**

Run:

```bash
npx vitest run tests/supabase/base-schema-migration-contracts.test.ts tests/supabase/public-data-api-grants.test.ts tests/supabase/rls-policies-after-explicit-grants-contracts.test.ts
npm run test:sidak
npm run lint
```

Expected: all pass.

Use `npm run type-check` after the local DB reset is green if the change will be merged into `main`.

---

### Task 5: Document The Migration Reset Contract

**Files:**
- Create: `docs/SUPABASE_LOCAL_MIGRATION_RESET_RUNBOOK.md`
- Modify: `docs/README.md`
- Modify: `docs/database.md`

- [ ] **Step 1: Create local reset runbook**

Create `docs/SUPABASE_LOCAL_MIGRATION_RESET_RUNBOOK.md`:

```md
# Supabase Local Migration Reset Runbook

Dokumen ini menjelaskan cara menangani reset database lokal Supabase ketika migration chain gagal karena schema dasar belum ada.

## Ringkasan

Fresh local database hanya menjalankan file di `supabase/migrations/`. Setup script di `supabase/scripts/` tidak otomatis dijalankan oleh `supabase db reset`.

Karena itu schema dasar aplikasi sekarang dilacak melalui:

- `supabase/migrations/20260401000000_create_initial_app_base_schema.sql`

Migration ini membuat tabel dasar seperti `profiles`, `profiler_peserta`, `qa_periods`, `qa_indicators`, `qa_temuan`, `ketik_history`, dan `pdkt_history` sebelum migration SIDAK/PDKT/KETIK yang lebih baru berjalan.

## Cara Verifikasi

```bash
supabase db reset --debug
npx vitest run tests/supabase/base-schema-migration-contracts.test.ts
```

Reset dianggap sehat jika `20260401000000_create_initial_app_base_schema.sql` berjalan sebelum `20260407190000_add_service_weights.sql` dan tidak ada error `relation does not exist`.

## Jika Error Muncul Lagi

1. Baca nama table/function yang hilang dari error Supabase CLI.
2. Cek apakah objek tersebut seharusnya base schema atau sudah punya migration sendiri.
3. Jika base schema, tambahkan ke `20260401000000_create_initial_app_base_schema.sql` secara idempotent.
4. Tambahkan assertion di `tests/supabase/base-schema-migration-contracts.test.ts`.
5. Jalankan ulang `supabase db reset --debug`.

Jangan menambahkan data produksi, backup lokal, atau data PII ke migration baseline.
```

- [ ] **Step 2: Update docs index**

Add this bullet to `docs/README.md` near Supabase docs:

```md
- `docs/SUPABASE_LOCAL_MIGRATION_RESET_RUNBOOK.md`: Panduan reset migration Supabase lokal dan kontrak baseline schema.
```

- [ ] **Step 3: Update database docs**

In `docs/database.md`, add a short note near the main table list:

```md
**Catatan Migration Baseline:** Schema dasar aplikasi untuk fresh local reset dilacak di `supabase/migrations/20260401000000_create_initial_app_base_schema.sql`. File ini memastikan tabel dasar tersedia sebelum migration fitur seperti SIDAK service weights, PDKT async evaluation, dan KETIK review berjalan. Setup scripts di `supabase/scripts/` tetap dapat menjadi referensi manual, tetapi bukan sumber utama untuk reset lokal.
```

---

### Task 6: Commit Scope And Deployment Notes

**Files:**
- No additional edits unless verification exposes a gap.

- [ ] **Step 1: Inspect changed files**

Run:

```bash
git status --short
git diff --stat
```

Expected changed files:

```text
docs/README.md
docs/SUPABASE_LOCAL_MIGRATION_RESET_RUNBOOK.md
docs/database.md
plan/2026-05-17-supabase-local-missing-base-schema-migration-v1.md
supabase/migrations/20260401000000_create_initial_app_base_schema.sql
supabase/rollback/20260401000000_create_initial_app_base_schema.down.sql
tests/supabase/base-schema-migration-contracts.test.ts
```

- [ ] **Step 2: Commit only after docs and verification pass**

Run:

```bash
git add docs/README.md docs/SUPABASE_LOCAL_MIGRATION_RESET_RUNBOOK.md docs/database.md plan/2026-05-17-supabase-local-missing-base-schema-migration-v1.md supabase/migrations/20260401000000_create_initial_app_base_schema.sql supabase/rollback/20260401000000_create_initial_app_base_schema.down.sql tests/supabase/base-schema-migration-contracts.test.ts
git commit -m "fix(supabase): add initial base schema migration"
```

- [ ] **Step 3: Remote Supabase caution**

Before pushing this migration to any remote Supabase project:

```sql
select to_regclass('public.profiles') as profiles,
       to_regclass('public.qa_indicators') as qa_indicators,
       to_regclass('public.qa_temuan') as qa_temuan,
       to_regclass('public.ketik_history') as ketik_history,
       to_regclass('public.pdkt_history') as pdkt_history;
```

Expected on existing remote projects: all key base tables already exist. Because the migration is idempotent, it should no-op. If Supabase CLI rejects an older timestamp as an out-of-order migration on a remote that already has the baseline objects, do not force-run destructive SQL; use `supabase migration repair --status applied 20260401000000` only after verifying the objects exist and documenting the decision.

---

## Acceptance Criteria

- `supabase db reset --debug` completes from a fresh local DB.
- The reset no longer fails at `20260407190000_add_service_weights.sql` with missing `qa_indicators`.
- No new broad `anon`/`public` grants are introduced.
- Static Supabase contract tests pass.
- Focused SIDAK tests pass.
- Docs explain why setup scripts are not enough for local migration reset.

## Preferred Execution

Use inline execution for Task 1 through Task 5 because the file set is tightly coupled and the migration needs one coherent review. Use subagents only for parallel review after the first full reset is green:

- Reviewer A: inspect baseline SQL for least-privilege grant regressions.
- Reviewer B: inspect SIDAK migration chain and confirm all base dependencies are covered.
