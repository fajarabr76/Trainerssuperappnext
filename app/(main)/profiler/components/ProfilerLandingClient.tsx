'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users, Plus, Upload, Table2, SlidersHorizontal, Download,
  FolderOpen, Pencil, Trash2, ChevronLeft, ChevronRight, Cake,
  Settings2, UserPlus, Moon, Sun, PieChart
} from 'lucide-react';
import { ProfilerYear, ProfilerFolder } from '../services/profilerService';
import YearSidebar from './YearSidebar';
import AddMemberPicker from './AddMemberPicker';
import DuplicateFolderModal from './DuplicateFolderModal';
import { useTheme } from 'next-themes';
import { 
  createYear, 
  createFolder as createFolderAction, 
  renameBatch as renameBatchAction, 
  deleteBatch as deleteBatchAction
} from '../actions';

interface ProfilerLandingClientProps {
  initialYears: ProfilerYear[];
  initialFolders: ProfilerFolder[];
  initialCounts: Record<string, number>;
  initialPesertaMap: Record<string, any[]>;
}

function getDaysUntilBirthday(tglLahir: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dob = new Date(tglLahir);
  const next = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
  if (next < today) next.setFullYear(today.getFullYear() + 1);
  return Math.round((next.getTime() - today.getTime()) / 86400000);
}

function getUpcomingBirthdays(pesertaList: any[]): { nama: string; tglLahir: string; days: number; age: number }[] {
  const today = new Date();
  return pesertaList
    .filter(p => p.tgl_lahir)
    .map(p => {
      const days = getDaysUntilBirthday(p.tgl_lahir);
      const dob = new Date(p.tgl_lahir);
      const nextYear =
        today.getMonth() > dob.getMonth() ||
        (today.getMonth() === dob.getMonth() && today.getDate() > dob.getDate())
          ? today.getFullYear() + 1
          : today.getFullYear();
      const age = nextYear - dob.getFullYear();
      return { nama: p.nama || 'Unknown', tglLahir: p.tgl_lahir, days, age };
    })
    .sort((a, b) => a.days - b.days)
    .slice(0, 5);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long' });
}

