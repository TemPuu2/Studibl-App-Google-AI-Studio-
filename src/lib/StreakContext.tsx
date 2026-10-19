import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { isRealUserSession } from './supabaseService';
import { supabase } from '../supabaseClient';

/**
 * Interface representing the complete synchronized streak metrics.
 * Provides a single, unified source of truth for the entire application.
 */
export interface StreakContextType {
  streak: number;          // Backward compatible current streak
  currentStreak: number;   // Current consecutive study/login days
  longestStreak: number;   // All-time longest streak
  missedDays: number;      // Days missed in the last 14 calendar days
  consistency: number;     // Consistency percentage in the last 14 calendar days
  loginDates: string[];    // Chronological list of active YYYY-MM-DD dates
  recordLogin: () => void; // Explicitly record a login event
}

const StreakContext = createContext<StreakContextType | undefined>(undefined);

const LOGIN_DATES_KEY = 'studibl_login_dates';

/**
 * Returns the YYYY-MM-DD date representation in local timezone.
 * Using a manual local ISO calculation ensures robust date matching regardless of user locales.
 */
function getLocalDateString(dateObj: Date = new Date()): string {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculates high-level streak metrics from an array of local date strings.
 * Built as a pure function to guarantee calculation consistency wherever stats are computed.
 */
export function computeStreakStats(datesList: string[]): {
  currentStreak: number;
  longestStreak: number;
  missedDays: number;
  consistency: number;
} {
  if (!datesList || datesList.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      missedDays: 14,
      consistency:  0,
    };
  }

  // Ensure login history dates are deduplicated and in ascending chronological order
  const uniqueDates = Array.from(new Set(datesList)).sort();
  const uniqueSet = new Set(uniqueDates);

  // 1. Calculate longest consecutive historical run
  let longest = 0;
  let currentRun = 0;
  let prevDate: Date | null = null;

  uniqueDates.forEach(dStr => {
    const parts = dStr.split('-');
    const currentDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    if (!prevDate) {
      currentRun = 1;
    } else {
      const diffTime = Math.abs(currentDate.getTime() - prevDate.getTime());
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        currentRun += 1;
      } else if (diffDays > 1) {
        if (currentRun > longest) longest = currentRun;
        currentRun = 1;
      }
    }
    prevDate = currentDate;
  });
  if (currentRun > longest) longest = currentRun;

  // 2. Compute current running streak backward from today or yesterday.
  // The streak dies if the user has not logged in today or yesterday.
  const now = new Date();
  const todayStr = getLocalDateString(now);

  const yesterdayObj = new Date(now);
  yesterdayObj.setDate(yesterdayObj.getDate() - 1);
  const yesterdayStr = getLocalDateString(yesterdayObj);

  let current = 0;
  const hasToday = uniqueSet.has(todayStr);
  const hasYesterday = uniqueSet.has(yesterdayStr);

  if (hasToday || hasYesterday) {
    let checkDate = hasToday ? new Date(now) : yesterdayObj;
    let checkStr = getLocalDateString(checkDate);

    while (uniqueSet.has(checkStr)) {
      current += 1;
      checkDate.setDate(checkDate.getDate() - 1);
      checkStr = getLocalDateString(checkDate);
    }
  }

  // 3. Compute missed study days within the last 14 days windows
  let missedCount = 0;
  for (let i = 0; i < 14; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = getLocalDateString(d);
    if (!uniqueSet.has(dateStr)) {
      missedCount += 1;
    }
  }

  const consistency = Math.round(((14 - missedCount) / 14) * 100);

  return {
    currentStreak: current,
    longestStreak: Math.max(longest, current),
    missedDays: missedCount,
    consistency,
  };
}

/**
 * Declares the StreakProvider state manager wrapping standard app layout.
 * Synchronizes client logins, background midnight updates, and study milestones.
 */
export function StreakProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth() || {};
  const [loginDates, setLoginDates] = useState<string[]>([]);

  // Function to fetch login dates list from Supabase/database
  const loadSupabaseDates = React.useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_login_dates')
        .select('login_date')
        .eq('user_id', userId);

      if (error) {
        console.error("Error loading user_login_dates from Supabase:", error);
        return;
      }

      const parsedDates = (data || []).map((row: any) => row.login_date);
      setLoginDates(parsedDates);
    } catch (e) {
      console.error("Error patching login dates from database:", e);
    }
  }, []);

  // Sync with Supabase when authenticated user session is active
  useEffect(() => {
    const isReal = user && isRealUserSession(user.id);
    if (isReal) {
      const userId = user!.id;
      loadSupabaseDates(userId);

      // Realtime subscription: receives notification on insert/delete to update state dynamically
      const channel = supabase
        .channel(`realtime-streak-sync-${userId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'user_login_dates', filter: `user_id=eq.${userId}` },
          () => {
            console.log("Realtime user_login_dates change received. Synchronising streak across components...");
            loadSupabaseDates(userId);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      // Offline/Sandbox scenario: pull from localStorage for guest flows
      const saved = localStorage.getItem(LOGIN_DATES_KEY);
      if (saved) {
        try {
          setLoginDates(JSON.parse(saved));
        } catch (e) {
          console.error("Error parsing local login dates:", e);
        }
      } else {
        const today = getLocalDateString();
        setLoginDates([today]);
        localStorage.setItem(LOGIN_DATES_KEY, JSON.stringify([today]));
      }
    }
  }, [user, loadSupabaseDates]);

  // Idempotent login registration function ensuring today's date is tracked once in the database
  const recordLogin = React.useCallback(async () => {
    const today = getLocalDateString();
    const isReal = user && isRealUserSession(user.id);
    
    if (isReal) {
      try {
        const userId = user!.id;
        // Perform upsert to save login date securely
        await supabase
          .from('user_login_dates')
          .upsert({
            user_id: userId,
            login_date: today
          }, {
            onConflict: 'user_id,login_date'
          });
      } catch (e) {
        console.error("Error saving login date to Supabase:", e);
      }
    } else {
      // Guest local storage persistence fallback
      const saved = localStorage.getItem(LOGIN_DATES_KEY);
      let list: string[] = [];
      if (saved) {
        try {
          list = JSON.parse(saved);
        } catch (e) {}
      }
      if (!list.includes(today)) {
        const updated = [...list, today];
        localStorage.setItem(LOGIN_DATES_KEY, JSON.stringify(updated));
        setLoginDates(updated);
      }
    }
  }, [user]);

  // Record a login immediately when app initializes or regains platform focus
  useEffect(() => {
    recordLogin();
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        recordLogin();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [recordLogin]);

  // Setup reactive midnight boundaries interval to guarantee streak accuracy for continuous sessions
  useEffect(() => {
    const interval = setInterval(() => {
      recordLogin();
    }, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [recordLogin]);

  // Memoize computed values to prevent superfluous re-renders across the application
  const calculated = useMemo(() => {
    return computeStreakStats(loginDates);
  }, [loginDates]);

  return (
    <StreakContext.Provider
      value={{
        streak: calculated.currentStreak,
        currentStreak: calculated.currentStreak,
        longestStreak: calculated.longestStreak,
        missedDays: calculated.missedDays,
        consistency: calculated.consistency,
        loginDates,
        recordLogin,
      }}
    >
      {children}
    </StreakContext.Provider>
  );
}

/**
 * Access hook for reading the single, central streak state from any UI element.
 */
export function useStreak() {
  const context = useContext(StreakContext);
  if (context === undefined) {
    throw new Error('useStreak must be used within a StreakProvider');
  }
  return context;
}
