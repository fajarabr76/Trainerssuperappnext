import { cache } from 'react';
import { createClient } from '@/app/lib/supabase/server';
import { User } from '@supabase/supabase-js';
import { Profile } from '@/app/types/auth';

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
  user: User | null;
  profile: Profile | null;
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
    .select('id, email, role, status, is_deleted, full_name, avatar_url, created_at, updated_at')
    .eq('id', user.id)
    .single();

  return {
    user,
    profile: profile as Profile,
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
