'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Agent,
  AgentDetailData,
  AgentPeriodSummary,
  QATemuan,
  PeriodSelection,
  EditFormState,
  GroupedTemuan,
  CoachingInsight,
  ScoreResult,
  unwrapIndicator,
} from '../../../lib/qa-types';
import { User } from '@supabase/supabase-js';
import {
  deleteTemuanAction,
  getAgentExportDataAction,
  getAgentPeriodsAction,
  getAgentTemuanPageAction,
  getPersonalTrendAction,
  updateTemuanAction,
} from '../../../actions';

interface UseAgentDetailProps {
  agentId: string;
  user: User;
  role: string;
  initialAgent: Agent;
  initialData: AgentDetailData;
}

function toScoreResult(period: AgentPeriodSummary): ScoreResult {
  return {
    month: period.month,
    year: period.year,
    finalScore: period.finalScore,
    nonCriticalScore: period.nonCriticalScore,
    criticalScore: period.criticalScore,
    sessionCount: period.sessionCount,
    service_type: period.serviceType,
  };
}

export function useAgentDetail({
  agentId,
  initialAgent,
  initialData,
}: UseAgentDetailProps) {
  const router = useRouter();
  const [loadingTemuan, setLoadingTemuan] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [activeSection, setActiveSection] = useState<'summary' | 'trend' | 'temuan'>('summary');
  const [trendMounted, setTrendMounted] = useState(false);
  const [temuanMounted, setTemuanMounted] = useState(false);
  const [activeTrendFilter, setActiveTrendFilter] = useState('all');
  const manualScrollRef = useRef<number>(0);

  const [agent] = useState<Agent>(initialAgent);
  const [data, setData] = useState<AgentDetailData>(initialData);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodSelection | null>(initialData.selectedPeriod ?? initialData.periodSummaries[0] ?? null);
  const [selectedYear, setSelectedYear] = useState(initialData.selectedPeriod?.year ?? new Date().getFullYear());
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(Boolean(initialData.temuanHasMore));
  const [loadedPeriodKey, setLoadedPeriodKey] = useState<string | null>(
    initialData.selectedPeriod ? `${initialData.selectedPeriod.id}:${initialData.selectedPeriod.serviceType}` : null
  );

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [editingTemuan, setEditingTemuan] = useState<QATemuan | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>({ nilai: 0, ketidaksesuaian: '', sebaiknya: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const indicatorsMetadata = data.indicators;
  const temuan = data.temuan;
  const personalTrend = data.personalTrend;
  const periodSummaries = data.periodSummaries;

  const _scoreHistory = useMemo(() => periodSummaries.map(toScoreResult), [periodSummaries]);

  const sortedPeriods = useMemo(() => {
    return periodSummaries.map((period) => ({
      month: period.month,
      year: period.year,
      label: period.label,
      serviceType: period.serviceType,
      id: period.id,
    }));
  }, [periodSummaries]);

  const selectedScore = useMemo((): ScoreResult | null => {
    if (!selectedPeriod) return null;
    const summary = periodSummaries.find(
      (period) =>
        period.id === selectedPeriod.id &&
        period.month === selectedPeriod.month &&
        period.year === selectedPeriod.year &&
        period.serviceType === selectedPeriod.serviceType
    );

    return summary ? toScoreResult(summary) : null;
  }, [periodSummaries, selectedPeriod]);

  const prevPeriod = useMemo(() => {
    if (!selectedPeriod) return null;
    const index = sortedPeriods.findIndex(
      (period) =>
        period.id === selectedPeriod.id &&
        period.month === selectedPeriod.month &&
        period.year === selectedPeriod.year &&
        period.serviceType === selectedPeriod.serviceType
    );

    return index >= 0 && index < sortedPeriods.length - 1 ? sortedPeriods[index + 1] : null;
  }, [selectedPeriod, sortedPeriods]);

  const prevScore = useMemo((): ScoreResult | null => {
    if (!prevPeriod) return null;
    const summary = periodSummaries.find(
      (period) =>
        period.id === prevPeriod.id &&
        period.month === prevPeriod.month &&
        period.year === prevPeriod.year &&
        period.serviceType === prevPeriod.serviceType
    );

    return summary ? toScoreResult(summary) : null;
  }, [periodSummaries, prevPeriod]);

  const trendDir = useMemo((): 'up' | 'down' | 'same' | 'none' => {
    if (!selectedScore || !prevScore) return 'none';
    if (selectedScore.finalScore > prevScore.finalScore) return 'up';
    if (selectedScore.finalScore < prevScore.finalScore) return 'down';
    return 'same';
  }, [selectedScore, prevScore]);

  const automatedCoaching = useMemo((): CoachingInsight | null => {
    if (!temuan.length) return null;
    const criticals = temuan.filter((item) => item.nilai === 0);
    const target = criticals.length > 0 ? criticals : temuan.filter((item) => item.nilai === 1);

    if (!target.length) return null;

    const counts: Record<string, number> = {};
    target.forEach((item) => {
      const indicator = unwrapIndicator(item.qa_indicators);
      const name = indicator?.name || 'Unknown';
      counts[name] = (counts[name] || 0) + 1;
    });

    const topParam = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    const example = target.find((item) => unwrapIndicator(item.qa_indicators)?.name === topParam[0]);

    return {
      parameter: topParam[0],
      count: topParam[1],
      recommendation: example?.sebaiknya || 'Tingkatkan kualitas pada parameter ini.',
      isCritical: criticals.length > 0,
    };
  }, [temuan]);

  const groupedTemuan = useMemo((): GroupedTemuan[] => {
    const groups: Record<string, QATemuan[]> = {};
    temuan.forEach((item) => {
      const key = item.no_tiket || `No Ticket-${item.id}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });

    return Object.entries(groups).map(([no_tiket, items], index) => ({
      urutan: index + 1,
      no_tiket: no_tiket.startsWith('No Ticket-') ? null : no_tiket,
      items,
    }));
  }, [temuan]);

  const availableYears = initialData.availableYears || [new Date().getFullYear()];

  useEffect(() => {
    if (sortedPeriods.length > 0 && !selectedPeriod) {
      setSelectedPeriod(sortedPeriods[0]);
    }
  }, [selectedPeriod, sortedPeriods]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (Date.now() - manualScrollRef.current < 800) return;

        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            const id = entry.target.id;
            if (id === 'section-summary') setActiveSection('summary');
            if (id === 'section-trend') {
              setActiveSection('trend');
              setTrendMounted(true);
            }
            if (id === 'section-temuan') {
              setActiveSection('temuan');
              setTemuanMounted(true);
            }
          }
        });
      },
      {
        root: scrollContainerRef.current,
        threshold: [0.1, 0.5, 0.8],
        rootMargin: '-100px 0px -200px 0px',
      }
    );

    ['section-summary', 'section-trend', 'section-temuan'].forEach((id) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, []);

  const scrollToSection = useCallback((sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element && scrollContainerRef.current) {
      manualScrollRef.current = Date.now();

      const key = sectionId.replace('section-', '');
      if (key === 'summary' || key === 'trend' || key === 'temuan') {
        setActiveSection(key);
      }

      const top = element.offsetTop - 140;
      scrollContainerRef.current.scrollTo({ top, behavior: 'smooth' });
    }
  }, []);

  const loadPeriodData = useCallback(async (
    period: PeriodSelection,
    options?: { forceTrend?: boolean }
  ) => {
    setLoadingTemuan(true);
    try {
      const periodKey = `${period.id}:${period.serviceType}`;
      const shouldRefreshTrend = options?.forceTrend || !loadedPeriodKey || !loadedPeriodKey.endsWith(`:${period.serviceType}`);

      const latestPeriodForService = periodSummaries.find(p => p.serviceType === period.serviceType);
      const endMonth = latestPeriodForService ? latestPeriodForService.month : 0;

      const [pageResult, trendResult] = await Promise.all([
        getAgentTemuanPageAction(agentId, selectedYear, period.id!, period.serviceType, 0),
        shouldRefreshTrend ? getPersonalTrendAction(agentId, selectedYear, 1, endMonth, period.serviceType) : Promise.resolve(null),
      ]);

      setData((prev) => ({
        ...prev,
        temuan: pageResult.temuan,
        personalTrend: trendResult ?? prev.personalTrend,
      }));
      setCurrentPage(0);
      setHasMore(pageResult.hasMore);
      setLoadedPeriodKey(periodKey);
    } catch (err) {
      console.error(`Gagal mengambil data periode ${period.id}:${period.serviceType}`, err);
      setData((prev) => ({ ...prev, temuan: [] }));
      setCurrentPage(0);
      setHasMore(false);
    } finally {
      setLoadingTemuan(false);
    }
  }, [agentId, loadedPeriodKey, selectedYear, periodSummaries]);

  const handleSelectedPeriodChange = useCallback(async (period: PeriodSelection) => {
    setSelectedPeriod(period);
    await loadPeriodData(period);
  }, [loadPeriodData]);

  const handleYearChange = async (year: number) => {
    if (year === selectedYear) return;
    setLoadingTemuan(true);
    try {
      const periodsResult = await getAgentPeriodsAction(agentId, year);
      const nextPeriod = periodsResult.periods[0] ?? null;

      if (!nextPeriod) {
        setData((prev) => ({ ...prev, periodSummaries: [], temuan: [], personalTrend: { labels: [], datasets: [] } }));
        setSelectedPeriod(null);
        setSelectedYear(year);
        setCurrentPage(0);
        setHasMore(false);
        setLoadedPeriodKey(null);
        return;
      }

      const latestPeriodForService = periodsResult.periods.find(p => p.serviceType === nextPeriod.serviceType);
      const endMonth = latestPeriodForService ? latestPeriodForService.month : 0;

      const [pageResult, trendResult] = await Promise.all([
        getAgentTemuanPageAction(agentId, year, nextPeriod.id, nextPeriod.serviceType, 0),
        getPersonalTrendAction(agentId, year, 1, endMonth, nextPeriod.serviceType),
      ]);

      setData((prev) => ({
        ...prev,
        periodSummaries: periodsResult.periods,
        temuan: pageResult.temuan,
        personalTrend: trendResult,
      }));
      setSelectedYear(year);
      setSelectedPeriod(nextPeriod);
      setCurrentPage(0);
      setHasMore(pageResult.hasMore);
      setLoadedPeriodKey(`${nextPeriod.id}:${nextPeriod.serviceType}`);
    } catch (err) {
      console.error(`Gagal mengambil data tahun ${year}`, err);
    } finally {
      setLoadingTemuan(false);
    }
  };

  const handlePageChange = async (page: number) => {
    if (!selectedPeriod || page <= currentPage || page < 0) return;

    setLoadingTemuan(true);
    try {
      const result = await getAgentTemuanPageAction(
        agentId,
        selectedYear,
        selectedPeriod.id!,
        selectedPeriod.serviceType,
        page
      );

      setData((prev) => ({
        ...prev,
        temuan: [...prev.temuan, ...result.temuan],
      }));
      setCurrentPage(page);
      setHasMore(result.hasMore);
    } catch (err) {
      console.error(`Gagal mengambil halaman ${page}`, err);
    } finally {
      setLoadingTemuan(false);
    }
  };



  const startEdit = (temuanItem: QATemuan) => {
    setEditingTemuan(temuanItem);
    setEditForm({
      nilai: temuanItem.nilai,
      ketidaksesuaian: temuanItem.ketidaksesuaian || '',
      sebaiknya: temuanItem.sebaiknya || '',
    });
  };

  const refreshCurrentPeriodSummary = async () => {
    const result = await getAgentPeriodsAction(agentId, selectedYear);
    setData((prev) => ({ ...prev, periodSummaries: result.periods }));
  };

  const handleEditSave = async () => {
    if (!editingTemuan) return;
    setIsSubmitting(true);
    try {
      const updated = await updateTemuanAction(editingTemuan.id, editForm);
      setData((prev) => ({
        ...prev,
        temuan: prev.temuan.map((item) => (item.id === editingTemuan.id ? updated : item)),
      }));
      setEditingTemuan(null);
      await refreshCurrentPeriodSummary();
    } catch (err) {
      console.error('Gagal menyimpan perubahan', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus temuan ini?')) return;
    setDeletingId(id);
    try {
      await deleteTemuanAction(id);
      setData((prev) => ({
        ...prev,
        temuan: prev.temuan.filter((item) => item.id !== id),
      }));
      await refreshCurrentPeriodSummary();
    } catch (err) {
      console.error('Gagal menghapus temuan', err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const exportData = await getAgentExportDataAction(agentId);
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();

      const summaryRows: (string | number | undefined)[][] = [
        ['Laporan SIDAK'], [''],
        ['Nama Agent', exportData.agent.nama], ['Tim', exportData.agent.tim], ['Folder', exportData.agent.batch],
        ['Tanggal Export', new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })],
        [''], ['RINGKASAN SKOR PER PERIODE'],
        ['Periode', 'Layanan', 'Skor Akhir', 'Non-Critical', 'Critical'],
      ];
      exportData.periods.forEach((period) => {
        const monthLabel = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][period.month - 1];
        summaryRows.push([
          `${monthLabel} ${period.year}`,
          period.service_type.toUpperCase(),
          period.score.toFixed(2),
          period.ncScore.toFixed(2),
          period.crScore.toFixed(2),
        ]);
      });
      const ws1 = XLSX.utils.aoa_to_sheet(summaryRows);
      ws1['!cols'] = [{ wch: 24 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, ws1, 'Ringkasan');

      exportData.periods.forEach((period) => {
        const monthShort = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][period.month - 1];
        const svcLabel = period.service_type === 'call' ? 'Call' : period.service_type === 'email' ? 'Email' : `${period.service_type.charAt(0).toUpperCase()}${period.service_type.slice(1)}`;
        const sheetName = `${monthShort} ${period.year} (${svcLabel})`.slice(0, 31);

        const rows: (string | number | undefined)[][] = [
          [`${['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][period.month - 1]} ${period.year} - ${svcLabel}`], [''],
          [`Skor Akhir: ${period.score.toFixed(2)}`], [`Non-Critical: ${period.ncScore.toFixed(2)}`], [`Critical: ${period.crScore.toFixed(2)}`],
          [''], ['No. Tiket', 'Kategori', 'Parameter', 'Nilai', 'Keterangan', 'Ketidaksesuaian', 'Sebaiknya'],
        ];
        period.temuan.forEach((item) => {
          const indicator = unwrapIndicator(item.qa_indicators);
          rows.push([
            item.no_tiket ?? '-',
            indicator?.category === 'critical' ? 'Critical' : 'Non-Critical',
            indicator?.name ?? '-',
            item.nilai,
            { 0: 'CRITICAL', 1: 'DEFICIT', 2: 'GOOD', 3: 'EXCELLENT' }[item.nilai] || '-',
            item.ketidaksesuaian ?? '-',
            item.sebaiknya ?? '-',
          ]);
        });
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [{ wch: 14 }, { wch: 14 }, { wch: 32 }, { wch: 8 }, { wch: 14 }, { wch: 30 }, { wch: 30 }];
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      });

      XLSX.writeFile(wb, `QA_${exportData.agent.nama.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      console.error('Gagal mengekspor data', err);
    } finally {
      setExporting(false);
    }
  };

  const handleTambahTemuan = () => {
    router.push(`/qa-analyzer/entry?agentId=${agentId}&name=${encodeURIComponent(agent.nama)}`);
  };

  return {
    loadingTemuan,
    loadingTrend: loadingTemuan,
    exporting,
    selectedPeriod,
    setSelectedPeriod: handleSelectedPeriodChange,

    activeSection,
    trendMounted,
    temuanMounted,
    activeTrendFilter,
    setActiveTrendFilter,
    agent,
    selectedYear,
    currentPage,
    hasMore,
    scrollContainerRef,
    editingTemuan,
    editForm,
    setEditForm,
    isSubmitting,
    deletingId,
    indicators: indicatorsMetadata,
    temuan,
    personalTrend,
    sortedPeriods,
    selectedScore,
    prevScore,
    trendDir,
    automatedCoaching,
    groupedTemuan,
    scrollToSection,
    startEdit,
    handleEditSave,
    handleDelete,
    handleYearChange,
    handlePageChange,
    handleExport,
    handleTambahTemuan,
    setEditingTemuan,
    availableYears,
  };
}
