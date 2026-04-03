'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Agent, 
  AgentDetailData, 
  QATemuan, 
  PeriodSelection, 
  EditFormState, 
  GroupedTemuan,
  CoachingInsight,
  ScoreResult,
  calculateQAScoreFromTemuan,
  ServiceType
} from '../../../lib/qa-types';
import { User } from '@supabase/supabase-js';
import { 
  getAgentTemuanAction, 
  getPersonalTrendAction, 
  updateTemuanAction, 
  deleteTemuanAction,
  getAgentExportDataAction
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
  user, 
  role, 
  initialAgent, 
  initialData 
}: UseAgentDetailProps) {
  const router = useRouter();
  
  // --- States ---
  const [loadingTemuan, setLoadingTemuan] = useState(false);
  const [loadingTrend, setLoadingTrend] = useState(false);
  const [exporting, setExporting] = useState(false);
  
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodSelection | null>(null);
  const [timeframe, setTimeframe] = useState<'3m' | '6m' | 'all'>('3m');
  const [activeSection, setActiveSection] = useState<'summary' | 'trend' | 'temuan'>('summary');
  const [trendMounted, setTrendMounted] = useState(false);
  const [temuanMounted, setTemuanMounted] = useState(false);
  const [activeTrendFilter, setActiveTrendFilter] = useState('all');
  const manualScrollRef = useRef<number>(0);
  
  const [agent] = useState<Agent>(initialAgent);
  const [data, setData] = useState<AgentDetailData>(initialData);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(initialData.temuan.length === 50); 
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Edit State
  const [editingTemuan, setEditingTemuan] = useState<QATemuan | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>({ nilai: 0, ketidaksesuaian: '', sebaiknya: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // --- Computed Values ---
  const indicatorsMetadata = data.indicators;
  const temuan = data.temuan;
  const personalTrend = data.personalTrend;

  // Calculate score for each period found in temuan
  const scoreHistory = useMemo((): ScoreResult[] => {
    const periods: Record<string, { month: number; year: number; serviceType: string; items: QATemuan[] }> = {};
    
    temuan.forEach(t => {
      // Use qa_periods instead of created_at for accurate scoring periods
      const month = t.qa_periods?.month;
      const year = t.qa_periods?.year;
      
      if (!month || !year) return; // Skip temuan without period metadata
      
      const serviceType = t.service_type || 'Unknown';
      const key = `${month}-${year}-${serviceType}`;
      
      if (!periods[key]) {
        periods[key] = { month, year, serviceType, items: [] };
      }
      periods[key].items.push(t);
    });
    
    return Object.values(periods).map(p => {
      // Logic from qa-types used directly via static import
      // Bug Fix: Filter indicators by correct service_type for each period to match SQL RPC logic
      const filteredIndicators = indicatorsMetadata.filter(i => i.service_type === p.serviceType);
      const score = calculateQAScoreFromTemuan(filteredIndicators, p.items);
      
      return {
        month: p.month,
        year: p.year,
        service_type: p.serviceType as ServiceType,
        finalScore: score.finalScore,
        nonCriticalScore: score.nonCriticalScore,
        criticalScore: score.criticalScore,
        sessionCount: score.sessionCount
      };
    });
  }, [temuan, indicatorsMetadata]);

  const sortedPeriods = useMemo(() => {
    return [...scoreHistory]
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
      })
      .map(ind => ({
        month: ind.month,
        year: ind.year,
        label: `${['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][ind.month - 1]} ${ind.year}`,
        serviceType: ind.service_type || 'Unknown'
      }));
  }, [scoreHistory]);

  const selectedScore = useMemo((): ScoreResult | null => {
    if (!selectedPeriod) return null;
    return scoreHistory.find(i => i.month === selectedPeriod.month && i.year === selectedPeriod.year && i.service_type === selectedPeriod.serviceType) || null;
  }, [scoreHistory, selectedPeriod]);

  const prevPeriod = useMemo(() => {
    if (!selectedPeriod) return null;
    const idx = sortedPeriods.findIndex(p => p.month === selectedPeriod.month && p.year === selectedPeriod.year && p.serviceType === selectedPeriod.serviceType);
    return idx < sortedPeriods.length - 1 ? sortedPeriods[idx + 1] : null;
  }, [sortedPeriods, selectedPeriod]);

  const prevScore = useMemo((): ScoreResult | null => {
    if (!prevPeriod) return null;
    return scoreHistory.find(i => i.month === prevPeriod.month && i.year === prevPeriod.year && i.service_type === prevPeriod.serviceType) || null;
  }, [scoreHistory, prevPeriod]);

  const trendDir = useMemo((): 'up' | 'down' | 'same' | 'none' => {
    if (!selectedScore || !prevScore) return 'none';
    if (selectedScore.finalScore > prevScore.finalScore) return 'up';
    if (selectedScore.finalScore < prevScore.finalScore) return 'down';
    return 'same';
  }, [selectedScore, prevScore]);

  const selectedTemuan = useMemo(() => {
    if (!selectedPeriod) return temuan;
    return temuan.filter(t => 
      t.qa_periods?.month === selectedPeriod.month && 
      t.qa_periods?.year === selectedPeriod.year &&
      t.service_type === selectedPeriod.serviceType
    );
  }, [temuan, selectedPeriod]);

  const automatedCoaching = useMemo((): CoachingInsight | null => {
    if (!selectedTemuan.length) return null;
    const criticals = selectedTemuan.filter(t => t.nilai === 0);
    const target = criticals.length > 0 ? criticals : selectedTemuan.filter(t => t.nilai === 1);
    
    if (!target.length) return null;

    const counts: Record<string, number> = {};
    target.forEach(t => {
      const name = t.qa_indicators?.name || 'Unknown';
      counts[name] = (counts[name] || 0) + 1;
    });

    const topParam = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    const example = target.find(t => t.qa_indicators?.name === topParam[0]);

    return {
      parameter: topParam[0],
      count: topParam[1],
      recommendation: example?.sebaiknya || 'Tingkatkan kualitas pada parameter ini.',
      isCritical: criticals.length > 0
    };
  }, [selectedTemuan]);

  const groupedTemuan = useMemo((): GroupedTemuan[] => {
    const groups: Record<string, QATemuan[]> = {};
    selectedTemuan.forEach(t => {
      const key = t.no_tiket || `No Ticket-${t.id}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });

    return Object.entries(groups).map(([no_tiket, items], idx) => ({
      urutan: idx + 1,
      no_tiket: no_tiket.startsWith('No Ticket-') ? null : no_tiket,
      items
    }));
  }, [selectedTemuan]);

  // --- Effects ---
  useEffect(() => {
    if (sortedPeriods.length > 0 && !selectedPeriod) {
      setSelectedPeriod(sortedPeriods[0]);
    }
  }, [sortedPeriods, selectedPeriod]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // Skip observer updates if a manual scroll was triggered recently
        if (Date.now() - manualScrollRef.current < 800) return;

        entries.forEach(entry => {
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
        rootMargin: '-100px 0px -200px 0px' 
      }
    );

    const sections = ['section-summary', 'section-trend', 'section-temuan'];
    sections.forEach(id => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  // --- Handlers ---
  const scrollToSection = useCallback((sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el && scrollContainerRef.current) {
      // Mark as manual scroll to prevent observer from overriding state during smooth scroll
      manualScrollRef.current = Date.now();

      // Manually set active section for immediate feedback
      const key = sectionId.replace('section-', '');
      if (key === 'summary' || key === 'trend' || key === 'temuan') {
        setActiveSection(key);
      }
      
      const top = el.offsetTop - 140; // Adjusted offset for new sticky bar height
      scrollContainerRef.current.scrollTo({ top, behavior: 'smooth' });
    }
  }, []);

  const handleYearChange = async (year: number) => {
    if (year === selectedYear) return;
    setLoadingTemuan(true);
    try {
      const res = await getAgentTemuanAction(agentId, year, 0); // Start from page 0
      setData(prev => ({ ...prev, temuan: res.temuan, indicators: prev.indicators })); // Adjust based on API
      setSelectedYear(year);
      setCurrentPage(0);
      setHasMore(res.temuan.length === 50);
      setSelectedPeriod(null); 
    } catch (err) {
      console.error('Gagal mengambil data tahun ' + year, err);
    } finally {
      setLoadingTemuan(false);
    }
  };

  const handlePageChange = async (page: number) => {
    if (page <= currentPage || page < 0) return;

    // Check if we've already fetched this page forward
    const alreadyFetchedCount = data.temuan.length;
    const targetCount = (page + 1) * 50;
    
    if (alreadyFetchedCount >= targetCount) {
      setCurrentPage(page);
      return;
    }

    setLoadingTemuan(true);
    try {
      const res = await getAgentTemuanAction(agentId, selectedYear, page);
      // Only append new findings to avoid duplication while keeping previous data for scoreHistory accuracy
      setData(prev => ({ 
        ...prev, 
        temuan: [...prev.temuan, ...res.temuan] 
      }));
      setCurrentPage(page);
      setHasMore(res.temuan.length === 50);
    } catch (err) {
      console.error('Gagal mengambil halaman ' + page, err);
    } finally {
      setLoadingTemuan(false);
    }
  };

  const handleTimeframeChange = useCallback(async (tf: '3m' | '6m' | 'all') => {
    setLoadingTrend(true);
    try {
      const targetService = selectedPeriod?.serviceType || (temuan[0]?.service_type) || 'call';
      const res = await getPersonalTrendAction(agentId, tf, targetService);
      setData(prev => ({ ...prev, personalTrend: res }));
      setTimeframe(tf);
    } catch (err) {
      console.error('Gagal memuat tren', err);
    } finally {
      setLoadingTrend(false);
    }
  }, [agentId, selectedPeriod?.serviceType, temuan]);

  // Refetch trend when service type changes via period selection
  useEffect(() => {
    if (selectedPeriod?.serviceType) {
      handleTimeframeChange(timeframe);
    }
  }, [selectedPeriod?.serviceType, timeframe, handleTimeframeChange]);

  const startEdit = (t: QATemuan) => {
    setEditingTemuan(t);
    setEditForm({
      nilai: t.nilai,
      ketidaksesuaian: t.ketidaksesuaian || '',
      sebaiknya: t.sebaiknya || ''
    });
  };

  const handleEditSave = async () => {
    if (!editingTemuan) return;
    setIsSubmitting(true);
    try {
      const updated = await updateTemuanAction(editingTemuan.id, editForm);
      setData(prev => ({
        ...prev,
        temuan: prev.temuan.map(t => t.id === editingTemuan.id ? updated : t)
      }));
      setEditingTemuan(null);
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
      setData(prev => ({
        ...prev,
        temuan: prev.temuan.filter(t => t.id !== id)
      }));
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
        ['Tanggal Export', new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})],
        [''], ['RINGKASAN SKOR PER PERIODE'],
        ['Periode', 'Layanan', 'Skor Akhir', 'Non-Critical', 'Critical'],
      ];
      exportData.periods.forEach(p => {
        const monthLabel = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'][p.month-1];
        summaryRows.push([
          `${monthLabel} ${p.year}`, 
          p.service_type.toUpperCase(),
          p.score.toFixed(2), 
          p.ncScore.toFixed(2), 
          p.crScore.toFixed(2)
        ]);
      });
      const ws1 = XLSX.utils.aoa_to_sheet(summaryRows);
      ws1['!cols'] = [{wch:24},{wch:12},{wch:14},{wch:14},{wch:14}];
      XLSX.utils.book_append_sheet(wb, ws1, 'Ringkasan');

      exportData.periods.forEach(p => {
        const monthShort = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][p.month-1];
        const svcLabel = p.service_type === 'call' ? 'Call' : p.service_type === 'email' ? 'Email' : p.service_type.charAt(0).toUpperCase() + p.service_type.slice(1);
        const sheetName = `${monthShort} ${p.year} (${svcLabel})`.slice(0,31);
        
        const rows: (string | number | undefined)[][] = [
          [`${['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'][p.month-1]} ${p.year} - ${svcLabel}`], [''],
          [`Skor Akhir: ${p.score.toFixed(2)}`], [`Non-Critical: ${p.ncScore.toFixed(2)}`], [`Critical: ${p.crScore.toFixed(2)}`],
          [''], ['No. Tiket', 'Kategori', 'Parameter', 'Nilai', 'Keterangan', 'Ketidaksesuaian', 'Sebaiknya'],
        ];
        p.temuan.forEach(t => {
          rows.push([
            t.no_tiket ?? '-',
            t.qa_indicators?.category === 'critical' ? 'Critical' : 'Non-Critical',
            t.qa_indicators?.name ?? '-',
            t.nilai,
            { 0: 'CRITICAL', 1: 'DEFICIT', 2: 'GOOD', 3: 'EXCELLENT' }[t.nilai] || '-',
            t.ketidaksesuaian ?? '-',
            t.sebaiknya ?? '-',
          ]);
        });
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [{wch:14},{wch:14},{wch:32},{wch:8},{wch:14},{wch:30},{wch:30}];
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      });

      XLSX.writeFile(wb, `QA_${exportData.agent.nama.replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.xlsx`);
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
    // State
    loadingTemuan,
    loadingTrend,
    exporting,
    selectedPeriod,
    setSelectedPeriod,
    timeframe,
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
    
    // Computed
    indicators: indicatorsMetadata,
    temuan,
    personalTrend,
    sortedPeriods,
    selectedScore,
    prevScore,
    trendDir,
    automatedCoaching,
    groupedTemuan,
    
    // Actions
    scrollToSection,
    startEdit,
    handleEditSave,
    handleDelete,
    handleYearChange,
    handlePageChange,
    handleTimeframeChange,
    handleExport,
    handleTambahTemuan,
    setEditingTemuan,
    availableYears: initialData.availableYears || [new Date().getFullYear()]
  };
}
