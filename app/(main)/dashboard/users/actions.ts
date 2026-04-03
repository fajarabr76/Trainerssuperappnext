'use server'

import { createClient } from '@/app/lib/supabase/server';
import { revalidatePath } from 'next/cache';

async function validateAdminRole() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Tidak terautentikasi');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const role = profile?.role?.toLowerCase() || '';
  if (role !== 'admin' && role !== 'superadmin') {
    throw new Error('Akses ditolak: Hanya admin yang dapat mengelola pengguna');
  }

  return user;
}

export async function updateUserStatusAction(userId: string, status: 'approved' | 'pending') {
  await validateAdminRole();
  const supabase = await createClient();

  const { error } = await supabase
    .from('profiles')
    .update({ status: status.toLowerCase() })
    .eq('id', userId);

  if (error) throw error;
  revalidatePath('/dashboard/users');
}

export async function updateUserRoleAction(userId: string, newRole: string) {
  await validateAdminRole();
  const supabase = await createClient();

  const { error } = await supabase
    .from('profiles')
    .update({ role: newRole })
    .eq('id', userId);

  if (error) throw error;
  revalidatePath('/dashboard/users');
}

export async function deleteUserAction(userId: string) {
  const user = await validateAdminRole();
  const supabase = await createClient();

  const { error } = await supabase
    .from('profiles')
    .update({ is_deleted: true })
    .eq('id', userId);

  if (error) throw error;

  // Log activity
  await supabase.from('activity_logs').insert({
    user_id: user.id,
    user_name: user.email,
    action: `Menghapus Pengguna ID: ${userId}`,
    module: 'USER_MGMT',
    type: 'delete'
  });

  revalidatePath('/dashboard/users');
}
