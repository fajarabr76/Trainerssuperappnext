'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import {
  Settings, Plus, Trash2, Info,
  Pencil, Check, History,
  Clock, Rocket, AlertTriangle,
  GitBranch
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  getRuleVersionsAction,
  getIndicatorsByVersionAction,
  createRuleDraftAction,
  updateRuleDraftAction,
  deleteRuleDraftAction,
  publishRuleVersionAction,
  addDraftIndicatorAction,
  updateDraftIndicatorAction,
  deleteDraftIndicatorAction
} from '../actions';
import type { 
  QAIndicator, 
  ServiceType, 
  Category, 
  ServiceWeight, 
  QARuleVersion, 
  QARuleIndicatorSnapshot, 
  QAPeriod
} from '../lib/qa-types';
import { SERVICE_LABELS } from '../lib/qa-types';
import QaStatePanel from '../components/QaStatePanel';

const TEAMS: ServiceType[] = ['call', 'chat', 'email', 'cso', 'pencatatan', 'bko', 'slik'];
const CAT_LABEL: Record<Category, string> = {
  non_critical: 'Non-Critical Error',
  critical: 'Critical Error',
  none: 'Semua Parameter',
};
const CAT_COLOR: Record<Category, string> = {
  non_critical: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20',
  critical: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20',
  none: 'bg-foreground/10 text-muted-foreground border-foreground/20',
};
const MONTH_NAMES = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const formatPeriodLabel = (month: number, year: number) => {
  const monthName = MONTH_NAMES[month - 1] ?? String(month);
  return `${monthName} ${year}`;
};

interface QaVersionedSettingsProps {
  user: User;
  role: string;
  initialIndicators: QAIndicator[];
  initialWeights: Record<ServiceType, ServiceWeight>;
  periods: QAPeriod[];
}

