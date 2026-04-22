import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260422103000_fix_sidak_clean_session_audit_presence.sql'
);
const migrationSql = readFileSync(migrationPath, 'utf8');

function getFunctionBlock(functionName: string) {
  const matcher = new RegExp(
    `CREATE OR REPLACE FUNCTION public\\.${functionName}\\([\\s\\S]*?END;\\n\\$\\$;`,
    'm'
  );
  const block = migrationSql.match(matcher)?.[0];
  expect(block, `missing SQL block for ${functionName}`).toBeTruthy();
  return block!;
}

function expectAuditedPopulationInvariant(block: string) {
  expect(block).toContain('COUNT(DISTINCT peserta_id)');
  expect(block).toContain('COUNT(*) FILTER (WHERE is_countable_finding)');
}

function expectZeroErrorInvariant(block: string) {
  expect(block).toContain('AND NOT EXISTS (');
  expect(block).toContain('AND b2.is_countable_finding');
}

function expectNoPhantomOnlyGuard(block: string) {
  expect(block).not.toMatch(/HAVING[\s\S]*is_phantom_padding/i);
  expect(block).not.toMatch(/COUNT\(\*\)\s+FILTER\s+\(WHERE\s+NOT\s+is_phantom_padding\)/i);
}

describe('SIDAK SQL contract guards', () => {
  it('locks audited-population and ranking invariants for get_qa_dashboard_data', () => {
    const block = getFunctionBlock('get_qa_dashboard_data');

    expect(block).toContain('COALESCE(q.is_phantom_padding, false) AS is_phantom_padding');
    expectAuditedPopulationInvariant(block);
    expectZeroErrorInvariant(block);
    expect(block).toContain('FROM agent_stats');
    expect(block).toContain('SELECT DISTINCT peserta_id');
    expectNoPhantomOnlyGuard(block);
  });

  it('locks audited-population and ranking invariants for get_qa_dashboard_range_data', () => {
    const block = getFunctionBlock('get_qa_dashboard_range_data');

    expect(block).toContain('COALESCE(q.is_phantom_padding, false) AS is_phantom_padding');
    expectAuditedPopulationInvariant(block);
    expectZeroErrorInvariant(block);
    expect(block).toContain('FROM agent_stats');
    expect(block).toContain('SELECT DISTINCT peserta_id');
    expectNoPhantomOnlyGuard(block);
  });

  it('locks trend invariants for get_qa_dashboard_range_trend_data', () => {
    const block = getFunctionBlock('get_qa_dashboard_range_trend_data');

    expect(block).toContain('COALESCE(q.is_phantom_padding, false) AS is_phantom_padding');
    expectAuditedPopulationInvariant(block);
    expectZeroErrorInvariant(block);
    expect(block).toContain('FOR v_agent_id IN');
    expect(block).toContain('SELECT DISTINCT peserta_id');
    expect(block).toContain("COUNT(*) FILTER (WHERE is_countable_finding) AS total_count");
    expectNoPhantomOnlyGuard(block);
  });
});
