/**
 * Dev toggle for the intro landing gate. Defaults to OFF (gate hidden) when
 * unset, so the app boots straight into the workspace as it did before the
 * landing gate existed. Flip it on from the Radiance dev panel to preview the
 * gate on the next load/appear. Persisted in localStorage like the other
 * tuner settings.
 */
export const LANDING_GATE_ENABLED_KEY = 'saudade:landing-gate-enabled';

export function isLandingGateEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(LANDING_GATE_ENABLED_KEY) === '1';
}

export function persistLandingGateEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  if (enabled) {
    window.localStorage.setItem(LANDING_GATE_ENABLED_KEY, '1');
  } else {
    window.localStorage.removeItem(LANDING_GATE_ENABLED_KEY);
  }
}
