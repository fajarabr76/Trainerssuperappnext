'use client';

import { AnimatePresence, motion } from 'motion/react';
import {
  CheckCircle2,
  KeyRound,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import PageHeroHeader from '@/app/components/PageHeroHeader';
import { normalizeRoleLabel } from '@/app/lib/app-config';
import { createClient } from '@/app/lib/supabase/client';
import { deleteUserAction, updateUserRoleAction, updateUserStatusAction } from './actions';

type ManagerRole = 'trainer' | 'admin' | 'superadmin';
type UserStatus = 'approved' | 'pending' | 'rejected';

interface ManagedUser {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  status: string | null;
  created_at: string;
  is_deleted?: boolean | null;
}

interface UsersClientProps {
  user: { id: string; email?: string | null };
  role: string;
  profile: { full_name?: string | null } | null;
}

const ROLE_OPTIONS: Record<ManagerRole, string[]> = {
  trainer: ['agent', 'leader', 'trainer'],
  admin: ['agent', 'leader', 'trainer', 'admin'],
  superadmin: ['agent', 'leader', 'trainer', 'admin', 'superadmin'],
};

function normalizeRoleValue(role?: string | null) {
  const value = role?.toLowerCase().trim() ?? '';
  if (value === 'trainers') return 'trainer';
  if (value === 'agents') return 'agent';
  if (['agent', 'leader', 'trainer', 'admin', 'superadmin'].includes(value)) return value;
  return '';
}

export default function UsersClient({ user, role, profile: _profile }: UsersClientProps) {
  const supabase = useMemo(() => createClient(), []);
  const managerRole = (normalizeRoleValue(role) || 'trainer') as ManagerRole;

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'active' | 'rejected'>('all');
  const [selectedRoles, setSelectedRoles] = useState<Record<string, string>>({});

  const fetchAllUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, status, created_at, is_deleted')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const nextUsers = (data || []) as ManagedUser[];
      setUsers(nextUsers);
      setSelectedRoles(
        Object.fromEntries(
          nextUsers.map((entry) => [entry.id, normalizeRoleValue(entry.role) || 'agent'])
        )
      );
    } catch (err) {
      console.error('Error fetching all users:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void fetchAllUsers();
  }, [fetchAllUsers]);

  const updateUserStatus = async (userId: string, status: UserStatus) => {
    setUpdating(userId);
    try {
      await updateUserStatusAction(userId, status);
      setUsers((current) => current.map((entry) => (
        entry.id === userId ? { ...entry, status } : entry
      )));
    } catch (err) {
      console.error('Error updating user status:', err);
      alert('Gagal memperbarui status pengguna.');
    } finally {
      setUpdating(null);
    }
  };

  const updateUserRole = async (userId: string) => {
    const nextRole = selectedRoles[userId];
    if (!nextRole) return;

    setUpdating(userId);
    try {
      await updateUserRoleAction(userId, nextRole);
      setUsers((current) => current.map((entry) => (
        entry.id === userId ? { ...entry, role: nextRole } : entry
      )));
    } catch (err) {
      console.error('Error updating user role:', err);
      alert(err instanceof Error ? err.message : 'Gagal memperbarui role pengguna.');
    } finally {
      setUpdating(null);
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus pengguna ini? Pengguna tidak akan bisa masuk lagi.')) return;

    setUpdating(userId);
    try {
      await deleteUserAction(userId);
      setUsers((current) => current.filter((entry) => entry.id !== userId));
    } catch (err) {
      console.error('Error deleting user:', err);
      alert(err instanceof Error ? err.message : 'Gagal menghapus pengguna.');
    } finally {
      setUpdating(null);
    }
  };

  const resetUserPassword = async (userId: string, userEmail: string | null) => {
    if (!userEmail) {
      alert('Email pengguna tidak tersedia.');
      return;
    }

    if (!confirm(`Kirim link reset password ke ${userEmail}?`)) return;

    setUpdating(userId);
    try {
      const response = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error);

      setResetSuccess(userId);
      window.setTimeout(() => setResetSuccess((current) => (current === userId ? null : current)), 3000);
    } catch (err) {
      alert(`Gagal mengirim reset password: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setUpdating(null);
    }
  };

  const filteredUsers = users.filter((entry) => {
    const matchesSearch =
      entry.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.full_name?.toLowerCase().includes(searchTerm.toLowerCase());

    if (activeTab === 'pending') return matchesSearch && entry.status === 'pending';
    if (activeTab === 'active') return matchesSearch && entry.status === 'approved';
    if (activeTab === 'rejected') return matchesSearch && entry.status === 'rejected';
    return matchesSearch;
  });

  const pendingCount = users.filter((entry) => entry.status === 'pending').length;
  const rejectedCount = users.filter((entry) => entry.status === 'rejected').length;

  return (
    <div className="h-full overflow-hidden bg-background text-foreground transition-colors duration-500">
      <main className="relative h-full overflow-y-auto">
        <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10 lg:py-10">
          <PageHeroHeader
            eyebrow="Access control"
            title="Kelola akses pengguna dengan ritme yang sama seperti workspace lain."
            description="Review pendaftaran, atur role, kirim reset password, dan jaga tata kelola pengguna dari satu panel yang lebih konsisten."
            icon={<Users className="h-3.5 w-3.5" />}
          />

          <header className="mb-10 space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-3xl font-semibold tracking-tight text-balance">Kelola Pengguna</h2>
                <p className="text-muted-foreground">
                  Approval, suspend, role access, dan reset password kini kembali terkumpul dalam satu panel aksi.
                </p>
              </div>
              <div className="rounded-[1.75rem] border border-border/60 bg-card/80 px-5 py-4 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Operator aktif</p>
                <p className="mt-2 text-sm font-semibold">{user.email || 'No email'}</p>
                <p className="mt-1 text-xs text-muted-foreground">Hak kelola: {normalizeRoleLabel(managerRole)}</p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Cari nama atau email pengguna..."
                  className="w-full rounded-2xl border border-border bg-card px-12 py-4 shadow-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>

              <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-1.5 shadow-sm">
                {[
                  { id: 'all', label: 'Semua', count: users.length },
                  { id: 'pending', label: 'Menunggu', count: pendingCount },
                  { id: 'active', label: 'Aktif', count: users.filter((entry) => entry.status === 'approved').length },
                  { id: 'rejected', label: 'Ditolak', count: rejectedCount },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as 'all' | 'pending' | 'active' | 'rejected')}
                    className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                      activeTab === tab.id
                        ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                        : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className={`rounded-md px-1.5 py-0.5 text-[10px] ${activeTab === tab.id ? 'bg-white/20' : 'bg-foreground/10'}`}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </header>

          <div className="space-y-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-4 py-24 text-muted-foreground">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
                <span className="font-medium">Memproses data pengguna...</span>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border bg-card/30 py-24 text-center">
                <Users className="mx-auto mb-4 h-12 w-12 text-foreground/10" />
                <p className="font-medium text-muted-foreground">Tidak ada pengguna ditemukan dalam kategori ini.</p>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {filteredUsers.map((entry) => {
                  const normalizedEntryRole = normalizeRoleValue(entry.role) || 'agent';
                  const isPending = entry.status === 'pending';
                  const isRejected = entry.status === 'rejected';
                  const isSelf = entry.id === user.id;
                  const canDelete = (managerRole === 'admin' || managerRole === 'superadmin') && !isSelf;
                  const canChangeRole = !isSelf || managerRole === 'superadmin';
                  const isRoleChanged = selectedRoles[entry.id] && selectedRoles[entry.id] !== normalizedEntryRole;

                  return (
                    <motion.article
                      layout
                      key={entry.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      className="grid gap-5 rounded-[2rem] border border-border bg-card/95 p-6 shadow-sm transition-all duration-300 hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5 xl:grid-cols-[minmax(0,1fr)_380px]"
                    >
                      <div className="space-y-5">
                        <div className="flex items-start gap-4">
                          <div className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${isPending ? 'bg-amber-500/10' : isRejected ? 'bg-red-500/10' : 'bg-blue-500/10'}`}>
                            {isPending ? (
                              <UserPlus className="h-6 w-6 text-amber-500" />
                            ) : isRejected ? (
                              <XCircle className="h-6 w-6 text-red-500" />
                            ) : (
                              <ShieldCheck className="h-6 w-6 text-blue-500" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-lg font-semibold tracking-tight">{entry.full_name || entry.email || 'Tanpa nama'}</h3>
                              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.22em] ${isPending ? 'bg-amber-500/10 text-amber-600' : isRejected ? 'bg-red-500/10 text-red-600' : 'bg-emerald-500/10 text-emerald-600'}`}>
                                {isPending ? 'Pending' : isRejected ? 'Ditolak' : 'Approved'}
                              </span>
                              {isSelf && (
                                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
                                  Anda
                                </span>
                              )}
                            </div>
                            <p className="mt-1 break-all text-sm text-muted-foreground">{entry.email || 'Email tidak tersedia'}</p>
                            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                              <span>ID: {entry.id.slice(0, 8)}...</span>
                              <span className="h-1 w-1 rounded-full bg-foreground/10" />
                              <span>Daftar: {new Date(entry.created_at).toLocaleDateString()}</span>
                              <span className="h-1 w-1 rounded-full bg-foreground/10" />
                              <span>Role aktif: {normalizeRoleLabel(entry.role)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-3">
                          <ActionCard
                            icon={<CheckCircle2 className="h-4 w-4" />}
                            title={isPending ? 'Approve atau Tolak' : isRejected ? 'Pulihkan user' : 'Suspend user'}
                            description={isPending ? 'Kelola pendaftaran pengguna baru sebelum mengizinkan login.' : isRejected ? 'Kembalikan user yang ditolak agar bisa direview kembali.' : 'Kembalikan user ke status pending tanpa menghapus akun.'}
                            tone={isPending ? 'success' : isRejected ? 'neutral' : 'warning'}
                          />
                          <ActionCard
                            icon={<KeyRound className="h-4 w-4" />}
                            title="Reset password"
                            description="Kirim email reset password langsung dari panel user management."
                            tone="info"
                          />
                          <ActionCard
                            icon={<Settings2 className="h-4 w-4" />}
                            title="Atur role & lifecycle"
                            description="Kelola role, status approval, dan aksi penghapusan dari panel kontrol yang konsisten."
                            tone="neutral"
                          />
                        </div>
                      </div>

                      <aside className="rounded-[1.75rem] border border-border/70 bg-background/65 p-5">
                        <div className="mb-4">
                          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Pengaturan pengguna</p>
                          <h4 className="mt-2 text-sm font-semibold">Kontrol akses & aksi cepat</h4>
                        </div>

                        <div className="space-y-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Role</label>
                            <div className="flex gap-2">
                              <select
                                value={selectedRoles[entry.id] || normalizedEntryRole}
                                onChange={(event) => {
                                  const nextRole = event.target.value;
                                  setSelectedRoles((current) => ({ ...current, [entry.id]: nextRole }));
                                }}
                                disabled={updating === entry.id || !canChangeRole}
                                className="min-w-0 flex-1 rounded-xl border border-border bg-card px-3 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {ROLE_OPTIONS[managerRole].map((option) => (
                                  <option key={option} value={option}>
                                    {normalizeRoleLabel(option)}
                                  </option>
                                ))}
                              </select>
                              <button
                                onClick={() => void updateUserRole(entry.id)}
                                disabled={updating === entry.id || !isRoleChanged || !canChangeRole}
                                className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Simpan
                              </button>
                            </div>
                            {!canChangeRole && (
                              <p className="text-xs text-muted-foreground">Role akun sendiri hanya bisa diubah oleh superadmin.</p>
                            )}
                          </div>

                          <div className="grid gap-2 sm:grid-cols-2">
                            {isPending ? (
                              <>
                                <button
                                  onClick={() => void updateUserStatus(entry.id, 'approved')}
                                  disabled={updating === entry.id}
                                  className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                  Approve user
                                </button>
                                <button
                                  onClick={() => void updateUserStatus(entry.id, 'rejected')}
                                  disabled={updating === entry.id}
                                  className="flex items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <XCircle className="h-4 w-4" />
                                  Tolak user
                                </button>
                              </>
                            ) : isRejected ? (
                              <button
                                onClick={() => void updateUserStatus(entry.id, 'pending')}
                                disabled={updating === entry.id}
                                className="flex items-center justify-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-600 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <UserPlus className="h-4 w-4" />
                                Pulihkan ke pending
                              </button>
                            ) : (
                              <button
                                onClick={() => void updateUserStatus(entry.id, 'pending')}
                                disabled={updating === entry.id}
                                className="flex items-center justify-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-600 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <XCircle className="h-4 w-4" />
                                Suspend / pending
                              </button>
                            )}

                            <button
                              onClick={() => void resetUserPassword(entry.id, entry.email)}
                              disabled={updating === entry.id}
                              className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                resetSuccess === entry.id
                                  ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600'
                                  : 'border-blue-500/20 bg-blue-500/10 text-blue-600 hover:bg-blue-500/15'
                              }`}
                            >
                              <KeyRound className="h-4 w-4" />
                              {resetSuccess === entry.id ? 'Link terkirim' : 'Reset password'}
                            </button>

                            <button
                              onClick={() => void deleteUser(entry.id)}
                              disabled={updating === entry.id || !canDelete}
                              className="flex items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete user
                            </button>
                          </div>

                          {managerRole === 'trainer' && (
                            <p className="text-xs leading-5 text-muted-foreground">
                              Trainer dapat approve/tolak user, reset password, suspend user, dan mengubah role sampai level Trainer.
                            </p>
                          )}
                          {managerRole === 'admin' && (
                            <p className="text-xs leading-5 text-muted-foreground">
                              Admin dapat menghapus akun dan mengatur role sampai level Admin. Role Superadmin tetap dibatasi.
                            </p>
                          )}
                        </div>
                      </aside>
                    </motion.article>
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function ActionCard({
  icon,
  title,
  description,
  tone,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  tone: 'success' | 'warning' | 'info' | 'neutral';
}) {
  const toneClassName = {
    success: 'border-emerald-500/15 bg-emerald-500/8 text-emerald-600',
    warning: 'border-amber-500/15 bg-amber-500/8 text-amber-600',
    info: 'border-blue-500/15 bg-blue-500/8 text-blue-600',
    neutral: 'border-border/70 bg-card text-foreground',
  }[tone];

  return (
    <div className={`rounded-2xl border p-4 ${toneClassName}`}>
      <div className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        <span>{title}</span>
      </div>
      <p className="mt-2 text-xs leading-5 text-current/80">{description}</p>
    </div>
  );
}
