'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface TelefunWarningContextType {
  isMaintenanceOpen: boolean;
  openMaintenance: () => void;
  closeMaintenance: () => void;
}

const TelefunWarningContext = createContext<TelefunWarningContextType | undefined>(undefined);

export function TelefunWarningProvider({ children }: { children: ReactNode }) {
  const [isMaintenanceOpen, setIsMaintenanceOpen] = useState(false);

  const openMaintenance = () => setIsMaintenanceOpen(true);
  const closeMaintenance = () => setIsMaintenanceOpen(false);

  return (
    <TelefunWarningContext.Provider value={{ isMaintenanceOpen, openMaintenance, closeMaintenance }}>
      {children}
    </TelefunWarningContext.Provider>
  );
}

export function useTelefunWarning() {
  const context = useContext(TelefunWarningContext);
  if (context === undefined) {
    throw new Error('useTelefunWarning must be used within a TelefunWarningProvider');
  }
  return context;
}
