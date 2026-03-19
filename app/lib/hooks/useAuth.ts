'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import { useRouter } from 'next/navigation';

export function useAuth(requireRole?: string[]) {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [role, setRole] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

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

      const userRole = profile?.role || 'Agent';
      
      if (requireRole && !requireRole.map(r => r.toLowerCase()).includes(userRole.toLowerCase())) {
        router.push('/dashboard');
        return;
      }

      setUser(user);
      setProfile(profile);
      setRole(userRole);
      setLoading(false);
    }

    fetchUser();
  }, [router, supabase, requireRole]);

  return { user, profile, role, loading };
}
