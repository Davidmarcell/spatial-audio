import { useEffect, type RefObject } from 'react';

const FOCUSABLE = 'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';
const scopes: HTMLElement[] = [];
let rootWasInert = false;

function visibleControls(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((node) =>
    !node.closest('[inert], [aria-hidden="true"]') &&
    node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden',
  );
}

/** One focus owner at a time, including lazy content and a closing card flight. */
export function useModalFocus(
  present: boolean,
  panelRef: RefObject<HTMLElement | null>,
  returnFocus?: () => HTMLElement | null,
) {
  useEffect(() => {
    const panel = panelRef.current;
    if (!present || !panel) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = document.getElementById('root');
    if (scopes.length === 0) rootWasInert = root?.inert ?? false;
    if (root && !root.contains(panel)) root.inert = true;
    panel.dataset.uiModalActive = 'true';
    scopes.push(panel);
    const isTop = () => scopes.at(-1) === panel;
    const focusFirst = () => (visibleControls(panel)[0] ?? panel).focus({ preventScroll: true });
    const frame = requestAnimationFrame(() => {
      if (isTop() && !panel.contains(document.activeElement)) focusFirst();
    });

    const onFocus = (event: FocusEvent) => {
      if (isTop() && event.target instanceof Node && !panel.contains(event.target)) focusFirst();
    };
    const onKey = (event: KeyboardEvent) => {
      if (!isTop() || event.key !== 'Tab') return;
      const controls = visibleControls(panel);
      const first = controls[0];
      const last = controls.at(-1);
      if (!first || !last) {
        event.preventDefault();
        panel.focus({ preventScroll: true });
      } else if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel)) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };
    document.addEventListener('focusin', onFocus);
    document.addEventListener('keydown', onKey, true);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('keydown', onKey, true);
      delete panel.dataset.uiModalActive;
      const index = scopes.indexOf(panel);
      if (index !== -1) scopes.splice(index, 1);
      if (root && !root.contains(panel)) root.inert = scopes.length > 0 || rootWasInert;
      requestAnimationFrame(() => {
        if (scopes.length > 0) {
          const top = scopes.at(-1)!;
          if (!top.contains(document.activeElement)) (visibleControls(top)[0] ?? top).focus({ preventScroll: true });
        } else {
          const target = returnFocus?.() ?? previousFocus;
          if (target?.isConnected && !target.closest('[inert]')) target.focus({ preventScroll: true });
        }
      });
    };
  }, [present, panelRef, returnFocus]);
}
