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
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profile?.status === 'pending') {
        router.push('/pending');
        return;
      }

      if (profile?.is_deleted) {
        await supabase.auth.signOut();
        router.push('/login');
        return;
      }

      const userRole = profile?.role || 'Agent';
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
