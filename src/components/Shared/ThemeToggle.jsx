import { useTheme } from '../../context/ThemeContext';

export default function ThemeToggle({ className = '' }) {
  const { isDark, toggleTheme } = useTheme();
  const nextTheme = isDark ? 'claro' : 'escuro';

  return (
    <button
      className={`theme-toggle${className ? ` ${className}` : ''}`}
      type="button"
      aria-label={`Ativar modo ${nextTheme}`}
      aria-pressed={isDark}
      title={`Ativar modo ${nextTheme}`}
      onClick={toggleTheme}
    >
      <i className={`bi ${isDark ? 'bi-sun' : 'bi-moon-stars'}`} aria-hidden="true" />
    </button>
  );
}
