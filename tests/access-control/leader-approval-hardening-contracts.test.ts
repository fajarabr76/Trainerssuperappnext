import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const leaderActionsSource = readFileSync('app/actions/leader-access.ts', 'utf8');
const migrationSource = readFileSync('supabase/migrations/20260502133224_leader_access_approval.sql', 'utf8');
const accessApprovalClientSource = readFileSync('app/(main)/dashboard/access-approval/AccessApprovalClient.tsx', 'utf8');
const leaderAccessStatusSource = readFileSync('app/components/access/LeaderAccessStatus.tsx', 'utf8');

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

describe('Leader access reassign contracts', () => {
  it('approved access rows expose access group ids for reassignment', () => {
    expect(leaderActionsSource).toContain('access_group_ids: string[]');
  });

  it('reassigns approved leader access groups through a dedicated server action', () => {
    const block = extractFunction(leaderActionsSource, 'reassignLeaderAccessGroups');

    expect(block).toContain(".eq('status', 'approved')");
    expect(block).toContain(".from('access_groups')");
    expect(block).toContain(".eq('is_active', true)");
    expect(block.indexOf(".from('access_groups')")).toBeLessThan(block.indexOf(".delete()"));
    expect(block).toContain(".from('leader_access_request_groups')");
    expect(block).toContain(".delete()");
    expect(block).toContain(".insert(groupRows)");
  });

  it('rolls back existing groups if insert fails during reassign', () => {
    const block = extractFunction(leaderActionsSource, 'reassignLeaderAccessGroups');

    const fetchExistingPos = block.indexOf('existingGroups');
    const deletePos = block.indexOf(".delete()");
    const insertPos = block.indexOf(".insert(groupRows)");
    const rollbackPos = block.indexOf('rollbackRows');

    expect(fetchExistingPos).toBeGreaterThanOrEqual(0);
    expect(fetchExistingPos).toBeLessThan(deletePos);
    expect(insertPos).toBeGreaterThan(deletePos);
    expect(rollbackPos).toBeGreaterThan(insertPos);
    expect(block).toContain('Rollback failed');
  });

  it('filters approved access group ids to active groups only', () => {
    const block = extractFunction(leaderActionsSource, 'getApprovedLeaderAccessList');

    const nameCheckPos = block.indexOf('if (name)');
    const idPushPos = block.indexOf('requestGroupIdMap.set(j.request_id, existingIds)');
    const closingBraceAfterId = block.indexOf('}', idPushPos);

    expect(nameCheckPos).toBeGreaterThanOrEqual(0);
    expect(idPushPos).toBeGreaterThan(nameCheckPos);
    expect(closingBraceAfterId).toBeGreaterThan(idPushPos);
  });

  it('approved access UI supports group reassignment', () => {
    expect(accessApprovalClientSource).toContain('reassignLeaderAccessGroups');
    expect(accessApprovalClientSource).toContain('handleReassign');
    expect(accessApprovalClientSource).toContain('Simpan Group');
  });

  it('revoked leaders can request access again from blocked status UI', () => {
    expect(leaderAccessStatusSource).toContain("status === 'none' || status === 'revoked'");
    expect(leaderAccessStatusSource).toContain('Ajukan Akses Lagi');
  });

  it('reassign blocks self-reassignment for audit parity with self-approval guard', () => {
    const block = extractFunction(leaderActionsSource, 'reassignLeaderAccessGroups');

    const selfCheckPos = block.indexOf('request.leader_user_id === userId');
    const deletePos = block.indexOf(".delete()");

    expect(selfCheckPos).toBeGreaterThanOrEqual(0);
    expect(selfCheckPos).toBeLessThan(deletePos);
  });

  it('reassign re-verifies approved status before mutating groups', () => {
    const block = extractFunction(leaderActionsSource, 'reassignLeaderAccessGroups');

    const recheckPos = block.indexOf('recheckReq');
    const deletePos = block.indexOf(".delete()");

    expect(recheckPos).toBeGreaterThanOrEqual(0);
    expect(recheckPos).toBeLessThan(deletePos);
  });

  it('revoked reapply reloads page after success to show pending status', () => {
    expect(leaderAccessStatusSource).toContain('result.success');
    expect(leaderAccessStatusSource).toContain('window.location.reload()');
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
