import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const MIGRATION_PATH = 'supabase/migrations/20260514000000_explicit_public_data_api_grants.sql';
const CORRECTIVE_MIGRATION_PATH = 'supabase/migrations/20260514120000_fix_qa_summary_refresh_security_definer.sql';

function getAllFiles(dir: string, fileList: string[] = []): string[] {
  if (!existsSync(dir)) return fileList;
  const files = readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === '.next' || file === 'dist') continue;
    const filePath = join(dir, file);
    if (statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

function extractFromTables(files: string[]): Set<string> {
  const tables = new Set<string>();
  const regex = /\.from\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    let match;
    while ((match = regex.exec(content)) !== null) {
      const tableName = match[1];
      if (tableName !== 'profiler-foto' && tableName !== 'telefun-recordings') {
        tables.add(tableName);
      }
    }
  }
  return tables;
}

function extractRpcs(files: string[]): Set<string> {
  const rpcs = new Set<string>();
  const regex = /\.rpc\s*\(\s*['"`]([^'"`]+)['"`]/g;
  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    let match;
    while ((match = regex.exec(content)) !== null) {
      rpcs.add(match[1]);
    }
  }
  return rpcs;
}

describe('Public Data API Grants static contract tests', () => {
  const appFiles = getAllFiles('app');
  const appsFiles = getAllFiles('apps');
  const allFiles = [...appFiles, ...appsFiles];

  it('scans .from() calls and ensures no application table grants access to anon', () => {
    const tables = extractFromTables(allFiles);
    expect(tables.size).toBeGreaterThan(0);

    // This will fail if the mitigation migration file does not exist yet
    const migrationContent = readFileSync(MIGRATION_PATH, 'utf8');

    for (const tableName of tables) {
      const broadGrantRegex = new RegExp(`GRANT\\s+.*ON\\s+(public\\.)?${tableName}\\s+TO\\s+anon`, 'i');
      expect(migrationContent).not.toMatch(broadGrantRegex);
    }
  });

  it('scans .rpc() calls and locks the exact expected list of RPCs', () => {
    const rpcs = extractRpcs(allFiles);
    const expectedRpcs = [
      'bulk_reorder_profiler_peserta',
      'consume_rate_limit',
      'get_leader_approved_scope_items',
      'get_qa_agent_directory_summary',
      'get_qa_dashboard_data',
      'get_qa_dashboard_range_data',
      'get_qa_dashboard_range_trend_data',
      'get_service_trend_dashboard',
      'publish_rule_version',
      'refresh_qa_dashboard_summary_for_period',
      'submit_pdkt_mailbox_batch',
      'submit_pdkt_mailbox_reply',
    ].sort();

    expect(Array.from(rpcs).sort()).toEqual(expectedRpcs);
  });

  it('ensures profiles table does not receive broad authenticated updates, only UPDATE (full_name)', () => {
    const migrationContent = readFileSync(MIGRATION_PATH, 'utf8');

    expect(migrationContent).toContain('GRANT UPDATE (full_name) ON public.profiles TO authenticated');
    const broadUpdateRegex = /GRANT\s+UPDATE\s+ON\s+(public\.)?profiles\s+TO\s+authenticated/i;
    expect(migrationContent).not.toMatch(broadUpdateRegex);
  });

  it('actively verifies that service-only tables do not leak grant permissions to authenticated or anon roles', () => {
    const migrationContent = readFileSync(MIGRATION_PATH, 'utf8');
    const serviceTables = [
      'ai_billing_settings',
      'ai_pricing_settings',
      'ai_usage_logs',
      'ketik_review_jobs',
      'qa_indicators_backup',
      'qa_temuan_backup',
      'security_rate_limits',
    ];

    // Ensure we are revoking ALL from authenticated, anon, public for all tables
    expect(migrationContent).toContain("EXECUTE 'REVOKE ALL ON public.' || v_table || ' FROM authenticated, anon, public'");

    for (const table of serviceTables) {
      // Explicit grant checks inside the file should not grant authenticated access to service tables
      const authGrantRegex = new RegExp(`GRANT\\s+.*ON\\s+(public\\.)?${table}\\s+TO\\s+authenticated`, 'i');
      expect(migrationContent).not.toMatch(authGrantRegex);
    }
  });

  it('ensures summary tables receive DELETE grant for authenticated role to support cache invalidation', () => {
    const migrationContent = readFileSync(MIGRATION_PATH, 'utf8');
    const summaryTables = [
      'qa_dashboard_agent_period_summary',
      'qa_dashboard_indicator_period_summary',
      'qa_dashboard_period_summary',
    ];

    for (const table of summaryTables) {
      expect(migrationContent).toContain(table);
    }
    // Verify the explicit grant statement for summary tables contains DELETE
    expect(migrationContent).toContain("EXECUTE 'GRANT SELECT, DELETE ON public.' || v_table || ' TO authenticated'");
  });

  it('verifies the corrective migration for summary refresh RPC', () => {
    const migrationContent = readFileSync(CORRECTIVE_MIGRATION_PATH, 'utf8');

    expect(migrationContent).toContain('SECURITY DEFINER');
    expect(migrationContent).toContain('SET search_path = public, pg_temp');
    expect(migrationContent).toContain('refresh_qa_dashboard_summary_for_period');

    // Ensure no broad INSERT grant for authenticated in both migrations
    const baselineMigration = readFileSync(MIGRATION_PATH, 'utf8');
    const insertGrantRegex = /GRANT\s+.*INSERT.*ON\s+.*qa_dashboard_.*_summary\s+TO\s+authenticated/i;
    
    expect(baselineMigration).not.toMatch(insertGrantRegex);
    expect(migrationContent).not.toMatch(insertGrantRegex);

    // Verify folder key guard restricts to __ALL__ only
    expect(migrationContent).toMatch(/p_folder_key\s*<>\s*'__ALL__'/);
    expect(migrationContent).toContain('Only folder_key = \'\'__ALL__\'\' is supported');

    // Verify role guard checks auth.role() before profile lookup
    expect(migrationContent).toContain("auth.role() <> 'service_role'");
    expect(migrationContent).toContain('lower(coalesce(role, \'\')) IN (\'trainer\', \'trainers\', \'admin\')');

    // Verify profile status and is_deleted guards
    expect(migrationContent).toContain("lower(coalesce(status, 'approved')) = 'approved'");
    expect(migrationContent).toContain('coalesce(is_deleted, false) = false');
  });
});
