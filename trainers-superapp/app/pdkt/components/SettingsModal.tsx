'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { AppSettings, Scenario, ConsumerType, Identity, ConsumerDifficulty } from '../types';
import { DEFAULT_SCENARIOS, DEFAULT_CONSUMER_TYPES } from '../constants';
import { X, Plus, Check, Edit2, Trash2, Image as ImageIcon, User, Settings, FileText, Users, Clock, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (newSettings: AppSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSave }) => {
  const [activeTab, setActiveTab] = useState<'scenarios' | 'consumers' | 'identity'>('scenarios');
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  
  // Scenario Form State
  const [editingScenarioId, setEditingScenarioId] = useState<string | null>(null);
  const [isAddingScenario, setIsAddingScenario] = useState(false);
  const [newScenarioCategory, setNewScenarioCategory] = useState('');
  const [isNewCategoryInput, setIsNewCategoryInput] = useState(false);
  const [newScenarioTitle, setNewScenarioTitle] = useState('');
  const [newScenarioDesc, setNewScenarioDesc] = useState('');
  const [newScenarioScript, setNewScenarioScript] = useState('');
  
  // Changed to array for multiple images
  const [newScenarioImages, setNewScenarioImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Consumer Form State
  const [editingConsumerId, setEditingConsumerId] = useState<string | null>(null);
  const [isAddingConsumer, setIsAddingConsumer] = useState(false);
  const [newConsumerName, setNewConsumerName] = useState('');
  const [newConsumerDesc, setNewConsumerDesc] = useState('');
  const [newConsumerDifficulty, setNewConsumerDifficulty] = useState<ConsumerDifficulty>(ConsumerDifficulty.Medium);
  const [newConsumerTone, setNewConsumerTone] = useState('');

  // Identity Form State
  const [customSenderName, setCustomSenderName] = useState(localSettings.customIdentity?.senderName || '');
  const [customBodyName, setCustomBodyName] = useState(localSettings.customIdentity?.bodyName || '');
  const [customEmail, setCustomEmail] = useState(localSettings.customIdentity?.email || '');
  const [customCity, setCustomCity] = useState(localSettings.customIdentity?.city || '');

  // Global Settings
  const [enableImageGeneration, setEnableImageGeneration] = useState(localSettings.enableImageGeneration ?? true);
  const [globalConsumerTypeId, setGlobalConsumerTypeId] = useState(localSettings.globalConsumerTypeId || 'random');

  // Sync state when modal opens to ensure fresh data
  useEffect(() => {
    if (isOpen) {
        setLocalSettings(settings);
        setCustomSenderName(settings.customIdentity?.senderName || '');
        setCustomBodyName(settings.customIdentity?.bodyName || '');
        setCustomEmail(settings.customIdentity?.email || '');
        setCustomCity(settings.customIdentity?.city || '');
        setEnableImageGeneration(settings.enableImageGeneration ?? true);
        setGlobalConsumerTypeId(settings.globalConsumerTypeId || 'random');
        
        // Reset forms
        setEditingScenarioId(null);
        setIsAddingScenario(false);
        setNewScenarioImages([]);
        setEditingConsumerId(null);
        setIsAddingConsumer(false);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const categories = Array.from(new Set(localSettings.scenarios.map(s => s.category)));

  const handleToggleScenario = (id: string) => {
    setLocalSettings(prev => ({
      ...prev,
      scenarios: prev.scenarios.map(s => s.id === id ? { ...s, isActive: !s.isActive } : s)
    }));
  };

  const handleToggleAllScenarios = (checked: boolean) => {
    setLocalSettings(prev => ({
      ...prev,
      scenarios: prev.scenarios.map(s => ({ ...s, isActive: checked }))
    }));
  };

  const handleAddScenario = () => {
    setEditingScenarioId(null);
    setIsAddingScenario(true);
    setNewScenarioCategory('');
    setNewScenarioTitle('');
    setNewScenarioDesc('');
    setNewScenarioScript('');
    setNewScenarioImages([]);
    setIsNewCategoryInput(false);
    
    // Scroll form into view
    setTimeout(() => {
        const formElement = document.getElementById('scenario-form');
        if (formElement) {
          formElement.scrollIntoView({ behavior: 'smooth' });
        }
    }, 100);
  };

  const handleEditScenario = (scenario: Scenario) => {
    setEditingScenarioId(scenario.id);
    setIsAddingScenario(true);
    setNewScenarioCategory(scenario.category);
    setNewScenarioTitle(scenario.title);
    setNewScenarioDesc(scenario.description);
    setNewScenarioScript(scenario.script || '');
    
    // Handle migration: Check for attachmentImages (new) or attachmentImage (old legacy data)
    let images: string[] = [];
    if (scenario.attachmentImages && Array.isArray(scenario.attachmentImages)) {
        images = scenario.attachmentImages;
    }
    setNewScenarioImages(images);

    setIsNewCategoryInput(!categories.includes(scenario.category));
    
    // Scroll form into view
    setTimeout(() => {
      const formElement = document.getElementById('scenario-form');
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  const resetScenarioForm = () => {
    setEditingScenarioId(null);
    setIsAddingScenario(false);
    setNewScenarioTitle('');
    setNewScenarioDesc('');
    setNewScenarioScript('');
    setNewScenarioCategory('');
    setNewScenarioImages([]);
    setIsNewCategoryInput(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0]; // Process one by one for now to check size
      
      // Limit size to 500KB to prevent LocalStorage quota exceeded
      if (file.size > 500 * 1024) {
        alert("Ukuran gambar terlalu besar! Maksimal 500KB per gambar agar pengaturan dapat disimpan.");
        return;
      }
      
      // Check total images limit (e.g. max 5)
      if (newScenarioImages.length >= 5) {
          alert("Maksimal 5 gambar per skenario.");
          return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setNewScenarioImages(prev => [...prev, base64String]);
      };
      reader.readAsDataURL(file);
    }
    // Reset input so same file can be selected again if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setNewScenarioImages(prev => prev.filter((_, index) => index !== indexToRemove));
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
                attachmentImages: newScenarioImages
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
        attachmentImages: newScenarioImages
      };
      setLocalSettings(prev => ({
        ...prev,
        scenarios: [...prev.scenarios, newScenario]
      }));
    }
    resetScenarioForm();
  };

  const handleAddConsumer = () => {
    setEditingConsumerId(null);
    setIsAddingConsumer(true);
    setNewConsumerName('');
    setNewConsumerDesc('');
    setNewConsumerDifficulty(ConsumerDifficulty.Medium);
    setNewConsumerTone('');
    
    setTimeout(() => {
        const formElement = document.getElementById('consumer-form');
        if (formElement) {
          formElement.scrollIntoView({ behavior: 'smooth' });
        }
    }, 100);
  };

  const handleEditConsumer = (consumer: ConsumerType) => {
    setEditingConsumerId(consumer.id);
    setIsAddingConsumer(true);
    setNewConsumerName(consumer.name);
    setNewConsumerDesc(consumer.description);
    setNewConsumerDifficulty(consumer.difficulty);
    setNewConsumerTone(consumer.tone);
    
    setTimeout(() => {
        const formElement = document.getElementById('consumer-form');
        if (formElement) {
          formElement.scrollIntoView({ behavior: 'smooth' });
        }
    }, 100);
  };

  const resetConsumerForm = () => {
    setEditingConsumerId(null);
    setIsAddingConsumer(false);
    setNewConsumerName('');
    setNewConsumerDesc('');
    setNewConsumerDifficulty(ConsumerDifficulty.Medium);
    setNewConsumerTone('');
  };

  const handleSaveConsumer = () => {
    if (!newConsumerName || !newConsumerDesc) return;

    if (editingConsumerId) {
      setLocalSettings(prev => ({
        ...prev,
        consumerTypes: prev.consumerTypes.map(c => 
          c.id === editingConsumerId 
            ? { ...c, name: newConsumerName, description: newConsumerDesc, difficulty: newConsumerDifficulty, tone: newConsumerTone }
            : c
        )
      }));
    } else {
      const newConsumer: ConsumerType = {
        id: `c-${Date.now()}`,
        name: newConsumerName,
        description: newConsumerDesc,
        difficulty: newConsumerDifficulty,
        tone: newConsumerTone,
        isCustom: true
      };
      setLocalSettings(prev => ({
        ...prev,
        consumerTypes: [...prev.consumerTypes, newConsumer]
      }));
    }
    resetConsumerForm();
  };

  const handleSave = () => {
    try {
      // Test localStorage size before closing
      const settingsToSave: AppSettings = {
        ...localSettings,
        enableImageGeneration,
        globalConsumerTypeId,
        customIdentity: {
          senderName: customSenderName,
          bodyName: customBodyName,
          email: customEmail,
          city: customCity
        }
      };
      
      const json = JSON.stringify(settingsToSave);
      localStorage.setItem('TEST_STORAGE', json);
      localStorage.removeItem('TEST_STORAGE');
      
      onSave(settingsToSave);
      onClose();
    } catch (e) {
      alert("Gagal menyimpan! Ukuran data (gambar) terlalu besar untuk penyimpanan browser. Silakan hapus beberapa gambar.");
      console.error(e);
    }
  };

  const handleResetDefaults = () => {
      if (window.confirm("Apakah Anda yakin ingin mereset semua pengaturan (skenario & karakteristik) ke awal? Data yang Anda buat akan hilang.")) {
          // Prepare clean defaults
          const defaultSettings: AppSettings = {
              scenarios: DEFAULT_SCENARIOS,
              consumerTypes: DEFAULT_CONSUMER_TYPES,
              enableImageGeneration: true,
              globalConsumerTypeId: 'random',
              customIdentity: {
                senderName: '',
                email: '',
                city: '',
                bodyName: ''
              }
          };

          // Update local state
          setLocalSettings(defaultSettings);
          setEnableImageGeneration(true);
          setGlobalConsumerTypeId('random');
          setCustomSenderName('');
          setCustomBodyName('');
          setCustomEmail('');
          setCustomCity('');

          // Cancel any active edits to prevent errors
          resetScenarioForm();
          resetConsumerForm();
          
          // Immediately save to storage and close to ensure it works
          onSave(defaultSettings);
          onClose();
      }
  }

  const tabs = [
    { id: 'scenarios', label: 'Masalah', icon: FileText },
    { id: 'consumers', label: 'Karakter', icon: Users },
    { id: 'identity', label: 'Identitas', icon: User },
  ];

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

  const handleDeleteScenario = (id: string) => {
    if (window.confirm('Hapus skenario ini?')) {
      setLocalSettings(prev => ({
        ...prev,
        scenarios: prev.scenarios.filter(s => s.id !== id)
      }));
    }
  };

  const handleDeleteConsumer = (id: string) => {
    if (window.confirm('Hapus karakteristik ini?')) {
      setLocalSettings(prev => {
        const newTypes = prev.consumerTypes.filter(c => c.id !== id);
        return {
          ...prev,
          consumerTypes: newTypes,
          globalConsumerTypeId: prev.globalConsumerTypeId === id ? 'random' : prev.globalConsumerTypeId
        };
      });
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md z-[200] flex items-center justify-center p-4">
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
            className="relative bg-card w-full max-w-5xl max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-border"
          >
            
            {/* Modal Header */}
            <div className="px-8 py-6 border-b border-border flex justify-between items-center bg-card/50 backdrop-blur-xl shrink-0">
              <h2 className="text-2xl font-bold text-foreground tracking-tight">Pengaturan Simulasi</h2>
              <div className="flex items-center gap-2">
                <button 
                    onClick={handleSave}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2"
                >
                    <Save className="w-4 h-4" /> Simpan Perubahan
                </button>
                <button 
                    onClick={onClose} 
                    className="w-9 h-9 flex items-center justify-center bg-foreground/5 hover:bg-foreground/10 rounded-full text-foreground/40 transition-all"
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
                        ? 'text-gray-900 dark:text-white shadow-sm' 
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    }`}
                  >
                    {activeTab === tab.id && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute inset-0 bg-card rounded-lg"
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
                            onClick={() => setEnableImageGeneration(!enableImageGeneration)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all shadow-sm flex items-center gap-2 ${enableImageGeneration ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white dark:bg-[#1C1C1E] border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400'}`}
                         >
                            <ImageIcon className="w-3.5 h-3.5" />
                            {enableImageGeneration ? 'Gambar AI Aktif' : 'Gambar AI Nonaktif'}
                         </button>
                         <div className="h-6 w-px bg-gray-300 dark:bg-gray-700 mx-1"></div>
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
                            ? 'bg-card border-blue-500/30 shadow-md' 
                            : 'bg-foreground/5 border-border opacity-70'
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
                               {((scenario.attachmentImages && scenario.attachmentImages.length > 0)) && (
                                  <div className="mt-2">
                                       <span className="text-[10px] bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-md inline-flex items-center gap-1 font-medium">
                                          <ImageIcon className="w-3 h-3" /> 
                                          {scenario.attachmentImages?.length} Lampiran
                                      </span>
                                  </div>
                              )}
                          </div>

                          {/* Action */}
                          <div className="flex items-center gap-2 ml-4">
                              <button 
                                  onClick={() => handleEditScenario(scenario)}
                                  className="p-2 text-foreground/40 hover:text-blue-500 hover:bg-blue-500/10 rounded-xl transition-all"
                              >
                                  <Edit2 className="w-4 h-4" />
                              </button>
                              <button 
                                  onClick={() => handleDeleteScenario(scenario.id)}
                                  className="p-2 text-foreground/40 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                              >
                                  <Trash2 className="w-4 h-4" />
                              </button>
                          </div>
                      </motion.div>
                      ))}
                  </div>

                  {!isAddingScenario && !editingScenarioId ? (
                    <button 
                      onClick={handleAddScenario}
                      className="w-full py-4 rounded-xl border-2 border-dashed border-border text-foreground/60 font-bold hover:bg-foreground/5 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-all flex items-center justify-center gap-2 shadow-sm bg-card"
                    >
                      <Plus className="w-5 h-5" />
                      Tambah Skenario Baru
                    </button>
                  ) : (
                    <div id="scenario-form" className="bg-card rounded-2xl border border-border shadow-lg overflow-hidden">
                      <div className="px-6 py-4 border-b border-border bg-foreground/5 flex justify-between items-center">
                        <h3 className="font-bold text-foreground text-base">
                          {editingScenarioId ? 'Edit Skenario' : 'Tambah Skenario Baru'}
                        </h3>
                        <button 
                          onClick={resetScenarioForm}
                          className="text-foreground/40 hover:text-red-500 transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="p-6 grid grid-cols-2 gap-5">
                      <div className="col-span-2 md:col-span-1">
                        <label className="block text-xs font-bold text-foreground/60 uppercase mb-2">Kategori</label>
                        {!isNewCategoryInput ? (
                          <div className="relative">
                            <select 
                              className="w-full rounded-xl border-border bg-foreground/5 p-3 text-sm text-foreground focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                              value={newScenarioCategory}
                              onChange={(e) => {
                                if (e.target.value === 'NEW') {
                                  setIsNewCategoryInput(true);
                                  setNewScenarioCategory('');
                                } else {
                                  setNewScenarioCategory(e.target.value);
                                }
                              }}
                            >
                              <option value="">Pilih Kategori</option>
                              {categories.map(c => <option key={c} value={c}>{c}</option>)}
                              <option value="NEW">+ Tambah Kategori Lainnya</option>
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-foreground/40">
                              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <input 
                              type="text"
                              className="flex-1 rounded-xl border-border bg-foreground/5 p-3 text-sm text-foreground focus:ring-2 focus:ring-blue-500 outline-none"
                              placeholder="Nama Kategori Baru"
                              value={newScenarioCategory}
                              onChange={(e) => setNewScenarioCategory(e.target.value)}
                            />
                            <button 
                              onClick={() => setIsNewCategoryInput(false)}
                              className="px-4 text-xs text-red-500 font-bold hover:bg-red-500/10 rounded-xl transition-all"
                            >
                              Batal
                            </button>
                          </div>
                        )}
                      </div>
                      
                      <div className="col-span-2">
                        <label className="block text-xs font-bold text-foreground/60 uppercase mb-2">Judul Masalah</label>
                        <input 
                          type="text"
                          className="w-full rounded-xl border-border bg-foreground/5 p-3 text-sm text-foreground focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder="Contoh: Gagal Transfer Antar Bank"
                          value={newScenarioTitle}
                          onChange={(e) => setNewScenarioTitle(e.target.value)}
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-bold text-foreground/60 uppercase mb-2">Deskripsi Masalah</label>
                        <textarea 
                          className="w-full rounded-xl border-border bg-foreground/5 p-3 text-sm text-foreground focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                          rows={3}
                          placeholder="Jelaskan detail masalah yang akan dihadapi agen..."
                          value={newScenarioDesc}
                          onChange={(e) => setNewScenarioDesc(e.target.value)}
                        />
                      </div>
                      
                      <div className="col-span-2">
                        <label className="block text-xs font-bold text-foreground/60 uppercase mb-2">Instruksi Khusus Simulasi (Opsional)</label>
                        <textarea 
                          className="w-full rounded-xl border-border bg-foreground/5 p-3 text-sm text-foreground focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                          rows={2}
                          placeholder="Instruksi tambahan untuk perilaku simulasi dalam skenario ini..."
                          value={newScenarioScript}
                          onChange={(e) => setNewScenarioScript(e.target.value)}
                        />
                      </div>
                      
                      <div className="col-span-2">
                        <label className="block text-xs font-bold text-foreground/60 uppercase mb-2">Lampiran Gambar</label>
                        <div className="flex items-center justify-center w-full">
                            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-border border-dashed rounded-xl cursor-pointer bg-foreground/5 hover:bg-foreground/10 transition-all">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <ImageIcon className="w-8 h-8 mb-3 text-foreground/40" />
                                    <p className="mb-2 text-sm text-foreground/60"><span className="font-semibold">Klik untuk upload</span> atau drag and drop</p>
                                    <p className="text-xs text-foreground/40">PNG, JPG (MAX. 500KB)</p>
                                </div>
                                <input 
                                    type="file" 
                                    accept="image/*" 
                                    ref={fileInputRef}
                                    onChange={handleImageUpload} 
                                    className="hidden" 
                                />
                            </label>
                        </div> 
                        
                        {newScenarioImages.length > 0 && (
                          <div className="flex gap-3 mt-4 overflow-x-auto pb-2">
                            {newScenarioImages.map((img, index) => (
                              <div key={index} className="relative w-20 h-20 shrink-0 group">
                                <Image 
                                  src={img} 
                                  alt={`Preview ${index}`} 
                                  width={80}
                                  height={80}
                                  className="w-full h-full object-cover rounded-xl border border-border" 
                                />
                                <button 
                                  onClick={() => handleRemoveImage(index)}
                                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="col-span-2 flex justify-end gap-3 pt-4 border-t border-border">
                        <button 
                          onClick={resetScenarioForm}
                          className="px-6 py-2.5 rounded-xl text-foreground/60 font-bold hover:bg-foreground/5 transition-all"
                        >
                          Batal
                        </button>
                        <button 
                          onClick={handleSaveScenario}
                          disabled={!newScenarioTitle || !newScenarioDesc || (!newScenarioCategory && !isNewCategoryInput)}
                          className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {editingScenarioId ? 'Perbarui' : 'Simpan'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                </div>
              )}
              
              {activeTab === 'consumers' && (
                <div className="space-y-6">
                  <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg flex gap-3 items-start border border-blue-100 dark:border-blue-800">
                    <span className="text-xl">💡</span>
                    <p className="text-sm text-blue-800 dark:text-blue-100">
                      <strong>Pilih Karakter Konsumen:</strong> Klik pada kartu untuk memilih tipe konsumen yang akan disimulasikan. Pilih &quot;Acak&quot; untuk variasi.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Random Option */}
                    <div 
                      onClick={() => setGlobalConsumerTypeId('random')}
                      className={`cursor-pointer border p-4 rounded-xl shadow-sm group transition-all relative ${globalConsumerTypeId === 'random' ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500 dark:bg-blue-900/20 dark:border-blue-400' : 'bg-white dark:bg-[#1C1C1E] border-gray-200 dark:border-white/10 hover:border-blue-300'}`}
                    >
                        <div className="flex justify-between items-start mb-2">
                          <h4 className={`font-bold flex items-center gap-2 ${globalConsumerTypeId === 'random' ? 'text-blue-700 dark:text-blue-300' : 'text-foreground'}`}>
                            <span className={`w-2 h-2 rounded-full ${globalConsumerTypeId === 'random' ? 'bg-blue-600 animate-pulse' : 'bg-foreground/40'}`}></span>
                            Acak (Random)
                          </h4>
                          {globalConsumerTypeId === 'random' && (
                            <div className="bg-blue-500 text-white p-1 rounded-full">
                                <Check className="w-3 h-3" />
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-foreground/60 leading-relaxed">Sistem akan memilih tipe konsumen secara acak untuk setiap sesi simulasi.</p>
                    </div>

                    {localSettings.consumerTypes.map(c => (
                      <div 
                        key={c.id} 
                        onClick={() => setGlobalConsumerTypeId(c.id)}
                        className={`cursor-pointer border p-4 rounded-xl shadow-sm group transition-all relative ${globalConsumerTypeId === c.id ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500 dark:bg-blue-900/20 dark:border-blue-400' : 'bg-card border-border hover:border-blue-300'} ${editingConsumerId === c.id ? 'ring-2 ring-yellow-400 bg-yellow-50 dark:bg-yellow-900/10' : ''}`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h4 className={`font-bold flex items-center gap-2 pr-8 ${globalConsumerTypeId === c.id ? 'text-blue-700 dark:text-blue-300' : 'text-foreground'}`}>
                            <span className={`w-2 h-2 rounded-full ${globalConsumerTypeId === c.id ? 'bg-blue-600' : 'bg-foreground/40'}`}></span>
                            {c.name}
                          </h4>
                          <div className="flex items-center gap-2">
                            {globalConsumerTypeId === c.id && (
                                <div className="bg-blue-500 text-white p-1 rounded-full mr-1">
                                    <Check className="w-3 h-3" />
                                </div>
                            )}
                            <button 
                              onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditConsumer(c);
                              }}
                              className="text-foreground/40 hover:text-blue-600 transition-colors p-1 hover:bg-foreground/5 rounded-lg"
                              title="Edit Karakteristik"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteConsumer(c.id);
                              }}
                              className="text-foreground/40 hover:text-red-600 transition-colors p-1 hover:bg-red-500/10 rounded-lg"
                              title="Hapus Karakteristik"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div className="flex gap-2 mb-2">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                                c.difficulty === ConsumerDifficulty.Hard ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800' :
                                c.difficulty === ConsumerDifficulty.Medium ? 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800' :
                                'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800'
                            }`}>
                                {c.difficulty}
                            </span>
                            {c.tone && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-foreground/5 text-foreground/60 border border-border">
                                    {c.tone}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-foreground/60 leading-relaxed line-clamp-3">{c.description}</p>
                      </div>
                    ))}
                  </div>

                  {!isAddingConsumer && !editingConsumerId ? (
                    <button 
                      onClick={handleAddConsumer}
                      className="w-full py-4 rounded-xl border-2 border-dashed border-border text-foreground/60 font-bold hover:bg-foreground/5 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-all flex items-center justify-center gap-2 bg-card"
                    >
                      <Plus className="w-5 h-5" />
                      Tambah Karakteristik Baru
                    </button>
                  ) : (
                    <div id="consumer-form" className={`bg-card rounded-2xl border border-border shadow-lg overflow-hidden`}>
                      <div className="px-6 py-4 border-b border-border bg-foreground/5 flex justify-between items-center">
                        <h3 className="font-bold text-foreground text-base">
                          {editingConsumerId ? 'Edit Karakteristik' : 'Tambah Karakteristik Baru'}
                        </h3>
                        <button 
                          onClick={resetConsumerForm}
                          className="text-foreground/40 hover:text-red-500 transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                         <div className="col-span-2">
                          <label className="block text-xs font-bold text-foreground/60 uppercase mb-2">Nama Tipe/Karakter</label>
                          <input 
                            type="text"
                            className="w-full rounded-xl border-border bg-foreground/5 p-3 text-sm text-foreground focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Contoh: Konsumen Lansia"
                            value={newConsumerName}
                            onChange={(e) => setNewConsumerName(e.target.value)}
                          />
                        </div>

                        <div className="col-span-2 md:col-span-1">
                          <label className="block text-xs font-bold text-foreground/60 uppercase mb-2">Tingkat Kesulitan</label>
                          <select 
                            className="w-full rounded-xl border-border bg-foreground/5 p-3 text-sm text-foreground focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                            value={newConsumerDifficulty}
                            onChange={(e) => setNewConsumerDifficulty(e.target.value as ConsumerDifficulty)}
                          >
                            {Object.values(ConsumerDifficulty).map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </div>

                        <div className="col-span-2 md:col-span-1">
                          <label className="block text-xs font-bold text-foreground/60 uppercase mb-2">Gaya Bicara (Tone)</label>
                          <input 
                            type="text"
                            className="w-full rounded-xl border-border bg-foreground/5 p-3 text-sm text-foreground focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Contoh: Sopan, Marah, Bingung"
                            value={newConsumerTone}
                            onChange={(e) => setNewConsumerTone(e.target.value)}
                          />
                        </div>
                        
                        <div className="col-span-2">
                          <label className="block text-xs font-bold text-foreground/60 uppercase mb-2">Deskripsi Perilaku (System Prompt AI)</label>
                          <textarea 
                            className="w-full rounded-xl border-border bg-foreground/5 p-3 text-sm text-foreground focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                            rows={3}
                            placeholder="Jelaskan bagaimana AI harus berperilaku (gaya bicara, tingkat kesabaran, singkatan yang sering dipakai, dll)..."
                            value={newConsumerDesc}
                            onChange={(e) => setNewConsumerDesc(e.target.value)}
                          />
                        </div>
                        <div className="col-span-2 flex justify-end gap-3 pt-4 border-t border-border">
                          <button 
                            onClick={resetConsumerForm}
                            className="px-6 py-2.5 rounded-xl text-foreground/60 font-bold hover:bg-foreground/5 transition-all"
                          >
                            Batal
                          </button>
                          <button 
                            onClick={handleSaveConsumer}
                            disabled={!newConsumerName || !newConsumerDesc}
                            className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {editingConsumerId ? 'Perbarui' : 'Simpan'}
                          </button>
                        </div>
                     </div>
                  </div>
                )}
                </div>
              )}

              {activeTab === 'identity' && (
                <div className="space-y-6">
                  <div className="bg-foreground/5 px-4 py-3 rounded-2xl border border-border flex items-center justify-between">
                      <div className="flex items-center gap-3">
                          <h3 className="text-sm font-black text-foreground tracking-tight uppercase">Identitas Konsumen</h3>
                          <div className="h-4 w-px bg-border hidden sm:block"></div>
                          <p className="text-xs text-foreground/60 hidden md:block">Atur identitas pengirim email simulasi.</p>
                      </div>
                  </div>

                  <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="col-span-2">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                    <User className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-foreground">Profil Pengirim</h4>
                                    <p className="text-xs text-foreground/60">Informasi ini akan muncul sebagai pengirim email.</p>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-foreground/60 uppercase mb-2">
                                Nama Pengirim (Display Name)
                            </label>
                            <input 
                                type="text" 
                                className="w-full rounded-xl border-border bg-foreground/5 p-3 text-sm text-foreground focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                placeholder="Contoh: Budi Santoso"
                                value={customSenderName}
                                onChange={(e) => setCustomSenderName(e.target.value)}
                            />
                            <p className="text-[10px] text-foreground/40 mt-1.5 ml-1">Muncul di header email (From: ...)</p>
                        </div>
                        
                        <div>
                            <label className="block text-xs font-bold text-foreground/60 uppercase mb-2">
                                Nama Di Badan Email
                            </label>
                            <input 
                                type="text" 
                                className="w-full rounded-xl border-border bg-foreground/5 p-3 text-sm text-foreground focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                placeholder="Contoh: Budi S."
                                value={customBodyName}
                                onChange={(e) => setCustomBodyName(e.target.value)}
                            />
                            <p className="text-[10px] text-foreground/40 mt-1.5 ml-1">Muncul di akhir email (Salam, ...)</p>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-foreground/60 uppercase mb-2">
                                Alamat Email
                            </label>
                            <input 
                                type="email" 
                                className="w-full rounded-xl border-border bg-foreground/5 p-3 text-sm text-foreground focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                placeholder="Contoh: budi.s@gmail.com"
                                value={customEmail}
                                onChange={(e) => setCustomEmail(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-foreground/60 uppercase mb-2">
                                Kota / Kabupaten
                            </label>
                            <input 
                                type="text" 
                                className="w-full rounded-xl border-border bg-foreground/5 p-3 text-sm text-foreground focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                placeholder="Contoh: Surabaya"
                                value={customCity}
                                onChange={(e) => setCustomCity(e.target.value)}
                            />
                        </div>
                    </div>
                  </div>

                  <div className="pt-6 mt-6 border-t border-border">
                    <button
                        onClick={handleResetDefaults}
                        className="w-full py-3 text-red-500 text-sm font-bold hover:bg-red-500/10 rounded-xl transition-all border border-transparent hover:border-red-500/20 flex items-center justify-center gap-2"
                    >
                        <Trash2 className="w-4 h-4" />
                        Reset Semua Pengaturan ke Default
                    </button>
                    <p className="text-center text-[10px] text-foreground/40 mt-2">
                        Tindakan ini akan menghapus semua skenario dan karakteristik kustom yang telah Anda buat.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
