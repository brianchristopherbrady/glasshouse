import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../hooks/useTheme.js';

export function ThemeToggle(): JSX.Element {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-text-muted transition-colors hover:border-border-strong hover:bg-surface-raised hover:text-text"
    >
      {isDark ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}
