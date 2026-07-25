import type { ReactNode } from 'react';
import styles from './UiIcon.module.css';

export type UiIconName =
  | 'play'
  | 'pause'
  | 'arrow-up-from-bracket'
  | 'map'
  | 'magnifying-glass'
  | 'circle-info'
  | 'sun'
  | 'moon'
  | 'location-crosshairs'
  | 'plus'
  | 'xmark'
  | 'shuffle'
  | 'arrows-rotate'
  | 'eye'
  | 'volume-high'
  | 'volume-low'
  | 'volume-xmark';

type Size = 'xs' | 'sm' | 'md' | 'lg';

type Props = {
  icon: UiIconName;
  size?: Size;
  className?: string;
};

const sizeClass: Record<Size, string> = {
  xs: styles.xs,
  sm: styles.sm,
  md: styles.md,
  lg: styles.lg,
};

/** Inline SVG paths (24×24 viewBox) so chrome icons render without the
 * gitignored Font Awesome Pro webfont. */
const ICON_PATHS: Record<UiIconName, ReactNode> = {
  play: <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14Z" />,
  pause: (
    <>
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </>
  ),
  'arrow-up-from-bracket': (
    <>
      <path
        d="M12 3v11"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="m8 7 4-4 4 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  map: (
    <path d="M9.5 4.2 3.8 6.3a1 1 0 0 0-.8 1V18.6a1 1 0 0 0 1.3.95l5.2-1.85 6 2.1 5.7-2.1a1 1 0 0 0 .8-1V5.4a1 1 0 0 0-1.3-.95L15.5 6.3l-6-2.1Zm0 2.1v11.2m6-9.1v11.2" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
  ),
  'magnifying-glass': (
    <>
      <circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="m15.2 15.2 4.3 4.3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  'circle-info': (
    <>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 10.5v5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="12" cy="7.5" r="1" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.05 5.05l1.55 1.55M17.4 17.4l1.55 1.55M18.95 5.05l-1.55 1.55M6.6 17.4l-1.55 1.55"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </>
  ),
  moon: (
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 7 7 0 1 0 20 14.5Z" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
  ),
  'location-crosshairs': (
    <>
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </>
  ),
  plus: (
    <path
      d="M12 5v14M5 12h14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  ),
  xmark: (
    <path
      d="m6.5 6.5 11 11M17.5 6.5l-11 11"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  ),
  shuffle: (
    <path
      d="M16 4h4v4M4 8c4 0 5.5 2 8 4s4 4 8 4M20 16v4h-4M4 16c4 0 5.5-2 8-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  'arrows-rotate': (
    <path
      d="M20 12a8 8 0 0 1-13.5 5.8M4 12A8 8 0 0 1 17.5 6.2M16 3.5v4h4M8 20.5v-4H4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  eye: (
    <>
      <path
        d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.75" fill="none" stroke="currentColor" strokeWidth="1.75" />
    </>
  ),
  'volume-high': (
    <>
      <path d="M4.5 9.5h3L12 6v12l-4.5-3.5h-3a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1Z" />
      <path
        d="M15.5 9.2a3.4 3.4 0 0 1 0 5.6M18 7a6.2 6.2 0 0 1 0 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </>
  ),
  'volume-low': (
    <>
      <path d="M4.5 9.5h3L12 6v12l-4.5-3.5h-3a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1Z" />
      <path
        d="M15.5 9.2a3.4 3.4 0 0 1 0 5.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </>
  ),
  'volume-xmark': (
    <>
      <path d="M4.5 9.5h3L12 6v12l-4.5-3.5h-3a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1Z" />
      <path
        d="m16 9 5 5M21 9l-5 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </>
  ),
};

export function UiIcon({ icon, size = 'md', className }: Props) {
  return (
    <svg
      className={[styles.root, sizeClass[size], className].filter(Boolean).join(' ')}
      viewBox="0 0 24 24"
      aria-hidden
      focusable="false"
    >
      {ICON_PATHS[icon]}
    </svg>
  );
}
