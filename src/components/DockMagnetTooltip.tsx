import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { SoundDef } from '../data/types';
import { getSoundTooltipLines } from '../utils/soundTooltip';
import styles from './DockMagnetTooltip.module.css';

const GAP = 8;
const VIEWPORT_PAD = 8;

export type DockTooltipAnchor = {
  sound: SoundDef;
  /** Icon center (includes transform scale). */
  centerX: number;
  centerY: number;
  /** Icon bounding rect (includes transform scale). */
  iconTop: number;
  iconHeight: number;
  iconLeft: number;
  iconWidth: number;
  horizontal: boolean;
};

type Props = {
  anchor: DockTooltipAnchor | null;
};

type Rect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

type Placement = 'above' | 'beside';

function rectsOverlap(a: Rect, b: Rect, margin = 0): boolean {
  return !(
    a.right + margin <= b.left ||
    a.left >= b.right + margin ||
    a.bottom + margin <= b.top ||
    a.top >= b.bottom + margin
  );
}

function clampHorizontal(left: number, width: number): number {
  const maxLeft = window.innerWidth - width - VIEWPORT_PAD;
  return Math.max(VIEWPORT_PAD, Math.min(left, maxLeft));
}

function computePlacement(
  anchor: DockTooltipAnchor,
  tooltipWidth: number,
  tooltipHeight: number,
): { placement: Placement; left: number; top: number } {
  const { centerX, centerY, iconTop, iconLeft, iconWidth, iconHeight, horizontal } = anchor;
  const iconRect: Rect = {
    left: iconLeft,
    top: iconTop,
    right: iconLeft + iconWidth,
    bottom: iconTop + iconHeight,
  };

  if (horizontal) {
    return {
      placement: 'above',
      left: clampHorizontal(centerX - tooltipWidth / 2, tooltipWidth),
      top: iconTop - tooltipHeight - GAP,
    };
  }

  const besideLeft = iconRect.right + GAP;
  const besideTop = centerY - tooltipHeight / 2;
  const besideRect: Rect = {
    left: besideLeft,
    top: besideTop,
    right: besideLeft + tooltipWidth,
    bottom: besideTop + tooltipHeight,
  };

  const besideFitsViewport = besideRect.right <= window.innerWidth - VIEWPORT_PAD;
  const besideClearOfIcon = !rectsOverlap(besideRect, iconRect);

  if (besideFitsViewport && besideClearOfIcon) {
    return { placement: 'beside', left: besideLeft, top: besideTop };
  }

  return {
    placement: 'above',
    left: clampHorizontal(centerX - tooltipWidth / 2, tooltipWidth),
    top: iconRect.top - tooltipHeight - GAP,
  };
}

export function DockMagnetTooltip({ anchor }: Props) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!anchor || !tooltipRef.current) return;
    const node = tooltipRef.current;
    const measure = () => {
      const rect = node.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [anchor]);

  if (!anchor) return null;

  const { sound } = anchor;
  const { title } = getSoundTooltipLines(sound);
  const tooltipWidth = size.width || 80;
  const tooltipHeight = size.height || 28;
  const { placement, left, top } = computePlacement(anchor, tooltipWidth, tooltipHeight);

  return createPortal(
    <div
      ref={tooltipRef}
      className={`${styles.tooltip} ${placement === 'above' ? styles.above : styles.beside}`}
      style={{
        left: `${left}px`,
        top: `${top}px`,
      }}
      role="tooltip"
    >
      {title}
    </div>,
    document.body,
  );
}
