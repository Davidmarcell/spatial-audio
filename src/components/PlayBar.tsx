import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { UiIcon, type UiIconName } from './UiIcon';
import glass from '../styles/glassButton.module.css';
import styles from './PlayBar.module.css';

type Props = {
  isPlaying: boolean;
  onToggle: () => void;
};

const PLAY_LABEL = 'Play audio';
const PAUSE_LABEL = 'Pause audio';
/** Keep the pill wide enough for the longer label so morphing never reflows. */
const LABEL_SIZER = 'Pause audio';

/** Per-letter wave — slower motion, longer gap before the next word slides in beneath. */
const LETTER_STAGGER_MS = 24;
const LETTER_ENTER_LAG_MS = 34;
const LETTER_DURATION_MS = 280;

/** Springy icon crossfade — old icon shrinks/fades out as the new one pops/fades in. */
const ICON_MORPH_MS = 320;

function MorphIcon({ icon, reducedMotion }: { icon: UiIconName; reducedMotion: boolean }) {
  const [current, setCurrent] = useState(icon);
  const [exiting, setExiting] = useState<UiIconName | null>(null);
  const prevIconRef = useRef(icon);

  useEffect(() => {
    if (icon === prevIconRef.current) return;

    const outgoing = prevIconRef.current;
    prevIconRef.current = icon;

    if (reducedMotion) {
      setExiting(null);
      setCurrent(icon);
      return;
    }

    setExiting(outgoing);
    setCurrent(icon);

    const timer = window.setTimeout(() => setExiting(null), ICON_MORPH_MS);
    return () => window.clearTimeout(timer);
  }, [icon, reducedMotion]);

  return (
    <span className={styles.iconSlot} aria-hidden>
      {exiting ? <UiIcon key={`exit-${exiting}`} icon={exiting} className={styles.iconExit} /> : null}
      <UiIcon
        key={`enter-${current}`}
        icon={current}
        className={exiting ? styles.iconEnter : undefined}
      />
    </span>
  );
}

type LabelVariant = 'enter' | 'exit' | 'static';

function morphTotalMs(lengthA: number, lengthB: number): number {
  const letters = Math.max(lengthA, lengthB, 1);
  return (letters - 1) * LETTER_STAGGER_MS + LETTER_DURATION_MS + LETTER_ENTER_LAG_MS + 24;
}

function StaggeredLabel({ text, variant }: { text: string; variant: LabelVariant }) {
  return (
    <span
      className={`${styles.labelLayer} ${variant === 'enter' ? styles.labelEnter : ''} ${
        variant === 'exit' ? styles.labelExit : ''
      }`}
      aria-hidden
    >
      {Array.from(text).map((char, index) => (
        <span
          key={`${text}-${index}`}
          className={styles.letter}
          style={{ '--letter-i': index } as CSSProperties}
        >
          {char === ' ' ? '\u00a0' : char}
        </span>
      ))}
    </span>
  );
}

export function PlayBar({ isPlaying, onToggle }: Props) {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const targetLabel = isPlaying ? PAUSE_LABEL : PLAY_LABEL;
  const [displayLabel, setDisplayLabel] = useState(targetLabel);
  const [exitingLabel, setExitingLabel] = useState<string | null>(null);
  const [incomingLabel, setIncomingLabel] = useState<string | null>(null);
  const prevTargetRef = useRef(targetLabel);

  useEffect(() => {
    if (targetLabel === prevTargetRef.current) return;

    const outgoing = prevTargetRef.current;
    prevTargetRef.current = targetLabel;

    if (reducedMotion) {
      setExitingLabel(null);
      setIncomingLabel(null);
      setDisplayLabel(targetLabel);
      return;
    }

    setExitingLabel(outgoing);
    setIncomingLabel(targetLabel);

    const timer = window.setTimeout(() => {
      setExitingLabel(null);
      setIncomingLabel(null);
      setDisplayLabel(targetLabel);
    }, morphTotalMs(outgoing.length, targetLabel.length));

    return () => window.clearTimeout(timer);
  }, [reducedMotion, targetLabel]);

  const showMorph = exitingLabel && incomingLabel;

  return (
    <button
      type="button"
      className={`${glass.pill} ${styles.button}`}
      onClick={onToggle}
      aria-label={targetLabel}
    >
      <MorphIcon icon={isPlaying ? 'pause' : 'play'} reducedMotion={reducedMotion} />
      <span className={styles.labelSlot}>
        <span className={styles.labelSizer}>{LABEL_SIZER}</span>
        {showMorph ? (
          <>
            <StaggeredLabel text={exitingLabel} variant="exit" />
            <StaggeredLabel text={incomingLabel} variant="enter" />
          </>
        ) : (
          <StaggeredLabel text={displayLabel} variant="static" />
        )}
      </span>
    </button>
  );
}
