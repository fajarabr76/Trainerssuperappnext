import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { AppSettings, Scenario, ConsumerType, ConsumerDifficulty } from '@/app/types';
import { AI_MODELS } from '../constants';
import { defaultSettings } from '../data';
import { Clock, Trash2, X, Plus, Check, Edit2, RotateCcw, Save, Image as ImageIcon, User, Settings, FileText, Users, Fingerprint } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (newSettings: AppSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSave }) => {
  const [activeTab, setActiveTab] = useState<'scenarios' | 'consumers' | 'identity' | 'system'>('scenarios');
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const defaultModelId = AI_MODELS[0]?.id || 'gemini-3.1-flash-lite-preview';

  // UI States for Forms
  const [isScenarioFormOpen, setIsScenarioFormOpen] = useState(false);
  const [isConsumerFormOpen, setIsConsumerFormOpen] = useState(false);

  // Scenario Form State
  const [editingScenarioId, setEditingScenarioId] = useState<string | null>(null);
  const [newScenarioCategory, setNewScenarioCategory] = useState('');
  const [isNewCategoryInput, setIsNewCategoryInput] = useState(false);
  const [newScenarioTitle, setNewScenarioTitle] = useState('');
  const [newScenarioDesc, setNewScenarioDesc] = useState('');
  const [newScenarioScript, setNewScenarioScript] = useState('');
  const [isScenarioScriptEnabled, setIsScenarioScriptEnabled] = useState(false);
  const [newScenarioImages, setNewScenarioImages] = useState<string[]>([]);

  // Consumer Form State
  const [editingConsumerId, setEditingConsumerId] = useState<string | null>(null);
  const [newConsumerName, setNewConsumerName] = useState('');
  const [newConsumerDesc, setNewConsumerDesc] = useState('');
  const [newConsumerDifficulty, setNewConsumerDifficulty] = useState<ConsumerDifficulty>(ConsumerDifficulty.Medium);

  // Identity Form State
  const handleIdentityChange = (field: string, value: string) => {
    setLocalSettings(prev => ({
        ...prev,
        identitySettings: {
            ...prev.identitySettings!,
            [field]: value
        }
    }));
  };

  // Reset local state when modal opens
  useEffect(() => {
    if (isOpen) {
      const selectedModel = settings.selectedModel && AI_MODELS.some(model => model.id === settings.selectedModel)
        ? settings.selectedModel
        : defaultModelId;
      setLocalSettings({ ...settings, selectedModel });
      setIsScenarioFormOpen(false);
      setIsConsumerFormOpen(false);
      setEditingScenarioId(null);
      setEditingConsumerId(null);
    }
  }, [isOpen, settings, defaultModelId]);

  const handleClose = () => {
    onClose();
  };

  if (!isOpen) return null;

  const categories = Array.from(new Set(localSettings.scenarios.map(s => s.category)));

  // SELECT ALL LOGIC
  const activeCount = localSettings.scenarios.filter(s => s.isActive).length;
  const totalScenarios = localSettings.scenarios.length;
  const allSelected = totalScenarios > 0 && activeCount === totalScenarios;
  const noneSelected = activeCount === 0;

  const handleSelectAll = () => {
    setLocalSettings(prev => ({
      ...prev,
      scenarios: prev.scenarios.map(s => ({ ...s, isActive: true }))
    }));
  };

  const handleUnselectAll = () => {
    setLocalSettings(prev => ({
        ...prev,
        scenarios: prev.scenarios.map(s => ({ ...s, isActive: false }))
    }));
  };

  const handleToggleScenario = (id: string) => {
    setLocalSettings(prev => ({
      ...prev,
      scenarios: prev.scenarios.map(s => s.id === id ? { ...s, isActive: !s.isActive } : s)
    }));
  };

  const handleDeleteScenario = (id: string) => {
    if (window.confirm('Hapus skenario ini?')) {
      setLocalSettings(prev => ({
        ...prev,
        scenarios: prev.scenarios.filter(s => s.id !== id)
      }));
    }
  };

  // Consumer Selection Logic (Global)
  const handleSelectConsumerType = (id: string) => {
      setLocalSettings(prev => ({ ...prev, activeConsumerTypeId: id }));
  }

  const resetScenarioForm = () => {
    setEditingScenarioId(null);
    setNewScenarioTitle('');
    setNewScenarioDesc('');
    setNewScenarioScript('');
    setIsScenarioScriptEnabled(false);
    setNewScenarioCategory('');
    setNewScenarioImages([]);
    setIsNewCategoryInput(false);
  };

  const handleAddScenarioClick = () => {
      resetScenarioForm();
      setIsScenarioFormOpen(true);
      setTimeout(() => {
          document.getElementById('scenario-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
  };

  const handleEditScenario = (scenario: Scenario) => {
    setEditingScenarioId(scenario.id);
    setNewScenarioCategory(scenario.category);
    setNewScenarioTitle(scenario.title);
    setNewScenarioDesc(scenario.description);
    setNewScenarioScript(scenario.script || '');
    setIsScenarioScriptEnabled(Boolean(scenario.script?.trim()));
    setNewScenarioImages(scenario.images || []);
    setIsNewCategoryInput(!categories.includes(scenario.category));

    setIsScenarioFormOpen(true);
    setTimeout(() => {
      document.getElementById('scenario-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleCancelScenarioForm = () => {
    setIsScenarioFormOpen(false);
    resetScenarioForm();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files) as File[];
      const MAX_SIZE = 500 * 1024; // 500KB limit per image

      files.forEach(file => {
        if (file.size > MAX_SIZE) {
          alert(`File ${file.name} terlalu besar (>500KB). Mohon kompres gambar terlebih dahulu.`);
          return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result as string;
          setNewScenarioImages(prev => [...prev, base64String]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeImage = (index: number) => {
    setNewScenarioImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveScenario = () => {
    if (!newScenarioTitle || !newScenarioDesc) return;
    const category = isNewCategoryInput ? newScenarioCategory : newScenarioCategory || "Umum";

    if (editingScenarioId) {
      setLocalSettings(prev => ({
        ...prev,
        scenarios: prev.scenarios.map(s =>
          s.id === editingScenarioId
            ? {
                ...s,
                category,
                title: newScenarioTitle,
                description: newScenarioDesc,
                script: isScenarioScriptEnabled ? newScenarioScript : '',
                images: newScenarioImages
              }
            : s
        )
      }));
    } else {
      const newScenario: Scenario = {
        id: `s-${Date.now()}`,
        category,
        title: newScenarioTitle,
        description: newScenarioDesc,
        script: isScenarioScriptEnabled ? newScenarioScript : '',
        isActive: true,
        images: newScenarioImages
      };
      setLocalSettings(prev => ({
        ...prev,
        scenarios: [...prev.scenarios, newScenario]
      }));
    }
    resetScenarioForm();
    setIsScenarioFormOpen(false);
  };

  const resetConsumerForm = () => {
    setEditingConsumerId(null);
    setNewConsumerName('');
    setNewConsumerDesc('');
    setNewConsumerDifficulty(ConsumerDifficulty.Medium);
  };

  const handleAddConsumerClick = () => {
    resetConsumerForm();
    setIsConsumerFormOpen(true);
    setTimeout(() => {
        document.getElementById('consumer-form')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleEditConsumer = (consumer: ConsumerType) => {
    setEditingConsumerId(consumer.id);
    setNewConsumerName(consumer.name);
    setNewConsumerDesc(consumer.description);
    setNewConsumerDifficulty(consumer.difficulty);

    setIsConsumerFormOpen(true);
    setTimeout(() => {
        document.getElementById('consumer-form')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleCancelConsumerForm = () => {
    setIsConsumerFormOpen(false);
    resetConsumerForm();
  };

  const handleSaveConsumer = () => {
    if (!newConsumerName || !newConsumerDesc) return;

    if (editingConsumerId) {
      setLocalSettings(prev => ({
        ...prev,
        consumerTypes: prev.consumerTypes.map(c =>
          c.id === editingConsumerId
            ? { ...c, name: newConsumerName, description: newConsumerDesc, difficulty: newConsumerDifficulty }
            : c
        )
      }));
    } else {
      const newConsumer: ConsumerType = {
        id: `c-${Date.now()}`,
        name: newConsumerName,
        description: newConsumerDesc,
        difficulty: newConsumerDifficulty,
        isCustom: true
      };
      setLocalSettings(prev => ({
        ...prev,
        consumerTypes: [...prev.consumerTypes, newConsumer]
      }));
    }
    resetConsumerForm();
    setIsConsumerFormOpen(false);
  };

  const handleDeleteConsumer = (id: string) => {
    if (window.confirm('Hapus karakteristik ini?')) {
      setLocalSettings(prev => {
        const newTypes = prev.consumerTypes.filter(c => c.id !== id);
        return {
          ...prev,
          consumerTypes: newTypes,
          activeConsumerTypeId: prev.activeConsumerTypeId === id ? 'random' : prev.activeConsumerTypeId
        };
      });
    }
  };

  const handleSave = () => {
    onSave(localSettings);
    onClose();
  };

  const handleResetDefaults = () => {
      if (window.confirm("Apakah Anda yakin ingin mereset semua pengaturan (skenario & karakteristik) ke awal? Data yang Anda buat akan hilang.")) {
          setLocalSettings(defaultSettings);
      }
  }

  const tabs = [
    { id: 'scenarios', label: 'Masalah', icon: FileText },
    { id: 'consumers', label: 'Karakter', icon: Users },
    { id: 'identity', label: 'Identitas', icon: User },
    { id: 'system', label: 'Sistem', icon: Settings },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div data-module="ketik" className="module-clean-app module-clean-modal fixed inset-0 module-clean-overlay z-[200] flex items-center justify-center p-3 sm:p-4 md:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="module-clean-modal-shell relative w-full max-w-4xl max-h-[86vh] rounded-[2rem] flex flex-col overflow-hidden shadow-2xl shadow-black/10"
          >
            {/* Modal Header */}
            <div className="module-clean-toolbar px-5 py-4 sm:px-6 sm:py-5 border-b flex justify-between items-center shrink-0 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-module-ketik/10 to-transparent pointer-events-none" />
              <div className="relative z-10">
                <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">Pengaturan Simulasi</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">Module KETIK</span>
                </div>
              </div>
              <div className="flex items-center gap-4 relative z-10">
                <button
                  onClick={handleClose}
                  className="w-10 h-10 flex items-center justify-center bg-foreground/5 hover:bg-foreground/10 rounded-xl text-muted-foreground hover:text-foreground transition-all border border-transparent hover:border-border/50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Segmented Control Tabs */}
            <div className="px-5 sm:px-6 pt-5 pb-3 shrink-0 bg-transparent">
              <div className="module-clean-panel flex p-2 rounded-2xl">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 flex items-center justify-center gap-3 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] rounded-xl transition-all relative group ${
                  activeTab === tab.id
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTabKetik"
                    className="module-clean-shell absolute inset-0 shadow-sm rounded-xl"
                    transition={{ type: "spring", bounce: 0.15, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2.5">
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </span>
              </button>
            ))}
              </div>
            </div>

            {/* Modal Body */}
            <div className="module-clean-stage flex-1 overflow-y-auto px-5 sm:px-6 pb-6 sm:pb-8 bg-transparent custom-scrollbar">

          {/* TAB 1: SCENARIOS */}
          {activeTab === 'scenarios' && (
            <div className="space-y-8 pb-10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-card/50 p-6 rounded-[2rem] border border-border/50">
                 <div>
                     <h3 className="font-black text-foreground text-xl tracking-tighter">
                        Daftar Skenario
                     </h3>
                     <p className="text-[10px] font-black uppercase tracking-widest text-primary mt-1 opacity-80">
                       {activeCount} / {totalScenarios} AKTIF
                     </p>
                 </div>

                 <div className="flex items-center gap-3">
                     <button
                        onClick={handleSelectAll}
                        disabled={allSelected}
                        className="px-5 py-2.5 bg-foreground/5 border border-border/50 rounded-xl text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:bg-foreground/10 hover:text-foreground transition-all disabled:opacity-30 shadow-sm"
                     >
                        Pilih Semua
                     </button>
                     <button
                        onClick={handleUnselectAll}
                        disabled={noneSelected}
                        className="px-5 py-2.5 bg-foreground/5 border border-border/50 rounded-xl text-[10px] font-black uppercase tracking-widest text-red-500/60 hover:bg-red-500/10 hover:text-red-500 transition-all disabled:opacity-30 shadow-sm"
                     >
                        Hapus Semua
                     </button>
                 </div>
              </div>

              {/* Scenario List */}
              <div className="grid grid-cols-1 gap-4">
                  {localSettings.scenarios.map(scenario => (
                  <motion.div
                    layout
                    key={scenario.id}
                    className={`flex items-start p-6 rounded-[2rem] border transition-all ${
                      scenario.isActive
                        ? 'bg-card border-primary/30 shadow-2xl shadow-primary/5'
                        : 'bg-card/40 border-border/50 opacity-40 grayscale hover:grayscale-0 hover:opacity-100'
                    }`}
                  >
                      {/* Checkbox */}
                      <div className="pt-1 mr-5">
                          <button
                              onClick={() => handleToggleScenario(scenario.id)}
                              className={`w-7 h-7 rounded-xl border-2 flex items-center justify-center transition-all ${
                                scenario.isActive
                                  ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20'
                                  : 'border-foreground/10 bg-foreground/5 text-transparent'
                              }`}
                          >
                            <Check className={`w-4 h-4 ${scenario.isActive ? 'scale-100 opacity-100' : 'scale-50 opacity-0'} transition-all`} />
                          </button>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                              <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-primary/10 text-primary border border-primary/20">
                                {scenario.category}
                              </span>
                              <h4 className="text-base font-black text-foreground tracking-tight truncate">
                                {scenario.title}
                              </h4>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed font-medium">
                              {scenario.description}
                          </p>
                           {scenario.images && scenario.images.length > 0 && (
                              <div className="mt-3">
                                   <span className="text-[10px] bg-foreground/5 text-muted-foreground px-3 py-1.5 rounded-xl inline-flex items-center gap-2 font-black uppercase tracking-widest border border-border/50">
                                      <ImageIcon className="w-3.5 h-3.5" /> {scenario.images.length} Lampiran
                                  </span>
                              </div>
                          )}
                      </div>

                      {/* Action */}
                      <div className="flex items-center gap-2 ml-4">
                          <button
                              onClick={() => handleEditScenario(scenario)}
                              className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-xl transition-all"
                          >
                              <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                              onClick={() => handleDeleteScenario(scenario.id)}
                              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all"
                          >
                              <Trash2 className="w-4 h-4" />
                          </button>
                      </div>
                  </motion.div>
                  ))}
              </div>

              {/* Add Button */}
              {!isScenarioFormOpen ? (
                <button
                    onClick={handleAddScenarioClick}
                    className="w-full py-6 flex flex-col items-center justify-center gap-3 bg-card/40 backdrop-blur-md border border-dashed border-border/50 rounded-[2rem] text-muted-foreground hover:text-primary hover:border-primary/30 transition-all font-black text-xs uppercase tracking-widest shadow-sm group"
                >
                    <div className="w-12 h-12 rounded-2xl bg-foreground/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                      <Plus className="w-6 h-6" />
                    </div>
                    <span>Tambah Skenario Baru</span>
                </button>
              ) : (
                /* Edit Form */
                <div id="scenario-form" className="bg-card border border-border/50 rounded-[2rem] shadow-3xl overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

                    <div className="px-8 py-6 border-b border-border/50 bg-foreground/5 relative z-10">
                         <h3 className="font-black text-foreground text-lg tracking-tighter">
                            {editingScenarioId ? 'Edit Skenario' : 'Tambah Skenario Baru'}
                        </h3>
                    </div>
                    <div className="p-8 grid grid-cols-2 gap-6 relative z-10">
                        <div className="col-span-2">
                             <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3 ml-1">Kategori</label>
                             {!isNewCategoryInput ? (
                                <div className="relative">
                                  <select
                                    className="w-full rounded-2xl border border-border/50 bg-foreground/5 p-4 text-sm text-foreground focus:ring-2 focus:ring-primary outline-none appearance-none transition-all"
                                    value={newScenarioCategory}
                                    onChange={(e) => {if (e.target.value === 'NEW') {setIsNewCategoryInput(true); setNewScenarioCategory('');} else {setNewScenarioCategory(e.target.value);}}}
                                  >
                                      <option value="">Pilih Kategori</option>
                                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                      <option value="NEW">+ Tambah Kategori Lainnya</option>
                                  </select>
                                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                  </div>
                                </div>
                            ) : (
                                <div className="flex gap-3">
                                    <input type="text" className="flex-1 rounded-2xl border border-border/50 bg-foreground/5 p-4 text-sm text-foreground focus:ring-2 focus:ring-primary outline-none transition-all" placeholder="Kategori Baru" value={newScenarioCategory} onChange={(e) => setNewScenarioCategory(e.target.value)} />
                                    <button onClick={() => setIsNewCategoryInput(false)} className="px-5 text-[10px] font-black uppercase tracking-widest text-red-500 bg-red-500/5 border border-red-500/20 rounded-2xl hover:bg-red-500/10 transition-all">Batal</button>
                                </div>
                            )}
                        </div>
                        <div className="col-span-2">
                            <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3 ml-1">Judul Masalah</label>
                            <input type="text" className="w-full rounded-2xl border border-border/50 bg-foreground/5 p-4 text-sm text-foreground focus:ring-2 focus:ring-primary outline-none transition-all placeholder:text-foreground/20" placeholder="Contoh: Gagal Transfer" value={newScenarioTitle} onChange={(e) => setNewScenarioTitle(e.target.value)} />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3 ml-1">Deskripsi Masalah</label>
                            <textarea className="w-full rounded-2xl border border-border/50 bg-foreground/5 p-4 text-sm text-foreground focus:ring-2 focus:ring-primary outline-none resize-none transition-all" rows={3} value={newScenarioDesc} onChange={(e) => setNewScenarioDesc(e.target.value)} />
                        </div>
                        <div className="col-span-2">
                             <div className="flex items-center justify-between gap-4 mb-3">
                               <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Skrip Percakapan</label>
                               <button
                                 type="button"
                                 onClick={() => setIsScenarioScriptEnabled((prev) => !prev)}
                                 className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                                   isScenarioScriptEnabled
                                     ? 'bg-primary/10 text-primary border-primary/20'
                                     : 'bg-foreground/5 text-muted-foreground border-border/50'
                                 }`}
                               >
                                 <span
                                   className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                                     isScenarioScriptEnabled
                                       ? 'bg-primary border-primary text-white'
                                       : 'border-foreground/20 bg-transparent text-transparent'
                                   }`}
                                 >
                                   <Check className="w-3 h-3" />
                                 </span>
                                 {isScenarioScriptEnabled ? 'Ikuti Skrip' : 'Sangat Kreatif'}
                               </button>
                             </div>
                             <textarea
                               className={`w-full rounded-2xl border p-4 text-sm outline-none resize-none transition-all placeholder:text-foreground/20 ${
                                 isScenarioScriptEnabled
                                   ? 'border-border/50 bg-foreground/5 text-foreground focus:ring-2 focus:ring-primary'
                                   : 'border-border/30 bg-foreground/[0.03] text-muted-foreground cursor-not-allowed'
                               }`}
                               rows={12}
                               value={newScenarioScript}
                               onChange={(e) => setNewScenarioScript(e.target.value)}
                               disabled={!isScenarioScriptEnabled}
                               placeholder={`Contoh format 1 - Dialog:
Agent: Selamat pagi, ada yang bisa saya bantu?
Konsumen: Mas saya ada masalah transaksi.
Agent: Baik, transaksi seperti apa ya?
Konsumen: Tadi pagi ada transaksi kartu kredit yang saya tidak kenal.

Contoh format 2 - Alur:
Awal:
- Konsumen membuka chat dengan nada panik dan singkat.
- Menyebut ada transaksi kartu kredit yang tidak dikenali.

Jika agen bertanya detail:
- Konsumen menyebut transaksi terjadi tadi pagi.
- Nilai transaksi sekitar Rp3.250.000.
- Konsumen tidak pernah memberikan OTP ke siapa pun.

Jika agen memberi arahan pemblokiran:
- Konsumen mulai sedikit tenang.
- Lalu bertanya apakah dana masih bisa diselamatkan.

Akhir:
- Konsumen berterima kasih setelah mendapat langkah lanjut.`}
                             />
                             <p className="mt-3 text-xs text-muted-foreground leading-relaxed font-medium">
                               Checklist <span className="font-black text-foreground">Ikuti Skrip</span> untuk mengaktifkan kolom ini. Saat tidak dicentang, konsumen akan dibiarkan lebih bebas dan kreatif mengikuti konteks skenario. Saat dicentang, AI akan berusaha mengikuti skrip sebagai panduan alur.
                             </p>
                             <p className="mt-2 text-xs text-muted-foreground leading-relaxed font-medium">
                               Anda bisa menulis skrip dalam format dialog seperti <span className="font-black text-foreground">Agent:</span> /
                               <span className="font-black text-foreground"> Konsumen:</span> atau dalam format poin alur seperti
                               <span className="font-black text-foreground"> Awal</span>, <span className="font-black text-foreground">Jika agen bertanya</span>,
                               dan <span className="font-black text-foreground">Akhir</span>. AI akan tetap menjawab secara natural sesuai pertanyaan agen dan situasi percakapan.
                             </p>
                        </div>
                        <div className="col-span-2">
                            <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3 ml-1">Lampiran Gambar</label>
                            <div className="flex items-center justify-center w-full">
                                <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-border border-dashed rounded-[2rem] cursor-pointer bg-foreground/5 hover:bg-foreground/10 hover:border-primary/30 transition-all group">
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <div className="w-12 h-12 rounded-2xl bg-foreground/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                          <ImageIcon className="w-6 h-6 text-muted-foreground" />
                                        </div>
                                        <p className="mb-1 text-xs font-black uppercase tracking-widest text-muted-foreground">Drop File atau Klik</p>
                                        <p className="text-[10px] font-medium text-muted-foreground italic">PNG, JPG (MAX. 500KB)</p>
                                    </div>
                                    <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
                                </label>
                            </div>
                            {newScenarioImages.length > 0 && (
                              <div className="flex gap-4 mt-6 overflow-x-auto pb-4 custom-scrollbar">
                                {newScenarioImages.map((img, idx) => (
                                  <div key={idx} className="relative w-24 h-24 shrink-0 group">
                                    <div className="relative w-full h-full">
                                      <Image
                                        src={img}
                                        alt={`Preview ${idx}`}
                                        fill
                                        className="object-cover rounded-2xl border border-border/50 shadow-md"
                                        unoptimized
                                      />
                                    </div>
                                    <button onClick={() => removeImage(idx)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center shadow-xl opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                        </div>
                        <div className="col-span-2 flex justify-end gap-3 pt-6 border-t border-border/50">
                             <button onClick={handleCancelScenarioForm} className="px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:bg-foreground/5 transition-all">Batal</button>
                             <button onClick={handleSaveScenario} disabled={!newScenarioTitle} className="px-8 py-3 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-30">Simpan</button>
                        </div>
                    </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CONSUMERS (Global Selection) */}
          {activeTab === 'consumers' && (
            <div className="space-y-8 pb-10">
              <div className="bg-card p-8 rounded-[2rem] border border-border/50 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
                <div className="flex items-start gap-6 relative z-10">
                  <div className="w-14 h-14 rounded-2xl bg-orange-500/10 flex items-center justify-center shrink-0 border border-orange-500/20">
                    <Users className="w-7 h-7 text-orange-500" />
                  </div>
                  <div>
                     <h3 className="font-black text-foreground text-xl tracking-tighter">Pilih Karakter Pelanggan</h3>
                              <p className="text-sm text-muted-foreground mt-1 leading-relaxed font-medium">
                         Pilih satu kepribadian pelanggan yang akan Anda hadapi. Karakter ini akan digunakan untuk <span className="text-foreground font-black">semua skenario</span> yang aktif.
                     </p>
                  </div>
                </div>
              </div>

              {/* Selection Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Random Option */}
                  <div
                    onClick={() => handleSelectConsumerType('random')}
                    className={`cursor-pointer p-8 rounded-[2.5rem] border-2 transition-all relative ${
                        localSettings.activeConsumerTypeId === 'random'
                        ? 'border-primary bg-primary/5 shadow-2xl shadow-primary/5'
                        : 'border-transparent bg-card border-border/50 hover:bg-foreground/5'
                    }`}
                  >
                      <div className="flex justify-between items-start">
                          <h4 className="font-black text-foreground tracking-tight flex items-center gap-2 text-lg">
                              🎲 Karakteristik Random
                          </h4>
                          {localSettings.activeConsumerTypeId === 'random' && (
                            <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
                              <Check className="w-4 h-4 text-white" />
                            </div>
                          )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-3 font-medium leading-relaxed">
                          Sistem akan memilih salah satu karakter secara acak setiap kali sesi simulasi dimulai.
                      </p>
                  </div>

                  {/* Defined Types */}
                  {localSettings.consumerTypes.map(c => (
                     <div
                        key={c.id}
                        onClick={() => handleSelectConsumerType(c.id)}
                        className={`cursor-pointer p-8 rounded-[2.5rem] border-2 transition-all relative group ${
                            localSettings.activeConsumerTypeId === c.id
                            ? 'border-primary bg-primary/5 shadow-2xl shadow-primary/5'
                            : 'border-transparent bg-card border-border/50 hover:bg-foreground/5'
                        }`}
                     >
                        <div className="flex justify-between items-start mb-3">
                           <h4 className="font-black text-foreground tracking-tight flex items-center gap-2 text-lg">
                                {c.name}
                           </h4>
                           <div className="flex items-center gap-2">
                                <span className={`text-[9px] px-3 py-1 rounded-lg font-black uppercase tracking-widest border ${
                                    c.difficulty === ConsumerDifficulty.Easy ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                                    c.difficulty === ConsumerDifficulty.Medium ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                                    'bg-red-500/10 text-red-500 border-red-500/20'
                                }`}>
                                    {c.difficulty}
                                </span>
                                {localSettings.activeConsumerTypeId === c.id ? (
                                    <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
                                      <Check className="w-4 h-4 text-white" />
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleEditConsumer(c); }}
                                            className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-all border border-border/50"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDeleteConsumer(c.id); }}
                                            className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all border border-border/50"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                           </div>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed font-medium">
                            {c.description}
                        </p>
                     </div>
                  ))}
              </div>

              {/* Add New Type Button */}
              {!isConsumerFormOpen && (
                 <button
                    onClick={handleAddConsumerClick}
                    className="w-full py-6 flex flex-col items-center justify-center gap-3 bg-card/40 backdrop-blur-md border border-dashed border-border/50 rounded-[2.5rem] text-muted-foreground hover:text-primary hover:border-primary/30 transition-all font-black text-xs uppercase tracking-widest shadow-sm group"
                >
                    <div className="w-12 h-12 rounded-2xl bg-foreground/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                      <Plus className="w-6 h-6" />
                    </div>
                    <span>Buat Karakteristik Baru</span>
                </button>
              )}

              {/* Form for Add/Edit Consumer */}
              {isConsumerFormOpen && (
                  <div id="consumer-form" className="bg-card border border-border/50 rounded-[2.5rem] shadow-3xl overflow-hidden relative">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
                      <div className="px-8 py-6 border-b border-border/50 bg-foreground/5 relative z-10">
                          <h3 className="font-black text-foreground text-lg tracking-tighter">{editingConsumerId ? 'Edit Karakter' : 'Tambah Karakter'}</h3>
                      </div>
                      <div className="p-8 space-y-6 relative z-10">
                          <div>
                              <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3 ml-1">Nama Karakter</label>
                              <input className="w-full rounded-2xl border border-border/50 bg-foreground/5 p-4 text-sm text-foreground focus:ring-2 focus:ring-primary outline-none transition-all placeholder:text-foreground/20" value={newConsumerName} onChange={e => setNewConsumerName(e.target.value)} placeholder="Contoh: Pelanggan Marah" />
                          </div>
                          <div>
                              <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3 ml-1">Tingkat Kesulitan</label>
                              <div className="relative">
                                <select className="w-full rounded-2xl border border-border/50 bg-foreground/5 p-4 text-sm text-foreground focus:ring-2 focus:ring-primary outline-none appearance-none transition-all" value={newConsumerDifficulty} onChange={e => setNewConsumerDifficulty(e.target.value as ConsumerDifficulty)}>
                                    <option value={ConsumerDifficulty.Easy}>Mudah</option>
                                    <option value={ConsumerDifficulty.Medium}>Sedang</option>
                                    <option value={ConsumerDifficulty.Hard}>Sulit</option>
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                                  <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                </div>
                              </div>
                          </div>
                          <div>
                              <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3 ml-1">Deskripsi / AI Prompt</label>
                              <textarea className="w-full rounded-2xl border border-border/50 bg-foreground/5 p-4 text-sm text-foreground focus:ring-2 focus:ring-primary outline-none resize-none transition-all placeholder:text-foreground/20" rows={3} value={newConsumerDesc} onChange={e => setNewConsumerDesc(e.target.value)} placeholder="Deskripsikan bagaimana karakter ini berperilaku..." />
                          </div>
                          <div className="flex justify-end gap-3 pt-6 border-t border-border/50">
                              <button onClick={handleCancelConsumerForm} className="px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:bg-foreground/5 transition-all">Batal</button>
                              <button onClick={handleSaveConsumer} className="px-8 py-3 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all">Simpan</button>
                          </div>
                      </div>
                  </div>
              )}
            </div>
          )}

          {/* TAB 3: IDENTITY */}
          {activeTab === 'identity' && (
              <div className="space-y-8 pb-10">
                {/* Header Section */}
                <div className="bg-card p-8 rounded-[2rem] border border-border/50 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
                  <div className="flex items-start gap-6 relative z-10">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                      <Fingerprint className="w-7 h-7 text-primary" />
                    </div>
                    <div>
                        <h3 className="font-black text-foreground text-xl tracking-tighter">Identitas & Greeting</h3>
                        <p className="text-sm text-muted-foreground mt-1 leading-relaxed font-medium">
                            Konfigurasi profil konsumen dan identitas agen untuk salam pembuka yang lebih personal.
                        </p>
                    </div>
                  </div>
                </div>

                <div className="p-10 rounded-[2.5rem] border border-border/50 bg-card shadow-sm relative overflow-hidden">
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -ml-32 -mb-32 pointer-events-none" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                        <div className="col-span-1">
                            <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3 ml-1">Nama Konsumen (Lengkap)</label>
                            <input type="text" className="w-full rounded-2xl border border-border/50 bg-foreground/5 p-4 text-base text-foreground focus:ring-2 focus:ring-primary outline-none transition-all placeholder:text-foreground/20" placeholder="Contoh: Agus Setiawan" value={localSettings.identitySettings?.displayName || ''} onChange={(e) => handleIdentityChange('displayName', e.target.value)} />
                        </div>
                        <div className="col-span-1">
                            <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3 ml-1">Nama Agen (Greeting Signature)</label>
                            <input type="text" className="w-full rounded-2xl border border-border/50 bg-foreground/5 p-4 text-base text-foreground focus:ring-2 focus:ring-primary outline-none transition-all placeholder:text-foreground/20" placeholder="Contoh: Fajar" value={localSettings.identitySettings?.signatureName || ''} onChange={(e) => handleIdentityChange('signatureName', e.target.value)} />
                        </div>
                        <div className="col-span-1">
                            <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3 ml-1">Nomor Telepon Konsumen</label>
                            <input type="text" className="w-full rounded-2xl border border-border/50 bg-foreground/5 p-4 text-base text-foreground focus:ring-2 focus:ring-primary outline-none transition-all placeholder:text-foreground/20" placeholder="Contoh: 0812..." value={localSettings.identitySettings?.phoneNumber || ''} onChange={(e) => handleIdentityChange('phoneNumber', e.target.value)} />
                        </div>
                        <div className="col-span-1">
                            <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3 ml-1">Kota Asal Konsumen</label>
                            <input type="text" className="w-full rounded-2xl border border-border/50 bg-foreground/5 p-4 text-base text-foreground focus:ring-2 focus:ring-primary outline-none transition-all placeholder:text-foreground/20" placeholder="Contoh: Jakarta" value={localSettings.identitySettings?.city || ''} onChange={(e) => handleIdentityChange('city', e.target.value)} />
                        </div>
                    </div>
                </div>
              </div>
          )}

          {/* TAB 4: SYSTEM */}
          {activeTab === 'system' && (
              <div className="space-y-10 pb-10">
                 {/* AI Model Selection */}
                 <section className="space-y-6">
                    <div className="bg-card p-8 rounded-[2rem] border border-border/50 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
                      <div className="flex items-start gap-6 relative z-10">
                        <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center shrink-0 border border-purple-500/20">
                          <div className="text-3xl">🤖</div>
                        </div>
                        <div>
                           <h3 className="font-black text-foreground text-xl tracking-tighter">Pilih Model Simulasi</h3>
                           <p className="text-sm text-foreground/50 mt-1 leading-relaxed font-medium">
                               Pilih model AI yang akan menggerakkan karakter pelanggan.
                           </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4">
                        {AI_MODELS.map(model => {
                            const isSelected = localSettings.selectedModel === model.id;
                            return (
                                <div
                                    key={model.id}
                                    onClick={() => setLocalSettings(prev => ({ ...prev, selectedModel: model.id }))}
                                    className={`cursor-pointer p-6 rounded-[2rem] border-2 transition-all flex items-center justify-between gap-6 group ${
                                        isSelected
                                        ? 'border-primary bg-primary/5 shadow-2xl shadow-primary/5'
                                        : 'border-transparent bg-card border-border/50 hover:bg-foreground/5'
                                    }`}
                                >
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                          <h4 className="font-black text-foreground tracking-tight text-lg">{model.name}</h4>
                                          <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border ${
                                            model.provider === 'openrouter'
                                            ? 'bg-orange-500/10 text-orange-500 border-orange-500/20'
                                            : 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                                          }`}>
                                            {model.provider}
                                          </span>
                                        </div>
                                        <p className="text-sm text-muted-foreground mt-1 font-medium">{model.description}</p>
                                    </div>
                                    {isSelected && (
                                      <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 shrink-0">
                                        <Check className="w-4 h-4 text-white" />
                                      </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                 </section>

                 {/* Simulation Duration Selection */}
                 <section className="space-y-6">
                    <div className="bg-card p-8 rounded-[2rem] border border-border/50 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
                      <div className="flex items-start gap-6 relative z-10">
                        <div className="w-14 h-14 rounded-2xl bg-orange-500/10 flex items-center justify-center shrink-0 border border-orange-500/20">
                          <Clock className="w-7 h-7 text-orange-500" />
                        </div>
                        <div>
                           <h3 className="font-black text-foreground text-xl tracking-tighter">Durasi Simulasi</h3>
                           <p className="text-sm text-foreground/50 mt-1 leading-relaxed font-medium">
                               Tentukan batas waktu maksimal untuk setiap sesi simulasi.
                           </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-6">
                        {[5, 10, 15].map(duration => {
                            const isSelected = (localSettings.simulationDuration || 5) === duration;
                            return (
                                <div
                                    key={duration}
                                    onClick={() => setLocalSettings(prev => ({ ...prev, simulationDuration: duration }))}
                                    className={`cursor-pointer p-8 rounded-[2.5rem] border-2 transition-all flex flex-col items-center justify-center gap-3 text-center relative group ${
                                        isSelected
                                        ? 'border-primary bg-primary/5 shadow-2xl shadow-primary/5'
                                        : 'border-transparent bg-card border-border/50 hover:bg-foreground/5'
                                    }`}
                                >
                                    <span className={`text-4xl font-black tracking-tighter ${isSelected ? 'text-primary' : 'text-foreground/20'}`}>
                                      {duration}
                                    </span>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Menit</span>
                                    {isSelected && (
                                      <div className="absolute -top-3 -right-3 w-8 h-8 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 z-10">
                                        <Check className="w-4 h-4 text-white" />
                                      </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                 </section>
              </div>
          )}
        </div>

            {/* Modal Footer */}
            <div className="px-10 py-8 border-t border-border/50 flex justify-between items-center bg-card/50 backdrop-blur-2xl shrink-0">
              <button
                onClick={handleResetDefaults}
                className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-red-500/60 hover:text-red-500 transition-all px-6 py-3 rounded-2xl hover:bg-red-500/5 border border-transparent hover:border-red-500/20"
              >
                <RotateCcw className="w-4 h-4" />
                Reset Default
              </button>
              <div className="flex gap-4">
                <button
                  onClick={handleClose}
                  className="px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:bg-foreground/5 transition-all"
                >
                  Batal
                </button>
                <button
                  onClick={handleSave}
                  className="px-10 py-4 bg-foreground text-background rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-2xl shadow-foreground/10 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Simpan Perubahan
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
