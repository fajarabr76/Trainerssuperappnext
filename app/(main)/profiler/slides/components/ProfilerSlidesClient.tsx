'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { 
  ArrowLeft, ChevronLeft, ChevronRight, ImageDown, 
  Loader2, ChevronDown, Check, Search, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Peserta, labelJabatan, labelTim,
  hitungMasaDinas, hitungUsia, formatTanggal 
} from '../../lib/profiler-types';
import { ProfilerYear, ProfilerFolder } from '../../services/profilerService';
import { getPhotoFrame, getPhotoImageStyle } from '../../lib/photo-frame';

const timTheme = (tim: string) => {
  const t = tim?.toLowerCase();
  if (t === 'telepon') return { accent: '#007AFF', light: '#EBF4FF', label: 'Tim Telepon', tailwind: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10', border: 'border-blue-200 dark:border-blue-500/20' };
  if (t === 'chat') return { accent: '#34C759', light: '#EDFAF1', label: 'Tim Chat', tailwind: 'text-green-500', bg: 'bg-green-50 dark:bg-green-500/10', border: 'border-green-200 dark:border-green-500/20' };
  if (t === 'email') return { accent: '#FF9500', light: '#FFF6E8', label: 'Tim Email', tailwind: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-500/10', border: 'border-orange-200 dark:border-orange-500/20' };
  return { accent: '#AF52DE', light: '#F5EEFF', label: labelTim[tim] || tim, tailwind: 'text-violet-500', bg: 'bg-violet-50 dark:bg-violet-500/10', border: 'border-violet-200 dark:border-violet-500/20' };
};

const Cell = ({ label, value, icon: Icon, multiline = false }: { label: string; value?: string | null; icon?: any; multiline?: boolean }) => (
  <div className="flex flex-col gap-1">
    <div className="flex items-center gap-1.5">
      {Icon && <Icon className="w-3 h-3 text-muted-foreground" />}
      <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground leading-none">
        {label}
      </span>
    </div>
    <span className={`text-xs font-semibold text-gray-900 dark:text-gray-100 leading-tight ${multiline ? 'whitespace-normal break-words' : 'truncate'}`}>
      {value || '-'}
    </span>
  </div>
);

interface ProfilerSlidesClientProps {
  initialPeserta: Peserta[];
  initialYears: ProfilerYear[];
  initialFolders: ProfilerFolder[];
  batchName: string;
  role?: string;
}

type SlideMode = 'original' | 'portraitA4';

export default function ProfilerSlidesClient({
  initialPeserta,
  initialYears,
  initialFolders,
  batchName,
  role: _role = 'trainer'
}: ProfilerSlidesClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const participantId = searchParams.get('participant');

  const [index, setIndex] = useState(0);
  const [fade, setFade] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPdf, setSavingPdf] = useState(false);
  const [showFolderDropdown, setShowFolderDropdown] = useState(false);
  const [showParticipantPicker, setShowParticipantPicker] = useState(false);
  const [slideMode, setSlideMode] = useState<SlideMode>('original');
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const slideRef = useRef<HTMLDivElement>(null);

  const activeTab: string = 'slides';

  // ── SINKRONISASI STATE & URL ───────────────────────────────────────────
  // Menangani:
  // 1. Initial load dengan/tanpa participantId
  // 2. Perpindahan batch (initialPeserta berubah)
  // 3. Update URL jika ID tidak valid
  // 4. Sinkronisasi state saat URL berubah (back/forward)
  useEffect(() => {
    // Kasus: Batch kosong
    if (initialPeserta.length === 0) {
      if (participantId) {
        const params = new URLSearchParams(searchParams.toString());
        params.delete('participant');
        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname);
      }
      setIndex(0);
      return;
    }

    // Jika ada participantId di URL, cari index-nya
    if (participantId) {
      const foundIndex = initialPeserta.findIndex(p => p.id === participantId);

      if (foundIndex !== -1) {
        setIndex(foundIndex);
      } else {
        // ID Invalid (mungkin dari batch lain atau dihapus): Fallback ke pertama & bersihkan URL
        setIndex(0);
        const params = new URLSearchParams(searchParams.toString());
        params.delete('participant');
        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname);
      }
    } else {
      // Tidak ada ID di URL (baru buka batch): Reset ke index 0
      setIndex(0);
    }
  }, [batchName, initialPeserta, participantId, pathname, router, searchParams]);
  // ───────────────────────────────────────────────────────────────────────

  const updateUrl = useCallback((id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('participant', id);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [pathname, router, searchParams]);

  const goTo = useCallback((i: number) => {
    if (i < 0 || i >= initialPeserta.length) return;
    setFade(false);
    setTimeout(() => { 
      setIndex(i); 
      setFade(true); 
      updateUrl(initialPeserta[i].id);
    }, 110);
  }, [initialPeserta, updateUrl]);

  const prev = useCallback(() => {
    if (index > 0) goTo(index - 1);
  }, [goTo, index]);

  const next = useCallback(() => {
    if (index < initialPeserta.length - 1) goTo(index + 1);
  }, [goTo, index, initialPeserta.length]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      // Don't trigger slide change if search input is focused
      if (document.activeElement?.tagName === 'INPUT') return;
      
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [next, prev]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowFolderDropdown(false);
      }
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowParticipantPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const captureElementCanvas = async (target: HTMLElement | null) => {
    if (!target) return null;
    const html2canvas = (await import('html2canvas')).default;
    const { prepareHtml2CanvasClone } = await import('@/app/lib/html2canvas-tailwind-fix');

    return await html2canvas(target, {
      scale: 3,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#FFFFFF',
      foreignObjectRendering: true,
      onclone: (_clonedDoc, clonedElement) => {
        prepareHtml2CanvasClone(_clonedDoc, clonedElement, target);
      },
    });
  };

  const captureSlideCanvas = async () => captureElementCanvas(slideRef.current);

  const saveAsImage = async () => {
    if (saving || savingPdf || !initialPeserta[index]) return;
    setSaving(true);
    try {
      const canvas = await captureSlideCanvas();
      if (!canvas) return;
      const modeSuffix = slideMode === 'portraitA4' ? 'opsi2-portrait-a4' : 'original';
      const link = document.createElement('a');
      link.download = `${batchName}_${initialPeserta[index].nama?.replace(/\s+/g, '_') || index + 1}_${modeSuffix}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err: any) {
      alert('Gagal simpan gambar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const saveAsPDF = async () => {
    if (saving || savingPdf || !initialPeserta[index]) return;
    setSavingPdf(true);
    try {
      const { jsPDF } = await import('jspdf');
      const isA4Portrait = slideMode === 'portraitA4';

      const canvas = await captureSlideCanvas();
      if (!canvas) return;

      const pdfFormat: [number, number] = [canvas.width, canvas.height];
      const pdf = new jsPDF({
        orientation: isA4Portrait ? 'p' : 'l',
        unit: 'px',
        format: pdfFormat,
        hotfixes: ['px_scaling'],
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);

      const modeSuffix = isA4Portrait ? 'opsi2-portrait-a4' : 'original';
      pdf.save(`${batchName}_${initialPeserta[index].nama?.replace(/\s+/g, '_') || index + 1}_${modeSuffix}.pdf`);
    } catch (err: any) {
      alert('Gagal simpan PDF: ' + err.message);
    } finally {
      setSavingPdf(false);
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const filteredPeserta = useMemo(() => {
    if (!searchQuery.trim()) return initialPeserta;
    const q = searchQuery.toLowerCase();
    return initialPeserta.filter(p => 
      p.nama?.toLowerCase().includes(q) ||
      p.tim?.toLowerCase().includes(q) ||
      labelTim[p.tim]?.toLowerCase().includes(q) ||
      p.jabatan?.toLowerCase().includes(q) ||
      labelJabatan[p.jabatan]?.toLowerCase().includes(q)
    );
  }, [initialPeserta, searchQuery]);

  const p = initialPeserta[index];
  const theme = p ? timTheme(p.tim) : timTheme('');
  const isA4Portrait = slideMode === 'portraitA4';

  const renderPolishedContent = (participant: Peserta) => {
    const headlineGradient = {
      background: `linear-gradient(160deg, ${theme.accent}14 0%, ${theme.accent}08 36%, transparent 100%)`,
    };

    return (
      <div className="relative flex flex-1 overflow-hidden" style={headlineGradient}>
        <div className="absolute -left-20 -top-20 h-56 w-56 rounded-full blur-3xl" style={{ background: `${theme.accent}24` }} />
        <div className="absolute -right-20 bottom-[-7rem] h-64 w-64 rounded-full bg-primary/10 blur-3xl" />

        <div className="relative z-10 flex flex-1 flex-col gap-5 p-7 overflow-y-auto box-border">
          <section className="rounded-[1.5rem] border border-white/45 bg-card/80 p-5 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-card/55">
            <div className="grid grid-cols-1 sm:grid-cols-[132px_1fr] gap-4 items-center">
              {participant.foto_url ? (
                <div className="w-[132px] h-[172px] rounded-[1.2rem] overflow-hidden shadow-xl relative ring-[5px] ring-card" style={{ boxShadow: `0 10px 24px ${theme.accent}32` }}>
                  <Image src={participant.foto_url} alt={participant.nama || ''} fill className="object-cover" style={getPhotoImageStyle(getPhotoFrame(participant.id, participant.photo_frame))} referrerPolicy="no-referrer" />
                </div>
              ) : (
                <div className="w-[132px] h-[172px] rounded-[1.2rem] flex items-center justify-center font-black text-5xl shadow-lg ring-[5px] ring-card" style={{ background: theme.light, color: theme.accent, border: `1px solid ${theme.accent}40` }}>
                  {participant.nama?.charAt(0)}
                </div>
              )}

              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: theme.accent }}>
                  Opsi 2 · Portrait A4
                </p>
                <h3 className="mt-2 text-3xl leading-tight font-black tracking-tight text-foreground">{participant.nama}</h3>
                <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  {labelJabatan[participant.jabatan] || participant.jabatan} · {theme.label}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                  <span className="rounded-full border border-border/50 bg-background/75 px-2.5 py-1">Masa dinas: {participant.bergabung_date ? hitungMasaDinas(participant.bergabung_date) : '-'}</span>
                  <span className="rounded-full border border-border/50 bg-background/75 px-2.5 py-1">Usia: {participant.tgl_lahir ? `${hitungUsia(participant.tgl_lahir)} tahun` : '-'}</span>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-white/45 bg-card/80 p-5 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-card/55">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: theme.accent }}>Identitas dan Kontak</p>
            <div className="mt-4 grid gap-4 grid-cols-1 sm:grid-cols-2">
              <Cell label="Email OJK" value={participant.email_ojk} />
              <Cell label="No. Telepon" value={participant.no_telepon} />
              <Cell label="Tanggal Bergabung" value={participant.bergabung_date ? formatTanggal(participant.bergabung_date) : null} />
              <Cell label="NIP OJK" value={participant.nip_ojk} />
              <Cell label="Kontak Darurat" value={participant.no_telepon_darurat} />
              <Cell label="Hubungan Darurat" value={participant.hubungan_kontak_darurat} />
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-module-profiler/15 bg-module-profiler/10 p-5 shadow-lg">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-module-profiler">Data Pribadi dan Latar Belakang</p>
            <div className="mt-4 grid gap-4 grid-cols-1 sm:grid-cols-2">
              <Cell label="Jenis Kelamin" value={participant.jenis_kelamin} />
              <Cell label="Status Perkawinan" value={participant.status_perkawinan} />
              <Cell label="Agama" value={participant.agama} />
              <Cell label="Tanggal Lahir" value={participant.tgl_lahir ? formatTanggal(participant.tgl_lahir) : null} />
              <Cell label="Pendidikan" value={participant.pendidikan} />
              <Cell label="Lembaga" value={participant.nama_lembaga} />
              <Cell label="Jurusan" value={participant.jurusan} />
              <Cell label="Previous Company" value={participant.previous_company} />
              <Cell label="Pengalaman CC" value={participant.pengalaman_cc} />
              <Cell label="Status Hunian" value={participant.status_tempat_tinggal} />
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-destructive/20 bg-destructive/10 p-5 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-destructive">Data Sensitif</p>
            <div className="mt-4 grid gap-4 grid-cols-1 sm:grid-cols-2">
              <Cell label="No. KTP" value={participant.no_ktp} />
              <Cell label="No. NPWP" value={participant.no_npwp} />
              <Cell label="No. Rekening" value={participant.nomor_rekening ? `${participant.nomor_rekening}${participant.nama_bank ? ` · ${participant.nama_bank}` : ''}` : null} />
              <Cell label="Alamat Tinggal" value={participant.alamat_tinggal} multiline={true} />
            </div>
          </section>

          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-1">
            <div className="rounded-[1.4rem] border border-amber-500/25 bg-amber-500/10 p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-amber-700 dark:text-amber-400">Catatan Tambahan</p>
              <p className="mt-2 text-sm leading-6 text-foreground/85">
                {participant.catatan_tambahan || 'Tidak ada catatan tambahan.'}
              </p>
            </div>
            <div className="rounded-[1.4rem] border border-border/55 bg-card/75 p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Keterangan Internal</p>
              <p className="mt-2 text-sm leading-6 text-foreground/80">
                {participant.keterangan || 'Tidak ada keterangan internal.'}
              </p>
            </div>
          </section>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* ── Tabs Navigation ── */}
      <div className="p-4 pb-0 flex justify-center">
        <div className="flex items-center gap-1 p-1 bg-muted/30 rounded-2xl w-fit border border-border/40">
          <button
            onClick={() => router.push(`/profiler/table?batch=${encodeURIComponent(batchName)}`)}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              activeTab === 'table'
                ? 'bg-background text-primary shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Daftar Peserta
          </button>
          <button
            onClick={() => {}}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              activeTab === 'slides'
                ? 'bg-background text-primary shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Tampilan Slide
          </button>
        </div>
      </div>

      {/* Top Bar */}
      <div className="flex items-center justify-between px-5 py-3 bg-background/80 backdrop-blur-xl border-b border-border/40 shadow-sm sticky top-0 z-[60]">
        <button
          onClick={() => router.push('/profiler')}
          className="flex items-center gap-1.5 text-sm font-bold tracking-tight text-primary hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg px-2 py-1 -ml-2"
        >
          <ArrowLeft size={15} /> Kembali
        </button>

        <div className="flex items-center gap-2">
          {/* Batch Selector */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowFolderDropdown(!showFolderDropdown)}
              className="flex items-center gap-2 h-10 px-4 bg-muted/50 hover:bg-muted border border-border/40 rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="text-xs font-black tracking-tight text-foreground truncate max-w-[120px]">{batchName}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-primary transition-transform duration-300 ${showFolderDropdown ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {showFolderDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute top-full left-0 mt-2 w-[calc(100vw-2.5rem)] md:w-64 bg-card border border-border/40 rounded-3xl shadow-2xl z-[100] overflow-hidden"
                >
                  <div className="max-h-80 overflow-y-auto p-3 space-y-4 custom-scrollbar">
                    {initialYears.map(year => {
                      const yearFolders = initialFolders.filter(f => f.year_id === year.id);
                      if (yearFolders.length === 0) return null;
                      return (
                        <div key={year.id} className="space-y-1">
                          <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] px-3 py-1">{year.label}</p>
                          <div className="space-y-0.5">
                            {yearFolders.map(folder => (
                              <button
                                key={folder.id}
                                onClick={() => {
                                  router.push(`/profiler/slides?batch=${encodeURIComponent(folder.name)}`);
                                  setShowFolderDropdown(false);
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                  folder.name === batchName
                                    ? 'bg-primary text-primary-foreground font-bold'
                                    : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                <span className="truncate">{folder.name}</span>
                                {folder.name === batchName && <Check className="w-3 h-3" />}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Participant Picker (Combobox) */}
          <div className="relative" ref={pickerRef}>
            <button
              onClick={() => {
                setShowParticipantPicker(!showParticipantPicker);
                if (!showParticipantPicker) {
                  setSearchQuery('');
                  setTimeout(() => searchInputRef.current?.focus(), 100);
                }
              }}
              disabled={initialPeserta.length === 0}
              className="flex flex-col items-center justify-center h-10 px-4 bg-muted/50 hover:bg-muted border border-border/40 rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-w-[180px] disabled:opacity-50"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-foreground truncate max-w-[150px]">
                  {initialPeserta.length > 0 ? (p?.nama || 'Pilih Peserta') : 'Belum ada peserta'}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-primary transition-transform duration-300 ${showParticipantPicker ? 'rotate-180' : ''}`} />
              </div>
              {initialPeserta.length > 0 && (
                <p className="text-[9px] text-muted-foreground font-black uppercase tracking-tighter">
                  {index + 1} / {initialPeserta.length}
                </p>
              )}
            </button>

            <AnimatePresence>
              {showParticipantPicker && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[calc(100vw-2.5rem)] md:w-80 bg-card border border-border/40 rounded-3xl shadow-2xl z-[100] overflow-hidden flex flex-col"
                >
                  <div className="p-3 border-b border-border/40 relative">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                    <input 
                      ref={searchInputRef}
                      type="text"
                      placeholder="Cari nama, tim, jabatan..."
                      className="w-full bg-muted/50 border border-border/40 rounded-xl py-2 pl-9 pr-4 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                      <button 
                        onClick={() => setSearchQuery('')}
                        className="absolute right-6 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto p-2 custom-scrollbar">
                    {filteredPeserta.length === 0 ? (
                      <div className="py-8 text-center text-muted-foreground">
                        <p className="text-xs font-medium">Tidak ada peserta ditemukan</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {filteredPeserta.map((peserta) => {
                          const isActive = peserta.id === p?.id;
                          return (
                            <button
                              key={peserta.id}
                              onClick={() => {
                                const newIndex = initialPeserta.findIndex(item => item.id === peserta.id);
                                if (newIndex !== -1) goTo(newIndex);
                                setShowParticipantPicker(false);
                              }}
                              className={`w-full flex items-center gap-3 p-2 rounded-2xl text-left transition-all hover:bg-muted group ${
                                isActive ? 'bg-primary/5 ring-1 ring-primary/20' : ''
                              }`}
                            >
                              <div className="w-10 h-10 rounded-full bg-muted flex-shrink-0 overflow-hidden relative border border-border/40">
                                {peserta.foto_url ? (
                                  <Image src={peserta.foto_url} alt={peserta.nama || ''} fill className="object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-bold text-sm">
                                    {peserta.nama?.charAt(0)}
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-xs font-bold truncate ${isActive ? 'text-primary' : 'text-foreground'}`}>
                                  {peserta.nama}
                                </p>
                                <p className="text-[10px] text-muted-foreground truncate uppercase tracking-tighter">
                                  {peserta.tim} • {labelJabatan[peserta.jabatan] || peserta.jabatan}
                                </p>
                              </div>
                              {isActive && <Check className="w-4 h-4 text-primary shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Slide Mode Toggle */}
          <div className="flex items-center bg-muted/30 rounded-xl p-1 border border-border/40">
            <button
              onClick={() => {
                setSlideMode('original');
              }}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${slideMode === 'original' ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              title="Versi Original"
            >
              Original
            </button>
            <button
              onClick={() => {
                setSlideMode('portraitA4');
              }}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${slideMode === 'portraitA4' ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              title="Opsi 2 (Portrait A4)"
            >
              Opsi 2
            </button>
          </div>

          <button
            onClick={saveAsImage}
            disabled={saving || savingPdf || !p}
            className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-bold text-primary-foreground bg-primary hover:opacity-90 border border-primary/10 rounded-xl px-4 py-2 transition-all disabled:opacity-40 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {saving
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <ImageDown size={13} />
            }
            {saving ? 'Menyimpan...' : 'Simpan Gambar'}
          </button>

          <button
            onClick={saveAsPDF}
            disabled={savingPdf || saving || !p}
            className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-bold text-destructive-foreground bg-destructive hover:opacity-90 border border-destructive/10 rounded-xl px-4 py-2 transition-all disabled:opacity-40 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {savingPdf
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <ImageDown size={13} />
            }
            {savingPdf ? 'Menyimpan...' : 'Simpan PDF'}
          </button>
        </div>
      </div>

      {/* Slide Stage */}
      <div className={`flex-1 flex flex-col items-center p-4 min-h-0 ${isA4Portrait ? 'justify-start overflow-auto' : 'justify-center overflow-hidden'}`}>
        {!p ? (
          <p className="text-sm text-muted-foreground font-medium tracking-tight">Belum ada peserta.</p>
        ) : (
          <div className={`relative flex justify-center w-full ${isA4Portrait ? 'items-start min-h-full' : 'items-center h-full'}`}>
            <div
              className={`relative transition-all duration-300 ${isA4Portrait ? 'w-full max-w-[820px] aspect-[210/297]' : 'aspect-video w-full max-w-[1000px] max-h-full'}`}
              style={{ opacity: fade ? 1 : 0, transform: fade ? 'translateY(0)' : 'translateY(4px)' }}
            >
              <div
                ref={slideRef}
                className={`w-full h-full bg-card rounded-[2rem] shadow-2xl dark:shadow-black/60 border border-border/40 flex flex-col ${isA4Portrait ? 'overflow-y-auto' : 'overflow-hidden'}`}
              >
                  <div className="h-[6px] w-full flex-shrink-0" style={{ background: theme.accent }} />

                  {slideMode === 'original' ? (
                    <div className="flex flex-1 min-h-0 overflow-hidden">
                      {/* LEFT SIDEBAR 30% */}
                      <div className="w-[30%] flex-shrink-0 bg-muted/20 border-r border-border/40 flex flex-col items-center px-6 py-8 gap-6 overflow-y-auto box-border pb-12">
                        {p.foto_url ? (
                          <div className="w-32 h-32 rounded-[2rem] overflow-hidden flex-shrink-0 shadow-lg relative ring-[6px] ring-card" style={{ boxShadow: `0 8px 24px ${theme.accent}30` }}>
                            <Image src={p.foto_url} alt={p.nama || ''} fill className="object-cover" style={getPhotoImageStyle(getPhotoFrame(p.id, p.photo_frame))} referrerPolicy="no-referrer" />
                          </div>
                        ) : (
                          <div className="w-32 h-32 rounded-[2rem] flex-shrink-0 flex items-center justify-center font-bold text-4xl shadow-md ring-[6px] ring-card" style={{ background: theme.light, color: theme.accent, border: `1px solid ${theme.accent}40` }}>
                            {p.nama?.charAt(0)}
                          </div>
                        )}

                        <div className="text-center w-full flex-shrink-0">
                          <h2 className="text-2xl font-black tracking-tight text-foreground leading-tight truncate">{p.nama}</h2>
                          <p className="text-[10px] font-bold mt-1 uppercase tracking-widest opacity-80" style={{ color: theme.accent }}>
                            {labelJabatan[p.jabatan] || p.jabatan}
                          </p>
                          <div className="inline-flex items-center gap-2 mt-3 font-bold rounded-full px-3 py-1 bg-card border border-border/40 shadow-sm" style={{ fontSize: '9px', color: theme.accent }}>
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: theme.accent }} />
                            {theme.label}
                          </div>
                        </div>

                        <div className="w-full flex-shrink-0 bg-card border border-border/40 rounded-3xl text-center p-4 shadow-sm">
                          <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-[0.15em] mb-1">Masa Dinas</p>
                          <p className="text-[22px] font-black tracking-tight text-foreground leading-none">
                            {p.bergabung_date ? hitungMasaDinas(p.bergabung_date) : '-'}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-1.5 font-medium tracking-tight">
                            {p.bergabung_date ? `Sejak ${formatTanggal(p.bergabung_date)}` : '-'}
                          </p>
                        </div>

                        <div className="w-full flex flex-col gap-2 flex-shrink-0 mt-auto">
                          {[
                            ['NIP OJK', p.nip_ojk],
                            ['Kelamin', p.jenis_kelamin],
                            ['Agama', p.agama],
                            ['Usia', p.tgl_lahir ? `${hitungUsia(p.tgl_lahir)} Tahun` : null],
                            ['Tgl Lahir', p.tgl_lahir ? formatTanggal(p.tgl_lahir) : null],
                            ['Status', p.status_perkawinan],
                          ].filter(([, v]) => v).map(([label, value]) => (
                            <div key={label as string} className="flex items-center justify-between gap-2 px-1">
                              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground flex-shrink-0">{label}</span>
                              <span className="text-[10px] font-bold tracking-tight text-foreground/80 text-right truncate">{value as string}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* RIGHT CONTENT 70% */}
                      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto px-10 py-8 gap-6 box-border pb-12">
                        <div className="flex flex-col gap-3 flex-shrink-0">
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Data Pekerjaan</span>
                            <div className="flex-1 h-px bg-border/40" />
                          </div>
                          <div className="grid grid-cols-3 gap-x-8 gap-y-4">
                            <Cell label="Email OJK" value={p.email_ojk} />
                            <Cell label="No. Telepon" value={p.no_telepon} />
                            <Cell label="Bergabung" value={p.bergabung_date ? formatTanggal(p.bergabung_date) : null} />
                            <Cell label="Telepon Darurat" value={p.no_telepon_darurat} />
                            <Cell label="Nama Kontak Darurat" value={p.nama_kontak_darurat} />
                            <Cell label="Hubungan" value={p.hubungan_kontak_darurat} />
                          </div>
                        </div>

                        <div className="flex flex-col gap-3 flex-shrink-0">
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Latar Belakang</span>
                            <div className="flex-1 h-px bg-border/40" />
                          </div>
                          <div className="grid grid-cols-3 gap-x-8 gap-y-4">
                            <Cell label="Pendidikan" value={p.pendidikan} />
                            <Cell label="Lembaga" value={p.nama_lembaga} />
                            <Cell label="Jurusan" value={p.jurusan} />
                            <Cell label="Prev. Company" value={p.previous_company} />
                            <Cell label="Pengalaman CC" value={p.pengalaman_cc} />
                          </div>
                        </div>

                        <div className="flex flex-col gap-3 flex-shrink-0">
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-destructive">🔒 Data Sensitif</span>
                            <div className="flex-1 h-px bg-destructive/20" />
                          </div>
                          <div className="grid grid-cols-3 gap-x-8 gap-y-4">
                            <Cell label="No. KTP" value={p.no_ktp} />
                            <Cell label="No. NPWP" value={p.no_npwp} />
                            <Cell label="No. Rekening" value={p.nomor_rekening ? `${p.nomor_rekening}${p.nama_bank ? ` · ${p.nama_bank}` : ''}` : null} />
                            <Cell label="Status Hunian" value={p.status_tempat_tinggal} />
                            <div className="col-span-2">
                              <Cell label="Alamat Tinggal" value={p.alamat_tinggal} multiline={true} />
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-4 mt-auto flex-shrink-0">
                          {p.catatan_tambahan && (
                            <div className="flex-1 bg-amber-500/10 border border-amber-500/20 rounded-3xl p-4 shadow-sm">
                              <p className="text-[9px] font-black text-amber-600 dark:text-amber-500 uppercase tracking-[0.2em] mb-1.5">⭐ Catatan</p>
                              <p className="text-[11px] text-amber-900 dark:text-amber-200/80 leading-relaxed line-clamp-2 font-medium">{p.catatan_tambahan}</p>
                            </div>
                          )}
                          {p.keterangan && (
                            <div className="flex-1 bg-muted/30 border border-border/40 rounded-3xl p-4 shadow-sm">
                              <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-1.5">Keterangan</p>
                              <p className="text-[11px] text-foreground/70 leading-relaxed line-clamp-2 font-medium tracking-tight">{p.keterangan}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : renderPolishedContent(p)}

                  <div className="h-6 flex-shrink-0" />
                </div>
              </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-center gap-4 py-4 border-t border-border/40 bg-background/60 backdrop-blur-xl shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
        <button
          onClick={prev}
          disabled={index === 0}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-card border border-border/40 text-primary disabled:opacity-25 hover:bg-muted transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="flex items-center gap-2 px-4 py-1.5 bg-muted/30 rounded-full border border-border/40">
          <span className="text-sm font-bold text-foreground tabular-nums tracking-tight">{index + 1}</span>
          <span className="text-xs text-muted-foreground font-bold">/</span>
          <span className="text-xs font-bold text-muted-foreground tabular-nums tracking-tight">{initialPeserta.length}</span>
        </div>
        <button
          onClick={next}
          disabled={index === initialPeserta.length - 1}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-card border border-border/40 text-primary disabled:opacity-25 hover:bg-muted transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight size={20} />
        </button>
      </div>

    </div>
  );
}
