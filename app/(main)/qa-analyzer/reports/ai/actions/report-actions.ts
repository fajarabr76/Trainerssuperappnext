'use server';

import { createClient } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { getProviderFromModelId } from '@/app/lib/ai-models';
import { generateOpenRouterContent } from '@/app/actions/openrouter';
import { generateGeminiContent } from '@/app/actions/gemini';
import { qaServiceServer } from '../../../services/qaService.server';
import type { ServiceType, QATemuan } from '../../../lib/qa-types';
import { SERVICE_LABELS } from '../../../lib/qa-types';
import { getReportMaxPerDay } from '../lib/report-models';
import { buildIndividualReportDocx, buildServiceReportDocx } from '../lib/docx-builder';

const ALLOWED_ROLES = ['trainer', 'trainers', 'admin'];
const MAX_DOCX_BYTES = 10 * 1024 * 1024;
const AI_TIMEOUT_MS = 300_000;

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export type ReportRateLimitStatus = {
  count: number;
  limit: number;
  allowed: boolean;
};

async function requireReportUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Tidak terautentikasi');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const role = profile?.role?.toLowerCase() ?? '';
  if (!ALLOWED_ROLES.includes(role)) {
    throw new Error('Akses ditolak: hanya trainer atau admin yang dapat membuat laporan.');
  }

  return { supabase, user, profile };
}

async function narrationWithTimeout(modelId: string, systemInstruction: string, userPrompt: string): Promise<string> {
  const contents = [{ role: 'user' as const, parts: [{ text: userPrompt }] }];
  const provider = getProviderFromModelId(modelId);

  const run = async () => {
    if (provider === 'openrouter') {
      const r = await generateOpenRouterContent({
        model: modelId,
        systemInstruction,
        contents,
        temperature: 0.5,
        usageContext: { module: 'qa-analyzer', action: 'report_generation' },
      });
      if (!r.success) throw new Error(r.error || 'Gagal memanggil OpenRouter');
      return r.text || '';
    }
    const r = await generateGeminiContent({
      model: modelId,
      systemInstruction,
      contents,
      temperature: 0.5,
      usageContext: { module: 'qa-analyzer', action: 'report_generation' },
    });
    if (!r.success) throw new Error(r.error || 'Gagal memanggil Gemini');
    return typeof r.text === 'string' ? r.text : '';
  };

  return await Promise.race([
    run(),
    new Promise<string>((_, rej) =>
      setTimeout(() => rej(new Error('Generasi narasi AI melebihi batas waktu (300 detik).')), AI_TIMEOUT_MS)
    ),
  ]);
}

export async function checkReportRateLimitAction(): Promise<ReportRateLimitStatus> {
  const { user } = await requireReportUser();
  const admin = createAdminClient();
  const limit = getReportMaxPerDay();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { count, error } = await admin
    .from('reports')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', since);

  if (error) {
    console.error('[checkReportRateLimitAction]', error);
    return { count: 0, limit, allowed: true };
  }

  const c = count ?? 0;
  return { count: c, limit, allowed: c < limit };
}

/** Data for client-side chart rendering (service report). */
export async function preflightServiceReportChartsAction(
  serviceType: string,
  folderIds: string[],
  year: number,
  startMonth: number,
  endMonth: number
) {
  await requireReportUser();

  const [periods, indicators] = await Promise.all([
    qaServiceServer.getPeriods(),
    qaServiceServer.getIndicators(serviceType),
  ]);
  const context = { periods, indicators };

  const data = await qaServiceServer.getConsolidatedDashboardDataByRange(
    serviceType,
    folderIds,
    context,
    year,
    startMonth,
    endMonth
  );

  if (!data || data.summary.totalDefects === 0) {
    throw new Error('Tidak ditemukan data temuan QA untuk rentang periode dan filter yang dipilih.');
  }

  return {
    summary: data.summary,
    paretoData: data.paretoData,
    donutData: data.donutData,
  };
}

/** Monthly trend points for individual report chart. */
export async function preflightIndividualReportChartsAction(
  pesertaId: string,
  year: number,
  startMonth: number,
  endMonth: number
) {
  await requireReportUser();
  const trend = await qaServiceServer.getAgentMonthlyPerformanceForReport(
    pesertaId,
    year,
    startMonth,
    endMonth
  );
  return { trend };
}

export type GenerateServiceReportInput = {
  reportKind: 'layanan';
  serviceType: ServiceType;
  folderIds: string[];
  year: number;
  startMonth: number;
  endMonth: number;
  modelId: string;
  paretoPngBase64: string | null;
  donutPngBase64: string | null;
};

