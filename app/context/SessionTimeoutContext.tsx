'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/lib/supabase/client';
import { useIdleTimeout } from '@/app/lib/hooks/useIdleTimeout';
import IdleWarningModal from '@/app/components/IdleWarningModal';

import { 
  AUTH_SESSION_TIMEOUT, 
  AUTH_GRACE_PERIOD_SEC, 
  AUTH_MAX_LIFETIME 
} from '@/app/constants';

interface SessionTimeoutContextType {
  signOut: () => Promise<void>;
}

const SessionTimeoutContext = createContext<SessionTimeoutContextType | undefined>(undefined);

export const SessionTimeoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const supabase = createClient();
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(AUTH_GRACE_PERIOD_SEC);
  const [user, setUser] = useState<any>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const { isIdle, resetTimer } = useIdleTimeout(AUTH_SESSION_TIMEOUT);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('trainers_login_time');
    localStorage.removeItem('trainers_last_activity');
    setShowWarning(false);
    
    // Clear any active countdowns
    if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
    }
    
    router.push('/?auth=login');
    router.refresh();
  }, [supabase, router]);

  // Initial auth status detection
  useEffect(() => {
    const getInitialUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user && !localStorage.getItem('trainers_login_time')) {
        localStorage.setItem('trainers_login_time', Date.now().toString());
      }
    };
    getInitialUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === 'SIGNED_IN' && session?.user) {
        localStorage.setItem('trainers_login_time', Date.now().toString());
      } else if (event === 'SIGNED_OUT') {
        localStorage.removeItem('trainers_login_time');
        localStorage.removeItem('trainers_last_activity');
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  // Respond to Idle state
  useEffect(() => {
    if (isIdle && user) {
      setShowWarning(true);
      setCountdown(AUTH_GRACE_PERIOD_SEC);
    } else {
      setShowWarning(false);
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    }
  }, [isIdle, user]);

  // Manage Warning Countdown
  useEffect(() => {
    if (showWarning && countdown > 0) {
      countdownIntervalRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            signOut();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [showWarning, signOut]);

  // Enforce Max Session Lifetime (8 Hours)
  useEffect(() => {
    const checkMaxLifetime = () => {
      const loginTimeStr = localStorage.getItem('trainers_login_time');
      if (loginTimeStr && user) {
        const loginTime = parseInt(loginTimeStr);
        const elapsed = Date.now() - loginTime;
        
        if (elapsed > AUTH_MAX_LIFETIME) {
          signOut();
        }
      }
    };

    // Check every minute
    const interval = setInterval(checkMaxLifetime, 60000);
    return () => clearInterval(interval);
  }, [user, signOut]);

  return (
    <SessionTimeoutContext.Provider value={{ signOut }}>
      {children}
      <IdleWarningModal 
        isOpen={showWarning} 
        onStayLoggedIn={resetTimer} 
        onLogout={signOut} 
        countdownSeconds={countdown}
      />
    </SessionTimeoutContext.Provider>
  );
};

export const useSessionTimeout = () => {
  const context = useContext(SessionTimeoutContext);
  if (context === undefined) {
    throw new Error('useSessionTimeout must be used within a SessionTimeoutProvider');
  }
  return context;
};
