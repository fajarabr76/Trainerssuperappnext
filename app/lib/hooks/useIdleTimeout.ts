'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Custom hook for detecting user inactivity (idle).
 * Syncs activity across multiple tabs using localStorage.
 */
export const useIdleTimeout = (idleTimeMs: number) => {
  const [isIdle, setIsIdle] = useState(false);
  const timeoutId = useRef<NodeJS.Timeout | null>(null);
  const lastSyncTime = useRef<number>(0);

  const resetTimer = useCallback(() => {
    setIsIdle(false);
    
    if (timeoutId.current) {
      clearTimeout(timeoutId.current);
    }

    timeoutId.current = setTimeout(() => {
      setIsIdle(true);
    }, idleTimeMs);

    // Throttle localStorage updates to once every 2 seconds to avoid performance issues
    const now = Date.now();
    if (now - lastSyncTime.current > 2000) {
      localStorage.setItem('trainers_last_activity', now.toString());
      lastSyncTime.current = now;
    }
  }, [idleTimeMs]);

  useEffect(() => {
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    
    const handleActivity = () => {
      resetTimer();
    };

    events.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    // Handle cross-tab sync
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'trainers_last_activity') {
        resetTimer();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    resetTimer();

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      window.removeEventListener('storage', handleStorageChange);
      if (timeoutId.current) {
        clearTimeout(timeoutId.current);
      }
    };
  }, [resetTimer]);

  return { isIdle, resetTimer };
};
