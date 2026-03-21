'use client';

import { motion, AnimatePresence } from "motion/react";
import { LayoutDashboard, MessageSquare, Mail, Phone, Settings, LogOut, BarChart3, Users, Search, Filter, Download, ChevronLeft, X, Clock, Eye, FileText } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from '@/app/lib/supabase/client';
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { useEffect, useState, useMemo } from "react";

// Types for unified history
interface UnifiedHistory {
  id: string;
  user_id: string;
  module: 'ketik' | 'pdkt' | 'telefun';
  scenario_title: string;
  created_at: string;
  duration_seconds: number;
  score: number | null;
  history: any; // raw messages/emails/recording
  user_email?: string;
  user_role?: string;
}

// Modal Component for Viewing Transcript
const TranscriptModal = ({ isOpen, onClose, result }: { isOpen: boolean, onClose: () => void, result: UnifiedHistory | null }) => {
  if (!isOpen || !result) return null;

  const renderHistory = () => {
    const history = result.history;
    
    if (result.module === 'ketik') {
      const messages = Array.isArray(history) ? history : [];
      return (
        <div className="space-y-4 p-4 max-h-[60vh] overflow-y-auto bg-foreground/5 rounded-2xl">
          {messages.map((msg: any, idx: number) => (
            <div key={idx} className={`flex ${msg.sender === 'agent' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                msg.sender === 'agent' ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-foreground'
              }`}>
                <p className="font-medium">{msg.text}</p>
                {msg.timestamp && (
                  <span className="text-[10px] opacity-40 mt-1 block">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>
          ))}
          {messages.length === 0 && (
            <div className="text-center py-12 text-foreground/40 italic">Tidak ada transcript untuk sesi ini.</div>
          )}
        </div>
      );
    }

    if (result.module === 'pdkt') {
      const emails = Array.isArray(history) ? history : (history?.emails || []);
      return (
        <div className="space-y-6">
          {emails.length > 0 ? emails.map((email: any, idx: number) => (
            <div key={idx} className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-border">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary">Email #{idx + 1}</span>
                        <span className="font-bold text-lg">{email.subject || `Draft Email`}</span>
                    </div>
                </div>
                <div className="prose prose-sm dark:prose-invert max-w-none text-foreground/80 whitespace-pre-wrap leading-relaxed">
                    {email.body || email.content || JSON.stringify(email, null, 2)}
                </div>
            </div>
          )) : (
            <div className="text-center py-12 text-foreground/40 italic">Tidak ada detail email untuk sesi ini.</div>
          )}
        </div>
      );
    }

    return <div className="p-8 text-center text-foreground/60">Detail riwayat sedang diproses untuk modul ini.</div>;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-background/80 backdrop-blur-md" 
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-card border border-border w-full max-w-3xl rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b border-border flex justify-between items-center bg-foreground/[0.02]">
          <div>
            <h2 className="text-xl font-black tracking-tight">{result.scenario_title}</h2>
            <div className="flex items-center gap-2 mt-1">
                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter ${
                    result.module === 'ketik' ? 'bg-blue-500/10 text-blue-500' :
                    result.module === 'pdkt' ? 'bg-purple-500/10 text-purple-500' :
                    'bg-emerald-500/10 text-emerald-500'
                }`}>
                    {result.module}
                </span>
                <span className="text-[10px] text-foreground/40 font-mono">• {result.user_email || 'N/A'}</span>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full hover:bg-foreground/5 flex items-center justify-center transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-8 overflow-y-auto custom-scrollbar">
          {renderHistory()}
        </div>
        <div className="p-6 bg-foreground/[0.02] border-t border-border flex justify-between items-center">
            <div className="flex items-center gap-4">
                <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-widest text-foreground/40">Durasi</span>
                    <span className="text-xl font-black">
                        {result.duration_seconds > 0
                          ? `${Math.floor(result.duration_seconds / 60)}m ${result.duration_seconds % 60}s`
                          : '--:--'}
                    </span>
                </div>
                {result.score !== null && (
                  <div className="flex flex-col ml-6">
                    <span className="text-[10px] font-black uppercase tracking-widest text-foreground/40">Skor</span>
                    <span className={`text-xl font-black ${(result.score ?? 0) >= 80 ? 'text-emerald-500' : (result.score ?? 0) >= 60 ? 'text-yellow-500' : 'text-red-500'}`}>
                        {result.score}
                    </span>
                  </div>
                )}
            </div>
            <button onClick={onClose} className="px-6 py-2.5 bg-foreground text-background font-black text-[10px] uppercase tracking-widest rounded-xl">
                Tutup Detail
            </button>
        </div>
      </motion.div>
    </div>
  );
};

export default function MonitoringClient({ user, role, profile }: { user: any, role: string, profile: any }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [results, setResults] = useState<UnifiedHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterModule, setFilterModule] = useState("all");
  const [selectedResult, setSelectedResult] = useState<UnifiedHistory | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchAllHistory() {
      try {
        // Fetch from all 3 history tables in parallel
        const [ketikRes, pdktRes, telefunRes] = await Promise.all([
          supabase.from('ketik_history').select('*').order('date', { ascending: false }),
          supabase.from('pdkt_history').select('*').order('timestamp', { ascending: false }),
          supabase.from('telefun_history').select('*').order('date', { ascending: false }),
        ]);

        // Fetch user profiles for mapping user_id -> email
        const allUserIds = new Set<string>();
        (ketikRes.data || []).forEach(r => allUserIds.add(r.user_id));
        (pdktRes.data || []).forEach(r => allUserIds.add(r.user_id));
        (telefunRes.data || []).forEach(r => allUserIds.add(r.user_id));

        let profilesMap: Record<string, { email: string; role: string }> = {};
        if (allUserIds.size > 0) {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, email, role')
            .in('id', [...allUserIds]);
          
          (profilesData || []).forEach(p => {
            profilesMap[p.id] = { email: p.email || '', role: p.role || '' };
          });
        }

        const unified: UnifiedHistory[] = [];

        // Transform ketik_history
        (ketikRes.data || []).forEach(r => {
          const messages = Array.isArray(r.messages) ? r.messages : [];
          let durationSeconds = 0;
          const timestamps = messages.filter((m: any) => m.timestamp).map((m: any) => new Date(m.timestamp).getTime());
          if (timestamps.length >= 2) {
            durationSeconds = Math.floor((Math.max(...timestamps) - Math.min(...timestamps)) / 1000);
          }

          unified.push({
            id: r.id,
            user_id: r.user_id,
            module: 'ketik',
            scenario_title: r.scenario_title || 'Simulasi Chat',
            created_at: r.date,
            duration_seconds: durationSeconds,
            score: null,
            history: messages,
            user_email: profilesMap[r.user_id]?.email,
            user_role: profilesMap[r.user_id]?.role,
          });
        });

        // Transform pdkt_history
        (pdktRes.data || []).forEach(r => {
          const config = r.config || {};
          const evaluation = r.evaluation || {};
          unified.push({
            id: r.id,
            user_id: r.user_id,
            module: 'pdkt',
            scenario_title: config?.scenario?.title || config?.subject || 'Simulasi Email',
            created_at: r.timestamp,
            duration_seconds: r.time_taken || 0,
            score: evaluation?.score ?? null,
            history: r.emails || [],
            user_email: profilesMap[r.user_id]?.email,
            user_role: profilesMap[r.user_id]?.role,
          });
        });

        // Transform telefun_history
        (telefunRes.data || []).forEach(r => {
          unified.push({
            id: r.id,
            user_id: r.user_id,
            module: 'telefun',
            scenario_title: r.scenario_title || 'Simulasi Telepon',
            created_at: r.date,
            duration_seconds: r.duration || 0,
            score: null,
            history: r.recording_url,
            user_email: profilesMap[r.user_id]?.email,
            user_role: profilesMap[r.user_id]?.role,
          });
        });

        // Sort by date descending
        unified.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        if (isMounted) {
          setResults(unified);
        }
      } catch (err) {
        console.error("Error fetching history:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchAllHistory();
    return () => { isMounted = false; };
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const filteredResults = results.filter(r => {
    const email = r.user_email || "";
    const title = r.scenario_title || "";
    const matchesSearch = email.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesModule = filterModule === "all" || r.module === filterModule;
    return matchesSearch && matchesModule;
  });

  const getDurationString = (result: UnifiedHistory) => {
    if (result.duration_seconds <= 0) return "--:--";
    const m = Math.floor(result.duration_seconds / 60);
    const s = result.duration_seconds % 60;
    return `${m}m ${s}s`;
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex transition-colors duration-500">
      {/* Sidebar */}
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
            <Link href="/qa-analyzer" className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${pathname.startsWith('/qa-analyzer') ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-foreground/60 hover:bg-foreground/5 hover:text-foreground'}`}>
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
            <Link href="/dashboard/settings" className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${pathname === '/dashboard/settings' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-foreground/60 hover:bg-foreground/5 hover:text-foreground'}`}>
              <Settings className="w-4 h-4" /> Pengaturan
            </Link>
          </nav>
        </div>

        <div className="mt-auto p-8 border-t border-border">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 text-red-500/80 hover:text-red-500 rounded-xl text-sm font-medium transition-colors">
            <LogOut className="w-4 h-4" /> Keluar
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative bg-background/50 backdrop-blur-3xl">
        <div className="sticky top-0 z-30 flex justify-end p-6 pointer-events-none">
          <div className="pointer-events-auto">
            <ThemeToggle />
          </div>
        </div>

        <div className="p-12 max-w-7xl mx-auto relative z-10 -mt-20">
          <header className="mb-12">
            <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20">
                    <Eye className="w-6 h-6 text-primary" />
                </div>
                <div>
                     <h1 className="text-4xl font-black tracking-tighter">Riwayat Simulasi</h1>
                     <p className="text-foreground/60 text-sm font-medium mt-1 uppercase tracking-widest opacity-80">Monitoring Performa Agen &amp; Transcript Sesi</p>
                </div>
            </div>
          </header>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-card border border-border rounded-2xl p-6">
              <div className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-2">Total Sesi</div>
              <div className="text-3xl font-black">{results.length}</div>
            </div>
            <div className="bg-card border border-border rounded-2xl p-6">
              <div className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-2">Pengguna Aktif</div>
              <div className="text-3xl font-black">{new Set(results.map(r => r.user_id)).size}</div>
            </div>
            <div className="bg-card border border-border rounded-2xl p-6">
              <div className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-2">Modul Terpopuler</div>
              <div className="text-3xl font-black uppercase">
                {results.length > 0 
                  ? (() => {
                      const counts: Record<string, number> = {};
                      results.forEach(r => { counts[r.module] = (counts[r.module] || 0) + 1; });
                      return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
                    })()
                  : '-'}
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="relative md:col-span-2">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
              <input 
                type="text" 
                placeholder="Cari email agen atau skenario..." 
                className="w-full pl-12 pr-4 py-3 bg-card border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none font-medium"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
              <select 
                className="w-full pl-12 pr-4 py-3 bg-card border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none appearance-none font-medium"
                value={filterModule}
                onChange={(e) => setFilterModule(e.target.value)}
              >
                <option value="all">Semua Modul</option>
                <option value="ketik">Ketik (Chat)</option>
                <option value="pdkt">PDKT (Email)</option>
                <option value="telefun">Telefun (Voice)</option>
              </select>
            </div>
            <button className="flex items-center justify-center gap-2 px-6 py-3 bg-card border border-border rounded-xl hover:bg-foreground/5 transition-all font-black text-[10px] uppercase tracking-widest">
              <Download className="w-4 h-4" /> Export Data
            </button>
          </div>

          {/* Table */}
          <div className="bg-card border border-border rounded-[2.5rem] overflow-hidden shadow-2xl relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
            <div className="overflow-x-auto relative z-10">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-foreground/[0.02] border-b border-border">
                    <th className="px-8 py-6 font-black text-[10px] uppercase tracking-widest opacity-40">Tanggal &amp; Waktu</th>
                    <th className="px-8 py-6 font-black text-[10px] uppercase tracking-widest opacity-40">Identitas Agen</th>
                    <th className="px-8 py-6 font-black text-[10px] uppercase tracking-widest opacity-40">Modul</th>
                    <th className="px-8 py-6 font-black text-[10px] uppercase tracking-widest opacity-40">Skenario</th>
                    <th className="px-8 py-6 font-black text-[10px] uppercase tracking-widest opacity-40 text-center"><Clock className="w-3 h-3 inline mr-1"/>Durasi</th>
                    <th className="px-8 py-6 font-black text-[10px] uppercase tracking-widest opacity-40 text-right">Detil</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-8 py-20 text-center">
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            <span className="text-xs font-black uppercase tracking-widest opacity-40">Menyelaraskan data riwayat...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredResults.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-8 py-20 text-center">
                         <div className="flex flex-col items-center gap-4">
                            <FileText className="w-12 h-12 text-foreground/10" />
                            <span className="text-xs font-black uppercase tracking-widest opacity-40">Belum ada riwayat simulasi ditemukan.</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredResults.map((result) => (
                      <tr key={`${result.module}-${result.id}`} className="hover:bg-foreground/[0.02] transition-colors group">
                        <td className="px-8 py-6 text-sm">
                          <span className="font-bold block tracking-tighter">
                            {new Date(result.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                          <span className="text-[10px] font-black uppercase tracking-widest opacity-30 mt-1 block tracking-[0.2em]">{new Date(result.created_at).toLocaleTimeString('id-ID')}</span>
                        </td>
                        <td className="px-8 py-6">
                            <div className="flex flex-col">
                                <span className="text-sm font-black tracking-tight">{result.user_email?.split('@')[0] || 'Unknown'}</span>
                                <span className="text-[10px] opacity-40 lowercase">{result.user_role || 'agent'}</span>
                            </div>
                        </td>
                        <td className="px-8 py-6">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] ${
                            result.module === 'ketik' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' :
                            result.module === 'pdkt' ? 'bg-purple-500/10 text-purple-500 border border-purple-500/20' :
                            'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                          }`}>
                            {result.module}
                          </span>
                        </td>
                        <td className="px-8 py-6 text-sm font-bold text-foreground/80 tracking-tight">{result.scenario_title}</td>
                        <td className="px-8 py-6 text-center">
                          <div className="flex flex-col items-center">
                            <span className="text-sm font-black tracking-tight">{getDurationString(result)}</span>
                            {result.score !== null && (
                              <span className={`text-[10px] font-black uppercase mt-1 ${result.score >= 80 ? 'text-emerald-500' : result.score >= 60 ? 'text-yellow-500' : 'text-red-500'}`}>
                                  Skor: {result.score}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <button 
                            onClick={() => setSelectedResult(result)}
                            className="px-4 py-2 bg-foreground/5 hover:bg-primary hover:text-primary-foreground text-foreground/40 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest border border-border group-hover:border-primary"
                          >
                            Lihat Riwayat
                          </button>
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

      {/* Transcript Modal */}
      <AnimatePresence>
        {selectedResult && (
            <TranscriptModal 
                isOpen={!!selectedResult} 
                onClose={() => setSelectedResult(null)} 
                result={selectedResult} 
            />
        )}
      </AnimatePresence>
    </div>
  );
}
