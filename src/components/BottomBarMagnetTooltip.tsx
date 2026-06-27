import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './BottomBarMagnetTooltip.module.css';

const GAP = 8;
const VIEWPORT_PADDING = 8;

export type BottomBarTooltipAnchor = {
  text: string;
  rect: DOMRect;
};

type Placement = 'above' | 'below' | 'left' | 'right';

type Props = {
  anchor: BottomBarTooltipAnchor | null;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function computePlacement(
  rect: DOMRect,
  tooltipWidth: number,
  tooltipHeight: number,
): { placement: Placement; left: number; top: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const nearRight = rect.right > vw - 72;
  const nearBottom = rect.bottom > vh - 72;

  const candidates: { placement: Placement; left: number; top: number }[] = [
    {
      placement: 'above',
      left: rect.left + rect.width / 2 - tooltipWidth / 2,
      top: rect.top - tooltipHeight - GAP,
    },
    {
      placement: 'left',
      left: rect.left - tooltipWidth - GAP,
      top: rect.top + rect.height / 2 - tooltipHeight / 2,
    },
    {
      placement: 'right',
      left: rect.right + GAP,
      top: rect.top + rect.height / 2 - tooltipHeight / 2,
    },
    {
      placement: 'below',
      left: rect.left + rect.width / 2 - tooltipWidth / 2,
      top: rect.bottom + GAP,
    },
  ];

  const order: Placement[] =
    nearRight && nearBottom
      ? ['left', 'above', 'right', 'below']
      : ['above', 'left', 'right', 'below'];

  for (const placement of order) {
    const candidate = candidates.find((item) => item.placement === placement)!;
    const fits =
      candidate.left >= VIEWPORT_PADDING
      && candidate.top >= VIEWPORT_PADDING
      && candidate.left + tooltipWidth <= vw - VIEWPORT_PADDING
      && candidate.top + tooltipHeight <= vh - VIEWPORT_PADDING;
    if (fits) return candidate;
  }

  const fallback = candidates.find((item) => item.placement === order[0])!;
  return {
    placement: fallback.placement,
    left: clamp(
      fallback.left,
      VIEWPORT_PADDING,
      Math.max(VIEWPORT_PADDING, vw - tooltipWidth - VIEWPORT_PADDING),
    ),
    top: clamp(
      fallback.top,
      VIEWPORT_PADDING,
      Math.max(VIEWPORT_PADDING, vh - tooltipHeight - VIEWPORT_PADDING),
    ),
  };
}

export function anchorFromTooltipTarget(target: EventTarget | null): BottomBarTooltipAnchor | null {
  if (!(target instanceof Element)) return null;
  const trigger = target.closest<HTMLElement>('[data-tooltip]');
  if (!trigger) return null;
  if (trigger instanceof HTMLButtonElement && trigger.disabled) return null;
  const text = trigger.getAttribute('data-tooltip');
  if (!text) return null;
  return { text, rect: trigger.getBoundingClientRect() };
}

export function BottomBarMagnetTooltip({ anchor }: Props) {
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

  const { text, rect } = anchor;
  const tooltipWidth = size.width || 80;
  const tooltipHeight = size.height || 28;
  const { placement, left, top } = computePlacement(rect, tooltipWidth, tooltipHeight);

  return createPortal(
    <div
      ref={tooltipRef}
      className={`${styles.tooltip} ${styles[placement]}`}
      style={{
        left: `${left}px`,
        top: `${top}px`,
      }}
      role="tooltip"
    >
      {text}
    </div>,
    document.body,
  );
}
