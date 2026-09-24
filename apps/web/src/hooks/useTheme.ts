import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'agentic-flows-theme';
type Theme = 'dark' | 'light';

function readInitialTheme(): Theme {
  return document.documentElement.classList.contains('light') ? 'light' : 'dark';
}

/** Mirrors the pre-paint inline script in index.html; keeps class + storage in sync. */
export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const [theme, setTheme] = useState<Theme>(readInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  return { theme, toggleTheme };
}
