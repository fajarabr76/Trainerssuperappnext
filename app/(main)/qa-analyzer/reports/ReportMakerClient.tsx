'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import Link from 'next/link';
import { motion } from 'motion/react';
import { FileText, Loader2, Download, ChevronLeft, AlertCircle } from 'lucide-react';
import type { ServiceType } from '../lib/qa-types';
import { SERVICE_LABELS } from '../lib/qa-types';
import type { ParetoData, CriticalVsNonCriticalData } from '../lib/qa-types';
import type { ReportAiModelOption } from './lib/report-models';
import { modelProviderLabel } from './lib/report-models';
import ReportChartCapture, { type ReportChartCaptureHandle } from './components/ReportChartCapture';
import {
  checkReportRateLimitAction,
  preflightServiceReportChartsAction,
  preflightIndividualReportChartsAction,
  generateReportAction,
  markReportDownloadedAction,
} from './actions/report-actions';
import { ReportWarningModal } from './components/ReportWarningModal';

const SERVICE_TYPES = Object.keys(SERVICE_LABELS) as ServiceType[];

type AgentOption = { id: string; nama: string; batch_name?: string | null };
type FolderOption = { id: string; name: string };

type Props = {
  role: string;
  models: ReportAiModelOption[];
  agents: AgentOption[];
  folders: FolderOption[];
  availableYears: number[];
};

