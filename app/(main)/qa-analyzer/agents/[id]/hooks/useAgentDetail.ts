'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Agent,
  AgentDetailData,
  QATemuan,
  EditFormState,
  CoachingInsight,
  TrendData,
  unwrapIndicator,
  unwrapPeriod,
  ServiceType,
} from '../../../lib/qa-types';
import { User } from '@supabase/supabase-js';
import {
  deleteTemuanAction,
  getAgentPeriodsAction,
  getAgentTemuanRangeAction,
  getPersonalTrendAction,
  updateTemuanAction,
  getAgentsByFolderAction,
  getFoldersAction,
  getAgentExportDataAction,
} from '../../../actions';

interface UseAgentDetailProps {
  agentId: string;
  user: User;
  role: string;
  initialAgent: Agent;
  initialData: AgentDetailData;
}

export function useAgentDetail({
  agentId,
  user: _user,
  role,
  initialAgent,
  initialData,
}: UseAgentDetailProps) {
  const router = useRouter();
  const [loadingTemuan, setLoadingTemuan] = useState(false);
  const [loadingTrend, setLoadingTrend] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [activeSection, setActiveSection] = useState<'summary' | 'trend' | 'temuan'>('summary');
  const [trendMounted, setTrendMounted] = useState(false);
  const [temuanMounted, setTemuanMounted] = useState(false);
  const [activeTrendFilter, setActiveTrendFilter] = useState('all');
  const manualScrollRef = useRef<number>(0);

  const [agent] = useState<Agent>(initialAgent);
  const [data, setData] = useState<AgentDetailData>(initialData);
  
  // --- GLOBAL CONTEXT (Initialized from typed initial fields) ---
  const [selectedServiceType, setSelectedServiceType] = useState<ServiceType>(initialData.initialService);
  const [selectedYear, setSelectedYear] = useState(initialData.initialYear);

  // --- TREND SPECIFIC CONTEXT (Scoped as tstart/tend) ---
  const [trendStartMonth, setTrendStartMonth] = useState(initialData.initialTrendRange.start);
  const [trendEndMonth, setTrendEndMonth] = useState(initialData.initialTrendRange.end);

  // --- UI STATE ---
  const [selectedTeam, setSelectedTeam] = useState<string>(initialAgent.batch || initialAgent.tim || '');
  const [teams, setTeams] = useState<string[]>([]);
  const [agentsInTeam, setAgentsInTeam] = useState<Agent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // --- MODAL & ACTION STATE ---
  const [editingTemuan, setEditingTemuan] = useState<QATemuan | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>({ nilai: 0, ketidaksesuaian: '', sebaiknya: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const temuan = data.temuan;
  const personalTrend = data.personalTrend;
  const periodSummaries = data.periodSummaries;

  // --- RECONCILIATION: Sync local state when server canonical props change ---
  useEffect(() => {
    setData(initialData);
    setSelectedYear(initialData.initialYear);
    setSelectedServiceType(initialData.initialService);
    setTrendStartMonth(initialData.initialTrendRange.start);
    setTrendEndMonth(initialData.initialTrendRange.end);
    
    // Safety check for trend filter when data changes
    setActiveTrendFilter(prev => {
      const labels = initialData.personalTrend?.datasets?.map(d => d.label) || [];
      if (prev !== 'all' && !labels.includes(prev)) return 'all';
      return prev;
    });
  }, [
    agentId, 
    initialData
  ]);

  // --- HELPER: Sync URL with current filters (tstart/tend for explicit scoping) ---
  const syncUrl = useCallback((year: number, tstart: number, tend: number, service: string) => {
    router.replace(`/qa-analyzer/agents/${agentId}?year=${year}&tstart=${tstart}&tend=${tend}&service=${service}`, { scroll: false });
  }, [agentId, router]);

  // --- DERIVED DATA ---
  const monthlySummaries = useMemo(() => {
    return periodSummaries
      .filter(p => p.serviceType === selectedServiceType)
      .sort((a, b) => a.month - b.month);
  }, [periodSummaries, selectedServiceType]);

  const groupedFindingsByMonth = useMemo(() => {
    const groups: Record<number, QATemuan[]> = {};
    temuan.forEach(t => {
      const p = unwrapPeriod(t.qa_periods);
      const month = p?.month;
      if (!month) return;
      if (!groups[month]) groups[month] = [];
      groups[month].push(t);
    });
    
    return Object.entries(groups)
      .map(([month, items]) => ({
        month: parseInt(month),
        year: selectedYear,
        label: `${['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][parseInt(month)-1]} ${selectedYear}`,
        items: items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      }))
      .sort((a, b) => b.month - a.month);
  }, [temuan, selectedYear]);

  const availableServiceTypes = useMemo(() => {
    return Array.from(new Set(periodSummaries.map(p => p.serviceType as ServiceType)));
  }, [periodSummaries]);

  const availableYears = data.availableYears || [new Date().getFullYear()];

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

  // --- EFFECTS ---

  useEffect(() => {
    if (role === 'agent') return;
    async function loadSwitcherData() {
      setLoadingAgents(true);
      try {
        const [allTeams, teamAgents] = await Promise.all([
          getFoldersAction(),
          selectedTeam ? getAgentsByFolderAction(selectedTeam) : Promise.resolve([])
        ]);
        setTeams(allTeams);
        setAgentsInTeam(teamAgents as Agent[]);
      } catch (err) { 
        console.error('Gagal memuat switcher data:', err); 
      } finally {
        setLoadingAgents(false);
      }
    }
    loadSwitcherData();
  }, [role, selectedTeam]);

  // --- ACTIONS ---

  const handleAgentChange = (newAgentId: string) => {
    if (newAgentId === agentId) return;
    router.push(`/qa-analyzer/agents/${newAgentId}?year=${selectedYear}&tstart=${trendStartMonth}&tend=${trendEndMonth}&service=${selectedServiceType}`);
  };

  const validateTrendFilter = useCallback((trendResult: TrendData) => {
    const labels = trendResult.datasets.map((dataset) => dataset.label);
    setActiveTrendFilter((currentFilter) => {
      if (currentFilter !== 'all' && !labels.includes(currentFilter)) {
        return 'all';
      }
      return currentFilter;
    });
  }, []);

  const handleTrendRangeChange = async (start: number, end: number) => {
    if (start > end) return;
    setTrendStartMonth(start);
    setTrendEndMonth(end);
    syncUrl(selectedYear, start, end, selectedServiceType);
    
    setLoadingTrend(true);
    try {
      const trendResult = await getPersonalTrendAction(agentId, selectedYear, start, end, selectedServiceType);
      setData(prev => ({ ...prev, personalTrend: trendResult }));
      validateTrendFilter(trendResult);
    } catch (err) { console.error('Gagal memuat tren:', err); } finally { setLoadingTrend(false); }
  };

  const handleServiceChange = useCallback(async (service: ServiceType) => {
    setSelectedServiceType(service);
    syncUrl(selectedYear, trendStartMonth, trendEndMonth, service);
    
    setLoadingTemuan(true);
    setLoadingTrend(true);
    try {
      const [trendResult, allTemuan] = await Promise.all([
        getPersonalTrendAction(agentId, selectedYear, trendStartMonth, trendEndMonth, service),
        getAgentTemuanRangeAction(agentId, selectedYear, 1, 12, service)
      ]);
      setData(prev => ({ ...prev, personalTrend: trendResult, temuan: allTemuan }));
      validateTrendFilter(trendResult);
    } catch (err) { console.error('Gagal ganti layanan:', err); } finally {
      setLoadingTemuan(false);
      setLoadingTrend(false);
    }
  }, [agentId, selectedYear, trendStartMonth, trendEndMonth, syncUrl, validateTrendFilter]);

  const handleYearChange = async (year: number) => {
    if (year === selectedYear) return;
    setLoadingTemuan(true);
    setLoadingTrend(true);
    try {
      const periodsResult = await getAgentPeriodsAction(agentId, year);
      
      let targetService = selectedServiceType;
      const isSvcValid = periodsResult.periods.some(p => p.serviceType === selectedServiceType);
      if (!isSvcValid && periodsResult.periods.length > 0) {
        targetService = periodsResult.periods[0].serviceType as ServiceType;
      }
      setSelectedServiceType(targetService);

      const isCurrentYear = year === new Date().getFullYear();
      const start = 1;
      let end: number;
      if (isCurrentYear) {
        end = new Date().getMonth() + 1;
      } else {
        const latestForSvc = periodsResult.periods.find(p => p.serviceType === targetService);
        end = latestForSvc ? latestForSvc.month : 12;
      }
      setTrendStartMonth(start);
      setTrendEndMonth(end);
      syncUrl(year, start, end, targetService);

      const [allTemuan, trendResult] = await Promise.all([
        getAgentTemuanRangeAction(agentId, year, 1, 12, targetService),
        getPersonalTrendAction(agentId, year, start, end, targetService),
      ]);

      setData((prev) => ({
        ...prev,
        periodSummaries: periodsResult.periods,
        temuan: allTemuan,
        personalTrend: trendResult,
      }));
      validateTrendFilter(trendResult);
      setSelectedYear(year);
    } catch (err) { console.error(`Gagal ganti tahun:`, err); } finally {
      setLoadingTemuan(false);
      setLoadingTrend(false);
    }
  };

  const handleTeamChange = async (team: string) => {
    setSelectedTeam(team);
  };

  const startEdit = (temuanItem: QATemuan) => {
    setEditingTemuan(temuanItem);
    setEditForm({ nilai: temuanItem.nilai, ketidaksesuaian: temuanItem.ketidaksesuaian || '', sebaiknya: temuanItem.sebaiknya || '' });
  };
  
  const refreshData = async () => {
    setLoadingTrend(true);
    setLoadingTemuan(true);
    try {
      const [pResult, tResult, trendResult] = await Promise.all([
        getAgentPeriodsAction(agentId, selectedYear),
        getAgentTemuanRangeAction(agentId, selectedYear, 1, 12, selectedServiceType),
        getPersonalTrendAction(agentId, selectedYear, trendStartMonth, trendEndMonth, selectedServiceType)
      ]);
      setData((prev) => ({ 
        ...prev, 
        periodSummaries: pResult.periods, 
        temuan: tResult,
        personalTrend: trendResult
      }));
      validateTrendFilter(trendResult);
    } catch (err) { console.error('Gagal menyegarkan data:', err); } finally {
      setLoadingTrend(false);
      setLoadingTemuan(false);
    }
  };

  const handleEditSave = async () => {
    if (!editingTemuan) return;
    setIsSubmitting(true);
    try {
      await updateTemuanAction(editingTemuan.id, editForm);
      setEditingTemuan(null);
      await refreshData();
    } catch (err) { console.error('Gagal simpan:', err); } finally { setIsSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus temuan ini?')) return;
    setDeletingId(id);
    try {
      await deleteTemuanAction(id);
      await refreshData();
    } catch (err) { console.error('Gagal hapus:', err); } finally { setDeletingId(null); }
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
    } catch (err) { console.error('Gagal mengekspor data', err); } finally { setExporting(false); }
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (Date.now() - manualScrollRef.current < 800) return;
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            const id = entry.target.id;
            if (id === 'section-summary') setActiveSection('summary');
            if (id === 'section-trend') { setActiveSection('trend'); setTrendMounted(true); }
            if (id === 'section-temuan') { setActiveSection('temuan'); setTemuanMounted(true); }
          }
        });
      },
      { root: scrollContainerRef.current, threshold: [0.1, 0.5, 0.8], rootMargin: '-100px 0px -200px 0px' }
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
      if (key === 'summary' || key === 'trend' || key === 'temuan') setActiveSection(key);
      const top = element.offsetTop - 140;
      scrollContainerRef.current.scrollTo({ top, behavior: 'smooth' });
    }
  }, []);

  return {
    loadingTemuan, loadingTrend, exporting,
    selectedServiceType, handleServiceChange,
    selectedYear, handleYearChange,
    activeSection, trendMounted, temuanMounted, activeTrendFilter, setActiveTrendFilter, agent,
    scrollContainerRef, editingTemuan, editForm, setEditForm, isSubmitting, deletingId,
    indicators: data.indicators, personalTrend, monthlySummaries, groupedFindingsByMonth, availableServiceTypes,
    automatedCoaching, scrollToSection, startEdit, handleEditSave, handleDelete,
    handleExport,
    handleTambahTemuan: () => router.push(`/qa-analyzer/entry?agentId=${agentId}&name=${encodeURIComponent(agent.nama)}`),
    setEditingTemuan, availableYears,
    trendStartMonth, trendEndMonth, handleTrendRangeChange,
    selectedTeam, handleTeamChange, handleAgentChange, teams, agentsInTeam, loadingAgents,
    contextKey: `${selectedYear}-${selectedServiceType}`,
  };
}
