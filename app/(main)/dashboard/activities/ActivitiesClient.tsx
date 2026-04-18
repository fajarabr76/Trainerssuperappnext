'use client';

import { Search, Filter, Download, Trash2, Activity, AlertCircle } from "lucide-react";
import { useState } from "react";
import { ActivityLog } from "@/app/lib/services/activityService";
import { normalizeModuleName, normalizeActionText } from "@/app/lib/utils";
import { deleteActivityAction } from "./actions";
import PageHeroHeader from "@/app/components/PageHeroHeader";
import { User } from "@supabase/supabase-js";
import { Profile } from "@/app/types/auth";

export default function ActivitiesClient({
  role,
  initialLogs,
}: {
  user: User | null,
  role: string,
  profile: Profile | null,
  initialLogs: ActivityLog[],
}) {
  const [logs, setLogs] = useState<ActivityLog[]>(initialLogs);
  const [loading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus log aktivitas ini?')) return;
    
    try {
      await deleteActivityAction(id);
      setLogs(logs.filter(l => l.id !== id));
    } catch (err: unknown) {
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

  const canManage = role?.toLowerCase() === 'trainer' || role?.toLowerCase() === 'trainers' || role?.toLowerCase() === 'admin';

  return (
    <main className="h-full overflow-y-auto relative bg-background/50 backdrop-blur-3xl">
      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10 lg:py-10">
        <PageHeroHeader
          eyebrow="Audit log"
          title="Riwayat aktivitas lintas pengguna dan sistem."
          description="Gunakan halaman ini untuk menelusuri log operasional, mencari aktivitas tertentu, dan menjaga traceability di seluruh platform."
          icon={<Activity className="h-3.5 w-3.5" />}
        />

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="relative md:col-span-2">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Cari user atau aktivitas..." 
              className="w-full pl-12 pr-4 py-3 bg-card border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
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
                  {canManage && <th className="px-4 py-5 font-black text-[10px] uppercase tracking-widest opacity-40 text-right w-16">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={canManage ? 6 : 5} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-4">
                          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          <span className="text-xs font-black uppercase tracking-widest opacity-40">Menyelaraskan audit log...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={canManage ? 6 : 5} className="px-6 py-20 text-center">
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
                      {canManage && (
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
