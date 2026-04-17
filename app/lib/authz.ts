import { cache } from 'react';
import { createClient } from '@/app/lib/supabase/server';

export type AppRole =
  | 'agent'
  | 'leader'
  | 'trainer'
  | 'admin'
  | '';

export function normalizeRole(role?: string | null): AppRole {
  const value = role?.toLowerCase().trim() ?? '';
  if (value === 'trainers') return 'trainer';
  if (value === 'agents') return 'agent';
  if (value === 'agent' || value === 'leader' || value === 'trainer' || value === 'admin') {
    return value;
  }
  return '';
}

export interface CurrentUserContext {
  user: any | null;
  profile: { role?: string | null; status?: string | null; full_name?: string | null } | null;
  role: AppRole;
}

export const getCurrentUserContext = cache(async (): Promise<CurrentUserContext> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, profile: null, role: '' as AppRole };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, status, full_name')
    .eq('id', user.id)
    .single();

  return {
    user,
    profile,
    role: normalizeRole(profile?.role),
  };
});

export async function getCurrentUserWithRole() {
  return getCurrentUserContext();
}

export function hasRole(role: string | null | undefined, allowedRoles: string[]) {
  const normalizedRole = normalizeRole(role);
  return allowedRoles.map(normalizeRole).includes(normalizedRole);
}
