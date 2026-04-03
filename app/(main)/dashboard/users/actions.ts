'use server'

import { createClient } from '@/app/lib/supabase/server';
import { revalidatePath } from 'next/cache';

async function validateManagerRole() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Tidak terautentikasi');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const role = profile?.role?.toLowerCase() || '';
  const allowedRoles = ['admin', 'superadmin', 'trainer', 'trainers'];
  if (!allowedRoles.includes(role)) {
    throw new Error('Akses ditolak: Anda tidak memiliki izin untuk mengelola pengguna');
  }

  return { user, role };
}

export async function updateUserStatusAction(userId: string, status: 'approved' | 'pending') {
  await validateManagerRole();
  const supabase = await createClient();

  const { error } = await supabase
    .from('profiles')
    .update({ status: status.toLowerCase() })
    .eq('id', userId);

  if (error) throw error;
  revalidatePath('/dashboard/users');
}

export async function updateUserRoleAction(userId: string, newRole: string) {
  const { role: callerRole } = await validateManagerRole();
  const supabase = await createClient();

  // Role restriction logic
  const trainerAllowedRoles = ['agent', 'leader', 'trainer', 'trainers'];
  
  // If caller is trainer/trainers, restrict the roles they can assign
  if (callerRole === 'trainer' || callerRole === 'trainers') {
    if (!trainerAllowedRoles.includes(newRole.toLowerCase())) {
      throw new Error('Trainer tidak dapat memberikan role admin atau superadmin');
    }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ role: newRole })
    .eq('id', userId);

  if (error) throw error;
  revalidatePath('/dashboard/users');
}

export async function deleteUserAction(userId: string) {
  const { user } = await validateManagerRole();
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
