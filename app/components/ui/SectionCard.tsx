import React from 'react';

interface SectionCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'elevated' | 'ghost';
  withAmbient?: boolean;
  ambientColor?: 'violet' | 'blue' | 'emerald' | 'rose' | 'orange' | 'primary';
}

export function SectionCard({
  children,
  className = '',
  variant = 'default',
  withAmbient = false,
  ambientColor = 'primary'
}: SectionCardProps) {
  // Define layout styles by variant based on design system
  const variantStyles = {
    default: 'bg-card border border-border/40 rounded-2xl shadow-sm',
    elevated: 'bg-card border border-border/40 rounded-2xl shadow-lg shadow-primary/5',
    ghost: 'bg-card/40 backdrop-blur-sm border border-border/40 rounded-xl'
  };

  // Explicit mapping for ambient accent colors for performance and safety
  const ambientBlobStyles = {
    primary: 'bg-primary/5',
    violet: 'bg-violet-500/5',
    blue: 'bg-blue-500/5',
    emerald: 'bg-emerald-500/5',
    rose: 'bg-rose-500/5',
    orange: 'bg-orange-500/5'
  };

  const blobColor = ambientBlobStyles[ambientColor] || 'bg-primary/5';
  const currentVariant = variantStyles[variant] || variantStyles.default;

  return (
    <section className={`relative overflow-hidden ${currentVariant} ${className}`}>
      {withAmbient && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 rounded-2xl">
          {/* Base primary blob */}
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px] animate-pulse" />
          
          {/* Variant accent blob */}
          <div 
            className={`absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] ${blobColor} rounded-full blur-[120px] animate-pulse`}
            style={{ animationDelay: '2s' }} 
          />
        </div>
      )}
      
      {/* Content wrapper with relative positioning for proper z-index layering */}
      <div className="relative z-10 w-full h-full">
        {children}
      </div>
    </section>
  );
}
