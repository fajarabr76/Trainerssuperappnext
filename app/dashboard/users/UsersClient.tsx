'use client';

import { motion } from "motion/react";
import { LayoutDashboard, MessageSquare, Mail, Phone, Settings, LogOut, BarChart3, Users, Search, Shield, UserCog, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from '@/app/lib/supabase/client';
import { ThemeToggle } from "../../components/ThemeToggle";
import { useEffect, useState } from "react";

export default function UsersClient({ user, role, profile }: { user: any, role: string, profile: any }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAllUsers() {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .order('email', { ascending: true });

        if (error) throw error;
        setUsers(data || []);
      } catch (err) {
        console.error("Error fetching all users:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchAllUsers();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    setUpdating(userId);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;
      
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err) {
      console.error("Error updating user role:", err);
      alert("Gagal memperbarui role pengguna.");
    } finally {
      setUpdating(null);
    }
  };

  const filteredUsers = users.filter(u => 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex transition-colors duration-500">
      {/* Sidebar - Reused from Dashboard */}
      <aside className="w-72 border-r border-border flex flex-col bg-card/50 backdrop-blur-xl relative z-20">
        <div className="p-8">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
              <Phone className="text-primary-foreground w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold tracking-widest uppercase text-sm">Trainers SuperApp</span>
              <span className="font-mono text-[10px] tracking-widest uppercase opacity-50">Kontak OJK 157</span>
            </div>
          </div>

          <nav className="space-y-2">
            <div className="font-mono text-[10px] uppercase tracking-widest text-foreground/40 mb-4 ml-2">Menu Utama</div>
            <Link href="/dashboard" className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${pathname === '/dashboard' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-foreground/60 hover:bg-foreground/5 hover:text-foreground'}`}>
              <LayoutDashboard className="w-4 h-4" /> Dashboard
            </Link>
            <Link href="/ketik" className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${pathname === '/ketik' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-foreground/60 hover:bg-foreground/5 hover:text-foreground'}`}>
              <MessageSquare className="w-4 h-4" /> Ketik
            </Link>
            <Link href="/pdkt" className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${pathname === '/pdkt' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-foreground/60 hover:bg-foreground/5 hover:text-foreground'}`}>
              <Mail className="w-4 h-4" /> PDKT
            </Link>
            <Link href="/telefun" className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${pathname === '/telefun' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-foreground/60 hover:bg-foreground/5 hover:text-foreground'}`}>
              <Phone className="w-4 h-4" /> Telefun
            </Link>
            <Link href="/profiler" className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${pathname === '/profiler' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-foreground/60 hover:bg-foreground/5 hover:text-foreground'}`}>
              <Users className="w-4 h-4" /> Profiler
            </Link>
            <Link href="/qa-analyzer" className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${pathname === '/qa-analyzer' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-foreground/60 hover:bg-foreground/5 hover:text-foreground'}`}>
              <BarChart3 className="w-4 h-4" /> QA Analyzer
            </Link>

            <div className="font-mono text-[10px] uppercase tracking-widest text-foreground/40 mb-4 mt-8 ml-2">Manajemen</div>
            <Link href="/dashboard/monitoring" className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${pathname === '/dashboard/monitoring' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-foreground/60 hover:bg-foreground/5 hover:text-foreground'}`}>
              <BarChart3 className="w-4 h-4" /> Monitoring
            </Link>
            <Link href="/dashboard/users" className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${pathname === '/dashboard/users' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-foreground/60 hover:bg-foreground/5 hover:text-foreground'}`}>
              <Users className="w-4 h-4" /> Kelola Pengguna
            </Link>
          </nav>
        </div>

        <div className="mt-auto p-8 border-t border-border">
          <div className="font-mono text-[10px] uppercase tracking-widest text-foreground/40 mb-4 ml-2">Sistem</div>
          <div className="space-y-2">
            <div className="px-4 py-3 text-sm font-medium text-foreground/60 mb-2">
              Masuk sebagai <br/>
              <span className="text-foreground font-bold">{role}</span>
              <br/>
              <span className="text-xs text-foreground/40 truncate block">{user?.email}</span>
            </div>
            <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 text-red-500/80 hover:text-red-500 rounded-xl text-sm font-medium transition-colors">
              <LogOut className="w-4 h-4" /> Keluar
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative">
        <div className="sticky top-0 z-30 flex justify-end p-6 pointer-events-none">
          <div className="pointer-events-auto">
            <ThemeToggle />
          </div>
        </div>

        <div className="p-12 max-w-5xl mx-auto relative z-10 -mt-20">
          <header className="mb-12">
            <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-foreground/60 hover:text-primary transition-colors mb-6 group">
              <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Kembali ke Dashboard
            </Link>
            <h1 className="text-4xl font-bold tracking-tight mb-2">Kelola Pengguna</h1>
            <p className="text-foreground/60">Atur hak akses dan role untuk seluruh pengguna Trainers SuperApp.</p>
          </header>

          {/* Search */}
          <div className="relative mb-8">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
            <input 
              type="text" 
              placeholder="Cari email pengguna..." 
              className="w-full pl-12 pr-4 py-3 bg-card border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Users List */}
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-12 text-foreground/40">Memuat data pengguna...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-12 text-foreground/40">Tidak ada pengguna ditemukan.</div>
            ) : (
              filteredUsers.map((u) => (
                <div key={u.id} className="bg-card border border-border rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-primary/20 transition-all shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-foreground/5 rounded-full flex items-center justify-center">
                      <Users className="w-6 h-6 text-foreground/40" />
                    </div>
                    <div>
                      <div className="font-bold">{u.email}</div>
                      <div className="flex items-center gap-2 text-xs text-foreground/40">
                        <Shield className="w-3 h-3" /> Role Saat Ini: <span className="text-primary font-medium">{u.role}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-foreground/40 mr-2">Ubah Role:</div>
                    <div className="flex bg-foreground/5 p-1 rounded-lg">
                      {['Agent', 'Trainer', 'Leader'].map((r) => (
                        <button
                          key={r}
                          disabled={updating === u.id || u.role === r}
                          onClick={() => updateUserRole(u.id, r)}
                          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                            u.role === r 
                              ? 'bg-primary text-primary-foreground shadow-sm' 
                              : 'text-foreground/60 hover:text-foreground'
                          } disabled:opacity-50`}
                        >
                          {updating === u.id && u.role !== r ? '...' : r}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
