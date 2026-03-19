'use client';

import { motion } from "motion/react";
import { LayoutDashboard, MessageSquare, Mail, Phone, Settings, LogOut, BarChart3, Users, Search, Filter, Download, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from '@/app/lib/supabase/client';
import { ThemeToggle } from "../../components/ThemeToggle";
import { useEffect, useState } from "react";

export default function MonitoringClient({ user, role, profile }: { user: any, role: string, profile: any }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterModule, setFilterModule] = useState("all");

  useEffect(() => {
    async function fetchAllResults() {
      try {
        const { data, error } = await supabase
          .from('results')
          .select(`
            *,
            profiles:user_id (
              email,
              role
            )
          `)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setResults(data || []);
      } catch (err) {
        console.error("Error fetching all results:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchAllResults();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const filteredResults = results.filter(r => {
    const matchesSearch = r.profiles?.email?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         r.scenario_title?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesModule = filterModule === "all" || r.module === filterModule;
    return matchesSearch && matchesModule;
  });

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
            {(role?.toLowerCase() === 'trainer' || role?.toLowerCase() === 'trainers') && (
              <Link href="/dashboard/users" className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${pathname === '/dashboard/users' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-foreground/60 hover:bg-foreground/5 hover:text-foreground'}`}>
                <Users className="w-4 h-4" /> Kelola Pengguna
              </Link>
            )}
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

        <div className="p-12 max-w-7xl mx-auto relative z-10 -mt-20">
          <header className="mb-12">
            <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-foreground/60 hover:text-primary transition-colors mb-6 group">
              <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Kembali ke Dashboard
            </Link>
            <h1 className="text-4xl font-bold tracking-tight mb-2">Monitoring Performa</h1>
            <p className="text-foreground/60">Pantau hasil simulasi seluruh agen Kontak OJK 157 secara real-time.</p>
          </header>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
              <input 
                type="text" 
                placeholder="Cari email agen atau skenario..." 
                className="w-full pl-12 pr-4 py-3 bg-card border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
              <select 
                className="w-full pl-12 pr-4 py-3 bg-card border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none appearance-none"
                value={filterModule}
                onChange={(e) => setFilterModule(e.target.value)}
              >
                <option value="all">Semua Modul</option>
                <option value="ketik">Ketik (Chat)</option>
                <option value="pdkt">PDKT (Email)</option>
                <option value="telefun">Telefun (Voice)</option>
              </select>
            </div>
            <button className="flex items-center justify-center gap-2 px-6 py-3 bg-foreground/5 hover:bg-foreground/10 border border-border rounded-xl transition-all font-medium">
              <Download className="w-4 h-4" /> Export Data
            </button>
          </div>

          {/* Table */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-foreground/5 border-bottom border-border">
                    <th className="px-6 py-4 font-mono text-[10px] uppercase tracking-widest opacity-50">Tanggal</th>
                    <th className="px-6 py-4 font-mono text-[10px] uppercase tracking-widest opacity-50">Agen</th>
                    <th className="px-6 py-4 font-mono text-[10px] uppercase tracking-widest opacity-50">Modul</th>
                    <th className="px-6 py-4 font-mono text-[10px] uppercase tracking-widest opacity-50">Skenario</th>
                    <th className="px-6 py-4 font-mono text-[10px] uppercase tracking-widest opacity-50 text-center">Skor</th>
                    <th className="px-6 py-4 font-mono text-[10px] uppercase tracking-widest opacity-50 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-foreground/40">Memuat data...</td>
                    </tr>
                  ) : filteredResults.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-foreground/40">Tidak ada data ditemukan.</td>
                    </tr>
                  ) : (
                    filteredResults.map((result) => (
                      <tr key={result.id} className="hover:bg-foreground/5 transition-colors group">
                        <td className="px-6 py-4 text-sm whitespace-nowrap">
                          {new Date(result.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                          <span className="block text-[10px] opacity-40">{new Date(result.created_at).toLocaleTimeString('id-ID')}</span>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium">{result.profiles?.email}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                            result.module === 'ketik' ? 'bg-blue-500/10 text-blue-500' :
                            result.module === 'pdkt' ? 'bg-purple-500/10 text-purple-500' :
                            'bg-emerald-500/10 text-emerald-500'
                          }`}>
                            {result.module}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-foreground/70">{result.scenario_title}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`text-sm font-bold ${
                            result.score >= 80 ? 'text-emerald-500' :
                            result.score >= 60 ? 'text-yellow-500' :
                            'text-red-500'
                          }`}>
                            {result.score}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button className="text-primary hover:underline text-xs font-medium">Detail</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
