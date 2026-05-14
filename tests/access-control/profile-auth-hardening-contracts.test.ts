import { readFileSync, existsSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const profileHardeningMigration = readFileSync(
  'supabase/migrations/20260513000000_restrict_profile_self_update.sql',
  'utf8'
);
const profilesRlsFixMigration = readFileSync(
  'supabase/migrations/20260514230000_fix_profiles_select_rls_policies.sql',
  'utf8'
);
const rbacSetupScript = readFileSync('supabase/scripts/supabase_rbac_setup.sql', 'utf8');
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

  it('registers new email users with insert instead of upsert after profile update privileges are narrowed, without unauthenticated profile lookups', () => {
    const registrationBlock = extractFunction(authModalSource, 'handleSubmit');

    expect(registrationBlock).toContain(".from('profiles').insert(");
    expect(registrationBlock).not.toContain('.upsert(');
    // Ensure no unauthenticated pre-check lookup on profiles table before signUp
    expect(registrationBlock).not.toContain(".from('profiles').select(");
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

  it('ensures signup error handling does not rely on broad 422 status and checks for specific duplicate signals', () => {
    const registrationBlock = extractFunction(authModalSource, 'handleSubmit');

    expect(registrationBlock).not.toContain('signUpError.status === 422');
    expect(registrationBlock).toContain("'user_already_exists'");
    expect(registrationBlock).toContain("'already registered'");
    expect(registrationBlock).toContain("'already exists'");
    expect(registrationBlock).toContain("'user already'");
  });
});

  describe('corrective migration: profiles SELECT RLS after explicit grants', () => {
    it('exists as the May 14 corrective migration file', () => {
      expect(existsSync('supabase/migrations/20260514230000_fix_profiles_select_rls_policies.sql')).toBe(true);
    });

    it('recreates get_auth_role() with lowercase normalization, SECURITY DEFINER, and search_path isolation', () => {
      expect(profilesRlsFixMigration).toContain('lower(coalesce(role, \'\'))');
      expect(profilesRlsFixMigration).toContain('SECURITY DEFINER');
      expect(profilesRlsFixMigration).toContain('STABLE');
      expect(profilesRlsFixMigration).toContain('SET search_path = public, pg_temp');
    });

    it('explicitly revokes get_auth_role() EXECUTE from PUBLIC and anon', () => {
      expect(profilesRlsFixMigration).toContain('REVOKE ALL ON FUNCTION public.get_auth_role() FROM PUBLIC, anon');
    });

    it('grants get_auth_role() EXECUTE to authenticated and service_role', () => {
      expect(profilesRlsFixMigration).toContain('GRANT EXECUTE ON FUNCTION public.get_auth_role() TO authenticated');
      expect(profilesRlsFixMigration).toContain('GRANT EXECUTE ON FUNCTION public.get_auth_role() TO service_role');
    });

    it('creates all four profiles SELECT policies scoped TO authenticated', () => {
      expect(profilesRlsFixMigration).toContain('CREATE POLICY "Users can view own profile"\nON public.profiles FOR SELECT\nTO authenticated');
      expect(profilesRlsFixMigration).toContain('CREATE POLICY "Admins can view all profiles"\nON public.profiles FOR SELECT\nTO authenticated');
      expect(profilesRlsFixMigration).toContain('CREATE POLICY "Trainers can view all profiles"\nON public.profiles FOR SELECT\nTO authenticated');
      expect(profilesRlsFixMigration).toContain('CREATE POLICY "Leaders can view all profiles"\nON public.profiles FOR SELECT\nTO authenticated');
    });

    it('does not modify INSERT/UPDATE policies from 20260513000000', () => {
      expect(profilesRlsFixMigration).not.toContain('CREATE POLICY "Users can insert');
      expect(profilesRlsFixMigration).not.toContain('CREATE POLICY "Users can update');
    });

    it('keeps anon denied on profiles and full_name as only client-updatable column', () => {
      expect(profilesRlsFixMigration).not.toContain('GRANT INSERT ON public.profiles TO anon');
      expect(profilesRlsFixMigration).not.toContain('GRANT UPDATE (role) ON public.profiles TO authenticated');
    });
  });

  describe('setup script lowercase normalization', () => {
    it('does not contain exact capitalized role comparisons for get_auth_role()', () => {
      expect(rbacSetupScript).not.toContain("get_auth_role() = 'Trainer'");
      expect(rbacSetupScript).not.toContain("get_auth_role() = 'Leader'");
    });

    it('uses lowercase-compatible role comparisons in profiles policies', () => {
      expect(rbacSetupScript).toContain("get_auth_role() IN ('trainer', 'trainers')");
      expect(rbacSetupScript).toContain("get_auth_role() = 'leader'");
      expect(rbacSetupScript).toContain("get_auth_role() = 'admin'");
    });

    it('uses lowercase-compatible role comparisons in results policies', () => {
      expect(rbacSetupScript).toContain("public.get_auth_role() IN ('trainer', 'trainers')");
      expect(rbacSetupScript).toContain("public.get_auth_role() = 'leader'");
    });

    it('recreates get_auth_role() with lower() normalization, SECURITY DEFINER, and STABLE', () => {
      expect(rbacSetupScript).toContain('lower(coalesce(role, \'\'))');
      expect(rbacSetupScript).toContain('SECURITY DEFINER');
      expect(rbacSetupScript).toContain('STABLE');
      expect(rbacSetupScript).toContain('SET search_path = public, pg_temp');
    });

    it('revokes get_auth_role() EXECUTE from PUBLIC and anon, and grants to authenticated and service_role', () => {
      expect(rbacSetupScript).toContain('REVOKE ALL ON FUNCTION public.get_auth_role() FROM PUBLIC, anon');
      expect(rbacSetupScript).toContain('GRANT EXECUTE ON FUNCTION public.get_auth_role() TO authenticated');
      expect(rbacSetupScript).toContain('GRANT EXECUTE ON FUNCTION public.get_auth_role() TO service_role');
    });

    it('adds admin profile SELECT policy', () => {
      expect(rbacSetupScript).toContain('CREATE POLICY "Admins can view all profiles"');
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