export default function ProfilerLandingClient({
  initialYears,
  initialFolders,
  initialCounts,
  initialPesertaMap
}: ProfilerLandingClientProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  
  const [years, setYears] = useState<ProfilerYear[]>(initialYears);
  const [folders, setFolders] = useState<ProfilerFolder[]>(initialFolders);
  const [selectedYearId, setSelectedYearId] = useState<string | null>(initialYears[0]?.id || null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(initialFolders[0]?.id || null);
  const [selectedBatch, setSelectedBatch] = useState<string>(initialFolders[0]?.name || '');
  
  const [counts, setCounts] = useState<Record<string, number>>(initialCounts);
  const [pesertaMap, setPesertaMap] = useState<Record<string, any[]>>(initialPesertaMap);
  
  // Modals
  const [showAddYear, setShowAddYear] = useState(false);
  const [newYearValue, setNewYearValue] = useState(new Date().getFullYear());
  const [showAddFolder, setShowAddFolder] = useState<{ yearId: string; parentId?: string } | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [renamingFolder, setRenamingFolder] = useState<ProfilerFolder | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDeleteFolder, setConfirmDeleteFolder] = useState<ProfilerFolder | null>(null);
  const [duplicateFolder, setDuplicateFolder] = useState<ProfilerFolder | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  
  const [deleting, setDeleting] = useState(false);
  const [showBirthdayModal, setShowBirthdayModal] = useState(false);

  const handleAddYear = async () => {
    try {
      const newYear = await createYear(newYearValue);
      setYears(prev => [newYear, ...prev]);
      setSelectedYearId(newYear.id);
      setShowAddYear(false);
    } catch (err: any) {
      alert("Gagal tambah tahun: " + err.message);
    }
  };

  const handleAddFolder = async () => {
    if (!showAddFolder || !newFolderName.trim()) return;
    try {
      const folder = await createFolderAction(
        newFolderName.trim(), 
        showAddFolder.yearId, 
        showAddFolder.parentId
      );
      setFolders(prev => [...prev, folder]);
      setSelectedFolderId(folder.id);
      setSelectedBatch(folder.name);
      setCounts(prev => ({ ...prev, [folder.name]: 0 }));
      setPesertaMap(prev => ({ ...prev, [folder.name]: [] }));
      setNewFolderName('');
      setShowAddFolder(null);
    } catch (err: any) {
      alert("Gagal tambah folder: " + err.message);
    }
  };

  const handleRenameFolder = async () => {
    if (!renamingFolder || !renameValue.trim() || renameValue.trim() === renamingFolder.name) {
      setRenamingFolder(null); return;
    }
    const newName = renameValue.trim();
    const oldName = renamingFolder.name;
    try {
      await renameBatchAction(oldName, newName);
      setFolders(prev => prev.map(f => f.id === renamingFolder.id ? { ...f, name: newName } : f));
      setCounts(prev => {
        const next = { ...prev };
        next[newName] = next[oldName] || 0;
        delete next[oldName];
        return next;
      });
      setPesertaMap(prev => {
        const next = { ...prev };
        next[newName] = next[oldName] || [];
        delete next[oldName];
        return next;
      });
      if (selectedBatch === oldName) setSelectedBatch(newName);
      setRenamingFolder(null);
    } catch (err: any) {
      alert("Gagal rename: " + err.message);
    }
  };

  const handleDeleteFolder = async () => {
    if (!confirmDeleteFolder) return;
    setDeleting(true);
    try {
      await deleteBatchAction(confirmDeleteFolder.name);
      setFolders(prev => prev.filter(f => f.id !== confirmDeleteFolder.id));
      setCounts(prev => { const next = { ...prev }; delete next[confirmDeleteFolder.name]; return next; });
      setPesertaMap(prev => { const next = { ...prev }; delete next[confirmDeleteFolder.name]; return next; });
      if (selectedFolderId === confirmDeleteFolder.id) {
        setSelectedFolderId(null);
        setSelectedBatch('');
      }
    } catch (err: any) {
      alert("Gagal hapus: " + err.message);
    } finally {
      setDeleting(false);
      setConfirmDeleteFolder(null);
    }
  };

  const selectFolder = (id: string) => {
    const folder = folders.find(f => f.id === id);
    if (folder) {
      setSelectedFolderId(id);
      setSelectedBatch(folder.name);
    }
  };

  const hasPeserta = (counts[selectedBatch] || 0) > 0;
  const count = counts[selectedBatch] || 0;

  const upcomingBirthdays = useMemo(() => {
    const list = pesertaMap[selectedBatch] || [];
    return getUpcomingBirthdays(list);
  }, [pesertaMap, selectedBatch]);

  const nearestBirthday = upcomingBirthdays[0] ?? null;

  return (
    <div className="min-h-screen bg-background flex flex-col transition-colors duration-500">
      <div className="flex items-center justify-between px-8 py-4 bg-card/30 backdrop-blur-2xl border-b border-border/40 sticky top-0 z-50">
        <div className="flex-1">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.2em] text-foreground/70 hover:text-primary transition-all group"
          >
            <div className="w-8 h-8 rounded-xl bg-accent/50 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-all">
              <ChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
            </div>
            <span className="hidden md:block">Dashboard</span>
          </button>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center shadow-xl shadow-primary/20 relative overflow-hidden group">
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            <Users className="w-5 h-5 text-primary-foreground relative z-10" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-black tracking-tighter uppercase leading-none">KTP</span>
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] opacity-70">Kotak Tool Profil</span>
          </div>
        </div>
        
        <div className="flex-1 flex justify-end">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-10 h-10 flex items-center justify-center rounded-2xl bg-accent/30 text-foreground/70 hover:text-primary transition-all border border-border/40 hover:shadow-lg hover:shadow-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden p-4 gap-4">
        <main className="flex-1 overflow-y-auto bg-card border border-border/40 rounded-2xl shadow-sm custom-scrollbar relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none overflow-hidden z-0 rounded-2xl">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-violet-500/5 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
          </div>

          {!selectedBatch ? (
            <div className="h-full flex items-center justify-center text-center p-6">
              <div className="max-w-xs">
                <div className="w-20 h-20 rounded-3xl bg-foreground/5 flex items-center justify-center mx-auto mb-6">
                  <FolderOpen className="w-10 h-10 text-foreground/20" />
                </div>
                <h3 className="text-xl font-bold mb-2">Pilih Batch</h3>
                <p className="text-sm text-foreground/40 font-light">Silakan pilih atau buat batch baru di panel sebelah kiri untuk mengelola data agen.</p>
              </div>
            </div>
          ) : (
            <div className="p-6 h-full flex flex-col max-w-7xl mx-auto w-full relative z-10">
              <div className="mb-6 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-4 mb-2">
                    <h2 className="text-3xl font-bold tracking-tight">{selectedBatch}</h2>
                    {count > 0 && (
                      <span className="px-3 py-1 bg-foreground/5 text-foreground/60 text-[10px] font-bold uppercase tracking-widest rounded-full border border-border">
                        {count} Agen
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-foreground/40 font-light">
                    {count > 0 
                      ? 'Kelola profil, tim, dan ekspor data secara efisien.' 
                      : 'Batch ini kosong. Tambahkan data agen di bawah.'}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setShowPicker(true)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-violet-600/20 hover:scale-105 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
                  >
                    <UserPlus size={18} />
                    Pilih dari Batch Lain
                  </button>
                  <button 
                    onClick={() => router.push(`/profiler/add?batch=${encodeURIComponent(selectedBatch)}`)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-accent text-foreground rounded-xl text-sm font-bold border border-border/40 hover:bg-accent/80 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
                  >
                    <Plus size={18} />
                    Input Baru
                  </button>
                </div>
              </div>

              <section className="mb-8">
                <div className="flex items-center gap-3 mb-4 px-1">
                  <div className="w-1 h-3 bg-primary rounded-full" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">Manajemen Data</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <ActionCard
                    icon={<Plus className="w-5 h-5" />}
                    iconBg="bg-primary/10"
                    iconColor="text-primary"
                    title="Registrasi Manual"
                    desc="Tambahkan data agen baru secara individual melalui formulir input."
                    className="md:col-span-2"
                    onClick={() => router.push(`/profiler/add?batch=${encodeURIComponent(selectedBatch)}`)}
                  />
                  <ActionCard
                    icon={<Upload className="w-5 h-5" />}
                    iconBg="bg-emerald-500/10"
                    iconColor="text-emerald-500"
                    title="Impor Kolektif"
                    desc="Unggah XLS untuk perbarui data massal."
                    onClick={() => router.push(`/profiler/import?batch=${encodeURIComponent(selectedBatch)}`)}
                  />
                </div>
              </section>

              <section className={`transition-all duration-500 mb-8 ${!hasPeserta ? 'opacity-30 grayscale pointer-events-none' : ''}`}>
                <div className="flex items-center gap-3 mb-4 px-1">
                  <div className="w-1 h-3 bg-blue-500 rounded-full" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40"> Analisis & Ekspor </p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <ActionCard
                    icon={<Table2 className="w-5 h-5" />}
                    iconBg="bg-blue-500/10"
                    iconColor="text-blue-500"
                    title="Database"
                    desc="Kelola data dalam format tabel."
                    onClick={() => router.push(`/profiler/table?batch=${encodeURIComponent(selectedBatch)}`)}
                  />
                  <ActionCard
                    icon={<SlidersHorizontal className="w-5 h-5" />}
                    iconBg="bg-purple-500/10"
                    iconColor="text-purple-500"
                    title="Slides"
                    desc="Profil agen format presentasi."
                    onClick={() => router.push(`/profiler/slides?batch=${encodeURIComponent(selectedBatch)}`)}
                  />
                  <ActionCard
                    icon={<Download className="w-5 h-5" />}
                    iconBg="bg-orange-500/10"
                    iconColor="text-orange-500"
                    title="Ekspor"
                    desc="Konversi ke PDF & Excel."
                    onClick={() => router.push(`/profiler/export?batch=${encodeURIComponent(selectedBatch)}`)}
                  />
                  <ActionCard
                    icon={<PieChart className="w-5 h-5" />}
                    iconBg="bg-emerald-500/10"
                    iconColor="text-emerald-500"
                    title="Statistik"
                    desc="Dashboard distribusi batch."
                    onClick={() => router.push(`/profiler/analytics?batch=${encodeURIComponent(selectedBatch)}`)}
                  />
                </div>
              </section>

              <section className="mt-2 mb-8">
                <div className="flex items-center gap-3 mb-4 px-1">
                  <div className="w-1 h-3 bg-foreground/20 rounded-full" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">Konfigurasi</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <ActionCard
                    icon={<Settings2 className="w-5 h-5" />}
                    iconBg="bg-foreground/10"
                    iconColor="text-foreground/60"
                    title="Manajemen Tim"
                    desc="Kustomisasi daftar tim."
                    onClick={() => router.push('/profiler/teams')}
                  />
                </div>
              </section>

              {hasPeserta && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <StatCard label="Total Agen" value={String(count)} />
                  <StatCard label="Batch Aktif" value={selectedBatch} small />
                  <button
                    onClick={() => setShowBirthdayModal(true)}
                    className="group relative overflow-hidden bg-primary/5 border border-primary/10 rounded-2xl p-4 text-left hover:shadow-lg hover:shadow-primary/5 transition-all"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Cake className="w-4 h-4 text-primary" />
                      </div>
                      <p className="text-[10px] text-primary uppercase tracking-widest font-bold">Ulang Tahun</p>
                    </div>
                    {nearestBirthday ? (
                      <>
                        <p className="text-base font-bold truncate leading-tight mb-1">{nearestBirthday.nama}</p>
                        <div className="flex items-baseline gap-2">
                          {nearestBirthday.days === 0 ? (
                            <span className="text-lg font-bold text-primary">Hari ini! 🎉</span>
                          ) : (
                            <>
                              <span className="text-2xl font-bold text-primary">{nearestBirthday.days}</span>
                              <span className="text-[10px] text-foreground/40 font-light">hari lagi</span>
                            </>
                          )}
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-foreground/40 font-light">Data tidak tersedia</p>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </main>

        <YearSidebar 
          years={years}
          folders={folders}
          selectedYearId={selectedYearId}
          selectedFolderId={selectedFolderId}
          onSelectYear={setSelectedYearId}
          onSelectFolder={selectFolder}
          onAddYear={() => setShowAddYear(true)}
          onAddFolder={(yearId, parentId) => setShowAddFolder({ yearId, parentId })}
          onRenameFolder={(f) => { setRenamingFolder(f); setRenameValue(f.name); }}
          onDeleteFolder={setConfirmDeleteFolder}
          onDuplicateFolder={setDuplicateFolder}
          counts={counts}
        />
      </div>

      {/* Modals */}
      {showAddYear && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-md">
          <div className="bg-card w-full max-w-sm rounded-[2rem] p-6 shadow-2xl border border-border/40">
            <h3 className="text-lg font-bold mb-4">Tambah Tahun</h3>
            <input 
              type="number"
              value={newYearValue}
              onChange={e => setNewYearValue(parseInt(e.target.value))}
              className="w-full px-4 py-3 rounded-2xl border border-border/40 bg-background mb-4 transition-all focus:outline-none focus:ring-2 focus:ring-primary/20"
              min="2000" max="2100"
            />
            <div className="flex gap-3">
              <button onClick={() => setShowAddYear(false)} className="flex-1 py-3 bg-accent border border-border/40 hover:bg-accent/80 rounded-2xl font-bold text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Batal</button>
              <button onClick={handleAddYear} className="flex-1 py-3 bg-primary text-primary-foreground hover:opacity-90 rounded-2xl font-bold text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Simpan</button>
            </div>
          </div>
        </div>
      )}

      {showAddFolder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-md">
          <div className="bg-card w-full max-w-sm rounded-[2rem] p-6 shadow-2xl border border-border/40">
            <h3 className="text-lg font-bold mb-4">{showAddFolder.parentId ? 'Tambah Sub-folder' : 'Tambah Folder'}</h3>
            <input 
              type="text"
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              placeholder="Nama folder..."
              className="w-full px-4 py-3 rounded-2xl border border-border/40 bg-background mb-4 transition-all focus:outline-none focus:ring-2 focus:ring-primary/20"
              autoFocus
            />
            <div className="flex gap-3">
              <button onClick={() => setShowAddFolder(null)} className="flex-1 py-3 bg-accent border border-border/40 hover:bg-accent/80 rounded-2xl font-bold text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Batal</button>
              <button onClick={handleAddFolder} className="flex-1 py-3 bg-primary text-primary-foreground hover:opacity-90 rounded-2xl font-bold text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Simpan</button>
            </div>
          </div>
        </div>
      )}

      {renamingFolder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-md">
          <div className="bg-card w-full max-w-sm rounded-[2rem] p-6 shadow-2xl border border-border/40">
            <h3 className="text-lg font-bold mb-4">Rename Folder</h3>
            <input 
              type="text"
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-border/40 bg-background mb-4 transition-all focus:outline-none focus:ring-2 focus:ring-primary/20"
              autoFocus
            />
            <div className="flex gap-3">
              <button onClick={() => setRenamingFolder(null)} className="flex-1 py-3 bg-accent border border-border/40 hover:bg-accent/80 rounded-2xl font-bold text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Batal</button>
              <button onClick={handleRenameFolder} className="flex-1 py-3 bg-primary text-primary-foreground hover:opacity-90 rounded-2xl font-bold text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Simpan</button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteFolder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-md" onClick={() => !deleting && setConfirmDeleteFolder(null)}>
          <div className="bg-card w-full max-w-sm rounded-[2rem] p-6 shadow-2xl border border-border/40" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 bg-red-500/15 rounded-2xl flex items-center justify-center">
                <Trash2 className="w-7 h-7 text-red-500" />
              </div>
            </div>
            <h3 className="text-base font-bold text-center mb-1">Hapus Folder?</h3>
            <p className="text-sm text-muted-foreground text-center mb-1 font-semibold">{confirmDeleteFolder.name}</p>
            <p className="text-xs text-red-500 text-center mb-6">Semua data peserta akan terhapus permanen.</p>
            <div className="space-y-2">
              <button onClick={handleDeleteFolder} disabled={deleting} className="w-full py-3 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white rounded-2xl font-bold text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background">
                {deleting ? 'Menghapus...' : 'Ya, Hapus Permanen'}
              </button>
              <button onClick={() => setConfirmDeleteFolder(null)} disabled={deleting} className="w-full py-3 bg-accent border border-border/40 hover:bg-accent/80 rounded-2xl font-bold text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Batal</button>
            </div>
          </div>
        </div>
      )}

      <AddMemberPicker 
        isOpen={showPicker}
        onClose={() => setShowPicker(false)}
        targetBatch={selectedBatch}
        onSuccess={() => router.refresh()}
      />

      <DuplicateFolderModal 
        isOpen={!!duplicateFolder}
        onClose={() => setDuplicateFolder(null)}
        folder={duplicateFolder}
        years={years}
        onSuccess={() => router.refresh()}
      />

      {showBirthdayModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-md" onClick={() => setShowBirthdayModal(false)}>
          <div className="bg-card w-full max-w-sm rounded-[2rem] shadow-2xl border border-border/40 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 bg-gradient-to-br from-pink-500 to-rose-500">
              <h3 className="text-lg font-bold text-white flex items-center gap-2 tracking-tight">
                <Cake size={20} /> 
                Ulang Tahun Terdekat
              </h3>
            </div>
            <div className="p-4 space-y-2">
              {upcomingBirthdays.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-muted-foreground font-light italic">Tidak ada data ulang tahun.</p>
                </div>
              ) : (
                upcomingBirthdays.map((b, i) => (
                  <div key={i} className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${b.days === 0 ? 'bg-pink-50 border-pink-200 dark:bg-pink-500/10' : 'bg-background border-border/40'}`}>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold truncate ${b.days === 0 ? 'text-pink-600 dark:text-pink-400' : 'text-foreground'}`}>
                        {b.nama} {b.days === 0 && '🎉'}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{formatDate(b.tglLahir)} · {b.age} tahun</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-xs font-black uppercase tracking-widest ${b.days === 0 ? 'text-pink-500' : 'text-muted-foreground'}`}>
                        {b.days === 0 ? 'Hari ini!' : `${b.days} hari`}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
            {upcomingBirthdays.length > 0 && (
              <div className="px-6 pb-5">
                <p className="text-[10px] text-muted-foreground/40 text-center font-mono">
                  Menampilkan 5 ulang tahun terdekat
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ActionCard({ icon, iconBg, iconColor, title, desc, onClick, className }: any) {
  return (
    <button onClick={onClick} className={`group flex flex-col gap-3 p-5 bg-card/40 backdrop-blur-sm border border-border/40 rounded-xl text-left transition-all hover:bg-card hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-0.5 relative overflow-hidden active:translate-y-0 ${className}`}>
      <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center transition-transform group-hover:scale-110 duration-500 flex-shrink-0`}>
        <span className={iconColor}>{icon}</span>
      </div>
      <div className="relative z-10 flex-1">
        <p className="text-base font-bold mb-1 tracking-tight group-hover:text-primary transition-colors">{title}</p>
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 font-light">{desc}</p>
      </div>
      {/* Decorative background icon */}
      <div className="absolute -right-2 -bottom-2 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity duration-700 rotate-12 scale-150 pointer-events-none">
        {icon}
      </div>
    </button>
  );
}

function StatCard({ label, value, small = false }: any) {
  return (
    <div className="bg-card/40 backdrop-blur-sm border border-border/40 rounded-xl p-4 flex flex-col justify-between shadow-sm hover:shadow-lg hover:shadow-primary/5 transition-all">
      <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-black">{label}</p>
      <p className={`font-black tracking-tighter ${
        small ? 'text-lg opacity-60 truncate' : 'text-3xl text-foreground'
      }`}>{value}</p>
    </div>
  );
}
