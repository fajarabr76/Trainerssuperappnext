'use client';

import { motion, AnimatePresence } from "motion/react";
import { 
  LayoutDashboard, MessageSquare, Mail, Phone, Settings, 
  LogOut, BarChart3, Users, Search, Shield, UserCog, 
  ChevronLeft, CheckCircle2, XCircle, Trash2, Filter,
  MoreVertical, UserPlus, UserMinus, ShieldCheck, ShieldAlert, KeyRound
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from '@/app/lib/supabase/client';
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { useEffect, useState, useMemo } from "react";
import { updateUserStatusAction, updateUserRoleAction, deleteUserAction } from "./actions";

export default function UsersClient({ user, role, profile }: { user: any, role: string, profile: any }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'active'>('all');

  const fetchAllUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error("Error fetching all users:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllUsers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const updateUserStatus = async (userId: string, status: 'approved' | 'pending') => {
    setUpdating(userId);
    try {
      await updateUserStatusAction(userId, status);
      
      setUsers(users.map(u => u.id === userId ? { ...u, status: status.toLowerCase() } : u));
    } catch (err) {
      console.error("Error updating user status:", err);
      alert("Gagal memperbarui status pengguna.");
    } finally {
      setUpdating(null);
    }
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    setUpdating(userId);
    try {
      await updateUserRoleAction(userId, newRole);
      
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err) {
      console.error("Error updating user role:", err);
      alert("Gagal memperbarui role pengguna.");
    } finally {
      setUpdating(null);
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus pengguna ini? Pengguna tidak akan bisa masuk lagi.")) return;
    
    setUpdating(userId);
    try {
      await deleteUserAction(userId);
      
      setUsers(users.filter(u => u.id !== userId));
    } catch (err) {
      console.error("Error deleting user:", err);
      alert("Gagal menghapus pengguna.");
    } finally {
      setUpdating(null);
    }
  };

  const resetUserPassword = async (userId: string, userEmail: string) => {
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
      setTimeout(() => setResetSuccess(null), 3000);
    } catch (err: any) {
      alert(`Gagal mengirim reset password: ${err.message}`);
    } finally {
      setUpdating(null);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.email?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          u.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeTab === 'pending') return matchesSearch && u.status === 'pending';
    if (activeTab === 'active') return matchesSearch && u.status === 'approved';
    return matchesSearch;
  });

  const pendingCount = users.filter(u => u.status === 'pending').length;

  return (
    <div className="h-full bg-background text-foreground transition-colors duration-500 overflow-hidden">
      {/* Main Content */}
      <main className="h-full overflow-y-auto relative">

        <div className="sticky top-0 z-30 flex justify-end p-6 pointer-events-none">
          <div className="pointer-events-auto">
            <ThemeToggle />
          </div>
        </div>

        <div className="p-12 max-w-6xl mx-auto relative z-10 -mt-20">
          <header className="mb-12">
            <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-foreground/60 hover:text-primary transition-colors mb-6 group">
              <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Kembali ke Dashboard
            </Link>
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <h1 className="text-4xl font-bold tracking-tight mb-2 text-balance">Kelola Pengguna</h1>
                <p className="text-foreground/60">Manajemen hak akses, persetujuan pendaftaran, dan audit peran pengguna.</p>
              </div>
              <div className="flex items-center gap-2 bg-card border border-border p-1.5 rounded-2xl shadow-sm">
                {[
                  { id: 'all', label: 'Semua', count: users.length },
                  { id: 'pending', label: 'Menunggu', count: pendingCount, emoji: '⏳' },
                  { id: 'active', label: 'Aktif', count: users.length - pendingCount, emoji: '✅' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                      activeTab === tab.id 
                        ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' 
                        : 'text-foreground/60 hover:text-foreground hover:bg-foreground/5'
                    }`}
                  >
                    {tab.label}
                    <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${activeTab === tab.id ? 'bg-white/20' : 'bg-foreground/10'}`}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </header>

          {/* Search */}
          <div className="relative mb-8">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
            <input 
              type="text" 
              placeholder="Cari nama atau email pengguna..." 
              className="w-full pl-12 pr-4 py-4 bg-card border border-border rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Users List */}
          <div className="space-y-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-24 text-foreground/40 gap-4">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                <span className="font-medium">Memproses data pengguna...</span>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-24 bg-card/30 border border-dashed border-border rounded-3xl">
                <Users className="w-12 h-12 text-foreground/10 mx-auto mb-4" />
                <p className="text-foreground/40 font-medium">Tidak ada pengguna ditemukan dalam kategori ini.</p>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {filteredUsers.map((u) => (
                  <motion.div 
                    layout
                    key={u.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-card border border-border rounded-3xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6 hover:shadow-xl hover:shadow-primary/5 hover:border-primary/20 transition-all duration-300 group"
                  >
                    <div className="flex items-center gap-5">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center relative overflow-hidden ${u.status === 'pending' ? 'bg-amber-500/10' : 'bg-blue-500/10'}`}>
                        {u.status === 'pending' ? (
                          <UserPlus className="w-6 h-6 text-amber-500" />
                        ) : (
                          <ShieldCheck className="w-6 h-6 text-blue-500" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div>
                        <div className="font-bold text-lg flex items-center gap-2">
                          {u.email}
                          {u.status === 'pending' && (
                            <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 text-[10px] uppercase tracking-wider font-bold rounded-md">Pending</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-foreground/40">ID: {u.id.substring(0,8)}...</span>
                          <span className="w-1 h-1 bg-foreground/10 rounded-full" />
                          <span className="text-xs text-foreground/40">Daftar: {new Date(u.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 lg:gap-8">
                      {/* Role Switcher */}
                      <div className="flex flex-col gap-2">
                        <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-foreground/30 px-1">Peran Akses</span>
                        <div className="flex bg-foreground/5 p-1 rounded-xl border border-border/50">
                          {['Agent', 'Trainer', 'Leader'].map((r) => (
                            <button
                              key={r}
                              disabled={updating === u.id || u.role?.toLowerCase() === r.toLowerCase()}
                              onClick={() => updateUserRole(u.id, r)}
                              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                                u.role?.toLowerCase() === r.toLowerCase()
                                  ? 'bg-primary text-primary-foreground shadow-md' 
                                  : 'text-foreground/40 hover:text-foreground'
                              } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                              {r}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Status Actions */}
                      <div className="flex items-center gap-2 ml-auto lg:ml-0">
                        {u.status === 'pending' ? (
                          <button
                            onClick={() => updateUserStatus(u.id, 'approved')}
                            disabled={updating === u.id}
                            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/20 hover:scale-[1.05] active:scale-[0.95] transition-all disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-4 h-4" /> Terima
                          </button>
                        ) : (
                          <button
                            onClick={() => updateUserStatus(u.id, 'pending')}
                            disabled={updating === u.id}
                            className="flex items-center gap-2 px-5 py-2.5 bg-amber-500/10 text-amber-600 border border-amber-500/20 rounded-xl text-sm font-bold hover:bg-amber-500/20 transition-all disabled:opacity-50"
                          >
                            <XCircle className="w-4 h-4" /> Tangguhkan
                          </button>
                        )}
                        <button
                          onClick={() => resetUserPassword(u.id, u.email)}
                          disabled={updating === u.id}
                          className={`p-2.5 rounded-xl transition-all disabled:opacity-50 ${
                            resetSuccess === u.id 
                              ? 'text-green-500 bg-green-500/10' 
                              : 'text-blue-500/40 hover:text-blue-500 hover:bg-blue-500/10'
                          }`}
                          title="Kirim Reset Password"
                        >
                          <KeyRound className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => deleteUser(u.id)}
                          disabled={updating === u.id}
                          className="p-2.5 text-red-500/40 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all disabled:opacity-50"
                          title="Hapus Pengguna"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
