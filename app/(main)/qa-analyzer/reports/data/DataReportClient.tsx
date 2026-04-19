'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { 
  Database, 
  ChevronLeft, 
  Search, 
  Download, 
  Loader2, 
  AlertCircle,
  Filter,
  User,
  LayoutGrid,
  Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { ServiceType, QAIndicator, QAPeriod } from '../../lib/qa-types';
import { SERVICE_LABELS } from '../../lib/qa-types';
import { fetchDataReportAction } from './actions';
import ExcelJS from 'exceljs';

const SERVICE_TYPES = Object.keys(SERVICE_LABELS) as ServiceType[];

type AgentOption = { id: string; nama: string; batch_name?: string | null };
type FolderOption = { id: string; name: string };

type Props = {
  role: string;
  agents: AgentOption[];
  folders: FolderOption[];
  availableYears: number[];
  allIndicators: QAIndicator[];
  periods: QAPeriod[];
};

export default function DataReportClient({ 
  role, 
  agents, 
  folders, 
  availableYears, 
  allIndicators,
  periods 
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  // Filters
  const [serviceType, setServiceType] = useState<ServiceType>('call');
  const [indicatorId, setIndicatorId] = useState<string>('ALL');
  const [year, setYear] = useState(() => availableYears[0] ?? new Date().getFullYear());
  const [periodMode, setPeriodMode] = useState<'single' | 'range'>('single');
  const [startMonth, setStartMonth] = useState(1);
  const [endMonth, setEndMonth] = useState(() => new Date().getMonth() + 1);
  const [mode, setMode] = useState<'layanan' | 'individu'>('layanan');
  const [pesertaId, setPesertaId] = useState('');
  const [folderId, setFolderId] = useState('ALL');

  const filteredIndicators = useMemo(() => {
    return allIndicators.filter(ind => ind.service_type === serviceType);
  }, [allIndicators, serviceType]);

  const filteredAgents = useMemo(() => {
    return agents.filter(a => folderId === 'ALL' || a.batch_name === folderId);
  }, [agents, folderId]);

  const handleFetch = async () => {
    if (periodMode === 'range' && startMonth > endMonth) {
      setError('Bulan mulai tidak boleh lebih besar dari bulan akhir.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const results = await fetchDataReportAction({
        serviceType,
        indicatorId,
        year,
        startMonth: periodMode === 'single' ? startMonth : startMonth,
        endMonth: periodMode === 'single' ? startMonth : endMonth,
        mode,
        pesertaId: mode === 'individu' ? pesertaId : undefined,
        folderId,
      });
      setData(results);
      setHasSearched(true);
    } catch (e: any) {
      setError(e.message || 'Gagal mengambil data.');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (data.length === 0) return;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Laporan Data QA');

    worksheet.columns = [
      { header: 'Layanan', key: 'serviceLabel', width: 20 },
      { header: 'Periode', key: 'period', width: 15 },
      { header: 'Nama Agen', key: 'agentName', width: 25 },
      { header: 'Batch/Tim', key: 'batch', width: 20 },
      { header: 'No. Tiket', key: 'ticketNumber', width: 20 },
      { header: 'Parameter', key: 'parameter', width: 30 },
      { header: 'Temuan Agen', key: 'finding', width: 40 },
      { header: 'Seharusnya', key: 'expected', width: 40 },
      { header: 'Skor', key: 'score', width: 10 },
    ];

    const exportRows = data.map(item => ({
      ...item,
      serviceLabel: SERVICE_LABELS[item.service] || item.service
    }));

    worksheet.addRows(exportRows);

    // Styling
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const periodStr = periodMode === 'single' ? `${startMonth}` : `${startMonth}-${endMonth}`;
    a.download = `Data_QA_${serviceType}_${periodStr}_${year}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <header className="relative z-20 flex shrink-0 flex-col items-start justify-between gap-4 border-b border-border/50 bg-background/80 px-4 py-4 backdrop-blur-xl sm:h-28 sm:flex-row sm:items-center sm:px-6 sm:py-0 lg:px-10">
        <div>
          <Link
            href="/qa-analyzer/reports"
            className="mb-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary"
          >
            <ChevronLeft className="h-3 w-3" /> Menu Laporan
          </Link>
          <div className="mb-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            <Database className="h-3 w-3" /> Laporan Data
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-foreground">Workspace Data</h1>
          <p className="mt-1 text-xs text-foreground/50">
            Filter temuan QA dan export data ke Excel. Role: {role}
          </p>
        </div>

        {data.length > 0 && (
          <button
            onClick={handleExport}
            className="flex h-12 items-center gap-2 rounded-2xl bg-primary px-6 text-xs font-black uppercase tracking-widest text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:opacity-90"
          >
            <Download className="h-4 w-4" /> Export Excel
          </button>
        )}
      </header>

      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        {/* Filters Sidebar */}
        <aside className="w-full shrink-0 border-b border-border/50 bg-card/20 p-4 backdrop-blur-sm lg:w-80 lg:border-b-0 lg:border-r lg:p-6 lg:overflow-y-auto">
          <div className="flex items-center gap-2 mb-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            <Filter className="h-3 w-3" /> Konfigurasi Filter
          </div>

          <div className="space-y-6">
            <div>
              <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Jenis Layanan
              </label>
              <select
                value={serviceType}
                onChange={(e) => {
                  setServiceType(e.target.value as ServiceType);
                  setIndicatorId('ALL');
                }}
                className="h-11 w-full rounded-xl border border-border/50 bg-background px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              >
                {SERVICE_TYPES.map((s) => (
                  <option key={s} value={s}>{SERVICE_LABELS[s]}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Parameter QA (Opsional)
              </label>
              <select
                value={indicatorId}
                onChange={(e) => setIndicatorId(e.target.value)}
                className="h-11 w-full rounded-xl border border-border/50 bg-background px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              >
                <option value="ALL">Semua Parameter</option>
                {filteredIndicators.map((ind) => (
                  <option key={ind.id} value={ind.id}>{ind.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Tahun
              </label>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="h-11 w-full rounded-xl border border-border/50 bg-background px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <div className="pt-2">
              <label className="mb-3 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Mode Periode
              </label>
              <div className="flex gap-2 p-1 bg-foreground/5 rounded-2xl">
                <button
                  onClick={() => setPeriodMode('single')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    periodMode === 'single' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  <Calendar className="h-3 w-3" /> 1 Bulan
                </button>
                <button
                  onClick={() => setPeriodMode('range')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    periodMode === 'range' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  <LayoutGrid className="h-3 w-3" /> Rentang
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  {periodMode === 'single' ? 'Bulan' : 'Bulan Mulai'}
                </label>
                <select
                  value={startMonth}
                  onChange={(e) => setStartMonth(Number(e.target.value))}
                  className="h-11 w-full rounded-xl border border-border/50 bg-background px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              {periodMode === 'range' && (
                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Bulan Akhir
                  </label>
                  <select
                    value={endMonth}
                    onChange={(e) => setEndMonth(Number(e.target.value))}
                    className="h-11 w-full rounded-xl border border-border/50 bg-background px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="pt-2">
              <label className="mb-3 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Mode Laporan
              </label>
              <div className="flex gap-2 p-1 bg-foreground/5 rounded-2xl">
                <button
                  onClick={() => setMode('layanan')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    mode === 'layanan' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  <LayoutGrid className="h-3 w-3" /> Layanan
                </button>
                <button
                  onClick={() => setMode('individu')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    mode === 'individu' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  <User className="h-3 w-3" /> Individu
                </button>
              </div>
            </div>

            {mode === 'individu' ? (
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Pilih Tim
                  </label>
                  <select
                    value={folderId}
                    onChange={(e) => {
                      setFolderId(e.target.value);
                      setPesertaId('');
                    }}
                    className="h-11 w-full rounded-xl border border-border/50 bg-background px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="ALL">Semua Tim</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.name}>{f.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Pilih Agen
                  </label>
                  <select
                    value={pesertaId}
                    onChange={(e) => setPesertaId(e.target.value)}
                    className="h-11 w-full rounded-xl border border-border/50 bg-background px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">— Pilih Agen —</option>
                    {filteredAgents.slice(0, 500).map((a) => (
                      <option key={a.id} value={a.id}>{a.nama}</option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Tim / Batch (Opsional)
                </label>
                <select
                  value={folderId}
                  onChange={(e) => setFolderId(e.target.value)}
                  className="h-11 w-full rounded-xl border border-border/50 bg-background px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="ALL">Semua Tim</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.name}>{f.name}</option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={handleFetch}
              disabled={loading || (mode === 'individu' && !pesertaId)}
              className="w-full h-12 flex items-center justify-center gap-2 rounded-2xl bg-foreground text-background font-black uppercase tracking-widest text-xs transition-all hover:opacity-90 disabled:opacity-30 disabled:pointer-events-none mt-4"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Tampilkan Data
            </button>
          </div>
        </aside>

        {/* Results Area */}
        <section className="flex-1 overflow-hidden flex flex-col bg-background/50">
          <div className="flex-1 overflow-auto p-4 lg:p-10">
            {error && (
              <div className="mb-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
                <div className="text-sm text-rose-700 font-medium">{error}</div>
              </div>
            )}

            {!hasSearched && !loading && (
              <div className="flex h-full flex-col items-center justify-center text-center p-10 opacity-40">
                <div className="mb-6 rounded-full bg-foreground/5 p-8">
                  <Database className="h-16 w-16" />
                </div>
                <h3 className="text-2xl font-black tracking-tight mb-2">Belum Ada Data</h3>
                <p className="text-sm max-w-xs leading-relaxed">
                  Gunakan panel filter di sebelah kiri untuk menampilkan temuan QA berdasarkan parameter yang Anda inginkan.
                </p>
              </div>
            )}

            {loading && (
              <div className="flex h-full flex-col items-center justify-center text-center p-10">
                <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground animate-pulse">
                  Menarik data dari database...
                </p>
              </div>
            )}

            {hasSearched && !loading && data.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center text-center p-10 opacity-60">
                <div className="mb-6 rounded-full bg-amber-500/10 p-8 text-amber-500">
                  <AlertCircle className="h-16 w-16" />
                </div>
                <h3 className="text-2xl font-black tracking-tight mb-2">Data Tidak Ditemukan</h3>
                <p className="text-sm max-w-xs leading-relaxed">
                  Tidak ada temuan yang cocok dengan filter yang Anda pilih. Coba sesuaikan rentang bulan atau parameter lainnya.
                </p>
              </div>
            )}

            {hasSearched && !loading && data.length > 0 && (
              <div className="rounded-[2.5rem] border border-border/50 bg-card/40 overflow-hidden backdrop-blur-sm shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border/50 bg-foreground/5">
                        <th className="px-6 py-4 font-black uppercase tracking-widest text-muted-foreground">Layanan</th>
                        <th className="px-6 py-4 font-black uppercase tracking-widest text-muted-foreground">Periode</th>
                        <th className="px-6 py-4 font-black uppercase tracking-widest text-muted-foreground">Agen</th>
                        <th className="px-6 py-4 font-black uppercase tracking-widest text-muted-foreground">No. Tiket</th>
                        <th className="px-6 py-4 font-black uppercase tracking-widest text-muted-foreground">Parameter</th>
                        <th className="px-6 py-4 font-black uppercase tracking-widest text-muted-foreground">Temuan</th>
                        <th className="px-6 py-4 font-black uppercase tracking-widest text-muted-foreground">Seharusnya</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {data.map((item) => (
                        <tr key={item.id} className="hover:bg-foreground/[0.02] transition-colors group">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="font-bold uppercase tracking-widest text-primary text-[10px]">
                              {SERVICE_LABELS[item.service] || item.service}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="font-bold tabular-nums text-foreground">{item.period}</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-bold text-foreground">{item.agentName}</div>
                            <div className="text-[10px] text-muted-foreground uppercase">{item.batch}</div>
                          </td>
                          <td className="px-6 py-4">
                            <code className="rounded bg-foreground/5 px-1.5 py-0.5 font-mono text-[10px] text-foreground/70">
                              {item.ticketNumber}
                            </code>
                          </td>
                          <td className="px-6 py-4 max-w-[200px]">
                            <div className="font-medium text-foreground line-clamp-2">{item.parameter}</div>
                          </td>
                          <td className="px-6 py-4 max-w-[300px]">
                            <div className="text-rose-600 leading-relaxed line-clamp-3 italic">{item.finding}</div>
                          </td>
                          <td className="px-6 py-4 max-w-[300px]">
                            <div className="text-emerald-600 leading-relaxed line-clamp-3">{item.expected}</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="border-t border-border/50 bg-foreground/[0.02] px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Menampilkan {data.length} temuan
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
