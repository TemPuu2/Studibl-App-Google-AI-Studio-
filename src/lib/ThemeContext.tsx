import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

/**
 * Supported display theme modes.
 * - 'dark': The default cyber-neon dark aesthetic optimized for low-light studying.
 * - 'light': A clean, high-contrast light mode engineered for bright environments and direct sunlight.
 */
export type ThemeMode = 'dark' | 'light';

interface ThemeContextType {
  /** Currently active theme mode */
  theme: ThemeMode;
  /** Direct setter for theme mode */
  setTheme: (mode: ThemeMode) => void;
  /** Toggles between 'dark' and 'light' */
  toggleTheme: () => void;
  /** Helper flag indicating if high-contrast light mode is active */
  isLight: boolean;
}

const THEME_STORAGE_KEY = 'studibl_theme_preference';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * Provider component managing global theme state and DOM synchronization.
 * Persists user choice in localStorage and reflects classes and attributes onto the HTML root.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        if (stored === 'light' || stored === 'dark') {
          return stored;
        }
      } catch (err) {
        console.warn('[ThemeContext] LocalStorage access failed, falling back to default theme:', err);
      }
    }
    return 'dark';
  });

  /**
   * Persists the selected theme to localStorage and updates state.
   */
  const setTheme = useCallback((newTheme: ThemeMode) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch (err) {
      console.warn('[ThemeContext] Failed to persist theme to localStorage:', err);
    }
  }, []);

  /**
   * Quick toggle between Dark and Light mode.
   */
  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  /**
   * Synchronize DOM attributes and class lists with current theme mode.
   * Modifies both document.documentElement and document.body for full coverage.
   */
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    if (theme === 'light') {
      root.classList.add('theme-light', 'light');
      root.classList.remove('theme-dark', 'dark');
      root.setAttribute('data-theme', 'light');
      body.classList.add('theme-light', 'light');
      body.classList.remove('theme-dark', 'dark');
      body.setAttribute('data-theme', 'light');
    } else {
      root.classList.add('theme-dark', 'dark');
      root.classList.remove('theme-light', 'light');
      root.setAttribute('data-theme', 'dark');
      body.classList.add('theme-dark', 'dark');
      body.classList.remove('theme-light', 'light');
      body.setAttribute('data-theme', 'dark');
    }
  }, [theme]);

  const value = {
    theme,
    setTheme,
    toggleTheme,
    isLight: theme === 'light'
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Custom hook to consume theme mode and toggle operations.
 * Safely falls back to default dark theme if used outside ThemeProvider.
 */
export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      theme: 'dark',
      setTheme: () => {},
      toggleTheme: () => {},
      isLight: false
    };
  }
  return context;
}
