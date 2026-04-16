'use client';

import type { CSSProperties } from 'react';
import type { PesertaPhotoFrame } from './profiler-types';

export interface PhotoFrame {
  x: number;
  y: number;
  zoom: number;
}

export const DEFAULT_PHOTO_FRAME: PhotoFrame = {
  x: 50,
  y: 50,
  zoom: 1,
};

const STORAGE_KEY = 'profiler-photo-frames-v1';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const sanitizeFrame = (raw?: Partial<PhotoFrame> | PesertaPhotoFrame | null): PhotoFrame => {
  if (!raw) return DEFAULT_PHOTO_FRAME;
  return {
    x: clamp(Number(raw.x ?? DEFAULT_PHOTO_FRAME.x), 0, 100),
    y: clamp(Number(raw.y ?? DEFAULT_PHOTO_FRAME.y), 0, 100),
    zoom: clamp(Number(raw.zoom ?? DEFAULT_PHOTO_FRAME.zoom), 1, 2.5),
  };
};

const readFrames = (): Record<string, PhotoFrame> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Partial<PhotoFrame>>;
    const next: Record<string, PhotoFrame> = {};
    for (const [id, frame] of Object.entries(parsed)) {
      next[id] = sanitizeFrame(frame);
    }
    return next;
  } catch {
    return {};
  }
};

const writeFrames = (frames: Record<string, PhotoFrame>) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(frames));
};

export const getPhotoFrame = (
  pesertaId?: string | null,
  serverFrame?: Partial<PhotoFrame> | PesertaPhotoFrame | null
): PhotoFrame => {
  if (serverFrame) {
    const normalized = sanitizeFrame(serverFrame);
    if (pesertaId) {
      const frames = readFrames();
      const existing = frames[pesertaId];
      if (
        !existing ||
        existing.x !== normalized.x ||
        existing.y !== normalized.y ||
        existing.zoom !== normalized.zoom
      ) {
        frames[pesertaId] = normalized;
        writeFrames(frames);
      }
    }
    return normalized;
  }

  if (!pesertaId) return DEFAULT_PHOTO_FRAME;
  const frames = readFrames();
  return frames[pesertaId] || DEFAULT_PHOTO_FRAME;
};

export const setPhotoFrame = (pesertaId: string, frame: Partial<PhotoFrame>) => {
  if (!pesertaId || typeof window === 'undefined') return;
  const frames = readFrames();
  frames[pesertaId] = sanitizeFrame(frame);
  writeFrames(frames);
};

export const getPhotoImageStyle = (frame: PhotoFrame): CSSProperties => ({
  objectFit: 'cover',
  objectPosition: `${frame.x}% ${frame.y}%`,
  transform: `scale(${frame.zoom})`,
  transformOrigin: 'center',
});

export const getPhotoInlineStyle = (frame: PhotoFrame): string =>
  `width:100%;height:100%;object-fit:cover;object-position:${frame.x}% ${frame.y}%;transform:scale(${frame.zoom});transform-origin:center;`;

export const normalizePhotoFrame = sanitizeFrame;
