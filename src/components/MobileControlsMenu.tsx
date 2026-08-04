import { useEffect, useId, useState, type ReactNode } from 'react';
import styles from './MobileControlsMenu.module.css';

type Props = {
  /** Primary action buttons (location, shuffle, map, share). */
  actions?: ReactNode;
  /** Secondary row (theme, about). */
  extras: ReactNode;
};

/**
 * Mobile-only top-left burger that toggles the crowded chrome controls.
 * Desktop keeps the existing bottom-bar / top-right layout.
 */
export function MobileControlsMenu({ actions, extras }: Props) {
  const [open, setOpen] = useState(false);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className={`${styles.burger} ${open ? styles.burgerOpen : ''}`}
        aria-label={open ? 'Close controls' : 'Open controls'}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className={styles.burgerGlyph} aria-hidden>
          <span />
          <span />
          <span />
        </span>
      </button>

      {open && (
        <button
          type="button"
          className={styles.scrim}
          aria-label="Dismiss controls"
          onClick={() => setOpen(false)}
        />
      )}

      <div className={styles.menuRoot} id={menuId}>
        <div
          className={`${styles.menu} ${open ? styles.menuOpen : ''}`}
          hidden={!open}
          role="dialog"
          aria-label="Controls"
        >
          {actions ? (
            <div>
              <p className={styles.label}>Places</p>
              <div
                className={styles.actions}
                onClick={() => setOpen(false)}
                onKeyDown={() => undefined}
              >
                {actions}
              </div>
            </div>
          ) : null}
          <div>
            <p className={styles.label}>App</p>
            <div className={styles.rowGrow}>{extras}</div>
          </div>
        </div>
      </div>
    </>
  );
}
