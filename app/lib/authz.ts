import { cache } from 'react';
import { createClient } from '@/app/lib/supabase/server';
import { User } from '@supabase/supabase-js';
import { Profile } from '@/app/types/auth';
import { redirect } from 'next/navigation';

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

/**
 * Robust server-side route guard helper.
 * Standardizes the redirect flow for different authentication and authorization states.
 */
export async function requirePageAccess(options?: {
  allowedRoles?: AppRole[];
  allowPending?: boolean;
}) {
  const { user, profile, role } = await getCurrentUserContext();

  // 1. Guest flow
  if (!user) {
    redirect('/?auth=login');
  }

  // 2. Terminal account states (deleted, rejected)
  const status = profile?.status?.toLowerCase();
  if (profile?.is_deleted) {
    redirect('/?auth=login&message=deleted');
  }
  if (status === 'rejected') {
    redirect('/?auth=login&message=rejected');
  }

  // 3. Pending flow
  if (status === 'pending' && !options?.allowPending) {
    redirect('/waiting-approval');
  }

  // 4. Role authorization flow
  if (options?.allowedRoles && options.allowedRoles.length > 0) {
    const isAllowed = options.allowedRoles.map(normalizeRole).includes(role);
    if (!isAllowed) {
      redirect('/dashboard');
    }
  }

  return { user, profile, role };
}
