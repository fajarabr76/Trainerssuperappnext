'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Trash2, Phone, Clock, Download, History as HistoryIcon, Eye, FileDown } from 'lucide-react';
import { CallRecord } from '../types';
import { getTelefunSignedUrl } from '../actions';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: CallRecord[];
  onDeleteSession: (id: string) => Promise<void>;
  onClearHistory: () => Promise<void>;
  onReviewSession?: (record: CallRecord) => void;
}

function exportToCSV(history: CallRecord[]) {
  const headers = ['Tanggal', 'Skenario', 'Nama Konsumen', 'Durasi (menit)', 'Skor', 'Feedback', 'URL Rekaman'];
  const rows = history.map(r => [
    new Date(r.date).toLocaleDateString('id-ID'),
    r.scenarioTitle,
    r.consumerName,
    String(Math.round(r.duration / 60)),
    r.score ?? '-',
    (r.feedback ?? '').replace(/\n/g, ' '),
    r.url,
  ]);

  const escapeCsv = (val: string) => `"${val.replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map(row => row.map(escapeCsv).join(',')).join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `telefun_history_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export const HistoryModal: React.FC<HistoryModalProps> = ({ 
  isOpen, 
  onClose, 
  history, 
  onDeleteSession, 
  onClearHistory,
  onReviewSession,
}) => {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setProcessingId(id);
    await onDeleteSession(id);
    setProcessingId(null);
  };

  const handleClear = async () => {
    if (!confirm('Apakah Anda yakin ingin menghapus semua riwayat?')) return;
    setIsClearing(true);
    await onClearHistory();
    setIsClearing(false);
  };

  const handleDownload = async (rec: CallRecord) => {
    if (rec.url && rec.url.startsWith('blob:')) {
      const a = document.createElement('a');
      a.href = rec.url;
      a.download = `Telefun_${rec.consumerName}_${rec.id}.webm`;
      a.click();
      return;
    }

    if (!rec.recordingPath) {
      alert('Rekaman tidak tersedia untuk diunduh (URL kedaluwarsa).');
      return;
    }

    setDownloadingId(rec.id);
    try {
      const result = await getTelefunSignedUrl({ sessionId: rec.id, type: 'full_call' });
      if (result.success && result.signedUrl) {
        const a = document.createElement('a');
        a.href = result.signedUrl;
        a.download = `Telefun_${rec.consumerName}_${rec.id}.webm`;
        a.click();
      } else {
        alert('Gagal mengambil tautan rekaman: ' + (result.error || 'Unknown error'));
      }
    } catch (e) {
      console.error('Download error:', e);
      alert('Terjadi kesalahan saat mengunduh.');
    } finally {
      setDownloadingId(null);
    }
  };
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="absolute inset-0 bg-background/80 backdrop-blur-md"
          />
          
            <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl bg-card border border-border rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
          >
            {/* Header */}
            <div className="p-6 border-b border-border flex items-center justify-between shrink-0 bg-foreground/[0.02]">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20">
                  <HistoryIcon className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-foreground">Riwayat Panggilan</h2>
                  <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">
                    {history.length} Rekaman Tersimpan
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {history.length > 0 && (
                  <>
                    <button 
                      onClick={() => exportToCSV(history)}
                      className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded-xl transition-all border border-emerald-500/20"
                      title="Ekspor ke CSV"
                    >
                      <FileDown className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={handleClear}
                      disabled={isClearing}
                      className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-red-500 hover:bg-red-500/10 rounded-xl transition-all border border-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isClearing ? 'Menghapus...' : 'Hapus Semua'}
                    </button>
                  </>
                )}
                <button 
                  onClick={onClose} 
                  className="p-2 hover:bg-foreground/5 rounded-full transition-colors border border-border"
                >
                  <X className="w-6 h-6 text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide">
              {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="w-20 h-20 bg-foreground/5 rounded-full flex items-center justify-center mb-6 border border-border">
                    <Clock className="w-10 h-10 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-bold mb-2 text-foreground">Belum Ada Rekaman</h3>
                  <p className="text-muted-foreground text-sm max-w-xs mx-auto font-light">
                    Selesaikan simulasi panggilan pertama Anda untuk melihat rekaman di sini.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {history.map(rec => (
                    <motion.div
                      key={rec.id}
                      whileHover={{ scale: 1.01, backgroundColor: 'rgba(var(--foreground),0.03)' }}
                      className="group relative bg-foreground/[0.02] border border-border rounded-3xl p-5 transition-all"
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-5">
                          <div className="w-12 h-12 bg-emerald-500/5 rounded-2xl flex items-center justify-center border border-emerald-500/10">
                            <Phone className="w-6 h-6 text-emerald-600/60 dark:text-emerald-400/60" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-foreground leading-tight">{rec.scenarioTitle}</h4>
                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">
                              {rec.consumerName} · {new Date(rec.date).toLocaleDateString('id-ID')}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {onReviewSession && (
                            <button 
                              onClick={() => onReviewSession(rec)}
                              className="p-3 bg-foreground/5 hover:bg-foreground/10 text-emerald-600 dark:text-emerald-400 rounded-xl border border-border transition-all"
                              title="Lihat Detail"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                          <button 
                            onClick={() => handleDownload(rec)}
                            disabled={downloadingId === rec.id}
                            className="p-3 bg-foreground/5 hover:bg-foreground/10 text-emerald-600 dark:text-emerald-400 rounded-xl border border-border transition-all disabled:opacity-50"
                            title="Unduh Rekaman"
                          >
                            {downloadingId === rec.id ? (
                              <div className="w-4 h-4 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                          </button>
                          <button 
                            onClick={() => handleDelete(rec.id)}
                            disabled={processingId === rec.id}
                            className="p-3 bg-red-500/5 hover:bg-red-500/10 text-red-500 rounded-xl border border-red-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Hapus"
                          >
                            {processingId === rec.id ? (
                              <div className="w-4 h-4 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
