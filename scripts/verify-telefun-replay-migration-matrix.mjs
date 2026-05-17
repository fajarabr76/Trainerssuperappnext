#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

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
  console.log(`\n$ cat ${path} | docker exec -i supabase_db_trainers-superapp-next psql -U postgres -d postgres -v ON_ERROR_STOP=1`);
  execFileSync('bash', ['-c', `cat ${path} | docker exec -i supabase_db_trainers-superapp-next psql -U postgres -d postgres -v ON_ERROR_STOP=1`], { stdio: 'inherit' });
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
