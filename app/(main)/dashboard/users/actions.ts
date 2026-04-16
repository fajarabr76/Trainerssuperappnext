'use server'

import { createClient } from '@/app/lib/supabase/server';
import { normalizeRole } from '@/app/lib/authz';
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

export async function updateUserStatusAction(userId: string, status: 'approved' | 'pending' | 'rejected') {
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
  const { user, role: callerRole } = await validateManagerRole();
  const supabase = await createClient();
  const normalizedNewRole = normalizeRole(newRole);

  if (!normalizedNewRole) {
    throw new Error('Role yang dipilih tidak valid');
  }

  if (user.id === userId && (callerRole === 'admin' || callerRole === 'trainer' || callerRole === 'trainers')) {
    throw new Error('Anda tidak dapat mengubah role akun Anda sendiri dari panel ini');
  }

  // Role restriction logic
  const trainerAllowedRoles = ['agent', 'leader', 'trainer'];
  
  // If caller is trainer/trainers, restrict the roles they can assign
  if (callerRole === 'trainer' || callerRole === 'trainers') {
    if (!trainerAllowedRoles.includes(normalizedNewRole)) {
      throw new Error('Trainer tidak dapat memberikan role admin atau superadmin');
    }
  }

  if (callerRole === 'admin' && normalizedNewRole === 'superadmin') {
    throw new Error('Hanya superadmin yang dapat memberikan role superadmin');
  }

  const { error } = await supabase
    .from('profiles')
    .update({ role: normalizedNewRole })
    .eq('id', userId);

  if (error) throw error;
  revalidatePath('/dashboard/users');
}

export async function deleteUserAction(userId: string) {
  const { user, role } = await validateManagerRole();
  const supabase = await createClient();

  if (!['admin', 'superadmin'].includes(role)) {
    throw new Error('Hanya admin atau superadmin yang dapat menghapus pengguna');
  }

  if (user.id === userId) {
    throw new Error('Akun Anda sendiri tidak dapat dihapus dari panel ini');
  }

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
