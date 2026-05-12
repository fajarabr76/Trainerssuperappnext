'use client';

import React from 'react';
import Image from 'next/image';
import { getImageDataUri } from '../utils/detectMimeType';

interface ScenarioImageProps {
  base64: string;
  alt?: string;
  variant: 'grid' | 'thumbnail' | 'fullscreen';
  onClick?: () => void;
  className?: string;
}

/**
 * Shared component untuk merender gambar skenario secara konsisten
 * di seluruh modul PDKT (Detail Pane, Settings Modal, Email Interface).
 *
 * Menggunakan `getImageDataUri` untuk deteksi MIME type otomatis
 * dan `next/image` dengan `unoptimized` untuk base64 rendering.
 */
export default function ScenarioImage({
  base64,
  alt = 'Scenario image',
  variant,
  onClick,
  className = '',
}: ScenarioImageProps) {
  const src = getImageDataUri(base64);

  if (variant === 'fullscreen') {
    return (
      <Image
        src={src}
        alt={alt}
        width={0}
        height={0}
        sizes="100vw"
        className={`object-contain max-w-full max-h-full rounded-xl ${className}`}
        style={{ width: 'auto', height: 'auto' }}
        unoptimized
        onClick={onClick}
      />
    );
  }

  if (variant === 'thumbnail') {
    return (
      <div
        className={`relative min-w-20 min-h-20 bg-muted/30 rounded-lg overflow-hidden ${className}`}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={
          onClick
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onClick();
                }
              }
            : undefined
        }
      >
        <Image
          src={src}
          alt={alt}
          fill
          className="object-contain"
          unoptimized
        />
      </div>
    );
  }

  // variant === 'grid'
  return (
    <div
      className={`relative aspect-[4/3] bg-muted/50 rounded-lg border border-border overflow-hidden ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <Image
        src={src}
        alt={alt}
        fill
        className="object-contain"
        unoptimized
      />
    </div>
  );
}
