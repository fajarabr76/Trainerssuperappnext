import { createClient } from '@/app/lib/supabase/server';

export type AppRole =
  | 'agent'
  | 'leader'
  | 'trainer'
  | 'admin'
  | 'superadmin'
  | '';

export function normalizeRole(role?: string | null): AppRole {
  const value = role?.toLowerCase().trim() ?? '';
  if (value === 'trainers') return 'trainer';
  if (value === 'agents') return 'agent';
  if (value === 'agent' || value === 'leader' || value === 'trainer' || value === 'admin' || value === 'superadmin') {
    return value;
  }
  return '';
}

export async function getCurrentUserWithRole() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, profile: null, role: '' as AppRole };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, status')
    .eq('id', user.id)
    .single();

  return {
    supabase,
    user,
    profile,
    role: normalizeRole(profile?.role),
  };
}

export function hasRole(role: string | null | undefined, allowedRoles: string[]) {
  const normalizedRole = normalizeRole(role);
  return allowedRoles.map(normalizeRole).includes(normalizedRole);
}
