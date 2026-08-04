import { AsciiSection } from '../components/AsciiSection';
import styles from './AsciiBackgroundPreview.module.css';

/**
 * Preview the 1920×1080 ASCII cloud as a website section background.
 * Open with `?view=ascii`
 */
export default function AsciiBackgroundPreview() {
  return (
    <main className={styles.page}>
      <AsciiSection aria-label="ASCII atmosphere preview">
        <p className={styles.caption}>1920 × 1080 · ASCII atmosphere</p>
      </AsciiSection>
    </main>
  );
}
