import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const profileHardeningMigration = readFileSync(
  'supabase/migrations/20260513000000_restrict_profile_self_update.sql',
  'utf8'
);
const userManagementActions = readFileSync('app/(main)/dashboard/users/actions.ts', 'utf8');
const authModalSource = readFileSync('app/components/AuthModal.tsx', 'utf8');

describe('profile auth hardening contracts', () => {
  it('prevents authenticated users from self-inserting approved or admin profiles', () => {
    const insertPolicy = extractSqlBlock(
      profileHardeningMigration,
      'CREATE POLICY "Users can insert own pending profile"',
      'CREATE POLICY "Users can update own display name"'
    );

    expect(insertPolicy).toContain('auth.uid() = id');
    expect(insertPolicy).toContain("lower(coalesce(status, 'pending')) = 'pending'");
    expect(insertPolicy).toContain("lower(coalesce(role, 'agent'))");
    expect(insertPolicy).toContain("'admin'");
    expect(insertPolicy).toContain('coalesce(is_deleted, false) = false');
  });

  it('limits ordinary authenticated profile updates to the display-name column', () => {
    expect(profileHardeningMigration).toContain('REVOKE UPDATE ON public.profiles FROM authenticated');
    expect(profileHardeningMigration).toContain('GRANT UPDATE (full_name) ON public.profiles TO authenticated');
  });

  it('registers new email users with insert instead of upsert after profile update privileges are narrowed', () => {
    const registrationBlock = extractFunction(authModalSource, 'handleSubmit');

    expect(registrationBlock).toContain(".from('profiles').insert(");
    expect(registrationBlock).not.toContain('.upsert(');
  });

  it('performs manager profile mutations with the admin client after caller validation', () => {
    const validationBlock = extractFunction(userManagementActions, 'validateManagerRole');
    const statusBlock = extractFunction(userManagementActions, 'updateUserStatusAction');
    const roleBlock = extractFunction(userManagementActions, 'updateUserRoleAction');
    const deleteBlock = extractFunction(userManagementActions, 'deleteUserAction');

    expect(userManagementActions).toContain("import { createAdminClient } from '@/app/lib/supabase/admin'");
    expect(validationBlock).toContain('PROFILE_FIELDS');
    expect(validationBlock).toContain("status !== 'approved'");
    expect(validationBlock).toContain('profile?.is_deleted');

    for (const block of [statusBlock, roleBlock, deleteBlock]) {
      const validationPos = block.indexOf('validateManagerRole()');
      const adminClientPos = block.indexOf('createAdminClient()');

      expect(validationPos).toBeGreaterThanOrEqual(0);
      expect(adminClientPos).toBeGreaterThanOrEqual(0);
      expect(validationPos).toBeLessThan(adminClientPos);
      expect(block).toContain('getManagedTargetProfile');
    }
  });

  it('blocks direct manager actions from mutating self or trainer-to-admin targets', () => {
    const statusBlock = extractFunction(userManagementActions, 'updateUserStatusAction');
    const roleBlock = extractFunction(userManagementActions, 'updateUserRoleAction');

    expect(statusBlock).toContain('user.id === userId');
    expect(statusBlock).toContain("callerRole === 'trainer'");
    expect(statusBlock).toContain("normalizeRole(targetProfile.role) === 'admin'");

    expect(roleBlock).toContain("callerRole === 'trainer'");
    expect(roleBlock).toContain("normalizeRole(targetProfile.role) === 'admin'");
  });
});

function extractSqlBlock(source: string, startNeedle: string, endNeedle: string) {
  const start = source.indexOf(startNeedle);
  expect(start, `missing SQL block ${startNeedle}`).toBeGreaterThanOrEqual(0);

  const end = source.indexOf(endNeedle, start + startNeedle.length);
  expect(end, `missing SQL block terminator ${endNeedle}`).toBeGreaterThanOrEqual(0);

  return source.slice(start, end);
}

function extractFunction(source: string, functionName: string) {
  const start = source.indexOf(`async function ${functionName}`);
  const exportedStart = source.indexOf(`export async function ${functionName}`);
  const functionStart = start >= 0 ? start : exportedStart;
  expect(functionStart, `missing function ${functionName}`).toBeGreaterThanOrEqual(0);

  const nextExport = source.indexOf('\nexport async function ', functionStart + 1);
  return source.slice(functionStart, nextExport === -1 ? undefined : nextExport);
}
