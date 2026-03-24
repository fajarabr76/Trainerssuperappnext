'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

interface AccessDeniedContextType {
  isAccessDeniedOpen: boolean;
  openAccessDenied: () => void;
  closeAccessDenied: () => void;
}

const AccessDeniedContext = createContext<AccessDeniedContextType | undefined>(undefined);

export function AccessDeniedProvider({ children }: { children: React.ReactNode }) {
  const [isAccessDeniedOpen, setIsAccessDeniedOpen] = useState(false);

  const openAccessDenied = useCallback(() => setIsAccessDeniedOpen(true), []);
  const closeAccessDenied = useCallback(() => setIsAccessDeniedOpen(false), []);

  return (
    <AccessDeniedContext.Provider value={{ isAccessDeniedOpen, openAccessDenied, closeAccessDenied }}>
      {children}
    </AccessDeniedContext.Provider>
  );
}

export function useAccessDenied() {
  const context = useContext(AccessDeniedContext);
  if (context === undefined) {
    throw new Error('useAccessDenied must be used within an AccessDeniedProvider');
  }
  return context;
}
