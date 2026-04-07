'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Settings, Plus, Trash2, AlertCircle, X, Info,
  Pencil, Check, ArrowLeftRight, AlertTriangle, Menu
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  createIndicatorAction, updateIndicatorAction, deleteIndicatorAction,
  updateServiceWeightAction
} from '../actions';
import type { QAIndicator, ServiceType, Category, ScoringMode, ServiceWeight } from '../lib/qa-types';
import { SERVICE_LABELS } from '../lib/qa-types';

const TEAMS: ServiceType[] = ['call', 'chat', 'email', 'cso', 'pencatatan', 'bko', 'slik'];
const CAT_LABEL: Record<Category, string> = {
  non_critical: 'Non-Critical Error',
  critical: 'Critical Error',
  none: 'Semua Parameter',
};
const CAT_COLOR: Record<Category, string> = {
  non_critical: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20',
  critical: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20',
  none: 'bg-foreground/10 text-foreground/60 border-foreground/20',
};

interface EditState {
  id: string;
  name: string;
  category: Category;
  bobot: string;
  has_na: boolean;
}

interface QaSettingsClientProps {
  user: any;
  role: string;
  initialIndicators: QAIndicator[];
  initialWeights: Record<ServiceType, ServiceWeight>;
}

export default function QaSettingsClient({ user, role, initialIndicators, initialWeights }: QaSettingsClientProps) {
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeTeam, setActiveTeam] = useState<ServiceType>('call');
  const [indicators, setIndicators] = useState<QAIndicator[]>(initialIndicators);
  const [weights, setWeights] = useState(initialWeights);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Bobot Kontribusi state
  const [editingWeight, setEditingWeight] = useState(false);
  const [draftCr, setDraftCr] = useState('50');
  const [savingWeight, setSavingWeight] = useState(false);

  const activeWeight = weights[activeTeam];

  // Form tambah baru
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<Category>('non_critical');
  const [newBobot, setNewBobot] = useState('10');
  const [newHasNa, setNewHasNa] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit inline
  const [editState, setEditState] = useState<EditState | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [showMoveWarning, setShowMoveWarning] = useState(false);

  // Hapus
  const [confirmDelete, setConfirmDelete] = useState<QAIndicator | null>(null);
  const [deleting, setDeleting] = useState(false);

  const teamIndicators = indicators.filter(i => i.service_type === activeTeam);
  const nc = teamIndicators.filter(i => i.category === 'non_critical');
  const cr = teamIndicators.filter(i => i.category === 'critical');
  const ncTotal = nc.reduce((s, i) => s + Number(i.bobot), 0);
  const crTotal = cr.reduce((s, i) => s + Number(i.bobot), 0);

  const isWeighted    = activeWeight.scoring_mode === 'weighted';
  const isFlat        = activeWeight.scoring_mode === 'flat';
  const isNoCategory  = activeWeight.scoring_mode === 'no_category';

  const ncValid  = Math.abs(ncTotal - 1) < 0.01;
  const crValid  = Math.abs(crTotal - 1) < 0.01;
  const allTotal = ncTotal + crTotal;
  const allValid = Math.abs(allTotal - 1) < 0.01;

  const isBobotsValid = isWeighted ? (ncValid && crValid) : allValid;

  const flash = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const previewTotals = (edit: EditState) => {
    const orig = indicators.find(i => i.id === edit.id)!;
    const bobotNew = parseFloat(edit.bobot) / 100;
    
    // Filter to current team only for accurate preview
    const currentTeamInds = indicators.filter(i => i.service_type === activeTeam);
    const ncTeam = currentTeamInds.filter(i => i.category === 'non_critical');
    const crTeam = currentTeamInds.filter(i => i.category === 'critical');
    
    let pNc = ncTeam.reduce((s, i) => s + Number(i.bobot), 0);
    let pCr = crTeam.reduce((s, i) => s + Number(i.bobot), 0);

    if (orig.category === 'non_critical') pNc -= Number(orig.bobot); else pCr -= Number(orig.bobot);
    if (edit.category === 'non_critical') pNc += bobotNew; else pCr += bobotNew;
    
    return { pNc: Math.round(pNc * 100), pCr: Math.round(pCr * 100) };
  };

  const handleAdd = async () => {
    const bobotVal = parseFloat(newBobot) / 100;
    if (!newName.trim()) return setErrorMsg('Nama indikator wajib diisi.');
    if (isNaN(bobotVal) || bobotVal <= 0) return setErrorMsg('Bobot harus lebih dari 0%.');
    
    // Auto set category for No Category mode
    const cat = isNoCategory ? 'none' : newCategory;
    
    setSaving(true);
    setErrorMsg(null);
    try {
      const created = await createIndicatorAction(activeTeam, newName.trim(), cat, bobotVal, newHasNa);
      setIndicators(prev => [...prev, created]);
      setNewName('');
      setNewBobot('10');
      setNewHasNa(false);
      setShowForm(false);
      flash('Parameter berhasil ditambahkan!');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWeights = async () => {
    const crVal = parseInt(draftCr) / 100;
    const ncVal = (100 - parseInt(draftCr)) / 100;
    setSavingWeight(true);
    setErrorMsg(null);
    try {
      const updated = await updateServiceWeightAction(activeTeam, crVal, ncVal, activeWeight.scoring_mode);
      setWeights(prev => ({ ...prev, [activeTeam]: updated }));
      setEditingWeight(false);
      flash('Bobot kontribusi berhasil diperbarui!');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSavingWeight(false);
    }
  };

  const startEdit = (ind: QAIndicator) => {
    setEditState({
      id: ind.id,
      name: ind.name,
      category: ind.category,
      bobot: String(Math.round(Number(ind.bobot) * 100)),
      has_na: ind.has_na ?? false,
    });
    setShowMoveWarning(false);
    setConfirmDelete(null);
    setErrorMsg(null);
  };

  const cancelEdit = () => {
    setEditState(null);
    setShowMoveWarning(false);
  };

  const handleSaveEdit = async () => {
    if (!editState) return;
    const bobotVal = parseFloat(editState.bobot) / 100;
    if (!editState.name.trim()) return setErrorMsg('Nama tidak boleh kosong.');
    if (isNaN(bobotVal) || bobotVal <= 0 || bobotVal > 1)
      return setErrorMsg('Bobot harus antara 1–100%.');

    const orig = indicators.find(i => i.id === editState.id)!;
    const categoryChanged = orig.category !== editState.category;

    if (categoryChanged && !showMoveWarning) {
      setShowMoveWarning(true);
      return;
    }

    setSavingEdit(true);
    setErrorMsg(null);
    try {
      const updated = await updateIndicatorAction(editState.id, {
        name: editState.name.trim(),
        category: editState.category,
        bobot: bobotVal,
        has_na: editState.has_na,
      });
      setIndicators(prev => prev.map(i => i.id === updated.id ? updated : i));
      setEditState(null);
      setShowMoveWarning(false);
      flash(categoryChanged
        ? `Parameter dipindahkan ke ${CAT_LABEL[editState.category]}!`
        : 'Parameter berhasil diperbarui!');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    setErrorMsg(null);
    try {
      await deleteIndicatorAction(confirmDelete.id);
      setIndicators(prev => prev.filter(i => i.id !== confirmDelete.id));
      setConfirmDelete(null);
      flash('Parameter dihapus.');
    } catch (err: any) {
      setErrorMsg(err.message);
      setConfirmDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const IndicatorRow = ({ ind, idx }: { ind: QAIndicator; idx: number }) => {
    const isEditing = editState?.id === ind.id;
    const preview = isEditing && editState ? previewTotals(editState) : null;
    const origCat = indicators.find(i => i.id === ind.id)?.category;
    const catChanged = isEditing && editState && editState.category !== origCat;

    return (
      <div className={idx !== 0 ? 'border-t border-border' : ''}>
        <AnimatePresence mode="wait">
          {!isEditing ? (
            <motion.div
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-4 px-5 py-4 group hover:bg-foreground/[0.02] transition-colors"
            >
              <div className="w-14 flex-shrink-0 text-center">
                <span className={`text-[11px] font-black px-2 py-1 rounded-lg border uppercase tracking-wider ${CAT_COLOR[ind.category]}`}>
                  {Math.round(Number(ind.bobot) * 100)}%
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{ind.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md border uppercase tracking-widest ${CAT_COLOR[ind.category]}`}>
                    {CAT_LABEL[ind.category].replace(' Error', '')}
                  </span>
                  {ind.has_na && (
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-foreground/5 text-foreground/40 border border-border uppercase tracking-widest flex items-center gap-1">
                      N/A 
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                <button
                  onClick={() => startEdit(ind)}
                  className="p-2 rounded-xl text-foreground/20 hover:text-primary hover:bg-primary/10 transition-colors"
                  aria-label="Edit parameter"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { setErrorMsg(null); setConfirmDelete(ind); }}
                  className="p-2 rounded-xl text-foreground/20 hover:text-destructive hover:bg-destructive/10 transition-colors"
                  aria-label="Hapus parameter"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              layout
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="px-5 py-6 bg-primary/[0.03] space-y-4 overflow-hidden"
            >
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-[0.1em] text-foreground/40 px-1">Nama Parameter</label>
                <input
                  value={editState!.name}
                  onChange={e => setEditState(s => s && ({ ...s, name: e.target.value }))}
                  className="w-full px-4 py-3 rounded-2xl border border-border bg-card text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                  placeholder="Nama indikator..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-[0.1em] text-foreground/40 px-1">Kategori</label>
                  {!isNoCategory && (
                    <div className="flex gap-1.5 p-1 bg-foreground/5 rounded-2xl border border-border">
                      {(['non_critical', 'critical'] as Category[]).map(cat => (
                        <button key={cat} type="button"
                          onClick={() => { setEditState(s => s && ({ ...s, category: cat })); setShowMoveWarning(false); }}
                          className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                            editState!.category === cat
                              ? cat === 'critical'
                                ? 'bg-red-500 text-white border-red-600 shadow-md shadow-red-500/20'
                                : 'bg-blue-500 text-white border-blue-600 shadow-md shadow-blue-500/20'
                              : 'bg-transparent text-foreground/40 border-transparent hover:text-foreground/60'
                          }`}>
                          {cat === 'critical' ? 'Critical' : 'Non-Crit'}
                        </button>
                      ))}
                    </div>
                  )}
                  {isNoCategory && (
                    <div className="px-4 py-3 bg-foreground/5 rounded-2xl border border-border text-[10px] font-black uppercase text-foreground/40">
                      Otomatis: Semua Parameter
                    </div>
                  )}
                  {catChanged && (
                    <div className="mt-2 flex items-center gap-1.5 text-amber-500 px-1">
                      <ArrowLeftRight className="w-3.5 h-3.5"/>
                      <span className="text-[10px] font-bold uppercase tracking-wide">Akan dipindah kategori</span>
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-[0.1em] text-foreground/40 px-1">
                    Bobot (%)
                  </label>
                  <div className="relative">
                    <input type="number" min={1} max={100}
                      value={editState!.bobot}
                      onChange={e => setEditState(s => s && ({ ...s, bobot: e.target.value }))}
                      className="w-full pl-4 pr-10 py-3 rounded-2xl border border-border bg-card text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-foreground/30">%</span>
                  </div>
                  {preview && !isNoCategory && (
                    <div className="mt-2 text-[9px] font-black uppercase tracking-[0.05em] text-foreground/30 px-1 flex justify-between">
                      <span>Preview NC: <span className={preview.pNc === 100 ? 'text-green-500' : 'text-amber-500'}>{preview.pNc}%</span></span>
                      <span>Preview CR: <span className={preview.pCr === 100 ? 'text-green-500' : 'text-amber-500'}>{preview.pCr}%</span></span>
                    </div>
                  )}
                  {preview && isNoCategory && (
                    <div className="mt-2 text-[9px] font-black uppercase tracking-[0.05em] text-foreground/30 px-1">
                      Preview Total: <span className={allValid ? 'text-green-500' : 'text-amber-500'}>{preview.pNc + preview.pCr}%</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <button type="button"
                  onClick={() => setEditState(s => s && ({ ...s, has_na: !s.has_na }))}
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl border text-left transition-all flex-1 ${
                    editState!.has_na
                      ? 'bg-primary/5 border-primary/20'
                      : 'bg-card border-border'
                  }`}>
                  <div className={`w-9 h-5 rounded-full flex items-center px-0.5 transition-all ${editState!.has_na ? 'bg-primary' : 'bg-foreground/10'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${editState!.has_na ? 'translate-x-4' : 'translate-x-0'}`}/>
                  </div>
                  <span className="text-xs font-bold text-foreground/70">Bisa N/A</span>
                </button>
              </div>

              {showMoveWarning && (
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex items-start gap-3 px-4 py-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5"/>
                  <div className="flex-1 text-[11px] text-amber-700 dark:text-amber-400 font-medium leading-relaxed">
                    <p className="font-bold uppercase tracking-widest text-[10px] mb-1">Konfirmasi pindah kategori</p>
                    Perubahan ini akan memengaruhi kalkulasi skor <strong>semua periode</strong>. Lanjutkan?
                  </div>
                </motion.div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleSaveEdit}
                  disabled={savingEdit}
                  className="flex-1 py-3.5 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/20"
                >
                  {savingEdit ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  {savingEdit ? 'Menyimpan...' : showMoveWarning ? 'Ya, Pindahkan & Simpan' : 'Simpan Perubahan'}
                </button>
                <button
                  onClick={cancelEdit}
                  disabled={savingEdit}
                  className="px-6 py-3.5 bg-foreground/5 hover:bg-foreground/10 text-foreground/40 rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
                >
                  Batal
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const SectionCard = ({ title, color, list, total, catName }: {
    title: string; color: string; list: QAIndicator[]; total: number; catName: string;
  }) => {
    const pct = Math.round(total * 100);
    const isOk = Math.abs(total - 1) < 0.01;
    const warningBobot = isWeighted
      ? `Total bobot ${catName}: ${pct}%. Harus tepat 100%.`
      : `Total semua parameter: ${Math.round(allTotal * 100)}%. Harus tepat 100%.`;
    return (
      <div className="bg-card rounded-3xl border border-border overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-foreground/[0.01]">
          <div>
            <div className="flex items-center gap-2.5">
              <div className={`w-2.5 h-2.5 rounded-full ${color} shadow-sm shadow-current/20`}/>
              <p className="text-sm font-black text-foreground uppercase tracking-wider">{title}</p>
              <span className="text-[10px] font-bold text-foreground/40 bg-foreground/5 px-2 py-0.5 rounded-full">{list.length}</span>
            </div>
            <p className="text-[10px] text-foreground/30 font-bold uppercase tracking-widest mt-1.5 ml-5">
              {isWeighted ? 'Kontribusi ke skor akhir' : 'Bobot langsung ke skor akhir'}
            </p>
          </div>
          <div className="text-right">
            <span className={`text-xs font-black px-3 py-1.5 rounded-xl border-2 transition-colors ${
              isOk
                ? 'bg-green-500/10 text-green-600 border-green-500/20'
                : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
            }`}>{pct}%</span>
            {!isOk && <p className="text-[9px] font-black uppercase tracking-widest text-amber-500 mt-2">{pct < 100 ? `kurang ${100 - pct}%` : `lebih ${pct - 100}%`}</p>}
          </div>
        </div>

        {!isOk && (
          <div className="mx-6 mt-4 flex items-center gap-3 px-4 py-3 bg-amber-500/5 border border-amber-500/20 rounded-2xl">
            <Info className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium leading-relaxed">
              {warningBobot} Sebaiknya tepat 100% untuk akurasi penilaian.
            </p>
          </div>
        )}

        <div className="mt-2">
          {list.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-12 h-12 bg-foreground/5 rounded-2xl flex items-center justify-center mx-auto mb-3 opacity-20">
                <Settings className="w-6 h-6" />
              </div>
              <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest">Belum ada parameter</p>
            </div>
          ) : (
            list.map((ind, i) => <IndicatorRow key={ind.id} ind={ind} idx={i}/>)
          )}
        </div>
        {!isOk && <div className="h-4"/>}
      </div>
    );
  };

  return (
    <>
      <main className="flex-1 flex flex-col overflow-hidden bg-background">
        <header className="h-16 flex items-center justify-between px-4 lg:px-8 bg-card/50 backdrop-blur-xl border-b border-border sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-foreground/5 text-foreground/60"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                <Settings className="w-4 h-4 text-primary-foreground"/>
              </div>
              <h1 className="text-lg font-bold text-foreground">Kelola Parameter</h1>
            </div>
          </div>
          
          <button
            onClick={() => { setShowForm(!showForm); setErrorMsg(null); cancelEdit(); }}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-primary/20 active:scale-[0.98]"
          >
            <Plus className="w-3.5 h-3.5"/>
            {showForm ? 'Tutup' : 'Tambah'}
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 lg:px-8 py-8 space-y-6">
          <div className="flex gap-1.5 p-1 bg-card rounded-2xl border border-border shadow-sm overflow-x-auto">
            {TEAMS.map(team => (
              <button key={team}
                onClick={() => { 
                  setActiveTeam(team); 
                  setShowForm(false); 
                  setErrorMsg(null); 
                  cancelEdit(); 
                  setConfirmDelete(null); 
                  setEditingWeight(false);
                }}
                className={`flex-none px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                  activeTeam === team
                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                    : 'text-foreground/40 hover:text-foreground/60 hover:bg-foreground/5'
                }`}>
                {SERVICE_LABELS[team] || team}
              </button>
            ))}
          </div>

          <AnimatePresence>
            {errorMsg && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-2xl overflow-hidden"
              >
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0"/>
                <p className="text-xs text-red-500 flex-1 font-bold leading-relaxed">{errorMsg}</p>
                <button onClick={() => setErrorMsg(null)} aria-label="Tutup error">
                  <X className="w-4 h-4 text-red-400 hover:text-red-500 transition-colors"/>
                </button>
              </motion.div>
            )}
            {successMsg && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="flex items-center gap-3 px-4 py-3 bg-green-500/10 border border-green-500/20 rounded-2xl overflow-hidden"
              >
                <Check className="w-4 h-4 text-green-500 flex-shrink-0"/>
                <p className="text-xs text-green-600 dark:text-green-400 font-bold leading-relaxed">{successMsg}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="bg-primary/[0.03] border border-primary/10 rounded-[2rem] p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-primary" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Sistem Penilaian: {activeWeight.scoring_mode.replace('_', ' ')}</p>
              </div>
              {!isNoCategory && !editingWeight && (
                <button 
                  onClick={() => {
                    setDraftCr(String(Math.round(activeWeight.critical_weight * 100)));
                    setEditingWeight(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl text-[10px] font-black uppercase transition-all"
                >
                  <Pencil className="w-3 h-3" /> Edit Bobot Kontribusi
                </button>
              )}
            </div>

            {editingWeight ? (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="flex justify-between text-[10px] font-black uppercase tracking-wider">
                  <span className="text-blue-500">Non-Critical: {100 - parseInt(draftCr)}%</span>
                  <span className="text-red-500">Critical: {draftCr}%</span>
                </div>
                <input 
                  type="range" min={1} max={99} value={draftCr}
                  onChange={e => setDraftCr(e.target.value)}
                  className="w-full h-2 bg-foreground/10 rounded-lg appearance-none cursor-pointer accent-red-500" 
                />
                <div className="flex rounded-xl overflow-hidden h-10 text-[10px] font-black shadow-inner">
                  <div className="bg-blue-500 flex items-center justify-center text-white transition-all duration-300"
                       style={{ width: `${100 - parseInt(draftCr)}%` }}>
                    NC {100 - parseInt(draftCr)}%
                  </div>
                  <div className="bg-red-500 flex items-center justify-center text-white transition-all duration-300"
                       style={{ width: `${draftCr}%` }}>
                    CR {draftCr}%
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={handleSaveWeights}
                    disabled={savingWeight}
                    className="flex-1 py-3 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
                  >
                    {savingWeight ? 'Menyimpan...' : 'Simpan Bobot'}
                  </button>
                  <button 
                    onClick={() => setEditingWeight(false)}
                    className="px-6 py-3 bg-foreground/5 text-foreground/40 rounded-2xl text-[10px] font-black uppercase tracking-widest"
                  >
                    Batal
                  </button>
                </div>
              </motion.div>
            ) : (
              <div className="grid grid-cols-2 gap-4 text-xs">
                {isWeighted && (
                  <>
                    <div className="bg-card rounded-2xl p-4 border border-border shadow-sm">
                      <p className="text-[9px] font-black uppercase tracking-widest text-blue-500 mb-2">Non-Critical</p>
                      <div className="flex items-baseline gap-1.5">
                        <span className={`text-2xl font-black ${ncValid ? 'text-foreground' : 'text-amber-500'}`}>{Math.round(ncTotal * 100)}%</span>
                        <span className="text-[10px] font-bold text-foreground/30">/ 100%</span>
                      </div>
                      <p className="text-[9px] font-bold text-foreground/40 mt-2 uppercase tracking-tight">Kontribusi {Math.round(activeWeight.non_critical_weight * 100)}% skor akhir</p>
                    </div>
                    <div className="bg-card rounded-2xl p-4 border border-border shadow-sm">
                      <p className="text-[9px] font-black uppercase tracking-widest text-red-500 mb-2">Critical</p>
                      <div className="flex items-baseline gap-1.5">
                        <span className={`text-2xl font-black ${crValid ? 'text-foreground' : 'text-amber-500'}`}>{Math.round(crTotal * 100)}%</span>
                        <span className="text-[10px] font-bold text-foreground/30">/ 100%</span>
                      </div>
                      <p className="text-[9px] font-bold text-foreground/40 mt-2 uppercase tracking-tight">Kontribusi {Math.round(activeWeight.critical_weight * 100)}% skor akhir</p>
                    </div>
                  </>
                )}

                {isFlat && (
                  <div className="col-span-2 space-y-3">
                    <div className="flex rounded-xl overflow-hidden h-10 text-xs font-black shadow-inner">
                      <div className="bg-blue-500 flex items-center justify-center text-white transition-all"
                           style={{ width: `${Math.round(ncTotal * 100)}%` }}>
                        NC {Math.round(ncTotal * 100)}%
                      </div>
                      <div className="bg-red-500 flex items-center justify-center text-white transition-all"
                           style={{ width: `${Math.round(crTotal * 100)}%` }}>
                        CR {Math.round(crTotal * 100)}%
                      </div>
                    </div>
                    <p className="text-[9px] font-bold text-foreground/40 uppercase tracking-widest text-center">
                      Bobot Langsung ke Skor Akhir — Total harus 100%
                    </p>
                  </div>
                )}

                {isNoCategory && (
                  <div className="col-span-2 bg-card rounded-2xl p-4 border border-border shadow-sm">
                    <p className="text-[9px] font-black uppercase tracking-widest text-foreground/40 mb-2">Semua Parameter</p>
                    <div className="flex items-baseline gap-1.5">
                      <span className={`text-2xl font-black ${allValid ? 'text-foreground' : 'text-amber-500'}`}>{Math.round(allTotal * 100)}%</span>
                      <span className="text-[10px] font-bold text-foreground/30">/ 100%</span>
                    </div>
                    <p className="text-[9px] font-bold text-foreground/40 mt-2 uppercase tracking-tight">Tidak menggunakan kategori Critical / Non-Critical</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <AnimatePresence>
            {showForm && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="bg-card rounded-3xl border-2 border-primary/20 p-6 space-y-5 shadow-xl shadow-primary/5 overflow-hidden"
              >
                <p className="text-sm font-black text-foreground uppercase tracking-widest">Tambah Parameter Baru</p>
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-foreground/40 px-1">Nama Parameter</label>
                  <input
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="Contoh: Salam Pembuka & Perkenalan..."
                    className="w-full px-4 py-3.5 rounded-2xl border border-border bg-foreground/[0.02] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {!isNoCategory && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-foreground/40 px-1">Kategori</label>
                      <select
                        value={newCategory}
                        onChange={e => setNewCategory(e.target.value as Category)}
                        className="w-full px-4 py-3.5 rounded-2xl border border-border bg-foreground/[0.02] text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none cursor-pointer"
                      >
                        <option value="non_critical">Non-Critical Error</option>
                        <option value="critical">Critical Error</option>
                      </select>
                    </div>
                  )}
                  {isNoCategory && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-foreground/40 px-1">Kategori</label>
                      <div className="w-full px-4 py-3.5 rounded-2xl border border-border bg-foreground/[0.1] text-xs font-black uppercase tracking-widest text-foreground/40 flex items-center">
                        Semua Parameter
                      </div>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-foreground/40 px-1">Bobot (%)</label>
                    <div className="relative">
                      <input
                        type="number" min={1} max={100} value={newBobot}
                        onChange={e => setNewBobot(e.target.value)}
                        className="w-full pl-4 pr-10 py-3.5 rounded-2xl border border-border bg-foreground/[0.02] text-sm font-black focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-foreground/30">%</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setNewHasNa(!newHasNa)}
                  className={`flex items-center gap-4 w-full px-4 py-4 rounded-2xl border transition-all text-left group ${
                    newHasNa ? 'bg-primary/5 border-primary/20' : 'bg-foreground/[0.02] border-border'
                  }`}
                >
                  <div className={`w-10 h-6 rounded-full transition-all flex items-center px-1 ${newHasNa ? 'bg-primary' : 'bg-foreground/10'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full shadow-md transition-transform ${newHasNa ? 'translate-x-4' : 'translate-x-0'}`}/>
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-foreground/70">Dapat Dikecualikan (N/A)</p>
                    <p className="text-[10px] text-foreground/40 font-bold uppercase tracking-tight mt-0.5">Bisa dilewati jika tidak berlaku dalam sesi</p>
                  </div>
                </button>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleAdd}
                    disabled={saving}
                    className="flex-1 py-4 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/20"
                  >
                    {saving ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Check className="w-5 h-5" />
                    )}
                    {saving ? 'Menyimpan...' : 'Simpan Parameter'}
                  </button>
                  <button
                    onClick={() => { setShowForm(false); setErrorMsg(null); }}
                    disabled={saving}
                    className="px-6 py-4 bg-foreground/5 hover:bg-foreground/10 text-foreground/40 rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
                  >
                    Batal
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-8 pb-12">
            {isNoCategory ? (
              <SectionCard title="Semua Parameter" color="bg-foreground" list={teamIndicators} total={allTotal} catName="Semua" />
            ) : (
              <>
                <SectionCard title="Non-Critical Error" color="bg-blue-500" list={nc} total={ncTotal} catName="Non-Critical" />
                <SectionCard title="Critical Error" color="bg-red-500" list={cr} total={crTotal} catName="Critical" />
              </>
            )}
          </div>
        </div>
      </main>

      <AnimatePresence>
        {confirmDelete && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-background/80 backdrop-blur-md"
            onClick={() => !deleting && setConfirmDelete(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-card w-full max-w-sm rounded-[2.5rem] p-8 border border-border shadow-2xl overflow-hidden relative"
              onClick={e => e.stopPropagation()}
            >
              <div className="absolute top-0 left-0 w-full h-1.5 bg-destructive" />
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 bg-destructive/10 rounded-3xl flex items-center justify-center shadow-inner relative group">
                  <Trash2 className="w-10 h-10 text-destructive transition-transform group-hover:scale-110" />
                </div>
              </div>
              <h3 className="text-xl font-black text-foreground text-center mb-3">Hapus Parameter?</h3>
              <div className="px-6 py-3 bg-foreground/5 rounded-2xl mx-auto w-full mb-5 border border-border/50">
                 <p className="text-[11px] font-black text-foreground/60 uppercase tracking-[0.15em] text-center leading-relaxed">
                  {confirmDelete.name}
                </p>
              </div>
              <p className="text-xs text-foreground/40 text-center mb-8 font-medium leading-relaxed px-2">
                Parameter yang sudah memiliki data temuan di periode manapun <strong>tidak dapat dihapus</strong>. Pastikan tidak ada data terkait sebelum melanjutkan.
              </p>
              <div className="flex flex-col gap-2.5">
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="w-full py-4.5 bg-destructive hover:bg-red-600 disabled:opacity-50 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-xl shadow-destructive/20 active:scale-[0.98]"
                >
                  {deleting ? 'Menghapus...' : 'Ya, Hapus Permanen'}
                </button>
                <button
                  onClick={() => setConfirmDelete(null)}
                  disabled={deleting}
                  className="w-full py-4.5 bg-foreground/5 hover:bg-foreground/10 text-foreground/50 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all"
                >
                  Batal
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
