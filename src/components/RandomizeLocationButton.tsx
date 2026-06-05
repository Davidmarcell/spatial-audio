import { useCallback, useMemo } from 'react';
import type { AppLocation } from '../data/environments';
import type { WorldLocation } from '../data/worldLocations';
import { pickRandomRegion } from '../utils/pickRandomRegion';
import styles from './RandomizeLocationButton.module.css';

type Props = {
  appLocations: readonly AppLocation[];
  worldLocations: readonly WorldLocation[];
  onPick: (environmentId: string, regionId: string) => void;
};

/** Change to 1–4 to pick a default icon variant. Overridden by `?randomIcon=2` in the URL. */
export const RANDOMIZE_ICON_VARIANT = 1 as 1 | 2 | 3 | 4;

type IconVariant = 1 | 2 | 3 | 4;

const STROKE = {
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.65,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function resolveIconVariant(): IconVariant {
  if (typeof window === 'undefined') {
    return RANDOMIZE_ICON_VARIANT;
  }

  const param = new URLSearchParams(window.location.search).get('randomIcon');
  if (!param) {
    return RANDOMIZE_ICON_VARIANT;
  }

  const parsed = Number(param);
  if (parsed >= 1 && parsed <= 4) {
    return parsed as IconVariant;
  }

  return RANDOMIZE_ICON_VARIANT;
}

/** Option 1: Classic shuffle — two crossing curved arrows (SF Symbol style). */
function ShuffleClassicIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={styles.icon}>
      <path d="M16.5 4.5 19 7l-2.5 2.5" {...STROKE} />
      <path d="M18.5 7H12c-3.3 0-6 2.7-6 6" {...STROKE} />
      <path d="M7.5 19.5 5 17l2.5-2.5" {...STROKE} />
      <path d="M5.5 17h6.5c3.3 0 6-2.7 6-6" {...STROKE} />
    </svg>
  );
}

/** Option 2: Dice face — single die showing five dots. */
function DiceFiveIcon() {
  const dot = { fill: 'currentColor' };
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={styles.icon}>
      <rect x="5" y="5" width="14" height="14" rx="2.75" {...STROKE} />
      <circle cx="9" cy="9" r="1.15" {...dot} />
      <circle cx="15" cy="9" r="1.15" {...dot} />
      <circle cx="12" cy="12" r="1.15" {...dot} />
      <circle cx="9" cy="15" r="1.15" {...dot} />
      <circle cx="15" cy="15" r="1.15" {...dot} />
    </svg>
  );
}

/** Option 3: iOS Music shuffle — crossing curves with arrowheads on both paths. */
function ShuffleDoubleArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={styles.icon}>
      <path d="M5.5 17.75C5.5 12.5 8.75 8.75 12.75 8.25c1.85-.25 3.65.35 5 1.75" {...STROKE} />
      <path d="M17.75 10 19.75 8 17.75 6" {...STROKE} />
      <path d="M4.75 18.75 5.5 17.75 7 18.75" {...STROKE} />
      <path d="M18.25 6.25C18.25 11.5 15 15.25 11 15.75c-1.85.25-3.65-.35-5-1.75" {...STROKE} />
      <path d="M6.25 14 4.25 16 6.25 18" {...STROKE} />
      <path d="M19.25 5.25 18.25 6.25 19.75 7.25" {...STROKE} />
    </svg>
  );
}

/** Option 4: Random dice — die outline with scattered dots (subtle sparkle). */
function RandomDiceIcon() {
  const dot = { fill: 'currentColor' };
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={styles.icon}>
      <rect x="5.25" y="5.25" width="13.5" height="13.5" rx="2.5" {...STROKE} />
      <circle cx="8.75" cy="8.25" r="1.05" {...dot} />
      <circle cx="14.5" cy="9.5" r="1.05" {...dot} />
      <circle cx="10.25" cy="13.25" r="1.05" {...dot} />
      <circle cx="15.25" cy="15.25" r="1.05" {...dot} />
      <path d="M18.75 4.75 20 3.5M20 6.25l1.25-1.25" {...STROKE} strokeWidth={1.35} />
    </svg>
  );
}

function RandomizeIcon({ variant }: { variant: IconVariant }) {
  switch (variant) {
    case 2:
      return <DiceFiveIcon />;
    case 3:
      return <ShuffleDoubleArrowIcon />;
    case 4:
      return <RandomDiceIcon />;
    default:
      return <ShuffleClassicIcon />;
  }
}

export function RandomizeLocationButton({ appLocations, worldLocations, onPick }: Props) {
  const iconVariant = useMemo(() => resolveIconVariant(), []);

  const handleClick = useCallback(() => {
    const next = pickRandomRegion(appLocations, worldLocations);
    onPick(next.environmentId, next.regionId);
  }, [appLocations, onPick, worldLocations]);

  return (
    <button
      type="button"
      className={styles.button}
      onClick={handleClick}
      aria-label="Random location"
      data-tooltip="Random location"
    >
      <RandomizeIcon variant={iconVariant} />
    </button>
  );
}
