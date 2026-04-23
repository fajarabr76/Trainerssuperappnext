'use client';

import { motion, AnimatePresence } from "motion/react";
import { Search, Filter, Download, X, Clock, Eye, FileText } from "lucide-react";
import { useState } from "react";
import PageHeroHeader from "@/app/components/PageHeroHeader";
import { ChatMessage } from "@/app/types";
import type { EmailMessage } from "@/app/(main)/pdkt/types";
import type { UnifiedHistory } from "./types";

// Modal Component for Viewing Transcript
const TranscriptModal = ({ isOpen, onClose, result }: { isOpen: boolean, onClose: () => void, result: UnifiedHistory | null }) => {
  if (!isOpen || !result) return null;

  const renderHistory = () => {
    const history = result.history;
    
    if (result.module === 'ketik') {
      const messages = Array.isArray(history) ? (history as ChatMessage[]) : [];
      return (
        <div className="space-y-4 p-4 max-h-[60vh] overflow-y-auto bg-foreground/5 rounded-2xl">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.sender === 'agent' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                msg.sender === 'agent' ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-foreground'
              }`}>
                <p className="font-medium whitespace-pre-wrap break-words">{msg.text}</p>
                {msg.timestamp && (
                  <span className="text-[10px] opacity-40 mt-1 block">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>
          ))}
          {messages.length === 0 && (
            <div className="text-center py-12 text-muted-foreground italic">Tidak ada transcript untuk sesi ini.</div>
          )}
        </div>
      );
    }

    if (result.module === 'pdkt') {
      const emails = Array.isArray(history) ? (history as EmailMessage[]) : [];
      return (
        <div className="space-y-6">
          {emails.length > 0 ? emails.map((email, idx) => (
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
            <div className="text-center py-12 text-muted-foreground italic">Tidak ada detail email untuk sesi ini.</div>
          )}
        </div>
      );
    }

    return <div className="p-8 text-center text-muted-foreground">Detail riwayat sedang diproses untuk modul ini.</div>;
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
                <span className="text-[10px] text-muted-foreground font-mono">• {result.user_email || 'N/A'}</span>
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
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Durasi</span>
                    <span className="text-xl font-black">
                        {result.duration_seconds > 0
                          ? `${Math.floor(result.duration_seconds / 60)}m ${result.duration_seconds % 60}s`
                          : '--:--'}
                    </span>
                </div>
                {result.score !== null && (
                  <div className="flex flex-col ml-6">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Skor</span>
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

export default function MonitoringClient({ initialResults }: { initialResults: UnifiedHistory[] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterModule, setFilterModule] = useState("all");
  const [selectedResult, setSelectedResult] = useState<UnifiedHistory | null>(null);
  const results = initialResults;
  const loading = false;

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
    <div className="h-full bg-background text-foreground transition-colors duration-500 overflow-hidden">
      {/* Main Content */}
      <main className="h-full overflow-y-auto relative bg-background/50 backdrop-blur-3xl">
        <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10 lg:py-10">
          <PageHeroHeader
            eyebrow="Simulation monitoring"
            title="Pantau histori simulasi dari satu pusat observasi."
            description="Lihat performa agen, telusuri transcript sesi, dan baca pola pemakaian lintas modul tanpa kehilangan konteks platform."
            icon={<Eye className="h-3.5 w-3.5" />}
          />

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
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Cari email agen atau skenario..." 
                className="w-full pl-12 pr-4 py-3 bg-card border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none font-medium"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
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
                            className="px-4 py-2 bg-foreground/5 hover:bg-primary hover:text-primary-foreground text-muted-foreground rounded-xl transition-all font-black text-[10px] uppercase tracking-widest border border-border group-hover:border-primary"
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
