export type BottomBarTooltipAnchor = {
  text: string;
  rect: DOMRect;
};

export function anchorFromTooltipTarget(target: EventTarget | null): BottomBarTooltipAnchor | null {
  if (!(target instanceof Element)) return null;
  const button = target.closest<HTMLButtonElement>('[data-tooltip]');
  if (!button || button.disabled) return null;
  const text = button.getAttribute('data-tooltip');
  if (!text) return null;
  return { text, rect: button.getBoundingClientRect() };
}
