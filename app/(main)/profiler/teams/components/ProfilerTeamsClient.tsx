'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Plus, Trash2, Loader2, Info, Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { addTim, deleteTim } from '../../actions';

interface ProfilerTeamsClientProps {
  initialTeams: string[];
}

export default function ProfilerTeamsClient({
  initialTeams
}: ProfilerTeamsClientProps) {
  const router = useRouter();
  const [teams, setTeams] = useState<string[]>(initialTeams);
  const [newTeam, setNewTeam] = useState('');
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleAddTeam() {
    if (!newTeam.trim()) return;
    setAdding(true);
    try {
      await addTim(newTeam.trim());
      setTeams(prev => [...prev, newTeam.trim()].sort());
      setNewTeam('');
    } catch (err) {
      alert('Gagal menambah tim. Pastikan nama tim unik.');
    } finally {
      setAdding(false);
    }
  }

  async function handleDeleteTeam(name: string) {
    if (!confirm(`Hapus tim "${name}"? Peserta yang sudah menggunakan tim ini tidak akan terhapus, namun tim ini tidak akan muncul lagi di pilihan.`)) return;
    setDeleting(name);
    try {
      await deleteTim(name);
      setTeams(prev => prev.filter(t => t !== name));
    } catch (err) {
      alert('Gagal menghapus tim.');
    } finally {
      setDeleting(null);
    }
  }

  const defaultTims = ['Telepon', 'Chat', 'Email'];

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => router.push('/profiler')}
            className="p-2 hover:bg-white dark:hover:bg-white/5 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Manajemen Tim</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Kelola daftar tim kustom</p>
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 rounded-2xl p-4 flex gap-3">
          <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
            Tim default (Telepon, Chat, Email) selalu tersedia dan tidak dapat dihapus. 
            Anda dapat menambahkan tim kustom sesuai kebutuhan batch tertentu.
          </p>
        </div>

        {/* Add Team Form */}
        <div className="bg-white dark:bg-card rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-white/[0.05]">
          <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3">
            Tambah Tim Baru
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newTeam}
              onChange={(e) => setNewTeam(e.target.value)}
              placeholder="Contoh: Tim Social Media"
              className="flex-1 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
              onKeyDown={(e) => e.key === 'Enter' && handleAddTeam()}
            />
            <button
              onClick={handleAddTeam}
              disabled={adding || !newTeam.trim()}
              className="px-4 py-2.5 bg-[#5A5A40] hover:opacity-90 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2"
            >
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Tambah
            </button>
          </div>
        </div>

        {/* Teams List */}
        <div className="space-y-3">
          <h2 className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest px-1">
            Daftar Tim Aktif
          </h2>

          <div className="grid gap-2">
            {/* Default Teams */}
            {defaultTims.map(t => (
              <div key={t} className="flex items-center justify-between p-4 bg-white dark:bg-card rounded-2xl border border-gray-100 dark:border-white/[0.05] shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-white/5 flex items-center justify-center">
                    <Users className="w-4 h-4 text-gray-400" />
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{t}</span>
                </div>
                <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-tighter bg-gray-50 dark:bg-white/5 px-2 py-1 rounded-md">
                  Sistem
                </span>
              </div>
            ))}

            {/* Custom Teams */}
            <AnimatePresence mode="popLayout">
              {teams.map(t => (
                <motion.div
                  key={t}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex items-center justify-between p-4 bg-white dark:bg-card rounded-2xl border border-gray-100 dark:border-white/[0.05] shadow-sm group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#5A5A40]/10 flex items-center justify-center">
                      <Users className="w-4 h-4 text-[#5A5A40]" />
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{t}</span>
                  </div>
                  <button
                    onClick={() => handleDeleteTeam(t)}
                    disabled={deleting === t}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                  >
                    {deleting === t ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>

            {teams.length === 0 && (
              <div className="text-center py-8 bg-white/50 dark:bg-white/[0.02] border-2 border-dashed border-gray-200 dark:border-white/5 rounded-2xl">
                <p className="text-sm text-gray-500 dark:text-gray-400">Belum ada tim kustom.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
