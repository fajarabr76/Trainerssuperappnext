'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { AppSettings, ConsumerIdentitySettings, Scenario, ConsumerType } from '../types';
import { ConsumerDifficulty } from '@/app/types';
import { DEFAULT_SCENARIOS, DEFAULT_CONSUMER_TYPES, AI_MODELS } from '../constants';
import { Clock, Trash2, X, Plus, Check, Edit2, User, Settings, FileText, Users, Image as ImageIcon, Save } from 'lucide-react';
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
  const [newScenarioImages, setNewScenarioImages] = useState<string[]>([]);

  // Consumer Form State
  const [editingConsumerId, setEditingConsumerId] = useState<string | null>(null);
  const [newConsumerName, setNewConsumerName] = useState('');
  const [newConsumerDesc, setNewConsumerDesc] = useState('');
  const [newConsumerDifficulty, setNewConsumerDifficulty] = useState<ConsumerDifficulty>(ConsumerDifficulty.Random);

  // Identity Form State
  const handleIdentityChange = (field: keyof ConsumerIdentitySettings, value: string) => {
    setLocalSettings(prev => ({
        ...prev,
        identitySettings: {
            ...prev.identitySettings,
            [field]: value
        }
    }));
  };

  // Reset local state when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalSettings(settings);
      setIsScenarioFormOpen(false);
      setIsConsumerFormOpen(false);
      setEditingScenarioId(null);
      setEditingConsumerId(null);
    }
  }, [isOpen, settings]);

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
      setLocalSettings(prev => ({ ...prev, preferredConsumerTypeId: id }));
  }

  const resetScenarioForm = () => {
    setEditingScenarioId(null);
    setNewScenarioTitle('');
    setNewScenarioDesc('');
    setNewScenarioScript('');
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
                script: newScenarioScript,
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
        script: newScenarioScript,
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
    setNewConsumerDifficulty(ConsumerDifficulty.Random);
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
          preferredConsumerTypeId: prev.preferredConsumerTypeId === id ? 'random' : prev.preferredConsumerTypeId
        };
      });
    }
  };

  const handleSave = () => {
    onSave(localSettings);
    onClose();
  };

  const tabs = [
    { id: 'scenarios', label: 'Masalah', icon: FileText },
    { id: 'consumers', label: 'Karakter', icon: Users },
    { id: 'identity', label: 'Identitas', icon: User },
    { id: 'system', label: 'Sistem', icon: Settings },
  ];

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-md z-[150] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-card w-full max-w-5xl max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-border"
      >
        
        {/* Modal Header */}
        <div className="px-8 py-6 border-b border-border flex justify-between items-center bg-card/50 backdrop-blur-xl shrink-0">
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Pengaturan Simulasi</h2>
          <div className="flex items-center gap-3">
            <button 
                onClick={handleSave}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-xl font-bold text-sm transition-all shadow-lg shadow-primary/20 flex items-center gap-2"
            >
                <Save className="w-4 h-4" />
                Simpan Perubahan
            </button>
            <button 
                onClick={handleClose} 
                className="w-9 h-9 flex items-center justify-center bg-foreground/5 hover:bg-foreground/10 rounded-full text-foreground/60 transition-all"
            >
                <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Segmented Control Tabs */}
        <div className="px-8 pt-6 pb-2 shrink-0 bg-card">
          <div className="flex p-1 bg-foreground/5 rounded-xl">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all relative ${
                  activeTab === tab.id 
                    ? 'text-foreground shadow-sm' 
                    : 'text-foreground/40 hover:text-foreground/60'
                }`}
              >
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTabTele"
                    className="absolute inset-0 bg-card rounded-lg shadow-sm"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-8 bg-background">
          
          {/* TAB 1: SCENARIOS */}
          {activeTab === 'scenarios' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                 <div>
                     <h3 className="font-bold text-gray-900 dark:text-white text-lg">
                        Daftar Skenario
                     </h3>
                     <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                       {activeCount} dari {totalScenarios} skenario dipilih
                     </p>
                 </div>
                 
                 <div className="flex items-center gap-2">
                     <button 
                        onClick={handleSelectAll}
                        disabled={allSelected}
                        className="px-4 py-2 bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-white/10 rounded-xl text-xs font-bold text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                     >
                        Pilih Semua
                     </button>
                     <button 
                        onClick={handleUnselectAll}
                        disabled={noneSelected}
                        className="px-4 py-2 bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-white/10 rounded-xl text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                     >
                        Hapus Semua
                     </button>
                 </div>
              </div>
                
              {/* Scenario List */}
              <div className="grid grid-cols-1 gap-3">
                  {localSettings.scenarios.map(scenario => (
                  <motion.div 
                    layout
                    key={scenario.id} 
                    className={`flex items-start p-5 rounded-2xl border transition-all ${
                      scenario.isActive 
                        ? 'bg-white dark:bg-[#1C1C1E] border-blue-500/30 shadow-md' 
                        : 'bg-gray-50 dark:bg-[#1C1C1E]/50 border-gray-200 dark:border-white/5 opacity-70'
                    }`}
                  >
                      {/* Checkbox */}
                      <div className="pt-1 mr-4">
                          <button
                              onClick={() => handleToggleScenario(scenario.id)}
                              className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                                scenario.isActive 
                                  ? 'bg-blue-500 border-blue-500 text-white' 
                                  : 'border-gray-300 dark:border-gray-600 bg-transparent'
                              }`}
                          >
                            {scenario.isActive && <Check className="w-4 h-4" />}
                          </button>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-gray-100 dark:bg-[#2C2C2E] text-gray-600 dark:text-gray-300">
                                {scenario.category}
                              </span>
                              <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                                {scenario.title}
                              </h4>
                          </div>
                          <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                              {scenario.description}
                          </p>
                           {scenario.images && scenario.images.length > 0 && (
                              <div className="mt-2">
                                   <span className="text-[10px] bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-md inline-flex items-center gap-1 font-medium">
                                      <ImageIcon className="w-3 h-3" /> {scenario.images.length} Lampiran
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
                    className="w-full py-4 flex items-center justify-center gap-2 bg-white dark:bg-[#1C1C1E] border border-dashed border-gray-300 dark:border-white/10 rounded-2xl text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 hover:border-blue-500/30 dark:hover:border-blue-400/30 transition-all font-bold text-sm shadow-sm"
                >
                    <Plus className="w-5 h-5" />
                    <span>Tambah Skenario Baru</span>
                </button>
              ) : (
                /* Edit Form */
                <div id="scenario-form" className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-200 dark:border-white/10 shadow-lg overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-[#2C2C2E]/50">
                         <h3 className="font-bold text-gray-900 dark:text-white text-base">
                            {editingScenarioId ? 'Edit Skenario' : 'Tambah Skenario Baru'}
                        </h3>
                    </div>
                    <div className="p-6 grid grid-cols-2 gap-5">
                        <div className="col-span-2">
                             <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Kategori</label>
                             {!isNewCategoryInput ? (
                                <div className="relative">
                                  <select 
                                    className="w-full rounded-xl border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#2C2C2E] p-3 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none" 
                                    value={newScenarioCategory} 
                                    onChange={(e) => {if (e.target.value === 'NEW') {setIsNewCategoryInput(true); setNewScenarioCategory('');} else {setNewScenarioCategory(e.target.value);}}}
                                  >
                                      <option value="">Pilih Kategori</option>
                                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                      <option value="NEW">+ Tambah Kategori Lainnya</option>
                                  </select>
                                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                  </div>
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <input type="text" className="flex-1 rounded-xl border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#2C2C2E] p-3 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Kategori Baru" value={newScenarioCategory} onChange={(e) => setNewScenarioCategory(e.target.value)} />
                                    <button onClick={() => setIsNewCategoryInput(false)} className="px-4 text-xs text-red-500 font-bold hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all">Batal</button>
                                </div>
                            )}
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Judul Masalah</label>
                            <input type="text" className="w-full rounded-xl border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#2C2C2E] p-3 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Contoh: Gagal Transfer" value={newScenarioTitle} onChange={(e) => setNewScenarioTitle(e.target.value)} />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Deskripsi Masalah</label>
                            <textarea className="w-full rounded-xl border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#2C2C2E] p-3 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none" rows={3} value={newScenarioDesc} onChange={(e) => setNewScenarioDesc(e.target.value)} />
                        </div>
                        <div className="col-span-2">
                             <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Instruksi Khusus Simulasi (Opsional)</label>
                             <textarea className="w-full rounded-xl border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#2C2C2E] p-3 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none" rows={3} value={newScenarioScript} onChange={(e) => setNewScenarioScript(e.target.value)} placeholder="Berikan instruksi tambahan untuk perilaku simulasi..." />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Lampiran Gambar</label>
                            <div className="flex items-center justify-center w-full">
                                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-xl cursor-pointer bg-gray-50 dark:hover:bg-[#2C2C2E] dark:bg-[#1C1C1E] hover:bg-gray-100 dark:border-gray-600 dark:hover:border-gray-500">
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <ImageIcon className="w-8 h-8 mb-3 text-gray-400" />
                                        <p className="mb-2 text-sm text-gray-500 dark:text-gray-400"><span className="font-semibold">Klik untuk upload</span> atau drag and drop</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">PNG, JPG (MAX. 500KB)</p>
                                    </div>
                                    <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
                                </label>
                            </div> 
                            {newScenarioImages.length > 0 && (
                              <div className="flex gap-3 mt-4 overflow-x-auto pb-2">
                                {newScenarioImages.map((img, idx) => (
                                  <div key={idx} className="relative w-20 h-20 shrink-0 group">
                                  <div className="relative w-full h-full">
                                    <Image 
                                      src={img} 
                                      alt={`Preview ${idx}`}
                                      fill
                                      className="object-cover rounded-xl border border-gray-200 dark:border-white/10"
                                      unoptimized
                                    />
                                  </div>
                                    <button onClick={() => removeImage(idx)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity">
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                        </div>
                        <div className="col-span-2 flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-white/10">
                             <button onClick={handleCancelScenarioForm} className="px-6 py-2.5 rounded-xl text-gray-600 dark:text-gray-400 font-bold hover:bg-gray-100 dark:hover:bg-[#2C2C2E] transition-all">Batal</button>
                             <button onClick={handleSaveScenario} disabled={!newScenarioTitle} className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed">Simpan</button>
                        </div>
                    </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CONSUMERS (Global Selection) */}
          {activeTab === 'consumers' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-[#1C1C1E] p-6 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center shrink-0">
                    <Users className="w-6 h-6 text-orange-500" />
                  </div>
                  <div>
                     <h3 className="font-bold text-gray-900 dark:text-white text-lg">Pilih Karakter Pelanggan</h3>
                     <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                         Pilih satu kepribadian pelanggan yang akan Anda hadapi. Karakter ini akan digunakan untuk <strong>semua skenario</strong> masalah yang telah Anda pilih.
                     </p>
                  </div>
                </div>
              </div>

              {/* Selection Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Random Option */}
                  <div 
                    onClick={() => handleSelectConsumerType('random')}
                    className={`cursor-pointer p-6 rounded-2xl border-2 transition-all relative ${
                        localSettings.preferredConsumerTypeId === 'random'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10' 
                        : 'border-transparent bg-white dark:bg-[#1C1C1E] hover:bg-gray-50 dark:hover:bg-[#2C2C2E]'
                    }`}
                  >
                      <div className="flex justify-between items-start">
                          <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                              🎲 Karakteristik Random
                          </h4>
                          {localSettings.preferredConsumerTypeId === 'random' && <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center"><Check className="w-3.5 h-3.5 text-white" /></div>}
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                          Sistem akan memilih salah satu karakter secara acak setiap kali sesi simulasi dimulai.
                      </p>
                  </div>

                  {/* Defined Types */}
                  {localSettings.consumerTypes.map(c => (
                     <div 
                        key={c.id} 
                        onClick={() => handleSelectConsumerType(c.id)}
                        className={`cursor-pointer p-6 rounded-2xl border-2 transition-all relative group ${
                            localSettings.preferredConsumerTypeId === c.id
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10' 
                            : 'border-transparent bg-white dark:bg-[#1C1C1E] hover:bg-gray-50 dark:hover:bg-[#2C2C2E]'
                        }`}
                     >
                        <div className="flex justify-between items-start mb-2">
                           <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                {c.name}
                           </h4>
                           <div className="flex items-center gap-2">
                                <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase ${
                                    c.difficulty === ConsumerDifficulty.Easy ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' :
                                    c.difficulty === ConsumerDifficulty.Medium ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400' :
                                    'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                                }`}>
                                    {c.difficulty}
                                </span>
                                {localSettings.preferredConsumerTypeId === c.id ? (
                                    <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center"><Check className="w-3.5 h-3.5 text-white" /></div>
                                ) : (
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleEditConsumer(c); }}
                                            className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-all"
                                        >
                                            <Edit2 className="w-3.5 h-3.5" />
                                        </button>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleDeleteConsumer(c.id); }}
                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                )}
                           </div>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                            {c.description}
                        </p>
                     </div>
                  ))}
              </div>

              {/* Add New Type Button */}
              {!isConsumerFormOpen && (
                 <button
                    onClick={handleAddConsumerClick}
                    className="w-full py-4 flex items-center justify-center gap-2 bg-white dark:bg-[#1C1C1E] border border-dashed border-gray-300 dark:border-white/10 rounded-2xl text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 hover:border-blue-500/30 dark:hover:border-blue-400/30 transition-all font-bold text-sm shadow-sm"
                >
                    <Plus className="w-5 h-5" />
                    <span>Buat Karakteristik Baru</span>
                </button>
              )}
              
              {/* Form for Add/Edit Consumer */}
              {isConsumerFormOpen && (
                  <div id="consumer-form" className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-200 dark:border-white/10 shadow-lg overflow-hidden">
                      <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-[#2C2C2E]/50">
                          <h3 className="font-bold text-gray-900 dark:text-white text-base">{editingConsumerId ? 'Edit Karakter' : 'Tambah Karakter'}</h3>
                      </div>
                      <div className="p-6 space-y-5">
                          <div>
                              <label className="block text-xs font-bold uppercase mb-2 text-gray-500 dark:text-gray-400">Nama</label>
                              <input className="w-full rounded-xl border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#2C2C2E] p-3 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" value={newConsumerName} onChange={e => setNewConsumerName(e.target.value)} placeholder="Contoh: Pelanggan Marah" />
                          </div>
                          <div>
                              <label className="block text-xs font-bold uppercase mb-2 text-gray-500 dark:text-gray-400">Kesulitan</label>
                              <div className="relative">
                                <select className="w-full rounded-xl border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#2C2C2E] p-3 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none" value={newConsumerDifficulty} onChange={e => setNewConsumerDifficulty(e.target.value as any)}>
                                    <option value={ConsumerDifficulty.Easy}>Mudah</option>
                                    <option value={ConsumerDifficulty.Medium}>Sedang</option>
                                    <option value={ConsumerDifficulty.Hard}>Sulit</option>
                                    <option value={ConsumerDifficulty.Random}>Random</option>
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                                  <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                </div>
                              </div>
                          </div>
                          <div>
                              <label className="block text-xs font-bold uppercase mb-2 text-gray-500 dark:text-gray-400">Deskripsi/Prompt</label>
                              <textarea className="w-full rounded-xl border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#2C2C2E] p-3 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none" rows={3} value={newConsumerDesc} onChange={e => setNewConsumerDesc(e.target.value)} placeholder="Deskripsikan bagaimana karakter ini berperilaku..." />
                          </div>
                          <div className="flex justify-end gap-3 pt-2">
                              <button onClick={handleCancelConsumerForm} className="px-6 py-2.5 rounded-xl text-gray-600 dark:text-gray-400 font-bold hover:bg-gray-100 dark:hover:bg-[#2C2C2E] transition-all">Batal</button>
                              <button onClick={handleSaveConsumer} className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all">Simpan</button>
                          </div>
                      </div>
                  </div>
              )}
            </div>
          )}

          {/* TAB 3: IDENTITY */}
          {activeTab === 'identity' && (
             <div className="space-y-6">
                <div className="bg-white dark:bg-[#1C1C1E] p-6 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center shrink-0">
                      <User className="w-6 h-6 text-green-500" />
                    </div>
                    <div>
                       <h3 className="font-bold text-gray-900 dark:text-white text-lg">Atur Identitas Simulasi</h3>
                       <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                           Konfigurasi nama konsumen dan data lainnya.
                       </p>
                    </div>
                  </div>
                </div>

                <div className="p-8 rounded-[2.5rem] border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1C1C1E] shadow-sm">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="col-span-1">
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-3 ml-1">Nama Konsumen (Lengkap)</label>
                            <input type="text" className="w-full rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#2C2C2E] p-4 text-base text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="Contoh: Agus Setiawan" value={localSettings.identitySettings?.displayName || ''} onChange={(e) => handleIdentityChange('displayName', e.target.value)} />
                        </div>
                        <div className="col-span-1">
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-3 ml-1">Jenis Kelamin</label>
                            <div className="relative">
                                <select 
                                    className="w-full rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#2C2C2E] p-4 text-base text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                                    value={localSettings.identitySettings?.gender || 'male'}
                                    onChange={(e) => handleIdentityChange('gender', e.target.value as 'male' | 'female')}
                                >
                                    <option value="male">Laki-laki</option>
                                    <option value="female">Perempuan</option>
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                                    <svg width="12" height="8" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                </div>
                            </div>
                        </div>
                        <div className="col-span-1">
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-3 ml-1">Nomor Telepon Konsumen</label>
                            <input type="text" className="w-full rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#2C2C2E] p-4 text-base text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="Contoh: 0812..." value={localSettings.identitySettings?.phoneNumber || ''} onChange={(e) => handleIdentityChange('phoneNumber', e.target.value)} />
                        </div>
                        <div className="col-span-1">
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-3 ml-1">Kota Konsumen</label>
                            <input type="text" className="w-full rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#2C2C2E] p-4 text-base text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="Contoh: Jakarta" value={localSettings.identitySettings?.city || ''} onChange={(e) => handleIdentityChange('city', e.target.value)} />
                        </div>
                    </div>
                </div>
             </div>
          )}

          {/* TAB 4: SYSTEM */}
          {activeTab === 'system' && (
              <div className="space-y-8">
                 {/* AI Model Selection */}
                 <section className="space-y-4">
                    <div className="bg-white dark:bg-[#1C1C1E] p-6 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center shrink-0">
                          <div className="text-2xl">🤖</div>
                        </div>
                        <div>
                           <h3 className="font-bold text-gray-900 dark:text-white text-lg">Pilih Model Simulasi</h3>
                           <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                               Pilih model yang paling sesuai dengan kebutuhan latensi dan kecerdasan.
                           </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3">
                        {AI_MODELS.map(model => {
                            const isSelected = localSettings.selectedModel === model.id;
                            return (
                                <div 
                                    key={model.id}
                                    onClick={() => setLocalSettings(prev => ({ ...prev, selectedModel: model.id }))}
                                    className={`cursor-pointer p-5 rounded-2xl border-2 transition-all flex items-center justify-between gap-4 group ${
                                        isSelected 
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10' 
                                        : 'border-transparent bg-white dark:bg-[#1C1C1E] hover:bg-gray-50 dark:hover:bg-[#2C2C2E]'
                                    }`}
                                >
                                    <div>
                                        <h4 className="font-bold text-gray-900 dark:text-white text-base">{model.name}</h4>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{model.description}</p>
                                    </div>
                                    {isSelected && <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center"><Check className="w-3.5 h-3.5 text-white" /></div>}
                                </div>
                            );
                        })}
                    </div>
                 </section>

                 {/* Simulation Duration Selection */}
                 <section className="space-y-4">
                    <div className="bg-white dark:bg-[#1C1C1E] p-6 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center shrink-0">
                          <Clock className="w-6 h-6 text-orange-500" />
                        </div>
                        <div>
                           <h3 className="font-bold text-gray-900 dark:text-white text-lg">Durasi Simulasi</h3>
                           <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                               Tentukan batas waktu maksimal untuk setiap sesi simulasi.
                           </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        {[5, 10, 15].map(duration => {
                            const isSelected = (localSettings.maxCallDuration || 5) === duration;
                            return (
                                <div 
                                    key={duration}
                                    onClick={() => setLocalSettings(prev => ({ ...prev, maxCallDuration: duration }))}
                                    className={`cursor-pointer p-6 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-2 text-center relative group ${
                                        isSelected 
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10' 
                                        : 'border-transparent bg-white dark:bg-[#1C1C1E] hover:bg-gray-50 dark:hover:bg-[#2C2C2E]'
                                    }`}
                                >
                                    <span className={`text-xl font-bold ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
                                        {duration} Menit
                                    </span>
                                    {isSelected && <div className="absolute top-3 right-3 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center"><Check className="w-3 h-3 text-white" /></div>}
                                </div>
                            );
                        })}
                    </div>
                 </section>
              </div>
          )}

        </div>
      </motion.div>
    </div>
  );
};
