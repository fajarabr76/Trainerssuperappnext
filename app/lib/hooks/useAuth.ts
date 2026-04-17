'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import { useRouter } from 'next/navigation';

export function useAuth(requireRole?: string[]) {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [role, setRole] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const requireRoleRef = useRef(requireRole);
  requireRoleRef.current = requireRole;

  useEffect(() => {
    async function fetchUser() {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/?auth=login');
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        console.warn('[useAuth] Failed to read profile:', profileError.message);
      }

      const profileStatus = profile?.status?.toLowerCase();

      if (profileStatus === 'pending') {
        router.push('/waiting-approval');
        return;
      }

      if (profile?.is_deleted || profileStatus === 'rejected') {
        await supabase.auth.signOut();
        router.push('/?auth=login');
        return;
      }

      const userRole = profile?.role || '';
      setUser(user);
      setProfile(profile);
      setRole(userRole);
      
      if (requireRoleRef.current && !requireRoleRef.current.map(r => r.toLowerCase()).includes(userRole.toLowerCase())) {
        router.push('/dashboard');
        // Do not set loading to false to keep the loader while redirecting
        return;
      }

      setLoading(false);
    }

    fetchUser();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { user, profile, role, loading };
}
