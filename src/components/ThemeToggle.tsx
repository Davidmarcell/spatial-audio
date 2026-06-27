import { useCallback, useState } from 'react';
import glass from '../styles/glassButton.module.css';
import { getResolvedTheme, toggleTheme } from '../utils/theme';
import { UiIcon } from './UiIcon';
import styles from './ThemeToggle.module.css';

export function ThemeToggle() {
  const [dark, setDark] = useState(() => getResolvedTheme() === 'dark');

  const handleClick = useCallback(() => {
    setDark(toggleTheme() === 'dark');
  }, []);

  return (
    <button
      type="button"
      className={`${glass.icon} ${styles.toggle}`}
      onClick={handleClick}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <UiIcon icon={dark ? 'sun' : 'moon'} />
    </button>
  );
}
