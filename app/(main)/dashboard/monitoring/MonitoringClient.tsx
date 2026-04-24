'use client';

import { motion, AnimatePresence } from "motion/react";
import { Search, Filter, Download, X, Clock, Eye, FileText, BarChart3, Settings2, Loader2, Save, CheckCircle2, AlertCircle } from "lucide-react";
import { useState, useCallback, useEffect } from "react";
import PageHeroHeader from "@/app/components/PageHeroHeader";
import { ChatMessage } from "@/app/types";
import type { EmailMessage } from "@/app/(main)/pdkt/types";
import type { UnifiedHistory } from "./types";
import type { UsageAggregation, PricingEditorEntry } from "./usageData";
import { getFilteredUsage, savePricingSetting, saveBillingRate, refreshPricingBilling } from "@/app/actions/usage";

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

type TabId = 'riwayat' | 'usage' | 'pricing';

function formatIdr(value: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

function formatTokenCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toString();
}

const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export default function MonitoringClient({
  initialResults,
  initialUsage,
  initialPricing,
  initialBilling,
  canEditPricing,
  initialWibYear,
  initialWibMonth,
}: {
  initialResults: UnifiedHistory[];
  initialUsage: UsageAggregation[];
  initialPricing: PricingEditorEntry[];
  initialBilling: { usd_to_idr_rate: number } | null;
  canEditPricing: boolean;
  initialWibYear: number;
  initialWibMonth: number;
}) {
  const [activeTab, setActiveTab] = useState<TabId>('riwayat');
  const [searchTerm, setSearchTerm] = useState("");
  const [filterModule, setFilterModule] = useState("all");
  const [selectedResult, setSelectedResult] = useState<UnifiedHistory | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [usageFilterModule, setUsageFilterModule] = useState("all");
  const [usageMonth, setUsageMonth] = useState(initialWibMonth);
  const [usageYear, setUsageYear] = useState(initialWibYear);
  const [usageData, setUsageData] = useState<UsageAggregation[]>(initialUsage);
  const [usageLoading, setUsageLoading] = useState(false);
  const [pricingData, setPricingData] = useState<PricingEditorEntry[]>(initialPricing);
  const [billingRate, setBillingRate] = useState<number | null>(initialBilling?.usd_to_idr_rate ?? null);
  const [saveFeedback, setSaveFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchUsage = useCallback(async (year: number, month: number, module: string, search: string) => {
    setUsageLoading(true);
    try {
      const data = await getFilteredUsage({
        year,
        month,
        module: module !== 'all' ? module : undefined,
        search: search || undefined,
      });
      setUsageData(data);
    } catch (error) {
      console.error('[Monitoring] Failed to fetch usage:', error);
    } finally {
      setUsageLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab !== 'usage') return;
    fetchUsage(usageYear, usageMonth, usageFilterModule, searchTerm);
  }, [activeTab, usageYear, usageMonth, usageFilterModule, searchTerm, fetchUsage]);

  const handleSavePricing = async (modelId: string, inputPrice: number, outputPrice: number) => {
    setSaveFeedback(null);
    const result = await savePricingSetting({
      model_id: modelId,
      input_price_usd_per_million: inputPrice,
      output_price_usd_per_million: outputPrice,
    });

    if (result.success) {
      setSaveFeedback({ type: 'success', message: 'Pricing berhasil disimpan.' });
      const refreshed = await refreshPricingBilling();
      setPricingData(refreshed.pricing);
    } else {
      setSaveFeedback({ type: 'error', message: result.error || 'Gagal menyimpan pricing.' });
    }

    setTimeout(() => setSaveFeedback(null), 4000);
  };

  const handleSaveBilling = async (rate: number) => {
    setSaveFeedback(null);
    const result = await saveBillingRate({ usd_to_idr_rate: rate });

    if (result.success) {
      setSaveFeedback({ type: 'success', message: 'Kurs berhasil disimpan.' });
      const refreshed = await refreshPricingBilling();
      setBillingRate(refreshed.billing?.usd_to_idr_rate ?? null);
    } else {
      setSaveFeedback({ type: 'error', message: result.error || 'Gagal menyimpan kurs.' });
    }

    setTimeout(() => setSaveFeedback(null), 4000);
  };

  const results = initialResults;

  const filteredResults = results.filter(r => {
    const email = r.user_email || "";
    const title = r.scenario_title || "";
    const matchesSearch = email.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesModule = filterModule === "all" || r.module === filterModule;
    return matchesSearch && matchesModule;
  });

  const selectedUserUsage = selectedUserId
    ? usageData.find(u => u.user_id === selectedUserId) || null
    : null;

  const getDurationString = (result: UnifiedHistory) => {
    if (result.duration_seconds <= 0) return "--:--";
    const m = Math.floor(result.duration_seconds / 60);
    const s = result.duration_seconds % 60;
    return `${m}m ${s}s`;
  };

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'riwayat', label: 'Riwayat Simulasi', icon: <Eye className="h-4 w-4" /> },
    { id: 'usage', label: 'Penggunaan Token', icon: <BarChart3 className="h-4 w-4" /> },
    { id: 'pricing', label: 'Harga & Kurs', icon: <Settings2 className="h-4 w-4" /> },
  ];

  const monthOptions = [];
  for (let m = 1; m <= 12; m++) {
    monthOptions.push({ value: m, label: MONTH_NAMES[m - 1] });
  }

  const yearOptions = [];
  const currentYear = new Date().getFullYear();
  for (let y = currentYear; y >= currentYear - 2; y--) {
    yearOptions.push({ value: y, label: y.toString() });
  }

  return (
    <div className="h-full bg-background text-foreground transition-colors duration-500 overflow-hidden">
      <main className="h-full overflow-y-auto relative bg-background/50 backdrop-blur-3xl">
        <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10 lg:py-10">
          <PageHeroHeader
            eyebrow="Simulation monitoring"
            title="Pantau histori simulasi dari satu pusat observasi."
            description="Lihat performa agen, telusuri transcript sesi, dan baca pola pemakaian lintas modul tanpa kehilangan konteks platform."
            icon={<Eye className="h-3.5 w-3.5" />}
          />

          <div className="flex gap-2 mb-8 border-b border-border">
            {tabs.map((tab) => {
              if (tab.id === 'pricing' && !canEditPricing) return null;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-all ${
                    activeTab === tab.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            {saveFeedback && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`fixed top-6 right-6 z-[200] flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-sm font-bold ${
                  saveFeedback.type === 'success'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-red-500 text-white'
                }`}
              >
                {saveFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <AlertCircle className="w-5 h-5" />
                )}
                <span>{saveFeedback.message}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {activeTab === 'riwayat' && (
            <>
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
                      {filteredResults.length === 0 ? (
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
            </>
          )}

          {activeTab === 'usage' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input 
                    type="text" 
                    placeholder="Cari email..." 
                    className="w-full pl-12 pr-4 py-3 bg-card border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none font-medium"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="relative">
                  <select 
                    className="w-full px-4 py-3 bg-card border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none appearance-none font-medium"
                    value={usageMonth}
                    onChange={(e) => setUsageMonth(Number(e.target.value))}
                  >
                    {monthOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="relative">
                  <select 
                    className="w-full px-4 py-3 bg-card border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none appearance-none font-medium"
                    value={usageYear}
                    onChange={(e) => setUsageYear(Number(e.target.value))}
                  >
                    {yearOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="relative">
                  <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <select 
                    className="w-full pl-12 pr-4 py-3 bg-card border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none appearance-none font-medium"
                    value={usageFilterModule}
                    onChange={(e) => setUsageFilterModule(e.target.value)}
                  >
                    <option value="all">Semua Modul</option>
                    <option value="ketik">Ketik</option>
                    <option value="pdkt">PDKT</option>
                    <option value="telefun">Telefun</option>
                    <option value="qa-analyzer">QA Analyzer</option>
                  </select>
                </div>
              </div>

              <div className="bg-card border border-border rounded-[2.5rem] overflow-hidden shadow-2xl relative mb-8">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
                <div className="overflow-x-auto relative z-10">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-foreground/[0.02] border-b border-border">
                        <th className="px-8 py-6 font-black text-[10px] uppercase tracking-widest opacity-40">Akun</th>
                        <th className="px-8 py-6 font-black text-[10px] uppercase tracking-widest opacity-40 text-center">Call Sukses</th>
                        <th className="px-8 py-6 font-black text-[10px] uppercase tracking-widest opacity-40 text-right">Input Tokens</th>
                        <th className="px-8 py-6 font-black text-[10px] uppercase tracking-widest opacity-40 text-right">Output Tokens</th>
                        <th className="px-8 py-6 font-black text-[10px] uppercase tracking-widest opacity-40 text-right">Total Tokens</th>
                        <th className="px-8 py-6 font-black text-[10px] uppercase tracking-widest opacity-40 text-right">Billing IDR</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {usageLoading ? (
                        <tr>
                          <td colSpan={6} className="px-8 py-20 text-center">
                            <div className="flex flex-col items-center gap-4">
                              <Loader2 className="w-8 h-8 text-primary animate-spin" />
                              <span className="text-xs font-black uppercase tracking-widest opacity-40">Memuat data usage...</span>
                            </div>
                          </td>
                        </tr>
                      ) : usageData.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-8 py-20 text-center">
                             <div className="flex flex-col items-center gap-4">
                                <BarChart3 className="w-12 h-12 text-foreground/10" />
                                <span className="text-xs font-black uppercase tracking-widest opacity-40">Belum ada penggunaan token pada periode ini.</span>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        usageData.map((usage) => (
                          <tr
                            key={usage.user_id}
                            onClick={() => setSelectedUserId(selectedUserId === usage.user_id ? null : usage.user_id)}
                            className="hover:bg-foreground/[0.02] transition-colors group cursor-pointer"
                          >
                            <td className="px-8 py-6">
                                <div className="flex flex-col">
                                    <span className="text-sm font-black tracking-tight">{usage.user_email?.split('@')[0] || 'Unknown'}</span>
                                    <span className="text-[10px] opacity-40 lowercase">{usage.user_role || 'agent'}</span>
                                </div>
                            </td>
                            <td className="px-8 py-6 text-center text-sm font-bold">{usage.total_calls}</td>
                            <td className="px-8 py-6 text-right text-sm font-bold">{formatTokenCount(usage.total_input_tokens)}</td>
                            <td className="px-8 py-6 text-right text-sm font-bold">{formatTokenCount(usage.total_output_tokens)}</td>
                            <td className="px-8 py-6 text-right text-sm font-bold">{formatTokenCount(usage.total_tokens)}</td>
                            <td className="px-8 py-6 text-right text-sm font-black text-primary">{formatIdr(usage.total_cost_idr)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <AnimatePresence>
                {selectedUserUsage && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="bg-card border border-border rounded-[2.5rem] overflow-hidden shadow-2xl relative"
                  >
                    <div className="p-6 border-b border-border">
                      <h3 className="text-lg font-black tracking-tight">
                        Breakdown per Model — {selectedUserUsage.user_email?.split('@')[0] || 'Unknown'}
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-foreground/[0.02] border-b border-border">
                            <th className="px-8 py-4 font-black text-[10px] uppercase tracking-widest opacity-40">Model</th>
                            <th className="px-8 py-4 font-black text-[10px] uppercase tracking-widest opacity-40 text-center">Calls</th>
                            <th className="px-8 py-4 font-black text-[10px] uppercase tracking-widest opacity-40 text-right">Input</th>
                            <th className="px-8 py-4 font-black text-[10px] uppercase tracking-widest opacity-40 text-right">Output</th>
                            <th className="px-8 py-4 font-black text-[10px] uppercase tracking-widest opacity-40 text-right">Total</th>
                            <th className="px-8 py-4 font-black text-[10px] uppercase tracking-widest opacity-40 text-right">Biaya</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {selectedUserUsage.models.map((m) => (
                            <tr key={m.model_id} className="hover:bg-foreground/[0.02] transition-colors">
                              <td className="px-8 py-4 text-sm font-bold">{m.model_id}</td>
                              <td className="px-8 py-4 text-center text-sm font-bold">{m.calls}</td>
                              <td className="px-8 py-4 text-right text-sm font-bold">{formatTokenCount(m.input_tokens)}</td>
                              <td className="px-8 py-4 text-right text-sm font-bold">{formatTokenCount(m.output_tokens)}</td>
                              <td className="px-8 py-4 text-right text-sm font-bold">{formatTokenCount(m.total_tokens)}</td>
                              <td className="px-8 py-4 text-right text-sm font-black text-primary">{formatIdr(m.cost_idr)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}

          {activeTab === 'pricing' && canEditPricing && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-card border border-border rounded-[2.5rem] overflow-hidden shadow-2xl relative">
                  <div className="p-6 border-b border-border flex items-center justify-between">
                    <h3 className="text-lg font-black tracking-tight">Harga per Model (USD per 1M tokens)</h3>
                  </div>
                  <div className="p-6 space-y-4">
                    {pricingData.map((p) => (
                      <PricingEditorRow
                        key={p.model_id}
                        modelId={p.model_id}
                        modelName={p.model_name}
                        provider={p.provider}
                        inputPrice={p.input_price_usd_per_million}
                        outputPrice={p.output_price_usd_per_million}
                        onSave={handleSavePricing}
                      />
                    ))}
                  </div>
                </div>

                <div className="bg-card border border-border rounded-[2.5rem] overflow-hidden shadow-2xl relative">
                  <div className="p-6 border-b border-border">
                    <h3 className="text-lg font-black tracking-tight">Kurs USD ke IDR</h3>
                  </div>
                  <div className="p-6">
                    <BillingEditor
                      currentRate={billingRate}
                      onSave={handleSaveBilling}
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

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

function PricingEditorRow({
  modelId,
  modelName,
  provider: _provider,
  inputPrice,
  outputPrice,
  onSave,
}: {
  modelId: string;
  modelName: string;
  provider: string;
  inputPrice: number;
  outputPrice: number;
  onSave: (modelId: string, input: number, output: number) => void;
}) {
  const [input, setInput] = useState(inputPrice.toString());
  const [output, setOutput] = useState(outputPrice.toString());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setInput(inputPrice.toString());
    setOutput(outputPrice.toString());
  }, [inputPrice, outputPrice]);

  const handleSave = async () => {
    const inVal = parseFloat(input);
    const outVal = parseFloat(output);
    if (Number.isNaN(inVal) || Number.isNaN(outVal) || inVal < 0 || outVal < 0) return;

    setSaving(true);
    await onSave(modelId, inVal, outVal);
    setSaving(false);
  };

  return (
    <div className="p-4 bg-foreground/[0.02] rounded-xl">
      <div className="flex items-center justify-between mb-3">
        <div className="flex flex-col">
          <span className="text-sm font-black">{modelName}</span>
          <span className="text-[10px] text-muted-foreground font-mono">{modelId}</span>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          <span>Simpan</span>
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1 block">Harga Input (USD / 1M token)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm font-bold outline-none focus:border-primary transition-all"
          />
        </div>
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1 block">Harga Output (USD / 1M token)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={output}
            onChange={(e) => setOutput(e.target.value)}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm font-bold outline-none focus:border-primary transition-all"
          />
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground mt-2">
        Nilai 0 berarti usage model ini belum dihitung biayanya secara bermakna.
      </p>
    </div>
  );
}

function BillingEditor({
  currentRate,
  onSave,
}: {
  currentRate: number | null;
  onSave: (rate: number) => void;
}) {
  const [rate, setRate] = useState(currentRate?.toString() ?? '15000');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentRate !== null) {
      setRate(currentRate.toString());
    }
  }, [currentRate]);

  const handleSave = async () => {
    const val = parseFloat(rate);
    if (Number.isNaN(val) || val <= 0) return;

    setSaving(true);
    await onSave(val);
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-4 bg-foreground/[0.02] rounded-xl">
        <div className="flex-1 mr-4">
          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1 block">Kurs USD/IDR</label>
          <input
            type="number"
            step="1"
            min="1"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-lg font-black outline-none focus:border-primary transition-all"
          />
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50 shrink-0"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          <span>Simpan</span>
        </button>
      </div>
      {currentRate !== null && (
        <p className="text-xs text-muted-foreground">
          Kurs aktif saat ini: <span className="font-black text-foreground">Rp {currentRate.toLocaleString('id-ID')}</span>
        </p>
      )}
    </div>
  );
}
