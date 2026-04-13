'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronLeft, ChevronRight, ImageDown, Loader2, ChevronDown, Check, Monitor, Smartphone } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Peserta, Jabatan, labelJabatan, labelTim,
  hitungMasaDinas, hitungUsia, formatTanggal 
} from '../../lib/profiler-types';
import { ProfilerYear, ProfilerFolder } from '../../services/profilerService';

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

export default function ProfilerSlidesClient({
  initialPeserta,
  initialYears,
  initialFolders,
  batchName,
  role = 'trainer'
}: ProfilerSlidesClientProps) {
  const isReadOnly = role === 'leader';
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [fade, setFade] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPdf, setSavingPdf] = useState(false);
  const [showFolderDropdown, setShowFolderDropdown] = useState(false);
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const slideRef = useRef<HTMLDivElement>(null);

  const activeTab: string = 'slides';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowFolderDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const goTo = useCallback((i: number) => {
    setFade(false);
    setTimeout(() => { setIndex(i); setFade(true); }, 110);
  }, []);

  const prev = useCallback(() => index > 0 && goTo(index - 1), [index, goTo]);
  const next = useCallback(() => index < initialPeserta.length - 1 && goTo(index + 1), [index, initialPeserta.length, goTo]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [next, prev]);

  const captureSlideCanvas = async () => {
    if (!slideRef.current) return null;
    const html2canvas = (await import('html2canvas')).default;
    const { prepareHtml2CanvasClone } = await import('@/app/lib/html2canvas-tailwind-fix');
    const el = slideRef.current;

    return await html2canvas(el, {
      scale: 3,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#FFFFFF',
      foreignObjectRendering: true,
      onclone: (_clonedDoc, clonedElement) => {
        prepareHtml2CanvasClone(_clonedDoc, clonedElement, el);
      },
    });
  };

  const saveAsImage = async () => {
    if (saving || savingPdf || !initialPeserta[index]) return;
    setSaving(true);
    try {
      const canvas = await captureSlideCanvas();
      if (!canvas) return;
      const link = document.createElement('a');
      link.download = `${batchName}_${initialPeserta[index].nama?.replace(/\s+/g, '_') || index + 1}.png`;
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
      const canvas = await captureSlideCanvas();
      if (!canvas) return;
      const { jsPDF } = await import('jspdf');
      
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      
      const pdfOrientation = orientation === 'landscape' ? 'l' : 'p';
      const pdfFormat = orientation === 'landscape' ? [1920, 1080] : 'a4';
      
      const pdf = new jsPDF({
        orientation: pdfOrientation,
        unit: 'px',
        format: pdfFormat,
        hotfixes: ['px_scaling'],
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${batchName}_${initialPeserta[index].nama?.replace(/\s+/g, '_') || index + 1}.pdf`);
    } catch (err: any) {
      alert('Gagal simpan PDF: ' + err.message);
    } finally {
      setSavingPdf(false);
    }
  };

  const p = initialPeserta[index];
  const theme = p ? timTheme(p.tim) : timTheme('');

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
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowFolderDropdown(!showFolderDropdown)}
            className="group flex flex-col items-center hover:bg-muted px-3 py-1 -my-1 rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-black tracking-tight text-foreground">{batchName}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-primary transition-transform duration-300 ${showFolderDropdown ? 'rotate-180' : ''}`} />
            </div>
            <p className="text-[10px] text-muted-foreground font-bold">{index + 1} / {initialPeserta.length}</p>
          </button>

          <AnimatePresence>
            {showFolderDropdown && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 bg-card border border-border/40 rounded-3xl shadow-2xl z-[100] overflow-hidden"
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
                                setIndex(0);
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
        <div className="flex items-center gap-3">
          {/* Orientation Toggle */}
          <div className="flex items-center bg-muted/30 rounded-xl p-1 border border-border/40">
            <button
              onClick={() => setOrientation('landscape')}
              className={`p-1.5 rounded-lg flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${orientation === 'landscape' ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              title="Landscape (16:9)"
            >
              <Monitor size={14} />
            </button>
            <button
              onClick={() => setOrientation('portrait')}
              className={`p-1.5 rounded-lg flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${orientation === 'portrait' ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              title="Portrait (A4)"
            >
              <Smartphone size={14} />
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
      <div className="flex-1 flex flex-col items-center justify-center p-4 min-h-0 overflow-hidden">
        {!p ? (
          <p className="text-sm text-muted-foreground font-medium tracking-tight">Belum ada peserta.</p>
        ) : (
          <div className="relative flex items-center justify-center w-full h-full">
            <div
              className={`relative transition-all duration-300 ${
                orientation === 'landscape' 
                  ? 'aspect-video w-full max-w-[1000px] max-h-full' 
                  : 'aspect-[1/1.414] h-full max-h-[840px] max-w-full'
              }`}
              style={{ opacity: fade ? 1 : 0, transform: fade ? 'translateY(0)' : 'translateY(4px)' }}
            >
              <div
                ref={slideRef}
                className="w-full h-full bg-card rounded-[2rem] overflow-hidden shadow-2xl dark:shadow-black/60 border border-border/40 flex flex-col"
              >
                  <div className="h-[6px] w-full flex-shrink-0" style={{ background: theme.accent }} />

                  {orientation === 'landscape' ? (
                    <div className="flex flex-1 min-h-0 overflow-hidden">
                      {/* LEFT SIDEBAR 30% */}
                      <div className="w-[30%] flex-shrink-0 bg-muted/20 border-r border-border/40 flex flex-col items-center px-6 py-8 gap-6 overflow-y-auto box-border pb-12">
                        {p.foto_url ? (
                          <div className="w-32 h-32 rounded-[2rem] overflow-hidden flex-shrink-0 shadow-lg relative ring-[6px] ring-card" style={{ boxShadow: `0 8px 24px ${theme.accent}30` }}>
                            <Image src={p.foto_url} alt={p.nama || ''} fill className="object-cover" referrerPolicy="no-referrer" />
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
                  ) : (
                    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto px-6 md:px-8 py-6 gap-5 box-border pb-12">
                      <div className="flex items-center gap-6 flex-shrink-0">
                        {p.foto_url ? (
                          <div className="w-24 h-24 rounded-[1.75rem] overflow-hidden flex-shrink-0 shadow-lg relative ring-[5px] ring-card" style={{ boxShadow: `0 6px 15px ${theme.accent}30` }}>
                            <Image src={p.foto_url} alt={p.nama || ''} fill className="object-cover" referrerPolicy="no-referrer" />
                          </div>
                        ) : (
                          <div className="w-24 h-24 rounded-[1.75rem] flex-shrink-0 flex items-center justify-center font-bold text-3xl shadow-md ring-[5px] ring-card" style={{ background: theme.light, color: theme.accent, border: `1px solid ${theme.accent}40` }}>
                            {p.nama?.charAt(0)}
                          </div>
                        )}
                        <div className="flex flex-col">
                          <h2 className="text-2xl font-black tracking-tight text-foreground leading-tight truncate">{p.nama}</h2>
                          <p className="text-[10px] font-bold mt-1 uppercase tracking-widest opacity-80" style={{ color: theme.accent }}>{labelJabatan[p.jabatan] || p.jabatan}</p>
                          <div className="inline-flex items-center gap-2 mt-2 font-bold rounded-full px-2.5 py-1 bg-card border border-border/40 shadow-sm w-fit" style={{ fontSize: '9px', color: theme.accent }}>
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: theme.accent }} />
                            {theme.label}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 flex-shrink-0">
                        <div className="bg-muted/30 border border-border/40 rounded-[20px] p-3 text-center shadow-sm">
                          <p className="text-[8px] text-muted-foreground font-bold uppercase tracking-widest mb-1">Masa Dinas</p>
                          <p className="text-lg font-black text-foreground tracking-tight leading-none">{p.bergabung_date ? hitungMasaDinas(p.bergabung_date) : '-'}</p>
                        </div>
                        <div className="bg-muted/30 border border-border/40 rounded-[20px] p-3 text-center shadow-sm">
                          <p className="text-[8px] text-muted-foreground font-bold uppercase tracking-widest mb-1">Usia</p>
                          <p className="text-lg font-black text-foreground tracking-tight leading-none">{p.tgl_lahir ? `${hitungUsia(p.tgl_lahir)} Thn` : '-'}</p>
                        </div>
                        <div className="bg-muted/30 border border-border/40 rounded-[20px] p-3 text-center shadow-sm">
                          <p className="text-[8px] text-muted-foreground font-bold uppercase tracking-widest mb-1">Tgl Lahir</p>
                          <p className="text-[10px] font-black text-foreground tracking-tight leading-none mt-1">{p.tgl_lahir ? formatTanggal(p.tgl_lahir) : '-'}</p>
                        </div>
                        <div className="bg-muted/30 border border-border/40 rounded-[20px] p-3 text-center shadow-sm">
                          <p className="text-[8px] text-muted-foreground font-bold uppercase tracking-widest mb-1">Agama</p>
                          <p className="text-xs font-black text-foreground tracking-tight leading-none mt-1">{p.agama || '-'}</p>
                        </div>
                        <div className="bg-muted/30 border border-border/40 rounded-[20px] p-3 text-center shadow-sm">
                          <p className="text-[8px] text-muted-foreground font-bold uppercase tracking-widest mb-1">Status</p>
                          <p className="text-xs font-black text-foreground tracking-tight leading-none mt-1 truncate">{p.status_perkawinan || '-'}</p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-4 flex-1">
                        <div className="flex flex-col gap-3 flex-shrink-0">
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Data Pekerjaan</span>
                            <div className="flex-1 h-px bg-border/40" />
                          </div>
                          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                            <Cell label="Email OJK" value={p.email_ojk} />
                            <Cell label="No. Telepon" value={p.no_telepon} />
                            <Cell label="Bergabung" value={p.bergabung_date ? formatTanggal(p.bergabung_date) : null} />
                            <Cell label="NIP OJK" value={p.nip_ojk} />
                            <Cell label="Nama Kontak Darurat" value={p.nama_kontak_darurat} />
                            <Cell label="Telepon Darurat" value={p.no_telepon_darurat ? `${p.no_telepon_darurat} (${p.hubungan_kontak_darurat || '-'})` : null} />
                          </div>
                        </div>

                        <div className="flex flex-col gap-3 flex-shrink-0">
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Latar Belakang</span>
                            <div className="flex-1 h-px bg-border/40" />
                          </div>
                          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                            <Cell label="Pendidikan" value={p.pendidikan} />
                            <Cell label="Lembaga" value={p.nama_lembaga} />
                            <Cell label="Jurusan" value={p.jurusan} />
                            <Cell label="Prev. Company" value={p.previous_company} />
                            <Cell label="Pengalaman CC" value={p.pengalaman_cc} />
                            <Cell label="Kelamin" value={p.jenis_kelamin} />
                          </div>
                        </div>

                        <div className="flex flex-col gap-3 flex-shrink-0">
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-destructive">🔒 Data Sensitif</span>
                            <div className="flex-1 h-px bg-destructive/20" />
                          </div>
                          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                            <Cell label="No. KTP" value={p.no_ktp} />
                            <Cell label="No. NPWP" value={p.no_npwp} />
                            <Cell label="No. Rekening" value={p.nomor_rekening ? `${p.nomor_rekening}${p.nama_bank ? ` · ${p.nama_bank}` : ''}` : null} />
                            <Cell label="Status Hunian" value={p.status_tempat_tinggal} />
                            <div className="col-span-2">
                              <Cell label="Alamat Tinggal" value={p.alamat_tinggal} multiline={true} />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 mt-auto flex-shrink-0">
                        {p.catatan_tambahan && (
                          <div className="w-full bg-amber-500/10 border border-amber-500/20 rounded-3xl p-5 shadow-sm">
                            <p className="text-[9px] font-black text-amber-600 dark:text-amber-500 uppercase tracking-[0.2em] mb-1.5">⭐ Catatan</p>
                            <p className="text-[11px] text-amber-900 dark:text-amber-200/80 leading-relaxed font-medium">{p.catatan_tambahan}</p>
                          </div>
                        )}
                        {p.keterangan && (
                          <div className="w-full bg-muted/30 border border-border/40 rounded-3xl p-5 shadow-sm">
                            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-1.5">Keterangan</p>
                            <p className="text-[11px] text-foreground/70 leading-relaxed font-medium tracking-tight">{p.keterangan}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

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