export type GenerateIndividualReportInput = {
  reportKind: 'individu';
  pesertaId: string;
  year: number;
  startMonth: number;
  endMonth: number;
  modelId: string;
  trendPngBase64: string | null;
};

export async function generateReportAction(
  input: GenerateServiceReportInput | GenerateIndividualReportInput
): Promise<
  | { ok: true; reportId: string; storagePath: string; signedUrl: string; expiresIn: number }
  | { ok: false; error: string }
> {
  const started = Date.now();
  const { supabase, user } = await requireReportUser();
  const admin = createAdminClient();
  const limit = getReportMaxPerDay();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { count: recentCount, error: cntErr } = await admin
    .from('reports')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', since);

  if (!cntErr && (recentCount ?? 0) >= limit) {
    return {
      ok: false,
      error: `Anda telah mencapai batas pembuatan laporan hari ini (${limit}/${limit}). Coba lagi besok.`,
    };
  }

  const modelId = input.modelId;
  const provider = getProviderFromModelId(modelId);
  const aiProvider = provider;

  let reportId: string | null = null;
  let downloadName = 'Laporan_QA.docx';

  try {
    const insertRow: Record<string, unknown> = {
      user_id: user.id,
      report_type: input.reportKind === 'layanan' ? 'layanan' : 'individu',
      service_type: input.reportKind === 'layanan' ? input.serviceType : null,
      peserta_id: input.reportKind === 'individu' ? input.pesertaId : null,
      parameters: {
        year: input.year,
        startMonth: input.startMonth,
        endMonth: input.endMonth,
        folderIds: input.reportKind === 'layanan' ? input.folderIds : [],
      },
      ai_model_used: modelId,
      ai_provider: aiProvider,
      status: 'processing',
    };

    const { data: inserted, error: insErr } = await admin.from('reports').insert(insertRow).select('id').single();
    if (insErr) throw new Error(insErr.message || 'Gagal membuat catatan laporan.');
    reportId = inserted!.id as string;

    let buffer: Buffer;
    let storagePath: string;

    const systemNarration =
      'Anda adalah analis QA senior dengan spesialisasi filosofi "Path to Zero" (menuju nol temuan). ' +
      'Tulis laporan profesional dalam Bahasa Indonesia yang actionable, kritis, dan berorientasi pada perbaikan berkelanjutan. ' +
      'Gunakan bullet points untuk kejelasan. Fokus pada tren (membaik/memburuk) dan rekomendasi strategis. Jangan menyertakan markup HTML.';

    if (input.reportKind === 'layanan') {
      const [periods, indicators] = await Promise.all([
        qaServiceServer.getPeriods(),
        qaServiceServer.getIndicators(input.serviceType),
      ]);
      const context = { periods, indicators };

      const [periodData, detailRows, trendData] = await Promise.all([
        qaServiceServer.getConsolidatedDashboardDataByRange(
          input.serviceType,
          input.folderIds,
          context,
          input.year,
          input.startMonth,
          input.endMonth
        ),
        qaServiceServer.getServiceReportTemuanDetailRows(
          input.serviceType,
          input.folderIds,
          context,
          input.year,
          input.startMonth,
          input.endMonth
        ),
        qaServiceServer.getConsolidatedTrendDataByRange(
          input.serviceType,
          input.folderIds,
          context,
          input.year,
          input.startMonth,
          input.endMonth
        ),
      ]);

      const svcLabel = SERVICE_LABELS[input.serviceType];
      const periodLabel = `${MONTHS[input.startMonth - 1]}–${MONTHS[input.endMonth - 1]} ${input.year}`;
      
      // Calculate Path to Zero Tracker rows for the builder
      const datasets = trendData?.paramTrend?.datasets || [];
      const paramTrackerRows = datasets
        .filter(d => !d.isTotal)
        .map(d => {
          const current = d.data[d.data.length - 1] || 0;
          const previous = d.data[0] || 0;
          const delta = current - previous;
          let direction: 'up' | 'down' | 'flat' = 'flat';
          if (delta > 0) direction = 'up';
          else if (delta < 0) direction = 'down';
          
          return {
            parameter: d.label,
            current,
            previous,
            delta,
            direction,
          };
        })
        .sort((a, b) => b.current - a.current);

      const paramTrends = datasets
        .filter(d => !d.isTotal)
        .map(d => `${d.label}: [${d.data.join(', ')}]`)
        .join(' | ') || '—';

      const prompt = [
        `Analisis Laporan QA Layanan ${svcLabel} - Filosofi Path to Zero.`,
        `Periode: ${periodLabel}.`,
        `1. STATUS EXECUTIVE SUMMARY:`,
        `- Total temuan: ${periodData.summary.totalDefects}`,
        `- Average temuan per audit (absolut): ${periodData.summary.avgDefectsPerAudit.toFixed(2)}`,
        `- Compliance rate: ${periodData.summary.complianceRate.toFixed(1)}%`,
        `- Status Zero-Error: ${periodData.summary.zeroErrorRate.toFixed(1)}% agen tanpa temuan.`,
        `2. DASHBOARD ARAH PARAMETER (Data tren bulanan per parameter):`,
        `${paramTrends}`,
        `Instruksi: Analisis mana parameter yang Membaik (turun), Memburuk (naik), atau Stagnan. Berikan tanda (⚠️) untuk yang memburuk.`,
        `3. ZOOM-IN PARAMETER MEMBURUK:`,
        `Berdasarkan data Pareto: ${periodData.paretoData.slice(0, 5).map(p => `${p.name} (${p.count})`).join(', ')}.`,
        `4. SUCCESS SPOTLIGHT: Sebutkan parameter yang menunjukkan tren penurunan temuan yang signifikan atau mencapai Zero.`,
        `5. REKOMENDASI STRATEGIS: Berikan 3 poin intervensi sistem atau proses untuk menekan temuan menuju Zero.`,
        `PENTING: Gunakan struktur penomoran 1-5 di atas dalam narasi Anda.`,
      ].join('\n');

      const aiNarrative = await narrationWithTimeout(modelId, systemNarration, prompt);

      buffer = await buildServiceReportDocx({
        title: `Laporan QA Layanan — ${svcLabel}`,
        serviceType: input.serviceType,
        periodLabel,
        summary: periodData.summary,
        paramTrackerRows, // New structured data
        aiNarrative,
        paretoPngBase64: input.paretoPngBase64,
        donutPngBase64: input.donutPngBase64,
        detailRows,
      });

      storagePath = `${user.id}/${reportId}.docx`;
      const svcLabelSafe = svcLabel.replace(/\s+/g, '_');
      const periodLabelSafe = periodLabel.replace(/\s+/g, '_').replace(/–/g, '-');
      downloadName = `Laporan_QA_Layanan_${svcLabelSafe}_${periodLabelSafe}.docx`;
    } else {
      const { agent, temuan: rawTemuan } = await qaServiceServer.getAgentWithTemuan(
        input.pesertaId,
        input.year,
        undefined
      );
      const temuanRaw = rawTemuan as QATemuan[];

      const temuan = temuanRaw.filter((t) => {
        const p = t.qa_periods as { month?: number; year?: number } | undefined;
        if (!p) return false;
        return (
          p.year === input.year &&
          p.month >= input.startMonth &&
          p.month <= input.endMonth
        );
      });

      const trend = await qaServiceServer.getAgentMonthlyPerformanceForReport(
        input.pesertaId,
        input.year,
        input.startMonth,
        input.endMonth
      );

      const scoresWithData = trend.filter((x) => x.findings > 0).map((x) => x.score);
      const avgScore =
        scoresWithData.length > 0
          ? scoresWithData.reduce((a, b) => a + b, 0) / scoresWithData.length
          : trend.length
            ? trend.reduce((a, b) => a + b.score, 0) / trend.length
            : 100;

      const preRangeTemuan = temuanRaw.filter((t) => {
        const p = t.qa_periods as { month?: number; year?: number } | undefined;
        if (!p) return false;
        return p.year === input.year && p.month < input.startMonth;
      });

      const latestPeriodByService = new Map<ServiceType, { periodId?: string; year: number; month: number }>();
      temuanRaw.forEach((finding) => {
        const service = (finding.service_type || 'call') as ServiceType;
        const period = finding.qa_periods as { month?: number; year?: number } | undefined;
        if (!period?.year || !period?.month) return;
        if (period.year !== input.year || period.month > input.endMonth) return;

        const current = latestPeriodByService.get(service);
        if (!current || period.month > current.month) {
          latestPeriodByService.set(service, {
            periodId: finding.period_id,
            year: period.year,
            month: period.month,
          });
        }
      });

      if (latestPeriodByService.size === 0) {
        const fallbackService = (temuan[0]?.service_type as ServiceType) || 'call';
        latestPeriodByService.set(fallbackService, {
          periodId: temuan[0]?.period_id,
          year: input.year,
          month: input.endMonth,
        });
      }

      const serviceIndicatorNameMap = new Map<ServiceType, Map<string, string>>();
      const allParameterNames = new Set<string>();

      await Promise.all([...latestPeriodByService.entries()].map(async ([service, latest]) => {
        const indicators = await qaServiceServer.getIndicators(service, latest.periodId || '');
        const nameMap = new Map<string, string>();

        (indicators as Array<{ id: string; name: string; legacy_indicator_id?: string | null }>).forEach((indicator) => {
          const name = (indicator.name || '').trim();
          if (!name) return;
          allParameterNames.add(name);
          nameMap.set(indicator.id, name);
          if (indicator.legacy_indicator_id) {
            nameMap.set(indicator.legacy_indicator_id, name);
          }
        });

        serviceIndicatorNameMap.set(service, nameMap);
      }));

      const resolveParameterName = (finding: QATemuan): string => {
        const joined = (finding.qa_indicators as { name?: string } | undefined)?.name?.trim();
        if (joined) return joined;

        const service = (finding.service_type || 'call') as ServiceType;
        const key = finding.rule_indicator_id || finding.indicator_id || '';
        if (!key) return 'Unknown';

        return serviceIndicatorNameMap.get(service)?.get(key) || 'Unknown';
      };

      const currentParams = new Set(temuan.map(resolveParameterName).filter((name) => name !== 'Unknown'));
      const preRangeParams = new Set(preRangeTemuan.map(resolveParameterName).filter((name) => name !== 'Unknown'));
      const parameterUniverse = allParameterNames.size > 0
        ? [...allParameterNames].sort((a, b) => a.localeCompare(b))
        : [...new Set([...currentParams, ...preRangeParams])].sort((a, b) => a.localeCompare(b));

      const paramMapRows: Array<{ parameter: string; status: 'dipertahankan' | 'baru' | 'regresi' | 'aktif' }> = [];
      let zeroParamCount = 0;

      parameterUniverse.forEach((name) => {
        const isCurrentZero = !currentParams.has(name);
        const isPreZero = !preRangeParams.has(name);

        if (isCurrentZero) {
          zeroParamCount++;
          if (isPreZero) {
            paramMapRows.push({ parameter: name, status: 'dipertahankan' });
          } else {
            paramMapRows.push({ parameter: name, status: 'baru' });
          }
        } else {
          if (isPreZero && preRangeParams.size > 0) {
            paramMapRows.push({ parameter: name, status: 'regresi' });
          } else {
            paramMapRows.push({ parameter: name, status: 'aktif' });
          }
        }
      });

      const regressionParams = paramMapRows
        .filter(r => r.status === 'regresi')
        .map(r => r.parameter);
      
      const totalParamCount = parameterUniverse.length;

      const tickets = new Set<string>();
      temuan.forEach((t, idx) => {
        const k = t.no_tiket && String(t.no_tiket).trim() ? String(t.no_tiket).trim() : `row-${idx}`;
        tickets.add(k);
      });

      const detailRows = temuan.map((t) => {
        const p = t.qa_periods as { month?: number; year?: number } | undefined;
        const periode = p ? `${MONTHS[(p.month ?? 1) - 1]} ${p.year}` : '—';
        return {
          no_tiket: t.no_tiket ?? null,
          parameter: resolveParameterName(t) === 'Unknown' ? '—' : resolveParameterName(t),
          nilai: t.nilai,
          periode,
          ketidaksesuaian: t.ketidaksesuaian ?? null,
          sebaiknya: t.sebaiknya ?? null,
        };
      });

      const periodLabel = `${MONTHS[input.startMonth - 1]}–${MONTHS[input.endMonth - 1]} ${input.year}`;
      const topParams: Record<string, number> = {};
      temuan.forEach((t) => {
        const n = resolveParameterName(t);
        topParams[n] = (topParams[n] || 0) + 1;
      });
      const topStr = Object.entries(topParams)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([k, v]) => `${k}: ${v}`)
        .join('; ');

      const prompt = [
        `Analisis Laporan QA Individu: ${agent.nama} (Filosofi Path to Zero).`,
        `Periode: ${periodLabel}.`,
        `1. PROFIL & STATUS PERSONAL PATH TO ZERO:`,
        `- Skor QA rata-rata: ${avgScore.toFixed(1)}`,
        `- Status Zero: ${zeroParamCount} dari ${totalParamCount} parameter mencapai ZERO.`,
        `- Total temuan: ${temuan.length} (dari ${tickets.size} sesi audit).`,
        `2. PETA PARAMETER PERSONAL:`,
        `- Parameter dominan: ${topStr || 'Semua parameter dalam kondisi baik.'}`,
        `3. ALARM REGRESI (⚠️):`,
        `- Parameter yang muncul kembali setelah sebelumnya bersih: ${regressionParams.length > 0 ? regressionParams.join(', ') : 'Tidak ditemukan regresi (Pertahankan!).'}`,
        `4. PRIORITAS COACHING:`,
        `Identifikasi Top 3 parameter yang paling krusial untuk diperbaiki segera berdasarkan frekuensi dan dampak.`,
        `5. TARGET PERIODE BERIKUTNYA: Berikan target spesifik (misal: Zero temuan pada parameter X).`,
        `PENTING: Gunakan struktur penomoran 1-5 di atas dalam narasi Anda. Berikan saran dialog coaching yang singkat dan empatik.`,
      ].join('\n');

      const aiNarrative = await narrationWithTimeout(modelId, systemNarration, prompt);

      buffer = await buildIndividualReportDocx({
        title: `Laporan QA Individu — ${agent.nama}`,
        agentName: agent.nama,
        team: agent.tim || '—',
        batch: agent.batch_name || '—',
        role: agent.jabatan || '—',
        periodLabel,
        avgScore,
        totalFindings: temuan.length,
        sessionEstimate: tickets.size,
        zeroParamCount,
        totalParamCount,
        paramMapRows,
        regressionParams,
        aiNarrative,
        trendPngBase64: input.trendPngBase64,
        detailRows,
      });

      storagePath = `${user.id}/${reportId}.docx`;
      const agentNameSafe = agent.nama.replace(/\s+/g, '_');
      const periodLabelSafe = periodLabel.replace(/\s+/g, '_').replace(/–/g, '-');
      downloadName = `Laporan_QA_Individu_${agentNameSafe}_${periodLabelSafe}.docx`;
    }

    if (buffer.length > MAX_DOCX_BYTES) {
      throw new Error(`Ukuran file melebihi batas ${MAX_DOCX_BYTES / (1024 * 1024)}MB.`);
    }

    const { error: upErr } = await admin.storage.from('reports').upload(storagePath, buffer, {
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      upsert: true,
    });
    if (upErr) throw new Error(upErr.message || 'Gagal mengunggah file ke penyimpanan.');

    const processing_time_ms = Date.now() - started;

    const { error: upRowErr } = await admin
      .from('reports')
      .update({
        status: 'completed',
        file_url: storagePath,
        file_size_bytes: buffer.length,
        processing_time_ms,
        error_message: null,
      })
      .eq('id', reportId);

    if (upRowErr) throw new Error(upRowErr.message);

    await supabase.from('activity_logs').insert({
      user_id: user.id,
      user_name: user.email ?? '',
      action: `Report Maker: generate ${input.reportKind} (${reportId})`,
      module: 'SIDAK',
      type: 'add',
    });

    const { data: signed, error: signErr } = await admin.storage
      .from('reports')
      .createSignedUrl(storagePath, 3600, { download: downloadName });

    if (signErr || !signed?.signedUrl) {
      throw new Error(signErr?.message || 'Gagal membuat tautan unduhan.');
    }

    return {
      ok: true,
      reportId,
      storagePath,
      signedUrl: signed.signedUrl,
      expiresIn: 3600,
    };
  } catch (e: unknown) {
    console.error('[generateReportAction] CRITICAL ERROR:', e);
    const msg = e instanceof Error ? e.message : 'Gagal membuat laporan karena kesalahan server internal.';
    if (reportId) {
      try {
        await admin
          .from('reports')
          .update({ status: 'failed', error_message: msg })
          .eq('id', reportId);
      } catch (dbErr) {
        console.error('[generateReportAction] Failed to update fail status:', dbErr);
      }
    }
    return { ok: false, error: msg };
  }
}

export async function markReportDownloadedAction(reportId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { user } = await requireReportUser();
    const admin = createAdminClient();

    const { data: row, error: fetchErr } = await admin
      .from('reports')
      .select('id, user_id, downloaded_at')
      .eq('id', reportId)
      .single();

    if (fetchErr || !row) return { ok: false, error: 'Laporan tidak ditemukan.' };
    if (row.user_id !== user.id) return { ok: false, error: 'Akses ditolak.' };
    if (row.downloaded_at) return { ok: true };

    const { error: upErr } = await admin
      .from('reports')
      .update({ downloaded_at: new Date().toISOString() })
      .eq('id', reportId);

    if (upErr) return { ok: false, error: upErr.message };
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Gagal mencatat unduhan.' };
  }
}
