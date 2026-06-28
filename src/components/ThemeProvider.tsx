'use client';

import { createContext, useContext, useEffect, useState, useCallback, useSyncExternalStore } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * Read the initial theme from localStorage or system preference.
 * Returns 'dark' on the server (SSR) or as a fallback.
 */
function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const saved = localStorage.getItem('theme') as Theme | null;
  if (saved === 'light' || saved === 'dark') return saved;
  if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
  return 'dark';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Use useSyncExternalStore to avoid the "setState in effect" pattern
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  // Track client mount to prevent hydration mismatch
  const isMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  // Apply the theme class to <html> and persist to localStorage
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  // Prevent flash of wrong theme during SSR
  if (!isMounted) {
    return null;
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
