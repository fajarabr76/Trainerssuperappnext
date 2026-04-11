'use server';

import { createClient } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { getProviderFromModelId } from '@/app/lib/ai-models';
import { generateOpenRouterContent } from '@/app/actions/openrouter';
import { generateGeminiContent } from '@/app/actions/gemini';
import { qaServiceServer } from '../../services/qaService.server';
import type { ServiceType, QATemuan } from '../../lib/qa-types';
import { SERVICE_LABELS } from '../../lib/qa-types';
import { getReportMaxPerDay } from '../lib/report-models';
import { buildIndividualReportDocx, buildServiceReportDocx } from '../lib/docx-builder';

const ALLOWED_ROLES = ['trainer', 'trainers', 'admin', 'superadmin'];
const MAX_DOCX_BYTES = 10 * 1024 * 1024;
const AI_TIMEOUT_MS = 115_000;

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
    throw new Error('Akses ditolak: hanya trainer, admin, atau superadmin yang dapat membuat laporan.');
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
      });
      if (!r.success) throw new Error(r.error || 'Gagal memanggil OpenRouter');
      return r.text || '';
    }
    const r = await generateGeminiContent({
      model: modelId,
      systemInstruction,
      contents,
      temperature: 0.5,
    });
    if (!r.success) throw new Error(r.error || 'Gagal memanggil Gemini');
    return r.text || '';
  };

  return await Promise.race([
    run(),
    new Promise<string>((_, rej) =>
      setTimeout(() => rej(new Error('Generasi narasi AI melebihi batas waktu (120 detik).')), AI_TIMEOUT_MS)
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

  if (!data) {
    throw new Error('Tidak ada data untuk rentang periode yang dipilih.');
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
  const { supabase, user, profile } = await requireReportUser();
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
      'Anda adalah analis QA BPR. Tulis narasi profesional dalam Bahasa Indonesia, ringkas namun actionable. ' +
      'Gunakan bullet points bila perlu. Jangan menyertakan markup HTML.';

    if (input.reportKind === 'layanan') {
      const [periods, indicators] = await Promise.all([
        qaServiceServer.getPeriods(),
        qaServiceServer.getIndicators(input.serviceType),
      ]);
      const context = { periods, indicators };

      const periodData = await qaServiceServer.getConsolidatedDashboardDataByRange(
        input.serviceType,
        input.folderIds,
        context,
        input.year,
        input.startMonth,
        input.endMonth
      );
      if (!periodData) throw new Error('Data dashboard tidak tersedia untuk filter ini.');

      const detailRows = await qaServiceServer.getServiceReportTemuanDetailRows(
        input.serviceType,
        input.folderIds,
        context,
        input.year,
        input.startMonth,
        input.endMonth
      );

      const svcLabel = SERVICE_LABELS[input.serviceType];
      const periodLabel = `${MONTHS[input.startMonth - 1]}–${MONTHS[input.endMonth - 1]} ${input.year}`;
      const prompt = [
        `Buat ringkasan analitik untuk laporan QA layanan ${svcLabel}, periode ${periodLabel}.`,
        `Metrik: total temuan ${periodData.summary.totalDefects}, rata temuan/audit ${periodData.summary.avgDefectsPerAudit.toFixed(2)}, `,
        `zero-error ${periodData.summary.zeroErrorRate.toFixed(1)}%, compliance ${periodData.summary.complianceRate.toFixed(1)}%, skor rata-rata agen ${periodData.summary.avgAgentScore.toFixed(1)}.`,
        `Top parameter Pareto (nama: jumlah): ${periodData.paretoData
          .slice(0, 8)
          .map((p) => `${p.name}: ${p.count}`)
          .join('; ')}.`,
        `Fatal vs non-fatal: critical ${periodData.donutData.critical}, non-critical ${periodData.donutData.nonCritical}.`,
        'Berikan interpretasi, risiko, dan rekomendasi perbaikan untuk manajemen.',
      ].join('\n');

      const aiNarrative = await narrationWithTimeout(modelId, systemNarration, prompt);

      buffer = await buildServiceReportDocx({
        title: `Laporan QA Layanan — ${svcLabel}`,
        serviceType: input.serviceType,
        periodLabel,
        summary: periodData.summary,
        aiNarrative,
        paretoPngBase64: input.paretoPngBase64,
        donutPngBase64: input.donutPngBase64,
        detailRows,
      });

      storagePath = `${user.id}/${reportId}.docx`;
    } else {
      const { agent, temuan: temuanRaw } = await qaServiceServer.getAgentWithTemuan(
        input.pesertaId,
        input.year,
        undefined
      );

      const temuan = (temuanRaw as QATemuan[]).filter((t) => {
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

      const tickets = new Set<string>();
      temuan.forEach((t, idx) => {
        const k =
          t.no_tiket && String(t.no_tiket).trim()
            ? String(t.no_tiket).trim()
            : `row-${idx}`;
        tickets.add(k);
      });

      const detailRows = temuan.map((t) => {
        const p = t.qa_periods as { month?: number; year?: number } | undefined;
        const periode = p ? `${MONTHS[(p.month ?? 1) - 1]} ${p.year}` : '—';
        return {
          no_tiket: t.no_tiket ?? null,
          parameter: (t.qa_indicators as { name?: string } | undefined)?.name?.trim() || '—',
          nilai: t.nilai,
          periode,
          ketidaksesuaian: t.ketidaksesuaian ?? null,
          sebaiknya: t.sebaiknya ?? null,
        };
      });

      const periodLabel = `${MONTHS[input.startMonth - 1]}–${MONTHS[input.endMonth - 1]} ${input.year}`;
      const topParams: Record<string, number> = {};
      temuan.forEach((t) => {
        const n = (t.qa_indicators as { name?: string } | undefined)?.name || 'Unknown';
        topParams[n] = (topParams[n] || 0) + 1;
      });
      const topStr = Object.entries(topParams)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([k, v]) => `${k}: ${v}`)
        .join('; ');

      const prompt = [
        `Buat insight coaching untuk agen ${agent.nama} (tim ${agent.tim || '—'}, batch ${agent.batch_name || '—'}).`,
        `Periode ${periodLabel}. Total temuan ${temuan.length}, perkiraan sesi ${tickets.size}, skor rata-rata bulanan (berbobot) ${avgScore.toFixed(1)}.`,
        `Distribusi parameter teratas: ${topStr || '—'}.`,
        'Fokus pada pola kesalahan, prioritas perbaikan, dan saran dialog coaching singkat.',
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
        aiNarrative,
        trendPngBase64: input.trendPngBase64,
        detailRows,
      });

      storagePath = `${user.id}/${reportId}.docx`;
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
      .createSignedUrl(storagePath, 3600);

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
    const msg = e instanceof Error ? e.message : 'Gagal membuat laporan.';
    if (reportId) {
      await admin
        .from('reports')
        .update({ status: 'failed', error_message: msg })
        .eq('id', reportId);
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
