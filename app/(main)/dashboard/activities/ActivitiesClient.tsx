'use client';

import { motion, AnimatePresence } from "motion/react";
import { LayoutDashboard, MessageSquare, Mail, Phone, Settings, LogOut, BarChart3, Users, Search, Filter, Download, ChevronLeft, Trash2, Activity, Clock, Target, X, AlertCircle } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from '@/app/lib/supabase/client';
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { useEffect, useState } from "react";
import { activityService, ActivityLog } from "@/app/lib/services/activityService";
import { normalizeModuleName, normalizeActionText } from "@/app/lib/utils";

export default function ActivitiesClient({ user, role, profile }: { user: any, role: string, profile: any }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");

  useEffect(() => {
    async function fetchLogs() {
      try {
        const { data, error } = await supabase
          .from('activity_logs')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setLogs(data || []);
      } catch (err) {
        console.error("Error fetching activity logs:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchLogs();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus log aktivitas ini?')) return;
    
    try {
      await activityService.deleteActivity(id);
      setLogs(logs.filter(l => l.id !== id));
    } catch (err) {
      console.error(err);
      alert('Gagal menghapus log');
    }
  };

  const filteredLogs = logs.filter(l => {
    const matchesSearch = l.user_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          l.action.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || l.type === filterType;
    return matchesSearch && matchesType;
  });

  const isTrainer = role?.toLowerCase() === 'trainer' || role?.toLowerCase() === 'trainers';

  return (
    <main className="h-full overflow-y-auto relative bg-background/50 backdrop-blur-3xl">
      <div className="sticky top-0 z-30 flex justify-end p-6 pointer-events-none">
        <div className="pointer-events-auto">
          <ThemeToggle />
        </div>
      </div>

      <div className="p-8 xl:p-12 max-w-7xl mx-auto relative z-10 -mt-14">
        <header className="mb-12">
           <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-foreground/60 hover:text-primary transition-colors mb-6 group">
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Kembali ke Dashboard
          </Link>
          <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20">
                  <Activity className="w-6 h-6 text-primary" />
              </div>
              <div>
                   <h1 className="text-4xl font-black tracking-tighter">Riwayat Aktivitas</h1>
                   <p className="text-foreground/60 text-sm font-medium mt-1 uppercase tracking-widest opacity-80">Audit Log Seluruh Pengguna & Sistem</p>
              </div>
          </div>
        </header>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="relative md:col-span-2">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
            <input 
              type="text" 
              placeholder="Cari user atau aktivitas..." 
              className="w-full pl-12 pr-4 py-3 bg-card border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
            <select 
              className="w-full pl-12 pr-4 py-3 bg-card border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none appearance-none font-medium"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="all">Semua Tipe</option>
              <option value="login">Login</option>
              <option value="add">Tambah Data</option>
              <option value="edit">Ubah Data</option>
              <option value="delete">Hapus Data</option>
            </select>
          </div>
          <button className="flex items-center justify-center gap-2 px-6 py-3 bg-card border border-border rounded-xl hover:bg-foreground/5 transition-all font-black text-[10px] uppercase tracking-widest">
            <Download className="w-4 h-4" /> Export Audit Log
          </button>
        </div>

        {/* Activity Table */}
        <div className="bg-card border border-border rounded-[2.5rem] overflow-hidden shadow-2xl relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
          <div className="overflow-x-auto relative z-10">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-foreground/[0.02] border-b border-border">
                  <th className="px-6 py-5 font-black text-[10px] uppercase tracking-widest opacity-40">Waktu</th>
                  <th className="px-6 py-5 font-black text-[10px] uppercase tracking-widest opacity-40">User</th>
                  <th className="px-6 py-5 font-black text-[10px] uppercase tracking-widest opacity-40">Aktivitas</th>
                  <th className="px-6 py-5 font-black text-[10px] uppercase tracking-widest opacity-40">Modul</th>
                  <th className="px-6 py-5 font-black text-[10px] uppercase tracking-widest opacity-40">Tipe</th>
                  {isTrainer && <th className="px-4 py-5 font-black text-[10px] uppercase tracking-widest opacity-40 text-right w-16">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={isTrainer ? 6 : 5} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-4">
                          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          <span className="text-xs font-black uppercase tracking-widest opacity-40">Menyelaraskan audit log...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={isTrainer ? 6 : 5} className="px-6 py-20 text-center">
                       <div className="flex flex-col items-center gap-4">
                          <AlertCircle className="w-12 h-12 text-foreground/10" />
                          <span className="text-xs font-black uppercase tracking-widest opacity-40">Tidak ada log aktivitas ditemukan.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-foreground/[0.02] transition-colors group">
                      <td className="px-6 py-5 text-sm">
                        <span className="font-bold block tracking-tighter">
                          {new Date(log.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-30 mt-1 block tracking-[0.2em]">{new Date(log.created_at).toLocaleTimeString('id-ID')}</span>
                      </td>
                      <td className="px-6 py-5">
                          <div className="flex flex-col">
                              <span className="text-sm font-black tracking-tight">{log.user_name}</span>
                              <span className="text-[10px] opacity-40 lowercase font-mono">
                                  ID: {log.user_id ? `${log.user_id.substring(0,8)}...` : 'Unknown'}
                              </span>
                          </div>
                      </td>
                      <td className="px-6 py-5 text-sm font-bold tracking-tight text-foreground/80">{normalizeActionText(log.action)}</td>
                      <td className="px-6 py-5">
                          <span className="px-2 py-0.5 rounded bg-foreground/5 text-[10px] font-black uppercase tracking-widest opacity-60">
                              {normalizeModuleName(log.module)}
                          </span>
                      </td>
                      <td className="px-6 py-5">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] ${
                          log.type === 'login' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' :
                          log.type === 'edit' ? 'bg-purple-500/10 text-purple-500 border border-purple-500/20' :
                          log.type === 'add' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                          'bg-red-500/10 text-red-500 border border-red-500/20'
                        }`}>
                          {log.type}
                        </span>
                      </td>
                      {isTrainer && (
                        <td className="px-4 py-5 text-right">
                           <button 
                              onClick={() => handleDelete(log.id)}
                              className="p-2 text-foreground/10 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                              title="Hapus Log"
                           >
                              <Trash2 className="w-4 h-4" />
                           </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
