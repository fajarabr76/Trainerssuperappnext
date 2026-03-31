'use client';

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Plus, X, Save, Trash2, Upload,
  Loader2, FolderInput, Check, GripVertical, ArrowUpDown,
  Download, ChevronDown, Activity,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Peserta, Jabatan, labelJabatan } from '../../lib/profiler-types';
import { ProfilerYear, ProfilerFolder } from '../../services/profilerService';
import { uploadFoto } from '../../services/profilerService';
import { 
  updatePeserta, 
  deletePeserta, 
  getTimList,
  getOriginalPeserta
} from '../../actions';

const inputClass = "w-full px-4 py-3 rounded-xl border border-border/40 bg-background text-sm text-foreground placeholder-foreground/20 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background";
const labelClass = "block text-[10px] font-bold uppercase tracking-widest text-foreground/40 mb-2 px-1";
const sectionClass = "bg-card border border-border/40 rounded-[2rem] p-6 space-y-6 shadow-sm";

// ── Move Folder Modal ─────────────────────────────────────────
const MoveFolderModal: React.FC<{
  selectedIds: string[];
  currentBatch: string;
  folders: ProfilerFolder[];
  years: ProfilerYear[];
  onClose: () => void;
  onMoved: (ids: string[], targetFolder: string) => void;
}> = ({ selectedIds, currentBatch, folders, years, onClose, onMoved }) => {
  const [targetFolder, setTargetFolder] = useState('');
  const [moving, setMoving] = useState(false);

  const handleMove = async () => {
    if (!targetFolder) return;
    setMoving(true);
    try {
      await Promise.all(selectedIds.map(id => updatePeserta(id, { batch_name: targetFolder })));
      onMoved(selectedIds, targetFolder);
      onClose();
    } catch (err: any) {
      alert('Gagal memindahkan: ' + err.message);
    } finally { 
      setMoving(false); 
    }
  };

  const otherFolders = folders.filter(f => f.name !== currentBatch);

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-background/80 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-card w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl border border-border/40 overflow-hidden shadow-2xl">
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-border rounded-full" />
        </div>
        <div className="px-5 pt-5 pb-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-foreground tracking-tight">Pindah ke Folder</h2>
              <p className="text-xs text-foreground/40 mt-0.5">{selectedIds.length} peserta dipilih</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center hover:bg-muted rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X className="w-4 h-4 text-foreground/40" /></button>
          </div>
          
          {otherFolders.length === 0 ? (
            <div className="text-center py-6 bg-muted/30 rounded-2xl border border-border/40">
              <p className="text-sm text-foreground/60">Tidak ada folder lain.</p>
              <p className="text-xs text-foreground/40 mt-1">Buat folder baru di halaman Profiler.</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
              {years.map(year => {
                const yearFolders = otherFolders.filter(f => f.year_id === year.id && !f.parent_id);
                if (yearFolders.length === 0) return null;
                
                return (
                  <div key={year.id} className="space-y-2">
                    <p className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest px-1">{year.label}</p>
                    <div className="space-y-1">
                      {yearFolders.map(folder => {
                        const subFolders = otherFolders.filter(f => f.parent_id === folder.id);
                        return (
                          <div key={folder.id} className="space-y-1">
                            <button onClick={() => setTargetFolder(folder.name)}
                              className={`w-full flex items-center justify-between px-4 py-3 rounded-[1.25rem] border transition-all text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                targetFolder === folder.name
                                  ? 'border-primary bg-primary/5 shadow-sm'
                                  : 'border-border/40 hover:border-primary/30 bg-background'
                              }`}>
                              <span className={`text-sm font-bold tracking-tight ${targetFolder === folder.name ? 'text-primary' : 'text-foreground'}`}>{folder.name}</span>
                              {targetFolder === folder.name && <div className="w-4 h-4 bg-primary rounded-full flex items-center justify-center"><Check className="w-2.5 h-2.5 text-primary-foreground" /></div>}
                            </button>
                            
                            {subFolders.map(sub => (
                              <button key={sub.id} onClick={() => setTargetFolder(sub.name)}
                                className={`w-full flex items-center justify-between px-4 py-3 rounded-[1.25rem] border transition-all text-left ml-4 w-[calc(100%-1rem)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                  targetFolder === sub.name
                                    ? 'border-primary bg-primary/5 shadow-sm'
                                    : 'border-border/40 hover:border-primary/30 bg-background'
                                }`}>
                                <span className={`text-sm font-bold tracking-tight ${targetFolder === sub.name ? 'text-primary' : 'text-foreground'}`}>{sub.name}</span>
                                {targetFolder === sub.name && <div className="w-4 h-4 bg-primary rounded-full flex items-center justify-center"><Check className="w-2.5 h-2.5 text-primary-foreground" /></div>}
                              </button>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          <div className="space-y-2 pt-1 border-t border-border/40">
            <button onClick={handleMove} disabled={!targetFolder || moving}
              className="w-full py-4 bg-primary hover:opacity-90 disabled:opacity-50 text-primary-foreground rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-md shadow-primary/10 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background">
              {moving ? <><Loader2 className="w-4 h-4 animate-spin" />Memindahkan...</> : <><FolderInput className="w-4 h-4" />Pindahkan ke &quot;{targetFolder || '...'}&quot;</>}
            </button>
            <button onClick={onClose} className="w-full py-3 bg-muted/50 hover:bg-muted text-foreground/60 rounded-2xl text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Batal</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── EditModal ─────────────────────────────────────────────────
const EditModal: React.FC<{
  peserta: Peserta;
  timList: string[];
  onClose: () => void;
  onSaved: (updated: Peserta) => void;
  onDeleted: (id: string) => void;
  isReadOnly?: boolean;
}> = ({ peserta, timList, onClose, onSaved, onDeleted, isReadOnly }) => {
  const [form, setForm] = useState<Peserta>({ ...peserta });
  const [saving, setSaving] = useState(false);
  const [fotoPreview, setFotoPreview] = useState<string>(peserta.foto_url || '');
  const [uploadingFoto, setUploadingFoto] = useState(false);

  const [loadingRealData, setLoadingRealData] = useState(false);

  useEffect(() => {
    async function fetchOriginal() {
      if (!peserta.id) return;
      // Since masking is now disabled at the server level, we don't need to re-fetch
      // unless specifically needed for other reasons.
    }
    fetchOriginal();
  }, [peserta.id]);

  const set = (key: keyof Peserta, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  const handleFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !form.id) return;
    setFotoPreview(URL.createObjectURL(file));
    setUploadingFoto(true);
    try {
      const url = await uploadFoto(file, form.id);
      await updatePeserta(form.id, { foto_url: url });
      setForm(prev => ({ ...prev, foto_url: url }));
    } catch (err: any) { alert('Gagal upload foto: ' + err.message); }
    finally { setUploadingFoto(false); }
  };

  const handleSave = async () => {
    if (!form.nama?.trim()) { alert('Nama wajib diisi.'); return; }
    setSaving(true);
    try {
      await updatePeserta(form.id!, form);
      onSaved(form); 
      onClose();
    } catch (err: any) { alert('Gagal simpan: ' + err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirm(`Hapus ${form.nama}?`)) return;
    await deletePeserta(form.id!);
    onDeleted(form.id!); 
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/80 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-card w-full sm:max-w-2xl sm:rounded-3xl rounded-t-3xl border border-border/40 overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border/40 shrink-0">
          <h2 className="text-base font-bold tracking-tight text-foreground">Edit Peserta</h2>
          <div className="flex items-center gap-2">
            {!isReadOnly && (
              <>
                <button onClick={handleDelete} className="flex items-center gap-1.5 px-3 py-1.5 text-destructive hover:bg-destructive/10 rounded-xl text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"><Trash2 className="w-3.5 h-3.5" /> Hapus</button>
                <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-1.5 bg-primary hover:opacity-90 disabled:opacity-50 text-primary-foreground rounded-xl text-xs font-bold shadow-md shadow-primary/10 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Save className="w-3.5 h-3.5" />{saving ? 'Menyimpan...' : 'Simpan'}</button>
              </>
            )}
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center hover:bg-muted rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X className="w-4 h-4 text-foreground/40" /></button>
          </div>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-6 space-y-6 custom-scrollbar">
          <div className={sectionClass}>
            <p className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest pl-1 mb-3">Identitas Utama</p>
            <div className="flex items-center gap-4 mb-4">
              <div className="relative w-20 h-20 rounded-[1.25rem] bg-muted/30 border border-border/40 overflow-hidden flex items-center justify-center shrink-0">
                {uploadingFoto ? <Loader2 className="w-6 h-6 text-primary animate-spin" /> : fotoPreview ? <div className="relative w-full h-full"><Image src={fotoPreview} alt="Preview" fill className="object-cover" unoptimized /></div> : <Upload className="w-6 h-6 text-foreground/20" />}
              </div>
              <label className="cursor-pointer px-4 py-2 bg-background hover:bg-muted border border-border/40 rounded-xl text-sm text-foreground/60 hover:text-foreground font-bold transition-all shadow-sm focus-within:ring-2 focus-within:ring-ring relative group">
                <span className="group-hover:-translate-y-0.5 transition-transform block">{uploadingFoto ? 'Mengunggah...' : 'Ganti Foto'}</span>
                <input type="file" accept="image/*" onChange={handleFoto} className="sr-only" disabled={uploadingFoto} />
              </label>
            </div>
            <div><label className={labelClass}>Nama Lengkap *</label><input type="text" className={inputClass} value={form.nama || ''} onChange={e => set('nama', e.target.value)} /></div>
            <div><label className={labelClass}>Tim *</label><select className={inputClass} value={form.tim || ''} onChange={e => set('tim', e.target.value)}>{timList.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
            <div><label className={labelClass}>Jabatan *</label><select className={inputClass} value={form.jabatan || ''} onChange={e => set('jabatan', e.target.value as Jabatan)}>{Object.entries(labelJabatan).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          </div>
          <div className={sectionClass}>
            <p className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest pl-1 mb-3">Data Kerja</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelClass}>NIP OJK</label><input type="text" className={inputClass} value={form.nip_ojk || ''} onChange={e => set('nip_ojk', e.target.value)} /></div>
              <div><label className={labelClass}>Bergabung di 157</label><input type="date" className={inputClass} value={form.bergabung_date || ''} onChange={e => set('bergabung_date', e.target.value)} /></div>
              <div className="col-span-2"><label className={labelClass}>Alamat Email OJK</label><input type="email" className={inputClass} value={form.email_ojk || ''} onChange={e => set('email_ojk', e.target.value)} /></div>
              <div><label className={labelClass}>No. Telepon Aktif</label><input type="text" className={inputClass} value={form.no_telepon || ''} onChange={e => set('no_telepon', e.target.value)} /></div>
              <div><label className={labelClass}>No. Telepon Darurat</label><input type="text" className={inputClass} value={form.no_telepon_darurat || ''} onChange={e => set('no_telepon_darurat', e.target.value)} /></div>
              <div><label className={labelClass}>Nama Kontak Darurat</label><input type="text" className={inputClass} value={form.nama_kontak_darurat || ''} onChange={e => set('nama_kontak_darurat', e.target.value)} /></div>
              <div><label className={labelClass}>Hubungan Kontak Darurat</label><select className={inputClass} value={form.hubungan_kontak_darurat || ''} onChange={e => set('hubungan_kontak_darurat', e.target.value)}><option value="">Pilih</option>{['Orang Tua','Saudara','Pasangan','Teman'].map(v => <option key={v} value={v}>{v}</option>)}</select></div>
            </div>
          </div>
          <div className={sectionClass}>
            <p className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest pl-1 mb-3">Data Pribadi</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelClass}>Jenis Kelamin</label><select className={inputClass} value={form.jenis_kelamin || ''} onChange={e => set('jenis_kelamin', e.target.value)}><option value="">Pilih</option><option value="Laki-laki">Laki-laki</option><option value="Perempuan">Perempuan</option></select></div>
              <div><label className={labelClass}>Agama</label><select className={inputClass} value={form.agama || ''} onChange={e => set('agama', e.target.value)}><option value="">Pilih</option>{['Islam','Kristen','Katolik','Hindu','Buddha','Konghucu'].map(a => <option key={a} value={a}>{a}</option>)}</select></div>
              <div><label className={labelClass}>Tanggal Lahir</label><input type="date" className={inputClass} value={form.tgl_lahir || ''} onChange={e => set('tgl_lahir', e.target.value)} /></div>
              <div><label className={labelClass}>Status Perkawinan</label><select className={inputClass} value={form.status_perkawinan || ''} onChange={e => set('status_perkawinan', e.target.value)}><option value="">Pilih</option>{['Belum Menikah','Menikah','Cerai'].map(v => <option key={v} value={v}>{v}</option>)}</select></div>
              <div><label className={labelClass}>Pendidikan</label><select className={inputClass} value={form.pendidikan || ''} onChange={e => set('pendidikan', e.target.value)}><option value="">Pilih</option>{['SMA','D3','S1','S2','S3'].map(p => <option key={p} value={p}>{p}</option>)}</select></div>
            </div>
          </div>
          <div className={sectionClass}>
            <p className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest pl-1 mb-3">🔒 Data Sensitif</p>
            <div className="grid grid-cols-2 gap-3 relative">
              <div className="col-span-2"><label className={labelClass}>No. KTP</label><input type="text" placeholder="16 digit NIK" maxLength={16} className={inputClass} value={form.no_ktp || ''} onChange={e => set('no_ktp', e.target.value)} /></div>
              <div><label className={labelClass}>No. NPWP</label><input type="text" className={inputClass} value={form.no_npwp || ''} onChange={e => set('no_npwp', e.target.value)} /></div>
              <div><label className={labelClass}>Nomor Rekening</label><input type="text" className={inputClass} value={form.nomor_rekening || ''} onChange={e => set('nomor_rekening', e.target.value)} /></div>
              <div><label className={labelClass}>Nama Bank</label><input type="text" className={inputClass} value={form.nama_bank || ''} onChange={e => set('nama_bank', e.target.value)} /></div>
              <div className="col-span-2"><label className={labelClass}>Alamat Tempat Tinggal</label><textarea rows={2} className={inputClass} value={form.alamat_tinggal || ''} onChange={e => set('alamat_tinggal', e.target.value)} /></div>
              <div className="col-span-2"><label className={labelClass}>Status Tempat Tinggal</label><select className={inputClass} value={form.status_tempat_tinggal || ''} onChange={e => set('status_tempat_tinggal', e.target.value)}><option value="">Pilih</option><option value="Milik Sendiri">Rumah/Apartemen Milik Sendiri</option><option value="Milik Orang Tua">Rumah/Apartemen Milik Orang Tua</option><option value="Kost/Sewa">Kost/Sewa Apartemen</option><option value="Lainnya">Lainnya</option></select></div>
            </div>
          </div>
          <div className={sectionClass}>
            <p className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest pl-1 mb-3">Latar Belakang</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelClass}>Nama Lembaga Pendidikan</label><input type="text" className={inputClass} value={form.nama_lembaga || ''} onChange={e => set('nama_lembaga', e.target.value)} /></div>
              <div><label className={labelClass}>Jurusan</label><input type="text" className={inputClass} value={form.jurusan || ''} onChange={e => set('jurusan', e.target.value)} /></div>
              <div className="col-span-2"><label className={labelClass}>Previous Company</label><input type="text" className={inputClass} value={form.previous_company || ''} onChange={e => set('previous_company', e.target.value)} /></div>
              <div className="col-span-2"><label className={labelClass}>Pengalaman Kontak OJK 157</label><select className={inputClass} value={form.pengalaman_cc || ''} onChange={e => set('pengalaman_cc', e.target.value)}><option value="">Pilih</option><option value="Pernah">Pernah</option><option value="Tidak Pernah">Tidak Pernah</option></select></div>
            </div>
          </div>
          <div className={sectionClass}>
            <p className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest pl-1 mb-3">⭐ Catatan Tambahan</p>
            <textarea rows={3} placeholder="Prestasi, bakat, hobi..." className={inputClass} value={form.catatan_tambahan || ''} onChange={e => set('catatan_tambahan', e.target.value)} />
          </div>
          <div className={sectionClass}>
            <p className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest pl-1 mb-3">Keterangan</p>
            <textarea rows={2} placeholder="Catatan umum lainnya..." className={inputClass} value={form.keterangan || ''} onChange={e => set('keterangan', e.target.value)} />
          </div>
          {!isReadOnly && (
            <button onClick={handleSave} disabled={saving} className="w-full py-4 bg-primary hover:opacity-90 disabled:opacity-50 text-primary-foreground rounded-2xl text-base font-bold shadow-md shadow-primary/10 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background hover:shadow-lg mt-2">
              {saving ? 'Menyimpan...' : '✓ Simpan Perubahan'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

interface ProfilerTableClientProps {
  initialPeserta: Peserta[];
  initialFolders: ProfilerFolder[];
  initialYears: ProfilerYear[];
  initialTimList: string[];
  batchName: string;
  role?: string;
}

export default function ProfilerTableClient({
  initialPeserta,
  initialFolders,
  initialYears,
  initialTimList,
  batchName,
  role = 'trainer'
}: ProfilerTableClientProps) {
  const isReadOnly = role === 'leader';
  const router = useRouter();

  const [peserta, setPeserta] = useState<Peserta[]>(initialPeserta);
  
  useEffect(() => {
    setPeserta(initialPeserta);
  }, [initialPeserta]);

  const [filterTim, setFilterTim] = useState<string>('all');
  const [selectedPeserta, setSelectedPeserta] = useState<Peserta | null>(null);
  const [showFolderDropdown, setShowFolderDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ── Sort mode ────────────────────────────────────────────────
  const [sortMode, setSortMode] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderChanged, setOrderChanged] = useState(false);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragIndex = useRef<number | null>(null);

  // ── Select mode ──────────────────────────────────────────────
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showMoveModal, setShowMoveModal] = useState(false);

  const activeTab = 'table';

  const handleSaved = (updated: Peserta) => setPeserta(prev => prev.map(p => p.id === updated.id ? updated : p));
  const handleDeleted = (id: string) => setPeserta(prev => prev.filter(p => p.id !== id));
  const handleMoved = (ids: string[]) => { 
    setPeserta(prev => prev.filter(p => !ids.includes(p.id!))); 
    setSelectedIds(new Set()); 
    setSelectMode(false); 
  };

  // ── Drag-and-drop handlers ───────────────────────────────────
  const handleDragStart = (e: React.DragEvent, index: number) => {
    dragIndex.current = index;
    e.dataTransfer.effectAllowed = 'move';
    const ghost = document.createElement('div');
    ghost.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => document.body.removeChild(ghost), 0);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    const from = dragIndex.current;
    const to = dragOverIndex;
    if (from !== null && to !== null && from !== to) {
      setPeserta(prev => {
        const next = [...prev];
        const [item] = next.splice(from, 1);
        next.splice(to, 0, item);
        return next;
      });
      setOrderChanged(true);
    }
    dragIndex.current = null;
    setDragOverIndex(null);
  };

  // ── Simpan urutan ke DB ──────────────────────────────────────
  const saveOrder = async () => {
    setSavingOrder(true);
    try {
      await Promise.all(peserta.map((p, idx) => updatePeserta(p.id!, { nomor_urut: idx + 1 })));
      setOrderChanged(false);
      setSortMode(false);
    } catch (err: any) { alert('Gagal menyimpan urutan: ' + err.message); }
    finally { setSavingOrder(false); }
  };

  const cancelSort = () => { 
    setSortMode(false); 
    setOrderChanged(false); 
    setDragOverIndex(null); 
    setPeserta(initialPeserta);
  };

  // ── Select helpers ───────────────────────────────────────────
  const toggleSelectMode = () => { setSelectMode(v => !v); setSelectedIds(new Set()); };
  const toggleSelect = (id: string) => setSelectedIds(prev => { 
    const n = new Set(prev); 
    n.has(id) ? n.delete(id) : n.add(id); 
    return n; 
  });
  
  const filtered = filterTim === 'all'
    ? peserta
    : peserta.filter(p => (p.tim ?? '').toLowerCase() === filterTim.toLowerCase());

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(p => p.id!)));
  };

  const allTims = useMemo(() => {
    const present = Array.from(new Set(peserta.map(p => p.tim).filter(Boolean)));
    return ['all', ...present.sort()];
  }, [peserta]);

  const allFilteredSelected = filtered.length > 0 && selectedIds.size === filtered.length;
  const displayList = sortMode ? peserta : filtered;

  return (
    <div className="h-full overflow-auto bg-background/50 backdrop-blur-sm relative flex flex-col">
      <div className="max-w-6xl mx-auto space-y-4">

        {/* ── Tabs Navigation ── */}
        <div className="flex items-center gap-1 p-1 bg-muted/30 rounded-2xl w-fit border border-border/40">
          <button
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              activeTab === 'table'
                ? 'bg-background text-primary shadow-sm'
                : 'text-foreground/40 hover:text-foreground'
            }`}
          >
            Daftar Peserta
          </button>
          <button
            onClick={() => router.push(`/profiler/slides?batch=${encodeURIComponent(batchName)}`)}
            className="px-6 py-2 rounded-xl text-sm font-bold text-foreground/40 hover:text-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Tampilan Slide
          </button>
        </div>

        {/* ── Top bar ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (sortMode) { cancelSort(); return; }
                if (selectMode) { toggleSelectMode(); return; }
                router.push('/profiler');
              }}
              className="w-10 h-10 flex items-center justify-center bg-card border border-border/40 rounded-xl text-primary hover:bg-muted transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              title={sortMode || selectMode ? 'Batal' : 'Kembali'}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowFolderDropdown(!showFolderDropdown)}
                className="group flex flex-col items-start hover:bg-muted p-2 -m-2 rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <h1 className="text-lg font-black tracking-tight text-foreground flex items-center gap-2">
                  {batchName}
                  <ChevronDown className={`w-4 h-4 text-primary transition-transform duration-300 ${showFolderDropdown ? 'rotate-180' : ''}`} />
                  <span className="px-2 py-0.5 bg-primary/5 text-primary text-[10px] font-bold rounded-full border border-primary/20">
                    {peserta.length}
                  </span>
                </h1>
                <p className="text-[10px] font-mono text-foreground/40 uppercase tracking-widest">Database KTP</p>
              </button>

              <AnimatePresence>
                {showFolderDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute top-full left-0 mt-2 w-64 bg-card border border-border/40 rounded-3xl shadow-2xl z-[100] overflow-hidden"
                  >
                    <div className="max-h-80 overflow-y-auto p-3 space-y-4 custom-scrollbar">
                      {initialYears.map(year => {
                        const yearFolders = initialFolders.filter(f => f.year_id === year.id);
                        if (yearFolders.length === 0) return null;
                        return (
                          <div key={year.id} className="space-y-1">
                            <p className="text-[9px] font-black text-foreground/40 uppercase tracking-[0.2em] px-3 py-1">{year.label}</p>
                            <div className="space-y-0.5">
                              {yearFolders.map(folder => (
                                <button
                                  key={folder.id}
                                  onClick={() => {
                                    router.push(`/profiler/table?batch=${encodeURIComponent(folder.name)}`);
                                    setShowFolderDropdown(false);
                                  }}
                                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                    folder.name === batchName
                                      ? 'bg-primary text-primary-foreground font-bold'
                                      : 'hover:bg-muted text-foreground/60 hover:text-foreground'
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
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {!isReadOnly && !selectMode && (
              <button
                onClick={() => { setSortMode(v => !v); setSelectMode(false); setDragOverIndex(null); }}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[11px] uppercase tracking-wider font-bold transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  sortMode
                    ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/10'
                    : 'bg-card hover:bg-muted text-foreground border-border/40 shadow-sm'
                }`}
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                Urutkan
              </button>
            )}
            {!isReadOnly && !sortMode && (
              <button
                onClick={toggleSelectMode}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[11px] uppercase tracking-wider font-bold transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  selectMode
                    ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/10'
                    : 'bg-card hover:bg-muted text-foreground border-border/40 shadow-sm'
                }`}
              >
                <FolderInput className="w-3.5 h-3.5" />
                {selectMode ? 'Selesai' : 'Kelola Data'}
              </button>
            )}
            {!sortMode && !selectMode && (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => router.push(`/profiler/export?batch=${encodeURIComponent(batchName)}`)}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-card hover:bg-muted text-foreground rounded-xl text-[11px] uppercase tracking-wider font-bold border border-border/40 shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Download className="w-3.5 h-3.5" /> Ekspor
                </button>
                {!isReadOnly && (
                  <button
                    onClick={() => router.push(`/profiler/add?batch=${encodeURIComponent(batchName)}`)}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:opacity-90 text-primary-foreground rounded-xl text-[11px] uppercase tracking-wider font-bold shadow-md shadow-primary/10 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:shadow-lg"
                  >
                    <Plus className="w-3.5 h-3.5" /> Tambah
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Sort mode banner ── */}
        {sortMode && (
          <div className="flex items-center justify-between bg-primary/5 rounded-2xl px-4 py-3 border border-primary/20">
            <div className="flex items-center gap-2">
              <GripVertical className="w-4 h-4 text-primary/40" />
              <p className="text-sm font-medium text-primary">Seret baris untuk mengubah urutan</p>
            </div>
            {orderChanged && (
              <button onClick={saveOrder} disabled={savingOrder}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:opacity-90 disabled:opacity-50 text-primary-foreground rounded-xl text-xs font-bold shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {savingOrder ? <><Loader2 className="w-3 h-3 animate-spin" />Menyimpan...</> : <><Save className="w-3 h-3" />Simpan</>}
              </button>
            )}
          </div>
        )}

        {/* ── Select all bar ── */}
        {selectMode && (
          <div className="flex items-center justify-between bg-card rounded-2xl px-4 py-3 border border-border/40 shadow-sm">
            <button onClick={toggleSelectAll} className="flex items-center gap-2 text-sm font-bold tracking-tight text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${allFilteredSelected ? 'bg-primary border-primary' : 'border-border/60'}`}>
                {allFilteredSelected && <Check className="w-3 h-3 text-primary-foreground" />}
              </div>
              {allFilteredSelected ? 'Batal pilih semua' : 'Pilih semua'}
              {selectedIds.size > 0 && <span className="ml-1 text-primary font-bold">({selectedIds.size} dipilih)</span>}
            </button>
            <p className="text-xs text-foreground/40 font-medium tracking-tight">Centang lalu klik Pindah</p>
          </div>
        )}

        {/* ── Tim filter ── */}
        {!sortMode && allTims.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            {allTims.map(tim => (
              <button key={tim} onClick={() => setFilterTim(tim)}
                className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  (tim === 'all' ? filterTim === 'all' : filterTim.toLowerCase() === tim.toLowerCase())
                    ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/10'
                    : 'bg-card text-foreground/60 hover:text-foreground border-border/40'
                }`}>
                {tim === 'all' ? 'Semua' : tim}
              </button>
            ))}
          </div>
        )}

        {/* ── List Peserta ── */}
        {displayList.length === 0 ? (
          <div className="bg-card rounded-[2rem] p-10 text-center border border-border/40 shadow-sm">
            <p className="text-foreground/40 text-sm">Belum ada peserta.</p>
            {!isReadOnly && (
              <button onClick={() => router.push(`/profiler/add?batch=${encodeURIComponent(batchName)}`)}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-primary hover:opacity-90 text-primary-foreground rounded-xl text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Plus className="w-4 h-4" /> Tambah Peserta
              </button>
            )}
          </div>
        ) : (
          <div className="bg-card rounded-[2rem] overflow-hidden divide-y divide-border/40 border border-border/40 shadow-sm">
            {displayList.map((p, i) => {
              const isSelected = selectedIds.has(p.id!);
              const isDragTarget = sortMode && dragOverIndex === i && dragIndex.current !== null && dragIndex.current !== i;
              const isDragging = sortMode && dragIndex.current === i;
              const showLineAbove = isDragTarget && dragIndex.current !== null && dragIndex.current > i;
              const showLineBelow = isDragTarget && dragIndex.current !== null && dragIndex.current < i;

              return (
                <div key={p.id}>
                  {showLineAbove && (
                    <div className="px-4">
                      <div className="h-0.5 bg-primary rounded-full" />
                    </div>
                  )}

                  <div
                    draggable={sortMode}
                    onDragStart={sortMode ? e => handleDragStart(e, i) : undefined}
                    onDragOver={sortMode ? e => handleDragOver(e, i) : undefined}
                    onDragLeave={sortMode ? handleDragLeave : undefined}
                    onDragEnd={sortMode ? handleDragEnd : undefined}
                    className={`flex items-center gap-3 px-4 py-3.5 transition-all ${
                      sortMode
                        ? isDragging
                          ? 'opacity-40 bg-primary/5 cursor-grabbing'
                          : 'cursor-grab hover:bg-muted/30 select-none'
                        : isSelected && selectMode
                          ? 'bg-primary/5'
                          : 'hover:bg-muted/30'
                    }`}
                  >
                    {sortMode ? (
                      <GripVertical className="w-4 h-4 text-foreground/20 flex-shrink-0 pointer-events-none" />
                    ) : selectMode ? (
                      <button onClick={() => toggleSelect(p.id!)}
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isSelected ? 'bg-primary border-primary' : 'border-border/60'}`}>
                        {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                      </button>
                    ) : null}

                    <div
                      onClick={() => {
                        if (sortMode) return;
                        if (selectMode) { toggleSelect(p.id!); return; }
                        setSelectedPeserta(p);
                      }}
                      className={`flex items-center gap-3 flex-1 min-w-0 text-left group transition-opacity rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        sortMode ? 'pointer-events-none' : 'hover:opacity-80 cursor-pointer'
                      }`}
                      role={!sortMode && !selectMode ? "button" : undefined}
                      tabIndex={!sortMode && !selectMode ? 0 : -1}
                    >
                      <span className="text-[11px] text-foreground/40 w-5 text-right flex-shrink-0 font-mono tabular-nums">
                        {i + 1}
                      </span>
                      <div className="w-10 h-10 rounded-[1.25rem] overflow-hidden bg-muted/30 border border-border/40 shrink-0 flex items-center justify-center">
                        {p.foto_url
                          ? <div className="relative w-full h-full"><Image src={p.foto_url} alt={p.nama} fill className="object-cover" referrerPolicy="no-referrer" /></div>
                          : <span className="text-sm font-bold text-foreground/40">{p.nama?.charAt(0)?.toUpperCase() || '?'}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold tracking-tight text-foreground truncate">{p.nama}</p>
                        <p className="text-xs text-foreground/40 mt-0.5">{p.tim} · {labelJabatan[p.jabatan] || p.jabatan}</p>
                      </div>
                      {!sortMode && !selectMode && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/qa-analyzer/agents/${p.id}`);
                            }}
                            className="p-2 rounded-xl bg-primary/5 text-primary hover:bg-primary/10 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            title="Lihat Analisis QA"
                          >
                            <Activity className="w-4 h-4" />
                          </button>
                          <svg className="w-4 h-4 text-foreground/20 group-hover:text-primary shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>

                  {showLineBelow && (
                    <div className="px-4">
                      <div className="h-0.5 bg-primary rounded-full" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {sortMode && orderChanged && (
          <button onClick={saveOrder} disabled={savingOrder}
            className="w-full py-4 bg-primary hover:opacity-90 disabled:opacity-50 text-primary-foreground rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all sticky bottom-4 shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {savingOrder ? <><Loader2 className="w-4 h-4 animate-spin" />Menyimpan urutan...</> : <><Save className="w-4 h-4" />Simpan Urutan</>}
          </button>
        )}
      </div>

      {selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-0 right-0 flex justify-center px-4 z-40">
          <div className="bg-foreground rounded-[2rem] shadow-2xl px-5 py-3.5 flex items-center gap-4">
            <p className="text-background text-sm font-bold tracking-tight">{selectedIds.size} peserta dipilih</p>
            <button onClick={() => setShowMoveModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-background hover:bg-muted text-foreground rounded-xl text-sm font-bold shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-foreground">
              <FolderInput className="w-4 h-4" />Pindah Folder
            </button>
          </div>
        </div>
      )}

      {selectedPeserta && (
        <EditModal peserta={selectedPeserta} timList={initialTimList}
          onClose={() => setSelectedPeserta(null)} onSaved={handleSaved} onDeleted={handleDeleted} isReadOnly={isReadOnly} />
      )}
      {showMoveModal && (
        <MoveFolderModal 
          selectedIds={Array.from(selectedIds)} 
          currentBatch={batchName}
          folders={initialFolders}
          years={initialYears}
          onClose={() => setShowMoveModal(false)} 
          onMoved={handleMoved} 
        />
      )}
    </div>
  );
}