export default function QaVersionedSettings({ periods }: QaVersionedSettingsProps) {
  const [activeTeam, setActiveTeam] = useState<ServiceType>('call');
  const [versions, setVersions] = useState<QARuleVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<QARuleVersion | null>(null);
  const [draftIndicators, setDraftIndicators] = useState<QARuleIndicatorSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingIndicators, setLoadingIndicators] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [isPublishing, setIsPublishing] = useState(false);
  const [changeReason, setChangeReason] = useState('');
  const [previewVersion, setPreviewVersion] = useState<QARuleVersion | null>(null);
  const [publishConfirmed, setPublishConfirmed] = useState(false);

  const fetchVersions = useCallback(async (team: ServiceType) => {
    setLoading(true);
    try {
      const { data, error } = await getRuleVersionsAction(team);
      if (error) {
        setErrorMsg(error);
        return;
      }
      setVersions(data as QARuleVersion[]);
      if (data.length > 0) {
        // Select draft first, then published, then latest version
        const draft = data.find(v => v.status === 'draft');
        const published = data.find(v => v.status === 'published');
        const latest = data.sort((a, b) => b.version_number - a.version_number)[0];
        setSelectedVersion(draft || published || latest || data[0]);
      } else {
        setSelectedVersion(null);
      }
    } catch {
      setErrorMsg('Gagal mengambil data versi rules.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVersions(activeTeam);
  }, [activeTeam, fetchVersions]);

  useEffect(() => {
    if (selectedVersion) {
      setLoadingIndicators(true);
      getIndicatorsByVersionAction(selectedVersion.id)
        .then(res => {
          if (res.error) {
            setErrorMsg(res.error);
          } else {
            setDraftIndicators(res.data as QARuleIndicatorSnapshot[]);
          }
        })
        .catch(() => setErrorMsg('Gagal mengambil detail parameter.'))
        .finally(() => setLoadingIndicators(false));
    } else {
      setDraftIndicators([]);
    }
  }, [selectedVersion]);

  const flash = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const handleCreateDraft = async (sourceId?: string) => {
    setErrorMsg(null);
    try {
      const draft = await createRuleDraftAction(activeTeam, sourceId);
      setVersions(prev => [draft, ...prev]);
      setSelectedVersion(draft);
      flash('Draft baru berhasil dibuat!');
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal membuat draft.');
    }
  };

  const handleDeleteDraft = async (id: string) => {
    if (!confirm('Hapus draft ini?')) return;
    try {
      await deleteRuleDraftAction(id);
      setVersions(prev => prev.filter(v => v.id !== id));
      if (selectedVersion?.id === id) {
        setSelectedVersion(versions.find(v => v.id !== id) || null);
      }
      flash('Draft dihapus.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menghapus draft.');
    }
  };

  const handlePublish = async () => {
    if (!previewVersion) return;
    setIsPublishing(true);
    setErrorMsg(null);
    try {
      const published = await publishRuleVersionAction(previewVersion.id, changeReason);
      setVersions(prev => prev.map(v => v.id === published.id ? published : v));
      setSelectedVersion(published);
      setPreviewVersion(null);
      setChangeReason('');
      setIsPublishing(false);
      flash(`Rule berhasil dipublish untuk periode ${periods.find(p => p.id === published.effective_period_id)?.label || ''}!`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mempublish rules.');
      setIsPublishing(false);
    }
  };

  // Draft Editing Logic (similar to QaSettingsClient but targeting snaphost indicators)
  const [showAddForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<Category>('non_critical');
  const [newBobot, setNewBobot] = useState('10');
  const [newHasNa, setNewHasNa] = useState(false);
  const [savingNew, setSavingNew] = useState(false);

  const [editIndId, setEditIndId] = useState<string | null>(null);
  const [editState, setEditState] = useState<{name: string, category: Category, bobot: string, has_na: boolean} | null>(null);

  const handleAddIndicator = async () => {
    if (!selectedVersion) return;
    const bobotVal = parseFloat(newBobot) / 100;
    setSavingNew(true);
    try {
      const created = await addDraftIndicatorAction(selectedVersion.id, {
        name: newName,
        category: selectedVersion.scoring_mode === 'no_category' ? 'none' : newCategory,
        bobot: bobotVal,
        has_na: newHasNa
      });
      setDraftIndicators(prev => [...prev, created]);
      setNewName('');
      setShowForm(false);
      flash('Parameter ditambahkan ke draft.');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSavingNew(false);
    }
  };

  const handleSaveEditIndicator = async () => {
    if (!editIndId || !editState) return;
    try {
      const updated = await updateDraftIndicatorAction(editIndId, {
        name: editState.name,
        category: editState.category,
        bobot: parseFloat(editState.bobot) / 100,
        has_na: editState.has_na
      });
      setDraftIndicators(prev => prev.map(i => i.id === editIndId ? updated : i));
      setEditIndId(null);
      setEditState(null);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleDeleteIndicator = async (id: string) => {
    try {
      await deleteDraftIndicatorAction(id);
      setDraftIndicators(prev => prev.filter(i => i.id !== id));
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const isDraft = selectedVersion?.status === 'draft';

  return (
    <main className="flex-1 flex flex-col overflow-hidden bg-background">
      <header className="h-16 flex items-center justify-between px-4 lg:px-8 bg-card/50 backdrop-blur-xl border-b border-border sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
              <History className="w-4 h-4 text-primary-foreground"/>
            </div>
            <h1 className="text-lg font-bold text-foreground">Versioning Parameter QA</h1>
          </div>
        </div>
        
        <div className="flex gap-2">
          {selectedVersion?.status === 'draft' && (
            <>
              <button
                onClick={() => { setPreviewVersion(selectedVersion); setPublishConfirmed(false); }}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-green-500/20"
              >
                <Rocket className="w-3.5 h-3.5"/>
                Publish
              </button>
              <button
                onClick={() => handleDeleteDraft(selectedVersion.id)}
                className="flex items-center gap-2 px-4 py-2 bg-destructive hover:bg-destructive/90 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-destructive/20"
              >
                <Trash2 className="w-3.5 h-3.5"/>
                Hapus Draft
              </button>
            </>
          )}
          {selectedVersion?.status === 'published' && (
            <button
              onClick={() => handleCreateDraft(selectedVersion.id)}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-primary/20"
            >
              <GitBranch className="w-3.5 h-3.5"/>
              Create Revision
            </button>
          )}
          {!selectedVersion && !versions.some(v => v.status === 'draft') && (
            <button
              onClick={() => handleCreateDraft()}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-primary/20"
            >
              <Plus className="w-3.5 h-3.5"/>
              Buat Draft Baru
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
        {/* Sidebar: Version History */}
        <aside className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-border bg-card/30 overflow-y-auto">
          <div className="p-4 space-y-4">
             <div className="flex gap-1 p-1 bg-foreground/5 rounded-xl border border-border">
                {TEAMS.map(team => (
                  <button key={team}
                    onClick={() => setActiveTeam(team)}
                    className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${
                      activeTeam === team ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:bg-foreground/5'
                    }`}>
                    {SERVICE_LABELS[team]}
                  </button>
                ))}
             </div>

             <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Riwayat Versi</p>
                {loading ? (
                  <div className="space-y-2">
                    {[1,2,3].map(i => <div key={i} className="h-16 bg-foreground/5 animate-pulse rounded-2xl"/>)}
                  </div>
                ) : versions.length === 0 ? (
                  <div className="p-4 text-center border-2 border-dashed border-border rounded-2xl">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Belum ada versi</p>
                    <button onClick={() => handleCreateDraft()} className="mt-2 text-[10px] font-black text-primary uppercase underline">Buat Baseline</button>
                  </div>
                ) : (
                  versions.map(v => (
                    <div key={v.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => setSelectedVersion(v)}
                        className={`w-full text-left p-4 rounded-2xl border transition-all ${
                          selectedVersion?.id === v.id
                            ? 'bg-primary/5 border-primary shadow-sm shadow-primary/10'
                            : 'bg-card border-border hover:border-primary/30'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter ${
                            v.status === 'draft' ? 'bg-amber-500/20 text-amber-600' :
                            v.status === 'superseded' ? 'bg-gray-500/20 text-gray-600' :
                            'bg-green-500/20 text-green-600'
                          }`}>
                            {v.status}
                          </span>
                          <span className="text-[9px] font-bold text-muted-foreground">
                            {new Date(v.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs font-black text-foreground">
                          {v.status === 'published' && (v as any).qa_periods
                            ? `v${v.version_number} — Effective: ${formatPeriodLabel((v as any).qa_periods.month, (v as any).qa_periods.year)}`
                            : `v${v.version_number} — Rule Draft Version`}
                        </p>
                        <div className="flex items-center gap-2 mt-2 opacity-60 group-hover:opacity-100">
                          <Clock className="w-3 h-3"/>
                          <span className="text-[9px] font-bold uppercase">{v.scoring_mode} Mode</span>
                        </div>
                      </button>

                      {v.status === 'draft' && (
                        <button
                          type="button"
                          onClick={() => handleDeleteDraft(v.id)}
                          className="absolute bottom-3 right-3 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 className="w-3 h-3"/>
                        </button>
                      )}
                    </div>
                  ))
                )}
             </div>
          </div>
        </aside>

        {/* Main Content: Version Detail & Editor */}
        <section className="flex-1 overflow-y-auto bg-foreground/[0.01] p-4 lg:p-8">
          <AnimatePresence mode="wait">
            {selectedVersion ? (
              <motion.div
                key={selectedVersion.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-4xl mx-auto space-y-6"
              >
                {/* Status Banner */}
                {selectedVersion.status === 'published' ? (
                  <div className="bg-green-500/10 border border-green-500/20 rounded-3xl p-6 flex items-start gap-4">
                    <div className="w-12 h-12 bg-green-500/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                      <Check className="w-6 h-6 text-green-600"/>
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-green-700 dark:text-green-400">Versi Aktif (Published) v{selectedVersion.version_number}</h2>
                      <p className="text-sm text-green-600/80 font-medium leading-relaxed">
                        Versi ini bersifat <strong>immutable</strong> dan digunakan untuk kalkulasi periode {formatPeriodLabel((selectedVersion as any).qa_periods?.month, (selectedVersion as any).qa_periods?.year)} dan seterusnya hingga ada versi baru.
                      </p>
                    </div>
                  </div>
                ) : selectedVersion.status === 'superseded' ? (
                  <div className="bg-gray-500/10 border border-gray-500/20 rounded-3xl p-6 flex items-start gap-4">
                    <div className="w-12 h-12 bg-gray-500/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                      <History className="w-6 h-6 text-gray-600"/>
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-gray-700 dark:text-gray-400">Versi Lama (Superseded) v{selectedVersion.version_number}</h2>
                      <p className="text-sm text-gray-600/80 font-medium leading-relaxed">
                        Versi ini telah digantikan oleh versi yang lebih baru. Data historis yang menggunakan versi ini tetap dipertahankan.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-3xl p-6 flex items-start gap-4">
                    <div className="w-12 h-12 bg-amber-500/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                      <Pencil className="w-6 h-6 text-amber-600"/>
                    </div>
                    <div className="flex-1">
                      <h2 className="text-lg font-black text-amber-700 dark:text-amber-400">Draft Rules v{selectedVersion.version_number}</h2>
                      <p className="text-sm text-amber-600/80 font-medium leading-relaxed">
                        Anda dapat mengubah parameter dan bobot pada draft ini. Publish draft ini untuk menjadikannya rule efektif mulai bulan tertentu.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                       <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase">Tambah Parameter</button>
                    </div>
                  </div>
                )}

                {errorMsg && <QaStatePanel type="error" compact title={errorMsg} action={<button onClick={() => setErrorMsg(null)}>Tutup</button>}/>}
                {successMsg && (
                   <div className="bg-green-500 text-white px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2">
                      <Check className="w-4 h-4"/> {successMsg}
                   </div>
                )}

                {/* Weights & Mode Panel */}
                <div className="bg-card rounded-[2.5rem] border border-border p-8 shadow-sm space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                      <Settings className="w-4 h-4"/> Konfigurasi Bobot & Mode
                    </h3>
                    <div className="flex gap-2">
                       <span className="px-3 py-1 bg-foreground/5 border border-border rounded-full text-[10px] font-black uppercase">{selectedVersion.scoring_mode} Mode</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase text-muted-foreground px-1">Bobot Non-Critical</label>
                       <div className="flex items-center gap-3">
                          <input 
                            type="range" min="0" max="100" step="5"
                            disabled={!isDraft || selectedVersion.scoring_mode === 'no_category'}
                            value={selectedVersion.non_critical_weight * 100}
                            onChange={(e) => updateRuleDraftAction(selectedVersion.id, { 
                              non_critical_weight: parseInt(e.target.value) / 100,
                              critical_weight: (100 - parseInt(e.target.value)) / 100
                            }).then(v => setSelectedVersion(v))}
                            className="flex-1 accent-primary disabled:opacity-30"
                          />
                          <span className="w-12 text-center font-black text-sm">{Math.round(selectedVersion.non_critical_weight * 100)}%</span>
                       </div>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase text-muted-foreground px-1">Bobot Critical</label>
                       <div className="flex items-center gap-3">
                          <input 
                            type="range" min="0" max="100" step="5"
                            disabled={true} // Auto-calculated from NC
                            value={selectedVersion.critical_weight * 100}
                            className="flex-1 accent-red-500 opacity-50"
                          />
                          <span className="w-12 text-center font-black text-sm text-red-500">{Math.round(selectedVersion.critical_weight * 100)}%</span>
                       </div>
                    </div>
                  </div>
                  
                  {isDraft && (
                    <div className="flex gap-2 pt-4 border-t border-border">
                       <p className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                          <Info className="w-3 h-3"/> Geser slider untuk mengubah proporsi kontribusi antar kategori.
                       </p>
                    </div>
                  )}
                </div>

                {/* Parameters List */}
                <div className="space-y-4">
                  <h3 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground px-2">Daftar Parameter</h3>
                  
                  {loadingIndicators ? (
                    <div className="space-y-2">
                       {[1,2,3,4,5].map(i => <div key={i} className="h-14 bg-card animate-pulse rounded-2xl border border-border"/>)}
                    </div>
                  ) : (
                    <div className="bg-card rounded-[2.5rem] border border-border overflow-hidden shadow-sm divide-y divide-border">
                      {draftIndicators.length === 0 && (
                        <div className="p-12 text-center">
                           <Info className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4"/>
                           <p className="text-sm font-bold text-muted-foreground">Belum ada parameter di versi ini.</p>
                        </div>
                      )}
                      
                      {draftIndicators.map((ind) => (
                        <div key={ind.id} className="group p-4 lg:px-8 hover:bg-foreground/[0.01] transition-all flex items-center gap-4">
                           <div className="w-12 text-center flex-shrink-0">
                              <span className={`text-[10px] font-black px-2 py-1 rounded-lg border uppercase tracking-wider ${CAT_COLOR[ind.category as Category]}`}>
                                {Math.round(ind.bobot * 100)}%
                              </span>
                           </div>
                           <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-foreground truncate">{ind.name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md border uppercase tracking-widest ${CAT_COLOR[ind.category as Category]}`}>
                                  {CAT_LABEL[ind.category as Category].replace(' Error', '')}
                                </span>
                                {ind.has_na && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-foreground/5 text-muted-foreground border border-border">N/A</span>}
                              </div>
                           </div>
                           {isDraft && (
                             <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                <button 
                                  onClick={() => { setEditIndId(ind.id); setEditState({ name: ind.name, category: ind.category as Category, bobot: String(ind.bobot * 100), has_na: ind.has_na }); }}
                                  className="p-2 hover:bg-primary/10 text-muted-foreground hover:text-primary rounded-xl"
                                >
                                  <Pencil className="w-4 h-4"/>
                                </button>
                                <button 
                                  onClick={() => handleDeleteIndicator(ind.id)}
                                  className="p-2 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-xl"
                                >
                                  <Trash2 className="w-4 h-4"/>
                                </button>
                             </div>
                           )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <QaStatePanel type="loading" title="Pilih atau buat versi rules untuk melihat detail" />
              </div>
            )}
          </AnimatePresence>
        </section>
      </div>

      {/* Modals: Add, Edit, Publish */}
      <AnimatePresence>
        {showAddForm && (
           <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-background/80 backdrop-blur-md">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card w-full max-w-lg rounded-[2.5rem] p-8 border border-border shadow-2xl space-y-6">
                 <h2 className="text-xl font-black text-foreground uppercase tracking-widest flex items-center gap-3">
                    <Plus className="w-6 h-6 text-primary"/> Tambah Parameter
                 </h2>
                 <div className="space-y-4">
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black uppercase text-muted-foreground px-1">Nama Parameter</label>
                       <input value={newName} onChange={e => setNewName(e.target.value)} className="w-full px-4 py-4 rounded-2xl border border-border bg-foreground/5 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none" placeholder="Masukkan nama parameter..."/>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase text-muted-foreground px-1">Kategori</label>
                          <select value={newCategory} onChange={e => setNewCategory(e.target.value as Category)} className="w-full px-4 py-4 rounded-2xl border border-border bg-foreground/5 text-sm font-bold outline-none">
                             <option value="non_critical">Non-Critical</option>
                             <option value="critical">Critical</option>
                          </select>
                       </div>
                       <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase text-muted-foreground px-1">Bobot (%)</label>
                          <input type="number" value={newBobot} onChange={e => setNewBobot(e.target.value)} className="w-full px-4 py-4 rounded-2xl border border-border bg-foreground/5 text-sm font-bold outline-none"/>
                       </div>
                    </div>
                    <button onClick={() => setNewHasNa(!newHasNa)} className={`flex items-center justify-between w-full p-4 rounded-2xl border transition-all ${newHasNa ? 'bg-primary/10 border-primary/30' : 'bg-foreground/5 border-border'}`}>
                       <span className="text-xs font-black uppercase tracking-widest opacity-70">Bisa N/A</span>
                       <div className={`w-10 h-6 rounded-full flex items-center px-1 transition-all ${newHasNa ? 'bg-primary' : 'bg-foreground/20'}`}>
                          <div className={`w-4 h-4 bg-white rounded-full transition-transform ${newHasNa ? 'translate-x-4' : ''}`}/>
                       </div>
                    </button>
                 </div>
                 <div className="flex gap-2">
                    <button onClick={handleAddIndicator} disabled={savingNew} className="flex-1 py-4 bg-primary text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20">
                       {savingNew ? 'Menyimpan...' : 'Tambah Parameter'}
                    </button>
                    <button onClick={() => setShowForm(false)} className="px-8 py-4 bg-foreground/5 text-muted-foreground rounded-2xl text-xs font-black uppercase tracking-widest">Batal</button>
                 </div>
              </motion.div>
           </div>
        )}

        {previewVersion && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-background/80 backdrop-blur-md">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card w-full max-w-lg rounded-[2.5rem] p-8 border border-border shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
                 <div className="w-20 h-20 bg-green-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <Rocket className="w-10 h-10 text-green-600 animate-bounce"/>
                 </div>
                 <h2 className="text-xl font-black text-foreground text-center uppercase tracking-widest">Preview & Publish</h2>
                 
                 {/* Preview Info */}
                 <div className="space-y-3 bg-foreground/5 rounded-2xl p-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground font-medium">Service:</span>
                      <span className="font-black">{SERVICE_LABELS[previewVersion.service_type]}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground font-medium">Version:</span>
                      <span className="font-black">v{previewVersion.version_number}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground font-medium">Scoring Mode:</span>
                      <span className="font-black uppercase">{previewVersion.scoring_mode}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground font-medium">Total Parameter:</span>
                      <span className="font-black">{draftIndicators.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground font-medium">Critical Weight:</span>
                      <span className="font-black">{Math.round(previewVersion.critical_weight * 100)}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground font-medium">Non-Critical Weight:</span>
                      <span className="font-black">{Math.round(previewVersion.non_critical_weight * 100)}%</span>
                    </div>
                 </div>

                 {/* Indicator List */}
                 <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase text-muted-foreground">Parameter</p>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {draftIndicators.map(ind => (
                        <div key={ind.id} className="flex justify-between text-xs py-1 border-b border-border last:border-0">
                          <span className="font-medium">{ind.name}</span>
                          <span className="font-black">{Math.round(ind.bobot * 100)}% ({ind.category})</span>
                        </div>
                      ))}
                    </div>
                 </div>

                 {/* Change Reason (required for revisions) */}
                 {previewVersion.version_number > 1 && (
                   <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-muted-foreground px-1 block">
                        Alasan Revisi <span className="text-red-500">*</span>
                      </label>
                      <textarea 
                        value={changeReason}
                        onChange={e => setChangeReason(e.target.value)}
                        placeholder="Jelaskan mengapa parameter ini direvisi..."
                        className="w-full px-4 py-3 rounded-2xl border border-border bg-foreground/5 text-sm font-bold outline-none resize-none h-20"
                      />
                   </div>
                 )}

                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3">
                     <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5"/>
                     <p className="text-[10px] font-bold text-amber-700 leading-relaxed uppercase tracking-wider">
                        Setelah dipublish, rule ini tidak dapat diubah lagi (Immutable). Versi published sebelumnya akan menjadi superseded.
                     </p>
                  </div>

                  {/* Confirmation checkbox */}
                  <label className="flex items-center gap-3 p-4 rounded-2xl border border-border bg-foreground/5 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={publishConfirmed}
                      onChange={e => setPublishConfirmed(e.target.checked)}
                      className="w-5 h-5 accent-primary rounded"
                    />
                    <span className="text-xs font-bold text-foreground">
                      Saya telah meninjau parameter dan bobot di atas
                    </span>
                  </label>

                  <div className="flex flex-col gap-2">
                     <button 
                       onClick={handlePublish}
                       disabled={isPublishing || !publishConfirmed || (previewVersion.version_number > 1 && !changeReason.trim())}
                       className="w-full py-4 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-green-500/20 transition-all"
                     >
                        {isPublishing ? 'Mempublish...' : 'Ya, Publish Sekarang'}
                     </button>
                     <button onClick={() => { setPreviewVersion(null); setChangeReason(''); setPublishConfirmed(false); }} className="w-full py-4 bg-foreground/5 text-muted-foreground rounded-2xl text-xs font-black uppercase tracking-widest">Batal</button>
                  </div>
              </motion.div>
          </div>
        )}

        {editIndId && editState && (
           <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-background/80 backdrop-blur-md">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card w-full max-w-lg rounded-[2.5rem] p-8 border border-border shadow-2xl space-y-6">
                 <h2 className="text-xl font-black text-foreground uppercase tracking-widest flex items-center gap-3">
                    <Pencil className="w-6 h-6 text-primary"/> Edit Parameter
                 </h2>
                 <div className="space-y-4">
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black uppercase text-muted-foreground px-1">Nama Parameter</label>
                       <input value={editState.name} onChange={e => setEditState({...editState, name: e.target.value})} className="w-full px-4 py-4 rounded-2xl border border-border bg-foreground/5 text-sm font-bold outline-none"/>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase text-muted-foreground px-1">Kategori</label>
                          <select 
                            value={editState.category} 
                            disabled={selectedVersion?.scoring_mode === 'no_category'}
                            onChange={e => setEditState({...editState, category: e.target.value as Category})} 
                            className="w-full px-4 py-4 rounded-2xl border border-border bg-foreground/5 text-sm font-bold outline-none disabled:opacity-50"
                          >
                             <option value="non_critical">Non-Critical</option>
                             <option value="critical">Critical</option>
                             <option value="none">Semua Parameter</option>
                          </select>
                       </div>
                       <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase text-muted-foreground px-1">Bobot (%)</label>
                          <input type="number" value={editState.bobot} onChange={e => setEditState({...editState, bobot: e.target.value})} className="w-full px-4 py-4 rounded-2xl border border-border bg-foreground/5 text-sm font-bold outline-none"/>
                       </div>
                    </div>
                    <button onClick={() => setEditState({...editState, has_na: !editState.has_na})} className={`flex items-center justify-between w-full p-4 rounded-2xl border transition-all ${editState.has_na ? 'bg-primary/10 border-primary/30' : 'bg-foreground/5 border-border'}`}>
                       <span className="text-xs font-black uppercase tracking-widest opacity-70">Bisa N/A</span>
                       <div className={`w-10 h-6 rounded-full flex items-center px-1 transition-all ${editState.has_na ? 'bg-primary' : 'bg-foreground/20'}`}>
                          <div className={`w-4 h-4 bg-white rounded-full transition-transform ${editState.has_na ? 'translate-x-4' : ''}`}/>
                       </div>
                    </button>
                 </div>
                 <div className="flex gap-2">
                    <button onClick={handleSaveEditIndicator} className="flex-1 py-4 bg-primary text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20">Simpan Perubahan</button>
                    <button onClick={() => { setEditIndId(null); setEditState(null); }} className="px-8 py-4 bg-foreground/5 text-muted-foreground rounded-2xl text-xs font-black uppercase tracking-widest">Batal</button>
                 </div>
              </motion.div>
           </div>
        )}
      </AnimatePresence>
    </main>
  );
}
