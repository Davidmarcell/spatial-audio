import type { ReactNode } from 'react';
import { AsciiCloudBackground } from './AsciiCloudBackground';
import styles from './AsciiSection.module.css';

type Props = {
  children?: ReactNode;
  /** Accessible label for the section */
  'aria-label'?: string;
  className?: string;
  seed?: number;
};

/**
 * Full-bleed section shell with the 1920×1080 ASCII cloud as atmosphere.
 * Drop content into the foreground layer; the cloud stays decorative.
 */
export function AsciiSection({
  children,
  'aria-label': ariaLabel = 'Featured section',
  className,
  seed,
}: Props) {
  return (
    <section
      className={[styles.section, className].filter(Boolean).join(' ')}
      aria-label={ariaLabel}
    >
      <AsciiCloudBackground seed={seed} />
      <div className={styles.content}>{children}</div>
    </section>
  );
}
