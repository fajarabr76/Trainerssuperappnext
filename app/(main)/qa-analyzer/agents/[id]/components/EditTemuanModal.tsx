'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Loader2 } from 'lucide-react';
import { QATemuan, EditFormState, unwrapIndicator } from '../../../lib/qa-types';

interface EditTemuanModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingTemuan: QATemuan | null;
  editForm: EditFormState;
  setEditForm: React.Dispatch<React.SetStateAction<EditFormState>>;
  isSubmitting: boolean;
  onSave: () => Promise<void>;
}

export default function EditTemuanModal({
  isOpen,
  onClose,
  editingTemuan,
  editForm,
  setEditForm,
  isSubmitting,
  onSave
}: EditTemuanModalProps) {
  if (!editingTemuan) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="absolute inset-0 bg-background/80 backdrop-blur-sm" 
            onClick={() => !isSubmitting && onClose()} 
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.95, y: 20 }} 
            className="relative w-full max-w-2xl bg-card border border-border/50 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="px-8 py-6 border-b border-border/50 flex items-center justify-between bg-foreground/[0.02]">
              <div>
                <h3 className="text-xl font-black tracking-tight">Edit Temuan</h3>
                <p className="text-xs text-foreground/50 mt-1 font-medium">
                {unwrapIndicator(editingTemuan.qa_indicators)?.name || `Parameter ID: ${editingTemuan.indicator_id}`}
              </p>
              </div>
              <button 
                onClick={() => !isSubmitting && onClose()} 
                className="w-8 h-8 rounded-full bg-foreground/5 hover:bg-foreground/10 flex items-center justify-center text-foreground/50 transition-colors"
                aria-label="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-8 overflow-y-auto flex-1 space-y-6">
              <div className="space-y-3">
                <label className="text-xs font-black uppercase tracking-widest text-foreground/50">Nilai</label>
                <div className="grid grid-cols-4 gap-3">
                  {[3, 2, 1, 0].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setEditForm(prev => ({ ...prev, nilai: val }))}
                      className={`p-4 rounded-xl border transition-all flex flex-col items-center gap-2 ${
                        editForm.nilai === val 
                          ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20 scale-105' 
                          : 'bg-background hover:bg-foreground/5 border-border/50'
                      }`}
                    >
                      <span className="text-2xl font-black">{val}</span>
                      <span className="text-[9px] font-black uppercase tracking-widest opacity-80">
                        {val === 3 ? 'SESUAI' : val === 2 ? 'PERLU PERBAIKAN' : val === 1 ? 'TIDAK SESUAI' : 'KRITIS'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="space-y-3">
                <label className="text-xs font-black uppercase tracking-widest text-foreground/50">Ketidaksesuaian</label>
                <textarea
                  value={editForm.ketidaksesuaian}
                  onChange={e => setEditForm(prev => ({ ...prev, ketidaksesuaian: e.target.value }))}
                  className="w-full h-24 bg-background border border-border/50 rounded-xl p-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Deskripsikan gap atau isu..."
                />
              </div>
              
              <div className="space-y-3">
                <label className="text-xs font-black uppercase tracking-widest text-foreground/50">Sebaiknya</label>
                <textarea
                  value={editForm.sebaiknya}
                  onChange={e => setEditForm(prev => ({ ...prev, sebaiknya: e.target.value }))}
                  className="w-full h-24 bg-background border border-border/50 rounded-xl p-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Saran perbaikan..."
                />
              </div>
            </div>
            
            <div className="px-8 py-6 border-t border-border/50 bg-foreground/[0.02] flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl text-sm font-bold bg-background border border-border/50 hover:bg-foreground/5 transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl text-sm font-bold bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0 flex items-center gap-2"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
