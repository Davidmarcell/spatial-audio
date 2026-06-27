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

export function UiIcon({ icon, size = 'md', className }: Props) {
  return (
    <i
      className={['fa-regular', `fa-${icon}`, styles.root, sizeClass[size], className]
        .filter(Boolean)
        .join(' ')}
      aria-hidden
    />
  );
}
