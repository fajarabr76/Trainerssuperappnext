import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const leaderActionsSource = readFileSync('app/actions/leader-access.ts', 'utf8');
const migrationSource = readFileSync('supabase/migrations/20260502133224_leader_access_approval.sql', 'utf8');

describe('Leader access approval hardening contracts', () => {
  it('allows only actual leader profiles to insert their own pending access request in RLS', () => {
    const policyBlock = extractSqlBlock(
      migrationSource,
      'create policy "Leader inserts own pending request"',
      'drop policy if exists "Admin and trainer manage leader access requests"',
    );

    expect(policyBlock).toContain('leader_user_id = auth.uid()');
    expect(policyBlock).toContain("status = 'pending'");
    expect(policyBlock).toContain("profiles.role in ('leader', 'leaders')");
  });

  it('rejects self approval before mutating request status or request groups', () => {
    const block = extractFunction(leaderActionsSource, 'approveLeaderAccessRequest');
    const selfApprovalCheck = block.indexOf('request.leader_user_id === userId');
    const updateCall = block.indexOf(".update({ status: 'approved'");

    expect(selfApprovalCheck).toBeGreaterThanOrEqual(0);
    expect(updateCall).toBeGreaterThanOrEqual(0);
    expect(selfApprovalCheck).toBeLessThan(updateCall);
  });

  it('validates every selected access group is active before approving a request', () => {
    const block = extractFunction(leaderActionsSource, 'approveLeaderAccessRequest');
    const activeGroupQuery = block.indexOf(".from('access_groups')");
    const updateCall = block.indexOf(".update({ status: 'approved'");

    expect(activeGroupQuery).toBeGreaterThanOrEqual(0);
    expect(block).toContain(".eq('is_active', true)");
    expect(block).toContain('uniqueAccessGroupIds');
    expect(activeGroupQuery).toBeLessThan(updateCall);
  });
});

function extractFunction(source: string, functionName: string) {
  const start = source.indexOf(`export async function ${functionName}`);
  expect(start, `missing function ${functionName}`).toBeGreaterThanOrEqual(0);

  const nextExport = source.indexOf('\nexport async function ', start + 1);
  return source.slice(start, nextExport === -1 ? undefined : nextExport);
}

function extractSqlBlock(source: string, startNeedle: string, endNeedle: string) {
  const start = source.indexOf(startNeedle);
  expect(start, `missing SQL block ${startNeedle}`).toBeGreaterThanOrEqual(0);

  const end = source.indexOf(endNeedle, start + startNeedle.length);
  expect(end, `missing SQL block terminator ${endNeedle}`).toBeGreaterThanOrEqual(0);

  return source.slice(start, end);
}
