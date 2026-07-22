import { useCallback, useEffect, useState } from 'react';
import { getResolvedTheme, setStoredTheme, type ResolvedTheme } from '../utils/theme';
import { UiIcon } from './UiIcon';
import styles from './ThemeToggle.module.css';

export function ThemeToggle() {
  const [theme, setTheme] = useState<ResolvedTheme>(() => getResolvedTheme());

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setTheme(getResolvedTheme());
    });
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  const selectTheme = useCallback((next: ResolvedTheme) => {
    if (next === theme) return;
    setStoredTheme(next);
    setTheme(next);
  }, [theme]);

  const isDark = theme === 'dark';

  return (
    <div
      className={styles.toggle}
      data-theme={theme}
      role="group"
      aria-label="Colour theme"
    >
      <span className={styles.thumb} aria-hidden />
      <button
        type="button"
        className={`${styles.segment} ${!isDark ? styles.segmentActive : ''}`}
        onClick={() => selectTheme('light')}
        aria-pressed={!isDark}
        aria-label="Light mode"
      >
        <UiIcon icon="sun" size="sm" />
        <span className={styles.srOnly}>Light</span>
      </button>
      <button
        type="button"
        className={`${styles.segment} ${isDark ? styles.segmentActive : ''}`}
        onClick={() => selectTheme('dark')}
        aria-pressed={isDark}
        aria-label="Dark mode"
      >
        <UiIcon icon="moon" size="sm" />
        <span className={styles.srOnly}>Dark</span>
      </button>
    </div>
  );
}
