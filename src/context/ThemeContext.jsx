import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export const THEME_STORAGE_KEY = 'psicologa_tema';

const ThemeContext = createContext(null);

function applyTheme(theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    'content',
    theme === 'dark' ? '#0b0b0c' : '#f3f1ea',
  );
}

function preferredTheme() {
  if (typeof document !== 'undefined' && ['light', 'dark'].includes(document.documentElement.dataset.theme)) {
    return document.documentElement.dataset.theme;
  }
  if (typeof window !== 'undefined') {
    try {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (['light', 'dark'].includes(stored)) return stored;
    } catch {
      // O tema continua funcionando quando o armazenamento está indisponível.
    }
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  }
  return 'light';
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(preferredTheme);

  useEffect(() => {
    applyTheme(theme);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // A preferência permanece ativa durante a sessão atual.
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    // O DOM muda antes da nova renderização para que animações que
    // consultam variáveis CSS recebam imediatamente a paleta correta.
    applyTheme(nextTheme);
    setTheme(nextTheme);
  }, [theme]);

  const value = useMemo(() => ({
    theme,
    isDark: theme === 'dark',
    toggleTheme,
  }), [theme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme deve ser usado dentro de ThemeProvider.');
  return context;
}
