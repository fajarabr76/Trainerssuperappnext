'use client';

import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  Bot,
  Clock,
  Lightbulb,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCw,
  Send,
  User,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type {
  AnnotationCategory,
  AnnotationMoment,
  CoachingRecommendation,
  ReplayAnnotation,
} from '../services/realisticMode/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_MANUAL_ANNOTATION_CHARS = 500;
const MAX_COACHING_RECOMMENDATIONS = 5;

const CATEGORY_LABELS: Record<AnnotationCategory, string> = {
  strength: 'Kekuatan',
  improvement_area: 'Area Perbaikan',
  critical_moment: 'Momen Kritis',
  technique_used: 'Teknik Digunakan',
};

const CATEGORY_COLORS: Record<AnnotationCategory, { bg: string; text: string; border: string }> = {
  strength: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-200 dark:border-emerald-800',
  },
  improvement_area: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-800',
  },
  critical_moment: {
    bg: 'bg-red-500/10',
    text: 'text-red-700 dark:text-red-400',
    border: 'border-red-200 dark:border-red-800',
  },
  technique_used: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800',
  },
};

const MOMENT_LABELS: Record<AnnotationMoment, string> = {
  missed_empathy: 'Empati Terlewat',
  good_de_escalation: 'De-eskalasi Baik',
  long_pause: 'Jeda Panjang',
  interruption: 'Interupsi',
  technique_usage: 'Penggunaan Teknik',
};

const VALID_CATEGORIES: AnnotationCategory[] = [
  'strength',
  'improvement_area',
  'critical_moment',
  'technique_used',
];

