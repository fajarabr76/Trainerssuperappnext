'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Trash2, Cake
} from 'lucide-react';
import { ProfilerYear, ProfilerFolder } from '../services/profilerService';
import AddMemberPicker from './AddMemberPicker';
import DuplicateFolderModal from './DuplicateFolderModal';
import { 
  createYear, 
  createFolder as createFolderAction, 
  renameBatch as renameBatchAction, 
  deleteBatch as deleteBatchAction,
  getPesertaByBatch
} from '../actions';
import { Peserta } from '../lib/profiler-types';

// New Redesigned Components
import WorkspaceHeader from './workspace/WorkspaceHeader';
import WorkspaceNavigator from './workspace/WorkspaceNavigator';
import WorkspaceActiveBatch from './workspace/WorkspaceActiveBatch';
import HierarchyPanel from './workspace/HierarchyPanel';
import { motion, AnimatePresence } from 'motion/react';

interface ProfilerLandingClientProps {
  initialYears: ProfilerYear[];
  initialFolders: ProfilerFolder[];
  initialCounts: Record<string, number>;
  initialPesertaMap: Record<string, Peserta[]>;
  role?: string;
}

function getDaysUntilBirthday(tglLahir: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dob = new Date(tglLahir);
  const next = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
  if (next < today) next.setFullYear(today.getFullYear() + 1);
  return Math.round((next.getTime() - today.getTime()) / 86400000);
}

