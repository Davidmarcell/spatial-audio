import type { SheetContentProps } from '@silk-hq/components';

/**
 * Background layer animation when a sheet presents — iOS-style scale, parallax,
 * and corner rounding. Used on SheetStack.Outlet (Silk "Sheet with Depth" pattern).
 */
export const appStackingAnimation = {
  scale: [1, 0.92],
  translateY: ({ progress }: { progress: number }) =>
    progress <= 1 ? `${progress * -12}px` : `calc(-14px + 2px * ${progress})`,
  borderRadius: ({ tween }: { tween: (start: string, end: string) => string }) =>
    tween('0px', '14px'),
  transformOrigin: '50% 0',
} satisfies NonNullable<SheetContentProps['stackingAnimation']>;

/**
 * Sheet panel animation when another sheet stacks above it.
 * Matches Silk SheetWithStacking bottom-placement defaults.
 */
export const bottomSheetStackingAnimation = {
  translateY: ({ progress }: { progress: number }) =>
    progress <= 1 ? `${progress * -10}px` : `calc(-12.5px + 2.5px * ${progress})`,
  scale: [1, 0.933],
  transformOrigin: '50% 0',
} satisfies NonNullable<SheetContentProps['stackingAnimation']>;

/** Backdrop dim driven by sheet travel progress. */
export const sheetBackdropTravelAnimation = { opacity: [0, 0.22] as [number, number] };
