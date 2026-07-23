/**
 * Landing gate preference. Defaults to ON when unset so the app always boots
 * to the landing home page unless an explicit opt-out is persisted.
 */
export const LANDING_GATE_ENABLED_KEY = 'saudade:landing-gate-enabled';

export function isLandingGateEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  return window.localStorage.getItem(LANDING_GATE_ENABLED_KEY) !== '0';
}

export function persistLandingGateEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  if (enabled) {
    window.localStorage.setItem(LANDING_GATE_ENABLED_KEY, '1');
  } else {
    window.localStorage.setItem(LANDING_GATE_ENABLED_KEY, '0');
  }
}