export default function ReportMakerClient({ role, models, agents, folders, availableYears }: Props) {
  const [reportKind, setReportKind] = useState<'layanan' | 'individu'>('layanan');
  const [serviceType, setServiceType] = useState<ServiceType>('call');
  const [folderId, setFolderId] = useState<string>('ALL');
  const [year, setYear] = useState(() => availableYears[0] ?? new Date().getFullYear());
  const [startMonth, setStartMonth] = useState(1);
  const [endMonth, setEndMonth] = useState(() => new Date().getMonth() + 1);
  const [pesertaId, setPesertaId] = useState('');
  const [modelId, setModelId] = useState(models[0]?.id ?? '');

  const [rate, setRate] = useState<{ count: number; limit: number; allowed: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastReport, setLastReport] = useState<{
    reportId: string;
    signedUrl: string;
  } | null>(null);

  const [chartData, setChartData] = useState<{
    paretoData: ParetoData[];
    donutData: CriticalVsNonCriticalData | null;
    trendPoints: Array<{ label: string; score: number; findings: number }>;
  }>({ paretoData: [], donutData: null, trendPoints: [] });
  const [captureWarning, setCaptureWarning] = useState<string | null>(null);
  const [showWarning, setShowWarning] = useState(true);

  const captureRef = useRef<ReportChartCaptureHandle>(null);

  const refreshRate = useCallback(async () => {
    try {
      const r = await checkReportRateLimitAction();
      setRate(r);
    } catch {
      setRate(null);
    }
  }, []);

  useEffect(() => {
    refreshRate();
  }, [refreshRate]);

  useEffect(() => {
    if (models.length && !models.some((m) => m.id === modelId)) {
      setModelId(models[0]!.id);
    }
  }, [models, modelId]);

  const folderIds = folderId === 'ALL' ? [] : [folderId];

  const formValid =
    rate?.allowed !== false &&
    !!modelId &&
    (reportKind === 'layanan' ||
      (reportKind === 'individu' && !!pesertaId && startMonth <= endMonth));

  const filteredAgents = agents.filter((a) =>
    folderId === 'ALL' || a.batch_name === folderId
  );

  const handleGenerate = async () => {
    setError(null);
    setLastReport(null);
    if (!formValid) return;

    setLoading(true);
    try {
      if (reportKind === 'layanan') {
        const pre = await preflightServiceReportChartsAction(
          serviceType,
          folderIds,
          year,
          startMonth,
          endMonth
        );
        flushSync(() => {
          setChartData({
            paretoData: pre.paretoData,
            donutData: pre.donutData,
            trendPoints: [],
          });
        });
      } else {
        const pre = await preflightIndividualReportChartsAction(pesertaId, year, startMonth, endMonth);
        flushSync(() => {
          setChartData({
            paretoData: [],
            donutData: null,
            trendPoints: pre.trend,
          });
        });
      }

      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      await new Promise((r) => setTimeout(r, 150));

      let paretoPng: string | null = null;
      let donutPng: string | null = null;
      let trendPng: string | null = null;

      try {
        if (reportKind === 'layanan') {
          const caps = await captureRef.current?.captureService();
          paretoPng = caps?.pareto ?? null;
          donutPng = caps?.donut ?? null;
          if (!paretoPng || !donutPng) {
            setCaptureWarning('Beberapa grafik layanan gagal ditangkap. Laporan akan tetap dibuat tanpa gambar grafik.');
          }
        } else {
          const caps = await captureRef.current?.captureIndividual();
          trendPng = caps?.trend ?? null;
          if (!trendPng) {
            setCaptureWarning('Grafik tren individu gagal ditangkap. Laporan akan tetap dibuat tanpa gambar grafik.');
          }
        }
      } catch (capErr) {
        console.warn('[ReportMaker] Chart capture failed, proceeding without images:', capErr);
        setCaptureWarning('Proses penangkapan grafik mengalami kendala. Laporan tetap dibuat tanpa gambar.');
      }

      const result =
        reportKind === 'layanan'
          ? await generateReportAction({
              reportKind: 'layanan',
              serviceType,
              folderIds,
              year,
              startMonth,
              endMonth,
              modelId,
              paretoPngBase64: paretoPng,
              donutPngBase64: donutPng,
            })
          : await generateReportAction({
              reportKind: 'individu',
              pesertaId,
              year,
              startMonth,
              endMonth,
              modelId,
              trendPngBase64: trendPng,
            });

      if (result.ok === false) {
        setError(result.error);
        return;
      }

      setLastReport({ reportId: result.reportId, signedUrl: result.signedUrl });
      await refreshRate();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal membuat laporan.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!lastReport) return;
    await markReportDownloadedAction(lastReport.reportId);
    window.open(lastReport.signedUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <header className="relative z-20 flex h-28 shrink-0 items-center justify-between border-b border-border/50 bg-background/80 px-10 backdrop-blur-xl">
        <div>
          <Link
            href="/qa-analyzer/dashboard"
            className="mb-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-foreground/40 hover:text-primary"
          >
            <ChevronLeft className="h-3 w-3" /> Dashboard SIDAK
          </Link>
          <div className="mb-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-foreground/40">
            <FileText className="h-3 w-3" /> SIDAK
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-foreground">Laporan</h1>
          <p className="mt-1 text-xs text-foreground/50">
            Generate laporan Word (.docx) dengan ringkasan data QA dan narasi AI. Role: {role}
          </p>
        </div>
        {rate && (
          <div
            className={`rounded-2xl border px-5 py-3 text-right text-xs ${
              rate.allowed ? 'border-border/50 bg-foreground/[0.02]' : 'border-rose-500/30 bg-rose-500/10'
            }`}
          >
            <div className="font-black uppercase tracking-widest text-foreground/40">Kuota harian</div>
            <div className="text-lg font-black tabular-nums text-foreground">
              {rate.count}/{rate.limit}
            </div>
            {!rate.allowed && (
              <div className="mt-1 max-w-xs text-[11px] text-rose-600">
                Batas pembuatan laporan tercapai ({rate.limit}/{rate.limit}).
              </div>
            )}
          </div>
        )}
      </header>

      <div className="flex flex-1 overflow-y-auto p-8 lg:p-10">
        <div className="mx-auto w-full max-w-3xl space-y-8">
          <section className="rounded-[2rem] border border-border/50 bg-card/40 p-8 backdrop-blur-sm">
            <label className="mb-3 block text-[10px] font-black uppercase tracking-widest text-foreground/40">
              Tipe laporan
            </label>
            <div className="flex gap-3">
              {(['layanan', 'individu'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    setReportKind(k);
                    // Reset inputs that are not compatible or should be fresh
                    if (k === 'layanan') {
                      setPesertaId('');
                    } else {
                      setFolderId('ALL');
                    }
                    // Always clear error and last report when switching
                    setError(null);
                    setLastReport(null);
                  }}
                  className={`flex-1 rounded-2xl py-3 text-xs font-black uppercase tracking-widest transition-all ${
                    reportKind === k
                      ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                      : 'bg-foreground/5 text-foreground/50 hover:bg-foreground/10'
                  }`}
                >
                  {k === 'layanan' ? 'Layanan' : 'Individu'}
                </button>
              ))}
            </div>

            {reportKind === 'layanan' ? (
              <div className="mt-8 space-y-6">
                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-foreground/40">
                    Tipe layanan
                  </label>
                  <select
                    value={serviceType}
                    onChange={(e) => setServiceType(e.target.value as ServiceType)}
                    className="h-12 w-full rounded-xl border border-border/50 bg-background px-4 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    {SERVICE_TYPES.map((s) => (
                      <option key={s} value={s}>
                        {SERVICE_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-foreground/40">
                    Tim / folder (opsional)
                  </label>
                  <select
                    value={folderId}
                    onChange={(e) => setFolderId(e.target.value)}
                    className="h-12 w-full rounded-xl border border-border/50 bg-background px-4 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="ALL">Semua tim</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.name}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="mt-8 space-y-4">
                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-foreground/40">
                    Pilih tim
                  </label>
                  <select
                    value={folderId}
                    onChange={(e) => {
                      setFolderId(e.target.value);
                      setPesertaId('');
                    }}
                    className="mb-3 h-11 w-full rounded-xl border border-border/50 bg-background px-4 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="ALL">Semua tim</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.name}>
                        {f.name}
                      </option>
                    ))}
                  </select>

                  <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-foreground/40">
                    Pilih agen
                  </label>
                  <select
                    value={pesertaId}
                    onChange={(e) => setPesertaId(e.target.value)}
                    className="h-12 w-full rounded-xl border border-border/50 bg-background px-4 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">— Pilih agen —</option>
                    {filteredAgents.slice(0, 400).map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nama}
                        {a.batch_name ? ` (${a.batch_name})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-foreground/40">
                  Tahun
                </label>
                <select
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="h-12 w-full rounded-xl border border-border/50 bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {availableYears.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-foreground/40">
                  Bulan mulai
                </label>
                <select
                  value={startMonth}
                  onChange={(e) => setStartMonth(Number(e.target.value))}
                  className="h-12 w-full rounded-xl border border-border/50 bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-foreground/40">
                  Bulan akhir
                </label>
                <select
                  value={endMonth}
                  onChange={(e) => setEndMonth(Number(e.target.value))}
                  className="h-12 w-full rounded-xl border border-border/50 bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-8">
              <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-foreground/40">
                Model AI
              </label>
              <select
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                className="h-12 w-full rounded-xl border border-border/50 bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-primary/20"
              >
                <optgroup label="Gemini">
                  {models
                    .filter((m) => m.provider === 'gemini')
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} — {m.description}
                      </option>
                    ))}
                </optgroup>
                <optgroup label="OpenRouter">
                  {models
                    .filter((m) => m.provider === 'openrouter')
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} — {m.description}
                      </option>
                    ))}
                </optgroup>
              </select>
              {models.find((m) => m.id === modelId) && (
                <p className="mt-2 text-[11px] text-foreground/45">
                  Provider:{' '}
                  <span className="font-bold text-primary">
                    {modelProviderLabel(models.find((m) => m.id === modelId)!.provider)}
                  </span>
                </p>
              )}
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-700"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            {captureWarning && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{captureWarning}</span>
              </motion.div>
            )}

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                type="button"
                disabled={!formValid || loading}
                onClick={handleGenerate}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-8 text-xs font-black uppercase tracking-widest text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:opacity-95 disabled:pointer-events-none disabled:opacity-40"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                Generate report
              </button>
              {lastReport && (
                <button
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-6 text-xs font-black uppercase tracking-widest hover:bg-foreground/5"
                >
                  <Download className="h-4 w-4" />
                  Unduh .docx
                </button>
              )}
            </div>
          </section>

          <p className="text-center text-[11px] text-foreground/35">
            File dihapus dari penyimpanan ±5 menit setelah unduhan pertama (riwayat tetap di database).
          </p>
        </div>
      </div>

      <ReportChartCapture
        ref={captureRef}
        paretoData={chartData.paretoData}
        donutData={chartData.donutData}
        trendPoints={chartData.trendPoints}
      />

      <ReportWarningModal 
        isOpen={showWarning} 
        onClose={() => setShowWarning(false)} 
      />
    </main>
  );
}
