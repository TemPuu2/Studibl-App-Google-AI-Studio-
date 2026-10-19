import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { User, Session } from '@supabase/supabase-js';
import { isRealUserSession } from './supabaseService';

// Define the shape of our authentication context
interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<{ error: Error | null }>;
  loginAsSandbox: (userInfo: { email: string; name: string; metadata?: any }) => void;
  refreshUser: () => Promise<void>;
}

// Create the context with default empty values
const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => ({ error: null }),
  loginAsSandbox: () => {},
  refreshUser: async () => {},
});

/**
 * Hook to consume the AuthContext state easily.
 */
export const useAuth = () => useContext(AuthContext);

/**
 * Provider component that handles tracking user session with Supabase,
 * listening to authentication state changes, and maintaining user persistence.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Check for an active session of a user currently logging in or returning
    const checkSession = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (initialSession) {
          setSession(initialSession);
          setUser(initialSession.user);
        } else {
          // Check for fallback sandbox session
          const sandboxUserRaw = localStorage.getItem('studibl_sandbox_user');
          if (sandboxUserRaw) {
            try {
              const sandboxUser = JSON.parse(sandboxUserRaw);
              setUser(sandboxUser);
              setSession({
                access_token: 'sandbox-token',
                token_type: 'bearer',
                user: sandboxUser,
                expires_in: 3600,
                expires_at: Math.floor(Date.now() / 1000) + 3600
              } as any);
            } catch (e) {
              console.error('Error parsing sandbox user:', e);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching initial session:', err);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    // 2. Listen for authentication state transformations (Sign In, Sign Out, Token Refresh, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      if (currentSession) {
        setSession(currentSession);
        setUser(currentSession.user);

        // Safely synchronize any pending onboarding selections if the logged-in user is authenticated
        const pendingRaw = localStorage.getItem('studibl_onboarding_pending');
        if (pendingRaw && isRealUserSession(currentSession.user?.id)) {
          try {
            const pending = JSON.parse(pendingRaw);
            console.log("Pending academic data discovered. Synchronizing choices with Supabase...");

            // 1. Write selections to Auth metadata
            await supabase.auth.updateUser({
              data: {
                goal: pending.goal,
                challenge: pending.challenge,
                frequency: pending.frequency,
                target: pending.target,
                learningStyle: pending.learningStyle,
                academicLevel: pending.academicLevel,
                faculty: pending.faculty,
                department: pending.department,
                selected_courses: pending.selected_courses,
                isSandbox: false
              }
            });

            // 2. Upsert choices to the user profiles table row (forces existence of profiles entry)
            await supabase.from('profiles').upsert({
              id: currentSession.user.id,
              full_name: pending.full_name || currentSession.user.user_metadata?.full_name || 'Student',
              major: pending.department || pending.faculty || 'Undeclared',
              updated_at: new Date().toISOString()
            });

            // Clean cache to finalize onboarding synchronization
            localStorage.removeItem('studibl_onboarding_pending');
            console.log("Successfully synchronized onboarding choices with Supabase backend!");
          } catch (syncErr) {
            console.error("Failed to sync pending onboarding data to Supabase:", syncErr);
          }
        }
      } else {
        // Only set null if there's no sandbox user active
        const sandboxUserRaw = localStorage.getItem('studibl_sandbox_user');
        if (sandboxUserRaw) {
          try {
            const sandboxUser = JSON.parse(sandboxUserRaw);
            setUser(sandboxUser);
            setSession({
              access_token: 'sandbox-token',
              token_type: 'bearer',
              user: sandboxUser
            } as any);
          } catch (e) {
            setUser(null);
            setSession(null);
          }
        } else {
          setSession(null);
          setUser(null);
        }
      }
      setLoading(false);
    });

    // 3. Clean up subscription listener on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  /**
   * Helper function to log out of the current Supabase / Sandbox session.
   * Purges user-specific local storage caches to prevent cross-session data leakage.
   */
  const signOut = async () => {
    try {
      const userKeysToClean = [
        'studibl_sandbox_user',
        'studibl_avatar_cache',
        'studibl_ai_history',
        'studibl_saved_ai',
        'studibl_current_session_id',
        'studibl_user_lectures',
        'studibl_lecture_overrides',
        'studibl_removed_lectures',
        'studibl_recent_courses',
        'studibl_doc_progress',
        'studibl_video_progress',
        'studibl_user_missions',
        'studibl_latest_ai_quiz',
        'studibl_study_goals',
        'studibl_onboarding_pending',
        'studibl_lectures_done'
      ];
      userKeysToClean.forEach(key => {
        try {
          localStorage.removeItem(key);
        } catch (e) {}
      });

      setUser(null);
      setSession(null);
      
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      return { error: null };
    } catch (err) {
      console.error('Error logging out:', err);
      return { error: err as Error };
    }
  };

  /**
   * Helper function to authenticate a virtual student session
   */
  const loginAsSandbox = (userInfo: { email: string; name: string; metadata?: any }) => {
    const mockUser = {
      id: 'sandbox-guest-id',
      email: userInfo.email || 'sandbox@studibl.edu',
      user_metadata: {
        full_name: userInfo.name || 'Sandbox Student',
        ...userInfo.metadata
      },
      aud: 'authenticated',
      role: 'authenticated'
    } as any;
    
    localStorage.setItem('studibl_sandbox_user', JSON.stringify(mockUser));
    setUser(mockUser);
    setSession({
      access_token: 'sandbox-token',
      token_type: 'bearer',
      user: mockUser,
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600
    } as any);
  };

  /**
   * Refreshes the local authenticated user state from Supabase Auth
   */
  const refreshUser = async () => {
    try {
      const { data: { user: freshestUser } } = await supabase.auth.getUser();
      if (freshestUser) {
        setUser(freshestUser);
      }
    } catch (e) {
      console.error('Error refreshing auth user:', e);
    }
  };

  const value = {
    user,
    session,
    loading,
    signOut,
    loginAsSandbox,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
