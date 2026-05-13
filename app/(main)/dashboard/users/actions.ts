'use server'

import { createClient } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { normalizeRole, PROFILE_FIELDS } from '@/app/lib/authz';
import { revalidatePath } from 'next/cache';

type ManagedTargetProfile = {
  id: string;
  role: string | null;
  status: string | null;
  is_deleted: boolean | null;
};

async function validateManagerRole() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Tidak terautentikasi');

  const { data: profile, error } = await supabase
    .from('profiles')
    .select(PROFILE_FIELDS)
    .eq('id', user.id)
    .single();

  if (error || !profile) {
    throw new Error('Profil pengelola tidak ditemukan atau gagal dibaca');
  }

  if (profile?.is_deleted) {
    throw new Error('Akses ditolak: akun Anda sudah dinonaktifkan');
  }

  const status = profile?.status?.toLowerCase();
  if (status !== 'approved') {
    throw new Error('Akses ditolak: akun Anda belum disetujui');
  }

  const role = normalizeRole(profile?.role);
  const allowedRoles: string[] = ['admin', 'trainer'];
  if (!allowedRoles.includes(role)) {
    throw new Error('Akses ditolak: Anda tidak memiliki izin untuk mengelola pengguna');
  }

  return { user, role };
}

async function getManagedTargetProfile(
  adminClient: ReturnType<typeof createAdminClient>,
  userId: string
): Promise<ManagedTargetProfile> {
  const { data, error } = await adminClient
    .from('profiles')
    .select('id, role, status, is_deleted')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Pengguna target tidak ditemukan');

  return data as ManagedTargetProfile;
}

export async function updateUserStatusAction(userId: string, status: 'approved' | 'pending' | 'rejected') {
  const { user, role: callerRole } = await validateManagerRole();

  if (user.id === userId) {
    throw new Error('Anda tidak dapat mengubah status akun Anda sendiri dari panel ini');
  }

  const adminClient = createAdminClient();
  const targetProfile = await getManagedTargetProfile(adminClient, userId);

  if (callerRole === 'trainer' && normalizeRole(targetProfile.role) === 'admin') {
    throw new Error('Trainer tidak dapat mengubah status akun admin');
  }

  const { error } = await adminClient
    .from('profiles')
    .update({ status: status.toLowerCase() })
    .eq('id', userId)
    .select('id')
    .single();

  if (error) throw error;
  revalidatePath('/dashboard/users');
}

export async function updateUserRoleAction(userId: string, newRole: string) {
  const { user, role: callerRole } = await validateManagerRole();
  const normalizedNewRole = normalizeRole(newRole);

  if (!normalizedNewRole) {
    throw new Error('Role yang dipilih tidak valid');
  }

  if (user.id === userId) {
    throw new Error('Anda tidak dapat mengubah role akun Anda sendiri dari panel ini');
  }

  // Role restriction logic
  const trainerAllowedRoles = ['agent', 'leader', 'trainer'];

  const adminClient = createAdminClient();
  const targetProfile = await getManagedTargetProfile(adminClient, userId);

  // If caller is trainer, restrict the roles they can assign
  if (callerRole === 'trainer') {
    if (normalizeRole(targetProfile.role) === 'admin') {
      throw new Error('Trainer tidak dapat mengubah akun admin');
    }

    if (!trainerAllowedRoles.includes(normalizedNewRole)) {
      throw new Error('Trainer tidak dapat memberikan role admin');
    }
  }

  const { error } = await adminClient
    .from('profiles')
    .update({ role: normalizedNewRole })
    .eq('id', userId)
    .select('id')
    .single();

  if (error) throw error;
  revalidatePath('/dashboard/users');
}

export async function deleteUserAction(userId: string) {
  const { user, role } = await validateManagerRole();

  if (!['admin'].includes(role)) {
    throw new Error('Hanya admin yang dapat menghapus pengguna');
  }

  if (user.id === userId) {
    throw new Error('Akun Anda sendiri tidak dapat dihapus dari panel ini');
  }

  const adminClient = createAdminClient();
  await getManagedTargetProfile(adminClient, userId);

  const { error } = await adminClient
    .from('profiles')
    .update({ is_deleted: true })
    .eq('id', userId)
    .select('id')
    .single();

  if (error) throw error;

  // Log activity
  await adminClient.from('activity_logs').insert({
    user_id: user.id,
    user_name: user.email,
    action: `Menghapus Pengguna ID: ${userId}`,
    module: 'USER_MGMT',
    type: 'delete'
  });

  revalidatePath('/dashboard/users');
}