const VALID_MOMENTS: AnnotationMoment[] = [
  'missed_empathy',
  'good_de_escalation',
  'long_pause',
  'interruption',
  'technique_usage',
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ReplayAnnotatorProps {
  sessionId: string;
  annotations: ReplayAnnotation[];
  recommendations: CoachingRecommendation[];
  isLoading: boolean;
  error?: string;
  onRetry: () => void;
  onAddAnnotation: (annotation: Omit<ReplayAnnotation, 'id' | 'isManual' | 'createdBy'>) => Promise<void>;
  /** Total session duration in milliseconds, used for timeline positioning */
  sessionDurationMs?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CoachingRecommendationsSection({
  recommendations,
}: {
  recommendations: CoachingRecommendation[];
}) {
  const sorted = useMemo(
    () => [...recommendations].sort((a, b) => a.priority - b.priority).slice(0, MAX_COACHING_RECOMMENDATIONS),
    [recommendations]
  );

  if (sorted.length === 0) return null;

  return (
    <section
      className="rounded-xl border border-slate-950/5 bg-white p-4 dark:border-white/10 dark:bg-slate-900"
      aria-label="Rekomendasi Coaching"
    >
      <div className="mb-3 flex items-center gap-2">
        <div className="rounded-lg bg-amber-500/10 p-1.5">
          <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        </div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-white/45">
          Rekomendasi Coaching
        </h3>
        <span className="ml-auto text-xs text-slate-400 dark:text-white/35">
          {sorted.length} item
        </span>
      </div>
      <ol className="space-y-2" aria-label="Daftar rekomendasi coaching">
        {sorted.map((rec, idx) => (
          <li
            key={idx}
            className="flex items-start gap-2 rounded-lg bg-slate-950/[0.02] p-2.5 dark:bg-white/5"
          >
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-[10px] font-bold text-amber-700 dark:text-amber-400">
              {idx + 1}
            </span>
            <p className="text-sm text-slate-700 dark:text-white/70">
              {rec.text.slice(0, 200)}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function AnnotationCard({ annotation }: { annotation: ReplayAnnotation }) {
  const categoryColor = CATEGORY_COLORS[annotation.category];
  const isManual = annotation.isManual;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={`relative rounded-lg border p-3 ${categoryColor.border} bg-white dark:bg-slate-900`}
      role="article"
      aria-label={`Anotasi pada ${formatTimestamp(annotation.timestampMs)}: ${annotation.text}`}
    >
      {/* Header row */}
      <div className="mb-2 flex items-center gap-2">
        {/* Timestamp */}
        <span className="flex items-center gap-1 text-xs font-mono text-slate-500 dark:text-white/50">
          <Clock className="h-3 w-3" aria-hidden="true" />
          {formatTimestamp(annotation.timestampMs)}
        </span>

        {/* Category badge */}
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${categoryColor.bg} ${categoryColor.text}`}
        >
          {CATEGORY_LABELS[annotation.category]}
        </span>

        {/* Moment type */}
        <span className="text-[10px] text-slate-400 dark:text-white/35">
          {MOMENT_LABELS[annotation.moment]}
        </span>

        {/* Source indicator */}
        <span className="ml-auto flex items-center gap-1">
          {isManual ? (
            <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-white/10 dark:text-white/50">
              <User className="h-3 w-3" aria-hidden="true" />
              Manual
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-600 dark:bg-violet-500/10 dark:text-violet-400">
              <Bot className="h-3 w-3" aria-hidden="true" />
              AI
            </span>
          )}
        </span>
      </div>

      {/* Annotation text */}
      <p className="text-sm leading-relaxed text-slate-700 dark:text-white/70">
        {annotation.text}
      </p>
    </motion.div>
  );
}

function AnnotationTimeline({
  annotations,
  sessionDurationMs,
}: {
  annotations: ReplayAnnotation[];
  sessionDurationMs?: number;
}) {
  const sorted = useMemo(
    () => [...annotations].sort((a, b) => a.timestampMs - b.timestampMs),
    [annotations]
  );

  if (sorted.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-950/10 bg-slate-950/[0.02] p-6 text-center dark:border-white/10 dark:bg-white/5">
        <MessageSquare className="mx-auto mb-2 h-6 w-6 text-slate-400 dark:text-white/30" aria-hidden="true" />
        <p className="text-sm text-slate-500 dark:text-white/50">
          Belum ada anotasi untuk sesi ini.
        </p>
      </div>
    );
  }

  return (
    <div className="relative space-y-3" role="list" aria-label="Timeline anotasi percakapan">
      {/* Timeline line */}
      <div className="absolute left-[18px] top-0 bottom-0 w-px bg-slate-200 dark:bg-white/10" aria-hidden="true" />

      {sorted.map((annotation) => (
        <div key={annotation.id} className="relative flex gap-3" role="listitem">
          {/* Timeline dot */}
          <div
            className={`relative z-10 mt-3 h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white dark:ring-slate-900 ${
              annotation.isManual
                ? 'bg-slate-400 dark:bg-white/40'
                : 'bg-violet-500 dark:bg-violet-400'
            }`}
            aria-hidden="true"
            style={
              sessionDurationMs
                ? { marginLeft: '12px' }
                : { marginLeft: '12px' }
            }
          />
          {/* Card */}
          <div className="flex-1">
            <AnnotationCard annotation={annotation} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ManualAnnotationForm({
  onSubmit,
  isSubmitting,
}: {
  onSubmit: (annotation: Omit<ReplayAnnotation, 'id' | 'isManual' | 'createdBy'>) => Promise<void>;
  isSubmitting: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState('');
  const [category, setCategory] = useState<AnnotationCategory>('improvement_area');
  const [moment, setMoment] = useState<AnnotationMoment>('technique_usage');
  const [timestampMinutes, setTimestampMinutes] = useState('0');
  const [timestampSeconds, setTimestampSeconds] = useState('0');

  const charCount = text.length;
  const isOverLimit = charCount > MAX_MANUAL_ANNOTATION_CHARS;
  const isValid = text.trim().length > 0 && !isOverLimit;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || isSubmitting) return;

    const timestampMs =
      (parseInt(timestampMinutes, 10) * 60 + parseInt(timestampSeconds, 10)) * 1000;

    await onSubmit({
      timestampMs,
      category,
      moment,
      text: text.trim(),
    });

    // Reset form
    setText('');
    setTimestampMinutes('0');
    setTimestampSeconds('0');
    setIsOpen(false);
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-600 transition hover:border-slate-400 hover:bg-slate-50 dark:border-white/15 dark:bg-slate-900 dark:text-white/60 dark:hover:border-white/25 dark:hover:bg-slate-800"
        aria-label="Tambah anotasi manual"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Tambah Anotasi Manual
      </button>
    );
  }

  return (
    <motion.form
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={handleSubmit}
      className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900"
      aria-label="Form anotasi manual"
    >
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-bold text-slate-700 dark:text-white/80">
          Anotasi Manual Baru
        </h4>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-white/70"
          aria-label="Tutup form"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Timestamp input */}
      <div className="mb-3">
        <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-white/50">
          Timestamp
        </label>
        <div className="flex items-center gap-1">
          <input
            type="number"
            min="0"
            max="999"
            value={timestampMinutes}
            onChange={(e) => setTimestampMinutes(e.target.value)}
            className="w-16 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-center text-sm dark:border-white/10 dark:bg-slate-800 dark:text-white"
            aria-label="Menit"
          />
          <span className="text-sm text-slate-400">:</span>
          <input
            type="number"
            min="0"
            max="59"
            value={timestampSeconds}
            onChange={(e) => setTimestampSeconds(e.target.value)}
            className="w-16 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-center text-sm dark:border-white/10 dark:bg-slate-800 dark:text-white"
            aria-label="Detik"
          />
        </div>
      </div>

      {/* Category selector */}
      <div className="mb-3">
        <label
          htmlFor="annotation-category"
          className="mb-1 block text-xs font-medium text-slate-500 dark:text-white/50"
        >
          Kategori
        </label>
        <select
          id="annotation-category"
          value={category}
          onChange={(e) => setCategory(e.target.value as AnnotationCategory)}
          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm dark:border-white/10 dark:bg-slate-800 dark:text-white"
        >
          {VALID_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {CATEGORY_LABELS[cat]}
            </option>
          ))}
        </select>
      </div>

      {/* Moment selector */}
      <div className="mb-3">
        <label
          htmlFor="annotation-moment"
          className="mb-1 block text-xs font-medium text-slate-500 dark:text-white/50"
        >
          Tipe Momen
        </label>
        <select
          id="annotation-moment"
          value={moment}
          onChange={(e) => setMoment(e.target.value as AnnotationMoment)}
          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm dark:border-white/10 dark:bg-slate-800 dark:text-white"
        >
          {VALID_MOMENTS.map((m) => (
            <option key={m} value={m}>
              {MOMENT_LABELS[m]}
            </option>
          ))}
        </select>
      </div>

      {/* Text input */}
      <div className="mb-3">
        <label
          htmlFor="annotation-text"
          className="mb-1 block text-xs font-medium text-slate-500 dark:text-white/50"
        >
          Teks Anotasi
        </label>
        <textarea
          id="annotation-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Tulis anotasi Anda di sini..."
          rows={3}
          maxLength={MAX_MANUAL_ANNOTATION_CHARS}
          className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm placeholder:text-slate-400 dark:border-white/10 dark:bg-slate-800 dark:text-white dark:placeholder:text-white/30"
          aria-describedby="char-count"
        />
        <div
          id="char-count"
          className={`mt-1 text-right text-xs ${
            isOverLimit
              ? 'text-red-500'
              : charCount > MAX_MANUAL_ANNOTATION_CHARS * 0.9
                ? 'text-amber-500'
                : 'text-slate-400 dark:text-white/35'
          }`}
        >
          {charCount}/{MAX_MANUAL_ANNOTATION_CHARS}
        </div>
      </div>

      {/* Submit button */}
      <button
        type="submit"
        disabled={!isValid || isSubmitting}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Simpan anotasi"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Menyimpan...
          </>
        ) : (
          <>
            <Send className="h-4 w-4" aria-hidden="true" />
            Simpan Anotasi
          </>
        )}
      </button>
    </motion.form>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4" role="status" aria-label="Memuat anotasi">
      {/* Loading indicator */}
      <div className="flex items-center gap-3 rounded-xl border border-slate-950/5 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
        <Loader2 className="h-5 w-5 animate-spin text-violet-500" aria-hidden="true" />
        <span className="text-sm font-medium text-slate-600 dark:text-white/60">
          Menghasilkan anotasi AI...
        </span>
      </div>

      {/* Skeleton timeline */}
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex gap-3">
            <div className="mt-3 h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-slate-200 dark:bg-white/10" />
            <div className="flex-1 animate-pulse rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-white/5 dark:bg-white/5">
              <div className="mb-2 flex gap-2">
                <div className="h-4 w-12 rounded bg-slate-200 dark:bg-white/10" />
                <div className="h-4 w-20 rounded bg-slate-200 dark:bg-white/10" />
              </div>
              <div className="h-4 w-3/4 rounded bg-slate-200 dark:bg-white/10" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div
      className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900/30 dark:bg-red-950/20"
      role="alert"
    >
      <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-red-500" aria-hidden="true" />
      <h3 className="mb-2 text-sm font-bold text-red-700 dark:text-red-400">
        Anotasi Tidak Tersedia
      </h3>
      <p className="mb-4 text-sm text-red-600 dark:text-red-300/80">
        {error}
      </p>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
      >
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
        Coba Lagi
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export const ReplayAnnotator: React.FC<ReplayAnnotatorProps> = ({
  sessionId: _sessionId,
  annotations,
  recommendations,
  isLoading,
  error,
  onRetry,
  onAddAnnotation,
  sessionDurationMs,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleAddAnnotation(
    annotation: Omit<ReplayAnnotation, 'id' | 'isManual' | 'createdBy'>
  ) {
    setIsSubmitting(true);
    try {
      await onAddAnnotation(annotation);
    } finally {
      setIsSubmitting(false);
    }
  }

  // Error state: recording unavailable or generation failed
  if (error && !isLoading) {
    return (
      <div className="space-y-4" aria-label="Replay Annotator">
        <ErrorState error={error} onRetry={onRetry} />
        {recommendations.length > 0 && (
          <CoachingRecommendationsSection recommendations={recommendations} />
        )}
        {/* Still allow manual annotations even when AI fails */}
        <ManualAnnotationForm onSubmit={handleAddAnnotation} isSubmitting={isSubmitting} />
        {annotations.length > 0 && (
          <AnnotationTimeline annotations={annotations} sessionDurationMs={sessionDurationMs} />
        )}
      </div>
    );
  }

  // Loading state with incremental rendering
  if (isLoading) {
    return (
      <div className="space-y-4" aria-label="Replay Annotator">
        <LoadingState />
        {/* Render annotations incrementally as they arrive */}
        <AnimatePresence>
          {(annotations.length > 0 || recommendations.length > 0) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              {recommendations.length > 0 && (
                <CoachingRecommendationsSection recommendations={recommendations} />
              )}
              <AnnotationTimeline annotations={annotations} sessionDurationMs={sessionDurationMs} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Normal state: annotations loaded
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
      aria-label="Replay Annotator"
    >
      {/* Coaching recommendations summary at top */}
      <CoachingRecommendationsSection recommendations={recommendations} />

      {/* Conversation timeline with annotations */}
      <section aria-label="Timeline anotasi">
        <div className="mb-3 flex items-center gap-2">
          <div className="rounded-lg bg-violet-500/10 p-1.5">
            <MessageSquare className="h-4 w-4 text-violet-600 dark:text-violet-400" aria-hidden="true" />
          </div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-white/45">
            Anotasi Percakapan
          </h3>
          <span className="ml-auto text-xs text-slate-400 dark:text-white/35">
            {annotations.length} anotasi
          </span>
        </div>
        <AnnotationTimeline annotations={annotations} sessionDurationMs={sessionDurationMs} />
      </section>

      {/* Manual annotation form */}
      <ManualAnnotationForm onSubmit={handleAddAnnotation} isSubmitting={isSubmitting} />
    </motion.div>
  );
};

export default ReplayAnnotator;
