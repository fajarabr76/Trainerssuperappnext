'use client';

import type { CSSProperties } from 'react';
import type { PesertaPhotoFrame } from './profiler-types';

export interface PhotoFrame {
  x: number;
  y: number;
  zoom: number;
}

export interface PhotoFrameDraft extends PhotoFrame {
  isDirty: boolean;
  updatedAt: number;
}

export const DEFAULT_PHOTO_FRAME: PhotoFrame = {
  x: 50,
  y: 50,
  zoom: 1,
};

const STORAGE_KEY = 'profiler-photo-frames-v1';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const sanitizeFrame = (raw?: Partial<PhotoFrame> | PesertaPhotoFrame | null): PhotoFrame => {
  if (!raw) return DEFAULT_PHOTO_FRAME;
  return {
    x: clamp(Number(raw.x ?? DEFAULT_PHOTO_FRAME.x), 0, 100),
    y: clamp(Number(raw.y ?? DEFAULT_PHOTO_FRAME.y), 0, 100),
    zoom: clamp(Number(raw.zoom ?? DEFAULT_PHOTO_FRAME.zoom), 1, 2.5),
  };
};

const readAllDrafts = (): Record<string, PhotoFrameDraft> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, PhotoFrameDraft>;
  } catch {
    return {};
  }
};

const writeAllDrafts = (drafts: Record<string, PhotoFrameDraft>) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
};

/**
 * Resolve the current frame for a participant.
 * Prioritizes unsaved local draft, otherwise falls back to the server frame.
 */
export const resolvePhotoFrame = (
  pesertaId?: string | null,
  serverFrame?: Partial<PhotoFrame> | PesertaPhotoFrame | null
): PhotoFrame => {
  const normalizedServer = sanitizeFrame(serverFrame);
  if (!pesertaId) return normalizedServer;

  const drafts = readAllDrafts();
  const draft = drafts[pesertaId];

  if (draft) {
    const normalizedDraft = sanitizeFrame(draft);

    // Only prefer a local draft while it still represents unsaved local state.
    // Once the server has the latest frame, the canonical read path should come
    // back from the server to avoid stale localStorage overriding newer data.
    if (draft.isDirty || !serverFrame) {
      return normalizedDraft;
    }
  }

  return normalizedServer;
};

/**
 * Update the local draft for a participant.
 */
export const updatePhotoFrameDraft = (pesertaId: string, frame: Partial<PhotoFrame>) => {
  if (!pesertaId || typeof window === 'undefined') return;
  const drafts = readAllDrafts();
  const current = drafts[pesertaId] || { ...DEFAULT_PHOTO_FRAME, isDirty: false, updatedAt: 0 };
  
  const next = sanitizeFrame({ ...current, ...frame });
  drafts[pesertaId] = {
    ...next,
    isDirty: true,
    updatedAt: Date.now(),
  };
  writeAllDrafts(drafts);
};

/**
 * Mark a participant's frame as saved (not dirty).
 */
export const markPhotoFrameAsSaved = (pesertaId: string, frame: PhotoFrame) => {
  if (!pesertaId || typeof window === 'undefined') return;
  const drafts = readAllDrafts();
  drafts[pesertaId] = {
    ...frame,
    isDirty: false,
    updatedAt: Date.now(),
  };
  writeAllDrafts(drafts);
};

/**
 * Clear draft for a participant.
 */
export const clearPhotoFrameDraft = (pesertaId: string) => {
  if (!pesertaId || typeof window === 'undefined') return;
  const drafts = readAllDrafts();
  delete drafts[pesertaId];
  writeAllDrafts(drafts);
};

export const getPhotoImageStyle = (frame: PhotoFrame): CSSProperties => ({
  objectFit: 'cover',
  objectPosition: `${frame.x}% ${frame.y}%`,
  transform: `scale(${frame.zoom})`,
  transformOrigin: `${frame.x}% ${frame.y}%`,
});

export const getPhotoInlineStyle = (frame: PhotoFrame): string =>
  `width:100%;height:100%;object-fit:cover;object-position:${frame.x}% ${frame.y}%;transform:scale(${frame.zoom});transform-origin:${frame.x}% ${frame.y}%;`;

/**
 * Legacy compatibility alias.
 * In the new version, we should use resolvePhotoFrame which doesn't have side effects during render.
 */
export const getPhotoFrame = resolvePhotoFrame;
export const setPhotoFrame = updatePhotoFrameDraft;
export const normalizePhotoFrame = sanitizeFrame;