function getUpcomingBirthdays(pesertaList: Peserta[]): { nama: string; tglLahir: string; days: number; age: number }[] {
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
  initialPesertaMap,
  role = 'trainer'
}: ProfilerLandingClientProps) {
  const isReadOnly = role === 'leader';
  
  const [years, setYears] = useState<ProfilerYear[]>(initialYears);
  const [folders, setFolders] = useState<ProfilerFolder[]>(initialFolders);
  const [selectedYearId, setSelectedYearId] = useState<string | null>(() => {
    if (initialYears.length === 0) return null;
    const currentYear = new Date().getFullYear();
    const sameYear = initialYears.find((y) => y.year === currentYear);
    if (sameYear) return sameYear.id;
    return [...initialYears].sort((a, b) => b.year - a.year)[0]?.id || initialYears[0]?.id || null;
  });
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<string>('');
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  
  const [counts, setCounts] = useState<Record<string, number>>(initialCounts);
  const [pesertaMap, setPesertaMap] = useState<Record<string, Peserta[]>>(initialPesertaMap);
  
  // UI States
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
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
  const [loadingPeserta, setLoadingPeserta] = useState(false);

  useEffect(() => {
    if (!selectedYearId) {
      setSelectedTeamId(null);
      setSelectedBatch('');
      setSelectedFolderId(null);
      return;
    }

    const teamStillValid = selectedTeamId
      ? folders.some((f) => f.id === selectedTeamId && f.year_id === selectedYearId && !f.parent_id)
      : false;

    if (!teamStillValid) {
      setSelectedTeamId(null);
      setSelectedBatch('');
      setSelectedFolderId(null);
    }
  }, [selectedYearId, selectedTeamId, folders]);

  // Lazy Load Peserta when batch changes
  React.useEffect(() => {
    if (!selectedBatch) return;
    
    // Only fetch if not already in map
    if (!pesertaMap[selectedBatch]) {
      const fetchPeserta = async () => {
        setLoadingPeserta(true);
        try {
          const data = await getPesertaByBatch(selectedBatch);
          setPesertaMap(prev => ({ ...prev, [selectedBatch]: data }));
        } catch (err) {
          console.error("Failed to fetch peserta:", err);
        } finally {
          setLoadingPeserta(false);
        }
      };
      fetchPeserta();
    }
  }, [selectedBatch, pesertaMap]);

  const handleAddYear = async () => {
    try {
      const newYear = await createYear(newYearValue);
      setYears(prev => [newYear, ...prev]);
      setSelectedYearId(newYear.id);
      setShowAddYear(false);
    } catch (err: unknown) {
      alert("Gagal tambah tahun: " + (err as Error).message);
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
      setSelectedTeamId(showAddFolder.parentId || folder.id);
      setCounts(prev => ({ ...prev, [folder.name]: 0 }));
      setPesertaMap(prev => ({ ...prev, [folder.name]: [] }));
      setNewFolderName('');
      setShowAddFolder(null);
    } catch (err: unknown) {
      alert("Gagal tambah folder: " + (err as Error).message);
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
    } catch (err: unknown) {
      alert("Gagal rename: " + (err as Error).message);
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
    } catch (err: unknown) {
      alert("Gagal hapus: " + (err as Error).message);
    } finally {
      setDeleting(false);
      setConfirmDeleteFolder(null);
    }
  };

  const selectFolder = (id: string) => {
    const folder = folders.find(f => f.id === id);
    if (folder) {
      setSelectedFolderId(id);
      if (!folder.parent_id) {
        setSelectedTeamId(folder.id);
        const children = folders.filter((f) => f.parent_id === folder.id);
        if (children.length === 0) {
          setSelectedBatch(folder.name);
        } else {
          setSelectedBatch('');
        }
      } else {
        setSelectedTeamId(folder.parent_id);
        setSelectedBatch(folder.name);
      }
      setIsSidebarOpen(false); // Close mobile sidebar on select
    }
  };

  const count = counts[selectedBatch] || 0;

  const upcomingBirthdays = useMemo(() => {
    const list = pesertaMap[selectedBatch] || [];
    return getUpcomingBirthdays(list);
  }, [pesertaMap, selectedBatch]);

  const activeTeamName = useMemo(() => {
    return folders.find(f => f.id === selectedTeamId)?.name;
  }, [folders, selectedTeamId]);

  const activeYearLabel = useMemo(() => {
    return years.find(y => y.id === selectedYearId)?.label;
  }, [years, selectedYearId]);

  return (
    <div className="min-h-screen bg-background flex flex-col transition-colors duration-500 overflow-hidden">
      <WorkspaceHeader 
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        activeBatch={selectedBatch}
        activeTeam={activeTeamName}
        activeYearLabel={activeYearLabel}
      />

      <div className="flex flex-1 overflow-hidden relative">
        <main className="flex-1 overflow-hidden relative group">
          {/* Subtle Workspace Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none overflow-hidden z-0">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/3 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-module-profiler/5 rounded-full blur-[120px]" />
          </div>

          <AnimatePresence mode="wait">
            {!selectedBatch ? (
              <motion.div 
                key="navigator"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.4, ease: "circOut" }}
                className="h-full"
              >
                <WorkspaceNavigator 
                  years={years}
                  folders={folders}
                  selectedYearId={selectedYearId}
                  onSelectYear={setSelectedYearId}
                  selectedTeamId={selectedTeamId}
                  onSelectTeam={setSelectedTeamId}
                  onSelectBatch={(id, name) => {
                    setSelectedFolderId(id);
                    setSelectedBatch(name);
                  }}
                  isReadOnly={isReadOnly}
                  onAddFolder={(yearId, parentId) => setShowAddFolder({ yearId, parentId })}
                  counts={counts}
                />
              </motion.div>
            ) : (
              <motion.div 
                key="active-batch"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.4, ease: "circOut" }}
                className="h-full"
              >
                <WorkspaceActiveBatch 
                  batchName={selectedBatch}
                  count={count}
                  loadingPeserta={loadingPeserta}
                  isReadOnly={isReadOnly}
                  onPickPeserta={() => setShowPicker(true)}
                  upcomingBirthdays={upcomingBirthdays}
                  onShowBirthdays={() => setShowBirthdayModal(true)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <aside className="hidden md:block">
          <HierarchyPanel 
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
            role={role}
          />
        </aside>

        {/* Mobile Hierarchy Sidebar */}
        <AnimatePresence>
          {isSidebarOpen && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsSidebarOpen(false)}
                className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm md:hidden"
              />
              <motion.aside
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="fixed top-0 right-0 z-[70] h-full w-[85%] max-w-sm bg-card shadow-2xl md:hidden"
              >
                <HierarchyPanel 
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
                  role={role}
                  isMobile
                />
              </motion.aside>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Modals - Maintained for functionality */}
      {showAddYear && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-md">
          <div className="bg-card w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl border border-border/40">
            <h3 className="text-xl font-black tracking-tight mb-6">Create Archives</h3>
            <input 
              type="number"
              value={newYearValue}
              onChange={e => setNewYearValue(parseInt(e.target.value))}
              className="w-full px-5 py-4 rounded-2xl border border-border/40 bg-background mb-6 transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 font-bold"
              min="2000" max="2100"
            />
            <div className="flex gap-3">
              <button onClick={() => setShowAddYear(false)} className="flex-1 py-4 bg-accent border border-border/40 hover:bg-accent/80 rounded-2xl font-black text-[10px] uppercase tracking-widest">Cancel</button>
              <button onClick={handleAddYear} className="flex-1 py-4 bg-primary text-primary-foreground hover:opacity-90 rounded-2xl font-black text-[10px] uppercase tracking-widest">Construct</button>
            </div>
          </div>
        </div>
      )}

      {showAddFolder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-md">
          <div className="bg-card w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl border border-border/40">
            <h3 className="text-xl font-black tracking-tight mb-6">{showAddFolder.parentId ? 'New Batch' : 'New Team'}</h3>
            <input 
              type="text"
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              placeholder={showAddFolder.parentId ? 'e.g. Batch Genesis' : 'e.g. Team Alpha'}
              className="w-full px-5 py-4 rounded-2xl border border-border/40 bg-background mb-6 transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 font-bold"
              autoFocus
            />
            <div className="flex gap-3">
              <button onClick={() => setShowAddFolder(null)} className="flex-1 py-4 bg-accent border border-border/40 hover:bg-accent/80 rounded-2xl font-black text-[10px] uppercase tracking-widest">Cancel</button>
              <button onClick={handleAddFolder} className="flex-1 py-4 bg-primary text-primary-foreground hover:opacity-90 rounded-2xl font-black text-[10px] uppercase tracking-widest">Deploy</button>
            </div>
          </div>
        </div>
      )}

      {renamingFolder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-md">
          <div className="bg-card w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl border border-border/40">
            <h3 className="text-xl font-black tracking-tight mb-6">Rename Node</h3>
            <input 
              type="text"
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              className="w-full px-5 py-4 rounded-2xl border border-border/40 bg-background mb-6 transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 font-bold"
              autoFocus
            />
            <div className="flex gap-3">
              <button onClick={() => setRenamingFolder(null)} className="flex-1 py-4 bg-accent border border-border/40 hover:bg-accent/80 rounded-2xl font-black text-[10px] uppercase tracking-widest">Cancel</button>
              <button onClick={handleRenameFolder} className="flex-1 py-4 bg-primary text-primary-foreground hover:opacity-90 rounded-2xl font-black text-[10px] uppercase tracking-widest">Commit</button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteFolder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-md" onClick={() => !deleting && setConfirmDeleteFolder(null)}>
          <div className="bg-card w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl border border-border/40" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500">
                <Trash2 size={32} />
              </div>
            </div>
            <h3 className="text-xl font-black tracking-tight text-center mb-2">Delete Node?</h3>
            <p className="text-sm text-muted-foreground text-center mb-2 font-bold">{confirmDeleteFolder.name}</p>
            <p className="text-xs text-red-500/60 text-center mb-8 px-4 leading-relaxed font-medium">This action will permanently purge the node and all nested participants data.</p>
            <div className="space-y-3">
              <button onClick={handleDeleteFolder} disabled={deleting} className="w-full py-4 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest">
                {deleting ? 'Purging...' : 'Confirm Purge'}
              </button>
              <button onClick={() => setConfirmDeleteFolder(null)} disabled={deleting} className="w-full py-4 bg-accent border border-border/40 hover:bg-accent/80 rounded-2xl font-black text-[10px] uppercase tracking-widest">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <AddMemberPicker 
        isOpen={showPicker}
        onClose={() => setShowPicker(false)}
        targetBatch={selectedBatch}
        onSuccess={(newList) => {
          setPesertaMap(prev => ({ 
            ...prev, 
            [selectedBatch]: [...(prev[selectedBatch] || []), ...newList] 
          }));
          setCounts(prev => ({ ...prev, [selectedBatch]: (prev[selectedBatch] || 0) + newList.length }));
        }}
      />

      <DuplicateFolderModal 
        isOpen={!!duplicateFolder}
        onClose={() => setDuplicateFolder(null)}
        folder={duplicateFolder}
        years={years}
        onSuccess={(newF, newP) => {
          setFolders(prev => [...prev, newF]);
          setCounts(prev => ({ ...prev, [newF.name]: newP.length }));
          setPesertaMap(prev => ({ ...prev, [newF.name]: newP }));
        }}
      />

      {showBirthdayModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-md" onClick={() => setShowBirthdayModal(false)}>
          <div className="bg-card w-full max-w-sm rounded-[2.5rem] shadow-2xl border border-border/40 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-8 bg-module-profiler text-white">
              <h3 className="text-2xl font-black flex items-center gap-3 tracking-tighter">
                <Cake size={28} /> 
                Celebrations
              </h3>
              <p className="text-xs font-bold text-white/60 uppercase tracking-widest mt-1">Upcoming events in {selectedBatch}</p>
            </div>
            <div className="p-4 space-y-2">
              {upcomingBirthdays.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-muted-foreground font-medium italic opacity-40">No celebrations found.</p>
                </div>
              ) : (
                upcomingBirthdays.map((b, i) => (
                  <div key={i} className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${b.days === 0 ? 'bg-module-profiler/5 border-module-profiler/20' : 'bg-background border-border/40'}`}>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-black truncate tracking-tight ${b.days === 0 ? 'text-module-profiler' : 'text-foreground'}`}>
                        {b.nama}
                      </p>
                      <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider mt-0.5">{formatDate(b.tglLahir)} · {b.age} Y.O</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-[10px] font-black uppercase tracking-widest ${b.days === 0 ? 'text-module-profiler animate-pulse' : 'text-muted-foreground/40'}`}>
                        {b.days === 0 ? 'Active Now' : `${b.days} Days`}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
            {upcomingBirthdays.length > 0 && (
              <div className="px-8 pb-6">
                <p className="text-[10px] text-muted-foreground/30 text-center font-black uppercase tracking-widest">
                  Showing top 5 insights
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
