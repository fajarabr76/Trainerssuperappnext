'use server'

import { createClient } from '@/app/lib/supabase/server';
import { hasRole, normalizeRole } from '@/app/lib/authz';
import { revalidatePath } from 'next/cache';

export async function deleteActivityAction(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Tidak terautentikasi');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const role = normalizeRole(profile?.role);
  if (!hasRole(role, ['trainer', 'admin', 'superadmin'])) {
    throw new Error('Akses ditolak');
  }

  const { error } = await supabase
    .from('activity_logs')
    .delete()
    .eq('id', id);

  if (error) throw error;

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/activities');
}
